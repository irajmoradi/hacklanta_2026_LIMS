"""Extensions of one weekly goal; village locks serialize review and tier changes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field

from app import domain
from app.auth import member, require_member
from app.db import connection, many, one
from app.models import Input

router = APIRouter(prefix="/villages/{vid}/goals")
BONUS = 10  # Half the existing 20 XP/coin weekly goal reward, per tier.


class StretchInput(Input):
    title: str = Field(default="", max_length=140)


class StretchStatus(Input):
    status: str = Field(pattern="^done$")


async def attach(conn, goals):
    if not goals:
        return goals
    tiers = await many(
        conn,
        "SELECT * FROM goal_stretches WHERE goal_id=ANY(%s::uuid[]) ORDER BY tier",
        ([g["id"] for g in goals],),
    )
    grouped = {}
    for tier in tiers:
        grouped.setdefault(tier["goal_id"], []).append(tier)
    for goal in goals:
        goal["stretches"] = grouped.get(goal["id"], [])
        goal["stretch_bonus"] = sum(s["status"] == "done" for s in goal["stretches"])
    return goals


async def editable(conn, vid, gid):
    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
    goal = await one(
        conn, "SELECT * FROM goals WHERE id=%s AND village_id=%s FOR UPDATE", (gid, vid)
    )
    if not goal:
        raise HTTPException(404, "Goal not found")
    if goal["week_start"] != domain.monday() or await one(
        conn,
        "SELECT 1 FROM weekly_audits WHERE village_id=%s AND week_start=%s AND status='finalized'",
        (vid, goal["week_start"]),
    ):
        raise HTTPException(409, "This week's goals are closed")
    return goal


async def invalidate(conn, gid):
    await conn.execute("DELETE FROM weekly_grades WHERE goal_id=%s", (gid,))
    await conn.execute("DELETE FROM weekly_suggestions WHERE goal_id=%s", (gid,))


@router.post("/{gid}/stretch")
async def start(
    vid: UUID,
    gid: UUID,
    data: StretchInput,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    goal = await editable(conn, vid, gid)
    if goal["user_id"] != user["id"]:
        raise HTTPException(403, "Only the goal owner can go beyond")
    await attach(conn, [goal])
    title = data.title.strip() or goal["title"]
    active = next((s for s in goal["stretches"] if s["status"] == "active"), None)
    if active:
        if active["title"] == title:
            return goal
        raise HTTPException(409, "Finish your current stretch first")
    if goal["status"] != "done" or len(goal["stretches"]) >= 3:
        raise HTTPException(409, "Complete your goal first; maximum three stretch tiers per week")
    tier = len(goal["stretches"]) + 1
    await conn.execute(
        "INSERT INTO goal_stretches(goal_id,tier,title) VALUES(%s,%s,%s)", (gid, tier, title)
    )
    await conn.execute("UPDATE goals SET status='stretch' WHERE id=%s", (gid,))
    await invalidate(conn, gid)
    goal["status"] = "stretch"
    return (await attach(conn, [goal]))[0]


@router.post("/{gid}/stretch/{tier}/status")
async def finish(
    vid: UUID,
    gid: UUID,
    tier: int,
    data: StretchStatus,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    goal = await editable(conn, vid, gid)
    if goal["user_id"] != user["id"]:
        raise HTTPException(403, "Only the goal owner can finish a stretch")
    await require_member(conn, vid, user["id"], lock=True)
    stretch = await one(
        conn, "SELECT * FROM goal_stretches WHERE goal_id=%s AND tier=%s", (gid, tier)
    )
    if not stretch:
        raise HTTPException(404, "Stretch tier not found")
    if stretch["status"] != "done":
        await conn.execute(
            "UPDATE goal_stretches SET status='done',completed_at=now() "
            "WHERE goal_id=%s AND tier=%s",
            (gid, tier),
        )
        await conn.execute("UPDATE goals SET status='done' WHERE id=%s", (gid,))
        await domain.award(conn, vid, user["id"], BONUS, "goal_stretch", f"stretch:{gid}:{tier}")
        await domain.activity(
            conn,
            vid,
            user["id"],
            "stretch_completed",
            {
                "goal_id": str(gid),
                "tier": tier,
                "title": "Went above & beyond: " + stretch["title"],
                "bonus_xp": BONUS,
                "bonus_coins": BONUS,
            },
        )
        await invalidate(conn, gid)
        goal["status"] = "done"
    return (await attach(conn, [goal]))[0]
