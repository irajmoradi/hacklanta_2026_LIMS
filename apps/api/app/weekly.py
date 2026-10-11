"""Weekly human audits. Village locks serialize assignment, votes and settlement."""

import secrets
from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg.types.json import Jsonb

from app.auth import member, require_member
from app.competition_models import Grade, Vote
from app.db import connection, many, one
from app.domain import activity, award, monday
from app.mayor import Mayor
from app.security import LimitExceeded

router = APIRouter(prefix="/villages/{vid}/weekly")


async def choose_auditor(conn, vid, candidates):
    from app.domain import balance

    tickets = []
    for uid in candidates:
        tickets.extend([uid] * (1 + min(10, (await balance(conn, vid, uid)) // 100)))
    return secrets.choice(tickets)


async def week(conn, vid, start):
    if start.weekday() or start > monday():
        raise HTTPException(422, "Use a current or past UTC Monday")
    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
    row = await one(
        conn, "SELECT * FROM weekly_audits WHERE village_id=%s AND week_start=%s", (vid, start)
    )
    if row:
        return row
    if start != monday():
        raise HTTPException(404, "Week not initialized")
    previous = await many(
        conn,
        """SELECT w.auditor_id,a.user_id FROM weekly_audits w
        LEFT JOIN weekly_assignments a ON a.week_id=w.id
        WHERE w.village_id=%s AND w.week_start=%s""",
        (vid, start - timedelta(days=7)),
    )
    members = await many(
        conn, "SELECT user_id FROM village_members WHERE village_id=%s ORDER BY user_id", (vid,)
    )
    excluded = {uid for r in previous for uid in (r["auditor_id"], r["user_id"])}
    candidates = [r["user_id"] for r in members if r["user_id"] not in excluded]
    # A solo village cannot run a fair audited competition; keep an unassigned week.
    uid = await choose_auditor(conn, vid, candidates) if len(members) >= 2 and candidates else None
    row = await one(
        conn,
        "INSERT INTO weekly_audits(village_id,week_start,auditor_id) VALUES(%s,%s,%s) RETURNING *",
        (vid, start, uid),
    )
    if uid:
        await conn.execute("INSERT INTO weekly_assignments VALUES(%s,%s)", (row["id"], uid))
    await activity(
        conn,
        vid,
        uid,
        "weekly_auditor_assigned",
        {"week_id": str(row["id"]), "auditor_id": str(uid) if uid else None},
    )
    return row


def authorized(row, uid):
    if row["auditor_id"] != uid:
        raise HTTPException(403, "Assigned auditor required")


def open_week(row):
    if row["status"] != "open":
        raise HTTPException(409, "Week already finalized")


async def goal_for(conn, row, gid):
    goal = await one(
        conn,
        "SELECT * FROM goals WHERE id=%s AND village_id=%s AND week_start=%s",
        (gid, row["village_id"], row["week_start"]),
    )
    if not goal:
        raise HTTPException(404, "Goal not found in this week")
    excluded = await one(
        conn,
        "SELECT 1 FROM weekly_assignments WHERE week_id=%s AND user_id=%s",
        (row["id"], goal["user_id"]),
    )
    if excluded:
        raise HTTPException(409, "Auditors sit out this week")
    return goal


async def state(conn, row):
    row = dict(row)
    row["goals"] = await many(
        conn,
        """SELECT g.*,to_jsonb(s)->'suggestion' AS suggestion,
      to_jsonb(r) AS grade, a.user_id IS NOT NULL AS excluded
      FROM goals g LEFT JOIN weekly_grades r ON r.goal_id=g.id AND r.week_id=%s
      LEFT JOIN weekly_suggestions s ON s.goal_id=g.id AND s.week_id=%s
      LEFT JOIN weekly_assignments a ON a.user_id=g.user_id AND a.week_id=%s
      WHERE g.village_id=%s AND g.week_start=%s ORDER BY g.user_id""",
        (row["id"], row["id"], row["id"], row["village_id"], row["week_start"]),
    )
    from app.goal_stretch import attach

    await attach(conn, row["goals"])
    row["reading_bonus"] = await many(
        conn,
        """SELECT c.user_id,count(*)::int AS completed,
        (count(*) FILTER (WHERE c.awarded)*5)::int AS xp
        FROM reading_completions c JOIN reading_items i ON i.id=c.item_id
        WHERE i.village_id=%s AND i.week_start=%s GROUP BY c.user_id""",
        (row["village_id"], row["week_start"]),
    )
    row["votes"] = (
        await one(
            conn,
            "SELECT count(*) AS n FROM weekly_votes WHERE week_id=%s AND generation=%s",
            (row["id"], row["generation"]),
        )
    )["n"]
    row["stars"] = [
        r["user_id"]
        for r in await many(
            conn, "SELECT user_id FROM weekly_badges WHERE week_id=%s", (row["id"],)
        )
    ]
    return row


@router.get("/current")
async def current(vid: UUID, user=Depends(member), conn=Depends(connection, scope="function")):
    return await state(conn, await week(conn, vid, monday()))


@router.get("/{week_start}")
async def get_week(
    vid: UUID, week_start: date, user=Depends(member), conn=Depends(connection, scope="function")
):
    return await state(conn, await week(conn, vid, week_start))


@router.post("/{week_start}/goals/{gid}/suggestion")
async def suggest(
    vid: UUID,
    week_start: date,
    gid: UUID,
    request: Request,
    refresh: bool = False,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    row = await week(conn, vid, week_start)
    authorized(row, user["id"])
    open_week(row)
    goal = await goal_for(conn, row, gid)
    from app.goal_stretch import attach

    await attach(conn, [goal])
    cached = await one(
        conn,
        "SELECT suggestion,model FROM weekly_suggestions WHERE week_id=%s AND goal_id=%s",
        (row["id"], gid),
    )
    if cached and not refresh:
        return cached
    checkins = await many(
        conn,
        """SELECT c.body,c.kind,c.created_at,c.stretch_tier,
      (SELECT jsonb_build_object('verdict',r.verdict,'confidence',r.confidence,'reason',r.reason)
       FROM evidence_reviews r WHERE r.check_in_id=c.id ORDER BY r.created_at DESC,r.id DESC LIMIT
         1) AS review
      FROM check_ins c WHERE c.goal_id=%s AND c.village_id=%s AND c.user_id=%s
      AND c.created_at >= (%s::date::timestamp AT TIME ZONE 'UTC')
      AND c.created_at < (%s::date::timestamp AT TIME ZONE 'UTC')
      ORDER BY c.created_at DESC LIMIT 100""",
        (gid, vid, goal["user_id"], week_start, week_start + timedelta(days=7)),
    )
    llm = Mayor(request.app.state.settings)
    try:
        result = await llm.generate(
            Grade,
            "Suggest ambition, evidence_quality and progress scores 1..5, "
            "completed and rationale. Specific measurable ambitious goals, "
            "credible evidence, and demonstrated progress earn higher scores. "
            "Human auditor decides; never treat self-reported done as "
            "verification.",
            {"goal": goal, "check_ins": checkins},
        )
    except LimitExceeded:
        raise
    except Exception:
        result = Grade(
            ambition=1,
            evidence_quality=1,
            progress=1,
            completed=False,
            rationale="AI unavailable; human review required.",
        )
        llm.last_source = "fallback"
    await conn.execute(
        """INSERT INTO weekly_suggestions VALUES(%s,%s,%s,%s)
        ON CONFLICT(week_id,goal_id) DO UPDATE
        SET suggestion=excluded.suggestion,model=excluded.model""",
        (row["id"], gid, Jsonb(result.model_dump()), llm.last_source),
    )
    await activity(
        conn,
        vid,
        user["id"],
        "agent_decision",
        {
            "agent": "auditor",
            "action": "weekly_pregrade",
            "reason": result.rationale,
            "model": llm.last_source,
            "goal_id": str(gid),
            "target_user_id": str(goal["user_id"]),
        },
    )
    return {"suggestion": result.model_dump(), "model": llm.last_source}


@router.post("/{week_start}/goals/{gid}/grade")
async def grade(
    vid: UUID,
    week_start: date,
    gid: UUID,
    data: Grade,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    row = await week(conn, vid, week_start)
    authorized(row, user["id"])
    open_week(row)
    await goal_for(conn, row, gid)
    result = await one(
        conn,
        """INSERT INTO weekly_grades VALUES(%s,%s,%s,%s,%s,%s,%s,%s)
      ON CONFLICT(week_id,goal_id) DO UPDATE SET auditor_id=excluded.auditor_id,
ambition=excluded.ambition,evidence_quality=excluded.evidence_quality,progress=excluded.progress,
      completed=excluded.completed,rationale=excluded.rationale RETURNING *""",
        (
            row["id"],
            gid,
            user["id"],
            data.ambition,
            data.evidence_quality,
            data.progress,
            data.completed,
            data.rationale,
        ),
    )
    await activity(
        conn, vid, user["id"], "weekly_graded", {"goal_id": str(gid), **data.model_dump()}
    )
    return result


@router.post("/{week_start}/finalize")
async def finalize(
    vid: UUID, week_start: date, user=Depends(member), conn=Depends(connection, scope="function")
):
    row = await week(conn, vid, week_start)
    authorized(row, user["id"])
    if row["status"] == "finalized":
        return await state(conn, row)
    goals = (await state(conn, row))["goals"]
    eligible = [g for g in goals if not g["excluded"]]
    if any(not g["grade"] for g in eligible):
        raise HTTPException(409, "Grade all eligible goals before finalizing")
    completed = [g for g in eligible if g["grade"]["completed"]]
    # Sum rubric; stable UUID tiebreak, a single crown. Only completed goals can win.
    completed.sort(
        key=lambda g: (
            -(
                sum(g["grade"][k] for k in ("ambition", "evidence_quality", "progress"))
                + g["stretch_bonus"]
            ),
            str(g["user_id"]),
        )
    )
    from app.rewards import grant

    winner = completed[0]["user_id"] if completed else None
    for g in sorted(completed, key=lambda g: str(g["user_id"])):
        await require_member(conn, vid, g["user_id"], lock=True)
        await conn.execute(
            "INSERT INTO weekly_badges VALUES(%s,%s) ON CONFLICT DO NOTHING",
            (row["id"], g["user_id"]),
        )
        await activity(
            conn,
            vid,
            g["user_id"],
            "badge_earned",
            {"week_id": str(row["id"]), "title": "Weekly completion star"},
        )
        if g["user_id"] == winner:
            await award(conn, vid, winner, 100, "weekly_win", f"weekly:{row['id']}:{winner}")
    await grant(conn, vid, user["id"], "auditor")
    if winner:
        await grant(conn, vid, winner, "weekly_crown")
    row = await one(
        conn,
        "UPDATE weekly_audits SET "
        "status='finalized',winner_id=%s,finalized_at=now() WHERE id=%s RETURNING "
        "*",
        (winner, row["id"]),
    )
    await activity(
        conn,
        vid,
        user["id"],
        "weekly_finalized",
        {"week_id": str(row["id"]), "winner_id": str(winner) if winner else None},
    )
    return await state(conn, row)


@router.post("/{week_start}/insufficient")
async def insufficient(
    vid: UUID,
    week_start: date,
    data: Vote,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    row = await week(conn, vid, week_start)
    open_week(row)
    if data.generation != row["generation"]:
        raise HTTPException(409, "Stale auditor generation; refresh the week")
    if not row["auditor_id"] or user["id"] == row["auditor_id"]:
        raise HTTPException(403, "Only other villagers may vote")
    inserted = await one(
        conn,
        "INSERT INTO weekly_votes VALUES(%s,%s,%s) ON CONFLICT DO NOTHING RETURNING user_id",
        (row["id"], row["generation"], user["id"]),
    )
    if inserted:
        await activity(
            conn,
            vid,
            user["id"],
            "weekly_insufficient_vote",
            {"week_id": str(row["id"]), "generation": row["generation"]},
        )
    members = await many(conn, "SELECT user_id FROM village_members WHERE village_id=%s", (vid,))
    votes = (
        await one(
            conn,
            """SELECT count(*) AS n FROM weekly_votes v JOIN village_members m ON
              m.user_id=v.user_id AND m.village_id=%s WHERE week_id=%s AND generation=%s""",
            (vid, row["id"], row["generation"]),
        )
    )["n"]
    if votes > len(members) // 2:
        assigned = await many(
            conn, "SELECT user_id FROM weekly_assignments WHERE week_id=%s", (row["id"],)
        )
        excluded = {a["user_id"] for a in assigned}
        candidates = [m["user_id"] for m in members if m["user_id"] not in excluded]
        if not candidates:
            raise HTTPException(409, "No unused replacement auditor remains")
        replacement = await choose_auditor(conn, vid, candidates)
        await conn.execute(
            "INSERT INTO auditor_penalties(week_id,user_id) VALUES(%s,%s) ON CONFLICT DO NOTHING",
            (row["id"], row["auditor_id"]),
        )
        await conn.execute("INSERT INTO weekly_assignments VALUES(%s,%s)", (row["id"], replacement))
        await conn.execute("DELETE FROM weekly_grades WHERE week_id=%s", (row["id"],))
        row = await one(
            conn,
            "UPDATE weekly_audits SET auditor_id=%s,generation=generation+1 WHERE "
            "id=%s RETURNING *",
            (replacement, row["id"]),
        )
        await activity(
            conn,
            vid,
            user["id"],
            "weekly_auditor_replaced",
            {
                "week_id": str(row["id"]),
                "auditor_id": str(replacement),
                "penalty": "pet_sad",
                "duration_days": 7,
            },
        )
    return await state(conn, row)
