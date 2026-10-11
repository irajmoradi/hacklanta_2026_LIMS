"""Private villager mail. User text is data, never a model instruction."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from app import domain
from app.auth import member, require_member
from app.db import connection, many, one

router = APIRouter()


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    to_user_id: UUID
    text: str = Field(min_length=1, max_length=2000)
    kind: Literal["message", "poke", "cheer"] = "message"


@router.post("/villages/{vid}/messages", status_code=201)
async def send(
    vid: UUID,
    data: Message,
    request: Request,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    if data.to_user_id == user["id"]:
        raise HTTPException(422, "Choose another villager")
    # Global sender lock makes the cross-village rate limit safe under concurrency.
    await conn.execute("SELECT id FROM users WHERE id=%s FOR NO KEY UPDATE", (user["id"],))
    await require_member(conn, vid, data.to_user_id)
    count = await one(
        conn,
        """SELECT count(*) AS n FROM villager_messages
        WHERE from_user_id=%s AND created_at>now()-interval '1 minute'""",
        (user["id"],),
    )
    if count["n"] >= 20:
        raise HTTPException(429, "Twenty messages per minute", headers={"Retry-After": "60"})
    row = await one(
        conn,
        """INSERT INTO villager_messages
        (village_id,from_user_id,to_user_id,text,kind) VALUES (%s,%s,%s,%s,%s) RETURNING *""",
        (vid, user["id"], data.to_user_id, data.text, data.kind),
    )
    if data.kind != "message":
        await domain.activity(
            conn,
            vid,
            user["id"],
            data.kind,
            {"message_id": str(row["id"]), "to_user_id": str(data.to_user_id), "text": data.text},
        )
    recipient = await one(
        conn,
        "SELECT 1 FROM users WHERE id=%s AND agent_msgs_ok AND phone_e164 IS NOT NULL",
        (data.to_user_id,),
    )
    if recipient:
        from app.security import charge

        charge(request.app.state.settings, "photon_queue")
    await conn.execute(
        """INSERT INTO mayor_outbox
        (village_id,user_id,phone_e164,text,kind,villager_message_id)
        SELECT %s,id,phone_e164,%s,'villager_message',%s FROM users
        WHERE id=%s AND agent_msgs_ok AND phone_e164 IS NOT NULL""",
        (vid, f"via Village from {user['display_name']}: {data.text}", row["id"], data.to_user_id),
    )
    return row


@router.get("/villages/{vid}/messages")
async def messages(
    vid: UUID,
    box: Literal["inbox", "outbox"] = "inbox",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    column = "to_user_id" if box == "inbox" else "from_user_id"
    rows = await many(
        conn,
        f"""SELECT * FROM villager_messages WHERE village_id=%s
        AND {column}=%s ORDER BY created_at DESC,id DESC LIMIT %s OFFSET %s""",
        (vid, user["id"], limit, offset),
    )
    return {"messages": rows, **await unread(vid, user, conn)}


@router.get("/villages/{vid}/messages/unread")
async def unread(vid: UUID, user=Depends(member), conn=Depends(connection, scope="function")):
    return await one(
        conn,
        """SELECT count(*) AS unread_count FROM villager_messages
        WHERE village_id=%s AND to_user_id=%s AND read_at IS NULL""",
        (vid, user["id"]),
    )


@router.post("/villages/{vid}/messages/{message_id}/read")
async def mark_read(
    vid: UUID, message_id: UUID, user=Depends(member), conn=Depends(connection, scope="function")
):
    row = await one(
        conn,
        """UPDATE villager_messages SET read_at=COALESCE(read_at,now())
        WHERE id=%s AND village_id=%s AND to_user_id=%s RETURNING *""",
        (message_id, vid, user["id"]),
    )
    if not row:
        raise HTTPException(404, "Message not found")
    return row
