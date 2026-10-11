from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth import member
from app.db import connection, many, one

router = APIRouter(prefix="/villages/{vid}")
PALETTE = ("🎉", "🔥", "👏", "💪", "❤️", "😂", "🤯", "👑")


class ReactionInput(BaseModel):
    target_kind: Literal["activity", "goal", "check_in"]
    target_id: UUID
    emoji: Literal["🎉", "🔥", "👏", "💪", "❤️", "😂", "🤯", "👑"]


async def attach(conn, vid, uid, rows, kind=None):
    """One aggregate query for a whole page, with viewer-specific mine flags."""
    if not rows:
        return rows
    ids = [r["id"] if kind else r["target_id"] for r in rows]
    counts = await many(
        conn,
        """SELECT target_kind,target_id,emoji,count(*)::int AS count,
        bool_or(user_id=%s) AS mine FROM reactions
        WHERE village_id=%s AND target_id=ANY(%s::uuid[])
        GROUP BY target_kind,target_id,emoji""",
        (uid, vid, ids),
    )
    grouped = {}
    for r in counts:
        grouped.setdefault((r["target_kind"], r["target_id"]), []).append(
            {k: r[k] for k in ("emoji", "count", "mine")}
        )
    for row in rows:
        key = (kind or row["target_kind"], row["id"] if kind else row["target_id"])
        row["reactions"] = sorted(grouped.get(key, []), key=lambda r: PALETTE.index(r["emoji"]))
    return rows


async def change(conn, vid, uid, data, remove=False):
    table = {"activity": "activity_events", "goal": "goals", "check_in": "check_ins"}[
        data.target_kind
    ]
    # Table name comes only from the fixed mapping. Lock serializes concurrent toggles.
    target = await one(
        conn,
        f"SELECT id FROM {table} WHERE village_id=%s AND id=%s FOR UPDATE",
        (vid, data.target_id),
    )
    if not target:
        raise HTTPException(404, "Reaction target not found in this village")
    if data.target_kind == "activity":
        from app.domain import monday
        reading = await one(
            conn,
            "SELECT i.week_start FROM reading_completions c "
            "JOIN reading_items i ON i.id=c.item_id WHERE c.activity_id=%s",
            (data.target_id,),
        )
        if reading and reading["week_start"] != monday():
            raise HTTPException(409, "Past reading weeks are read-only")
    params = (vid, data.target_kind, data.target_id, uid, data.emoji)
    if remove:
        await conn.execute(
            """DELETE FROM reactions WHERE village_id=%s AND target_kind=%s
            AND target_id=%s AND user_id=%s AND emoji=%s""",
            params,
        )
    else:
        await conn.execute(
            """INSERT INTO reactions(village_id,target_kind,target_id,user_id,emoji)
            VALUES(%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
            params,
        )
    return (await attach(conn, vid, uid, [target], data.target_kind))[0]["reactions"]


@router.post("/reactions")
async def add_reaction(
    vid: UUID, data: ReactionInput, user=Depends(member), conn=Depends(connection, scope="function")
):
    return await change(conn, vid, user["id"], data)


@router.delete("/reactions")
async def remove_reaction(
    vid: UUID, data: ReactionInput, user=Depends(member), conn=Depends(connection, scope="function")
):
    return await change(conn, vid, user["id"], data, remove=True)


@router.get("/accomplishments")
async def accomplishments(
    vid: UUID,
    limit: int = Query(50, ge=1, le=200),
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    rows = await many(
        conn,
        """SELECT a.*,u.display_name FROM (
        SELECT id,'goal'::text AS target_kind,id AS target_id,user_id,
          'goal_completed'::text AS type,title,COALESCE(completed_at,created_at) AS created_at
        FROM goals WHERE village_id=%s AND (status='done' OR status='stretch')
        UNION ALL
        SELECT id,'activity',id,user_id,type,
          COALESCE(payload->>'title','Reached level ' || (payload->>'level')),created_at
        FROM activity_events WHERE village_id=%s
          AND type IN ('competition_won','level_up','badge_earned',
                       'stretch_completed','reading_completed')
        ) a JOIN users u ON u.id=a.user_id
        ORDER BY created_at DESC,id DESC LIMIT %s""",
        (vid, vid, limit),
    )
    return await attach(conn, vid, user["id"], rows)
