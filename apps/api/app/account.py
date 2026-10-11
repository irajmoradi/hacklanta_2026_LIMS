"""Explicit self-erasure, including non-FK history and locally owned artifacts."""

import shutil
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg import sql
from pydantic import BaseModel, ConfigDict

from app import presence, voice
from app.auth import current_user
from app.db import connection, many, one

router = APIRouter()


class DeleteAccount(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: Literal["DELETE"]


def erase_path(root, key):
    """Only server-constructed owned paths; refuse symlinks escaping asset storage."""
    root = root.resolve()
    path = root / key
    resolved = path.resolve()
    if resolved == root or not resolved.is_relative_to(root):
        raise HTTPException(409, "Asset path is outside storage")
    if path.is_symlink():
        path.unlink()
    elif path.is_dir():
        # Check descendants as Windows junctions can otherwise escape the asset root.
        if any(not child.resolve().is_relative_to(root) for child in path.rglob("*")):
            raise HTTPException(409, "Asset path is outside storage")
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)


@router.delete("/me")
async def delete_me(
    data: DeleteAccount,
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    uid = user["id"]
    settings = request.app.state.settings
    # Stable order also serializes simultaneous owners leaving and concurrent joins.
    villages = await many(
        conn,
        """SELECT v.id,m.role FROM villages v
        JOIN village_members m ON m.village_id=v.id WHERE m.user_id=%s
        ORDER BY v.id FOR UPDATE OF v""",
        (uid,),
    )
    await conn.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (uid,))
    # The bridge claims with UPDATE. Prevent new claims until queued jobs are erased.
    await conn.execute("LOCK TABLE avatar_jobs IN SHARE ROW EXCLUSIVE MODE")
    groups = await many(
        conn,
        """SELECT g.job_id,g.village_id FROM group_photos g
        JOIN avatar_jobs j ON j.id=g.job_id WHERE j.user_id=%s OR (%s AND EXISTS
        (SELECT 1 FROM group_photo_claims c WHERE c.job_id=g.job_id AND c.user_id=%s))""",
        (uid, user["auth_issuer"] != "village-demo-guest", uid),
    )
    group_ids = [g["job_id"] for g in groups]
    running = await one(
        conn,
        """SELECT id FROM avatar_jobs WHERE status='running'
        AND (user_id=%s OR id=ANY(%s::uuid[]) OR input->>'group_job_id'=ANY(%s::text[])
        OR input->>'audio_key' LIKE %s) LIMIT 1""",
        (uid, group_ids, [str(g) for g in group_ids], f"voice/{uid}/%"),
    )
    if running:
        raise HTTPException(409, "Avatar processing is running; retry deletion when it finishes")
    # Provider failure leaves DB/files intact. Adapter treats an already absent clone as success.
    await voice.delete_clone(conn, settings, user)
    gram_files = await many(
        conn,
        """SELECT id,village_id FROM villagergrams
        WHERE sender_id=%s OR speaker_id=%s OR recipient_id=%s""",
        (uid, uid, uid),
    )
    await conn.execute(
        "DELETE FROM voice_lines WHERE id=ANY(%s::uuid[])", ([g["id"] for g in gram_files],)
    )

    for table in ("evidence_reviews", "check_in_keys"):
        await conn.execute(
            sql.SQL(
                "DELETE FROM {} WHERE check_in_id IN (SELECT id FROM check_ins WHERE user_id=%s)"
            ).format(sql.Identifier(table)),
            (uid,),
        )
    await conn.execute("DELETE FROM check_ins WHERE user_id=%s", (uid,))
    await conn.execute(
        """DELETE FROM activity_events WHERE user_id=%s
        OR payload::text LIKE %s""",
        (uid, f"%{uid}%"),
    )
    await conn.execute("DELETE FROM inbound_messages WHERE response::text LIKE %s", (f"%{uid}%",))
    for table in ("weekly_assignments", "weekly_votes", "weekly_badges", "auditor_penalties"):
        await conn.execute(
            sql.SQL("DELETE FROM {} WHERE user_id=%s").format(sql.Identifier(table)), (uid,)
        )
    await conn.execute("DELETE FROM weekly_grades WHERE auditor_id=%s", (uid,))
    await conn.execute("UPDATE weekly_audits SET auditor_id=NULL WHERE auditor_id=%s", (uid,))
    await conn.execute("UPDATE weekly_audits SET winner_id=NULL WHERE winner_id=%s", (uid,))
    # A nonfriendly competition cannot have a null auditor under its existing contract.
    await conn.execute("DELETE FROM competitions WHERE creator_id=%s OR auditor_id=%s", (uid, uid))
    await conn.execute("DELETE FROM competition_entries WHERE user_id=%s", (uid,))
    await conn.execute("DELETE FROM competition_participants WHERE user_id=%s", (uid,))
    await conn.execute(
        "UPDATE competitions SET result=NULL WHERE result::text LIKE %s", (f"%{uid}%",)
    )
    # Remove source group photos containing this member; peers retain copied avatar assets.
    await conn.execute(
        "DELETE FROM group_photo_claims WHERE job_id=ANY(%s::uuid[]) OR user_id=%s",
        (group_ids, uid),
    )
    await conn.execute(
        """UPDATE voice_lines SET job_id=NULL WHERE job_id IN
        (SELECT id FROM avatar_jobs WHERE user_id=%s OR input->>'audio_key' LIKE %s)""",
        (uid, f"voice/{uid}/%"),
    )
    # Cancel queued copies whose source group photo is being erased.
    await conn.execute(
        "DELETE FROM avatar_jobs WHERE input->>'group_job_id'=ANY(%s::text[])",
        ([str(g) for g in group_ids],),
    )
    await conn.execute("DELETE FROM avatar_jobs WHERE id=ANY(%s::uuid[])", (group_ids,))
    await conn.execute("DELETE FROM voice_lines WHERE user_id=%s", (uid,))
    await conn.execute("DELETE FROM mayor_outbox WHERE audio_key LIKE %s", (f"voice/{uid}/%",))
    # Other users may have expression jobs referencing a line spoken by this account.
    await conn.execute(
        "DELETE FROM avatar_jobs WHERE input->>'audio_key' LIKE %s", (f"voice/{uid}/%",)
    )

    for village in villages:
        vid = village["id"]
        successor = await one(
            conn,
            """SELECT user_id FROM village_members
            WHERE village_id=%s AND user_id<>%s ORDER BY joined_at,user_id LIMIT 1""",
            (vid, uid),
        )
        if successor and village["role"] == "owner":
            await conn.execute(
                "UPDATE village_members SET role='owner' WHERE village_id=%s AND user_id=%s",
                (vid, successor["user_id"]),
            )
        elif not successor:
            await conn.execute(
                "DELETE FROM evidence_reviews WHERE check_in_id IN "
                "(SELECT id FROM check_ins WHERE village_id=%s)",
                (vid,),
            )
            await conn.execute(
                "DELETE FROM check_in_keys WHERE check_in_id IN "
                "(SELECT id FROM check_ins WHERE village_id=%s)",
                (vid,),
            )
            await conn.execute("DELETE FROM check_ins WHERE village_id=%s", (vid,))
            await conn.execute("DELETE FROM activity_events WHERE village_id=%s", (vid,))
            await conn.execute("DELETE FROM villages WHERE id=%s", (vid,))

    await conn.execute("DELETE FROM users WHERE id=%s", (uid,))
    audit = await one(conn, "INSERT INTO account_deletion_audit DEFAULT VALUES RETURNING id")
    # No caller-supplied file paths. Include uploaded-but-never-submitted evidence.
    keys = [f"{prefix}/{uid}" for prefix in ("uploads", "avatars", "voice", "items")]
    keys += [f"evidence/{v['id']}/{uid}" for v in villages]
    keys += [
        f"{prefix}/{g['village_id']}/{g['job_id']}" for g in groups for prefix in ("group-photos",)
    ]
    keys += [f"villages/{g['village_id']}/group/{g['job_id']}" for g in groups]
    keys += [
        f"villages/{g['village_id']}/grams/{g['id']}.{ext}"
        for g in gram_files
        for ext in ("mp3", "png")
    ]
    try:
        for key in keys:
            erase_path(settings.asset_dir, key)
    except OSError:
        raise HTTPException(503, "Asset cleanup failed; retry account deletion") from None
    presence.state(request.app).remove(uid)
    return {"deleted": True, "audit_id": audit["id"]}
