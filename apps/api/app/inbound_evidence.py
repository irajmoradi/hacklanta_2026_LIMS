"""Service-authenticated photo routing using existing entry/check-in review workflows."""

import hashlib
import io
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile
from psycopg.types.json import Jsonb

from app import competitions, domain
from app.assets import MAX_UPLOAD, save_image
from app.competition_models import Entry
from app.db import many, one
from app.inbound import reply
from app.inbound_queries import joined_competitions
from app.models import CheckInInput


async def registered(conn, phone):
    users = await many(conn, "SELECT * FROM users WHERE phone_e164=%s", (phone,))
    if len(users) != 1:
        return None, None
    user = users[0]
    from app.security import set_seat

    set_seat(user["id"])
    membership = await one(
        conn,
        """SELECT village_id FROM village_members WHERE user_id=%s
        ORDER BY joined_at,village_id LIMIT 1""",
        (user["id"],),
    )
    if membership:
        await conn.execute(
            "SELECT id FROM villages WHERE id=%s FOR UPDATE", (membership["village_id"],)
        )
    return user, membership["village_id"] if membership else None


def invitation():
    return reply("Join the village first — ask your village owner for an invite.")


def choices_reply(choices):
    return reply(
        "Which competition is this evidence for? Reply with a number within 10 minutes "
        "(or cancel):\n" + "\n".join(f"{i}. {c['title']}" for i, c in enumerate(choices, 1))
    )


async def pending(conn, uid):
    await conn.execute(
        "DELETE FROM inbound_evidence_pending WHERE user_id=%s AND expires_at<=now()", (uid,)
    )
    return await one(
        conn, "SELECT * FROM inbound_evidence_pending WHERE user_id=%s FOR UPDATE", (uid,)
    )


async def submit_image(conn, request, background, user, vid, item, competition=None):
    if competition:
        await competitions.submit(
            vid,
            UUID(str(competition["id"])),
            Entry(body=item["caption"], evidence_asset_id=item["key"], idempotency_key=item["id"]),
            request,
            background,
            user,
            conn,
        )
        title = competition["title"]
        processed = False
    else:
        goal = await one(
            conn,
            """SELECT * FROM goals WHERE village_id=%s AND user_id=%s
            AND week_start=%s AND status='active'""",
            (vid, user["id"], domain.monday()),
        )
        if not goal:
            return reply("Set an active weekly goal with goal: <text>, then send your photo again.")
        from app.main import check_ins

        await check_ins(
            vid,
            CheckInInput(
                kind="progress",
                body=item["caption"],
                goal_id=goal["id"],
                evidence_asset_id=item["key"],
                idempotency_key=item["id"],
            ),
            request,
            background,
            user,
            conn,
        )
        title, processed = goal["title"], True
    return reply(f"📸 Logged as evidence for '{title}' — the auditor will review it.", processed)


async def choose(text, conn, request, background, user, vid):
    if not (text.isdecimal() or text.lower() == "cancel"):
        return None
    # Same lock order as uploads, so photos and choices cannot overtake each other.
    await conn.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (user["id"],))
    row = await pending(conn, user["id"])
    if not row or row["village_id"] != vid:
        return reply("No photo is waiting for a choice. Send your photo again.")
    if text.lower() == "cancel":
        await conn.execute("DELETE FROM inbound_evidence_pending WHERE user_id=%s", (user["id"],))
        return reply("Photo selection cancelled.")
    if len(text) > 3 or not 1 <= int(text) <= len(row["choices"]):
        return choices_reply(row["choices"])
    selected = row["choices"][int(text) - 1]
    current = await joined_competitions(conn, vid, user["id"], True)
    if not any(str(c["id"]) == selected["id"] for c in current):
        await conn.execute("DELETE FROM inbound_evidence_pending WHERE user_id=%s", (user["id"],))
        return reply(
            "That competition is no longer available. Send your photo again to choose anew."
        )
    for item in row["images"]:
        result = await submit_image(conn, request, background, user, vid, item, selected)
    await conn.execute("DELETE FROM inbound_evidence_pending WHERE user_id=%s", (user["id"],))
    if len(row["images"]) > 1:
        result["reply_text"] += f" ({len(row['images'])} photos.)"
    return result


async def upload(phone, caption, message_id, file, request, background, conn):
    user, vid = await registered(conn, phone)
    if not user or not vid:
        await file.close()
        return invitation()
    if caption.strip().upper() == "STOP":
        from app.inbound import command
        from app.models import Inbound

        await file.close()
        result = await command(Inbound(phone_e164=phone, text="STOP"), request, conn, background)
        # Like the text endpoint, opt-out must survive an exhausted reply allowance.
        await conn.commit()
        return result
    if not (file.content_type or "").lower().startswith("image/"):
        await file.close()
        raise HTTPException(415, "Image attachments only")
    try:
        content = await file.read(MAX_UPLOAD + 1)
    finally:
        await file.close()
    if len(content) > MAX_UPLOAD:
        raise HTTPException(413, "Image exceeds 10 MiB")
    fingerprint = hashlib.sha256(
        phone.encode() + b"\0" + caption.encode() + b"\0" + content
    ).hexdigest()
    mid = "evidence:" + (message_id or str(uuid4()))
    inserted = await one(
        conn,
        """INSERT INTO inbound_messages(message_id,request_hash) VALUES (%s,%s)
        ON CONFLICT DO NOTHING RETURNING message_id""",
        (mid, fingerprint),
    )
    if not inserted:
        prior = await one(conn, "SELECT * FROM inbound_messages WHERE message_id=%s", (mid,))
        if prior["request_hash"] != fingerprint:
            raise HTTPException(409, "Message ID already used")
        return prior["response"]
    choices = await joined_competitions(conn, vid, user["id"], True)
    row = await pending(conn, user["id"])
    if row and row["village_id"] != vid:
        await conn.execute("DELETE FROM inbound_evidence_pending WHERE user_id=%s", (user["id"],))
        row = None
    if row and len(row["images"]) >= 20:
        raise HTTPException(409, "Choose a competition before sending more photos")
    key, _ = await save_image(
        request.app.state.settings, UploadFile(io.BytesIO(content)), f"evidence/{vid}/{user['id']}"
    )
    try:
        await domain.activity(
            conn, vid, user["id"], "evidence_uploaded", {"evidence_asset_id": key}
        )
        from app.inbound_play import route

        routed = (
            await route(caption, conn, request, background, user, vid, mid, key)
            if caption.strip() and not caption.lower().startswith("checkin:")
            else None
        )
        if routed is not None:
            await conn.execute(
                "UPDATE inbound_messages SET response=%s WHERE message_id=%s", (Jsonb(routed), mid)
            )
            return routed
        verb, separator, body = caption.partition(":")
        caption = (
            body.strip()
            if separator and verb.lower().strip() in {"checkin", "progress"}
            else caption
        )
        item = {
            "key": key,
            "caption": caption.strip() or "Photo evidence via iMessage",
            "id": "imessage-photo:" + hashlib.sha256(mid.encode()).hexdigest(),
        }
        if len(choices) > 1 or row:
            options = (
                row["choices"]
                if row
                else [{"id": str(c["id"]), "title": c["title"]} for c in choices]
            )
            images = [*row["images"], item] if row else [item]
            await conn.execute(
                """INSERT INTO inbound_evidence_pending
                VALUES (%s,%s,%s,%s,now()+interval '10 minutes')
                ON CONFLICT (user_id) DO UPDATE SET images=EXCLUDED.images""",
                (user["id"], vid, Jsonb(options), Jsonb(images)),
            )
            result = choices_reply(options)
        else:
            result = await submit_image(
                conn, request, background, user, vid, item, choices[0] if choices else None
            )
        await conn.execute(
            "UPDATE inbound_messages SET response=%s WHERE message_id=%s", (Jsonb(result), mid)
        )
        return result
    except Exception:
        (request.app.state.settings.asset_dir / key).unlink(missing_ok=True)
        raise
