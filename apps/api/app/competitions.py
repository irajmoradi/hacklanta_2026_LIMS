"""Opt-in competitions. Lamports and fees are intent metadata, never payments."""

import mimetypes
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from psycopg.types.json import Jsonb

from app import auditor
from app.assets import asset_path
from app.auth import member, require_member
from app.competition_models import CompetitionCreate, Entry, EntryDecision
from app.competition_scoring import score_competition
from app.db import connection, many, one
from app.domain import activity, award, coin_award, coin_balance
from app.mayor import MODEL
from app.models import EvidenceReview
from app.payouts import projection

router = APIRouter(prefix="/villages/{vid}/competitions")


async def competition(conn, vid, cid):
    row = await one(
        conn, "SELECT * FROM competitions WHERE id=%s AND village_id=%s FOR UPDATE", (cid, vid)
    )
    if not row:
        raise HTTPException(404, "Competition not found")
    return row


def opened(row):
    if row["status"] != "open":
        raise HTTPException(409, "Competition already settled")


async def details(conn, row):
    detail = {
        **row,
        "participants": await many(
            conn,
            "SELECT * FROM competition_participants WHERE competition_id=%s "
            "ORDER BY chain_join_index NULLS LAST,joined_at,user_id",
            (row["id"],),
        ),
        "entries": await many(
            conn,
            "SELECT * FROM competition_entries WHERE competition_id=%s ORDER BY created_at,id",
            (row["id"],),
        ),
    }

    detail["projected_payouts"] = projection(row, detail["participants"], detail["entries"])
    return detail


@router.get("")
async def listing(vid: UUID, user=Depends(member), conn=Depends(connection, scope="function")):
    return await many(
        conn, "SELECT * FROM competitions WHERE village_id=%s ORDER BY created_at DESC,id", (vid,)
    )


@router.post("")
async def create(
    vid: UUID,
    data: CompetitionCreate,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    if data.deadline and data.deadline <= datetime.now(UTC):
        raise HTTPException(422, "Deadline must be in the future")
    uid = data.auditor_id
    if not data.friendly:
        if uid:
            await require_member(conn, vid, uid)
        else:
            candidates = await many(
                conn,
                "SELECT user_id FROM village_members WHERE village_id=%s AND user_id<>%s",
                (vid, user["id"]),
            )
            if not candidates:
                raise HTTPException(409, "An audited competition needs another villager")
            from app.weekly import choose_auditor

            uid = await choose_auditor(conn, vid, [c["user_id"] for c in candidates])
    row = await one(
        conn,
        """INSERT INTO
          competitions(village_id,creator_id,title,terms,friendly,auditor_id,entry_lamports,auditor_fee_bps,scoring,unit,target,payout_mode,ranked_bps,entry_coins,deadline)
      VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
        (
            vid,
            user["id"],
            data.title,
            data.terms,
            data.friendly,
            uid,
            data.entry_lamports,
            data.auditor_fee_bps,
            data.scoring,
            data.unit,
            data.target,
            data.payout_mode,
            data.ranked_bps,
            data.entry_coins,
            data.deadline,
        ),
    )
    await activity(
        conn,
        vid,
        user["id"],
        "competition_created",
        {"competition_id": str(row["id"]), "title": data.title},
    )
    return await details(conn, row)


@router.get("/{cid}")
async def get(
    vid: UUID, cid: UUID, user=Depends(member), conn=Depends(connection, scope="function")
):
    return await details(conn, await competition(conn, vid, cid))


@router.post("/{cid}/join")
async def join(
    vid: UUID, cid: UUID, user=Depends(member), conn=Depends(connection, scope="function")
):
    row = await competition(conn, vid, cid)
    opened(row)
    if row["entry_lamports"]:
        raise HTTPException(409, "Join with a confirmed devnet wallet transaction")
    if row.get("deadline") and row["deadline"] <= datetime.now(UTC):
        raise HTTPException(409, "Entry closed")
    if user["id"] == row["auditor_id"]:
        raise HTTPException(409, "Auditor cannot enter their competition")
    existing = await one(
        conn,
        "SELECT 1 FROM competition_participants WHERE competition_id=%s AND user_id=%s",
        (cid, user["id"]),
    )
    if not existing and row["entry_coins"]:
        await require_member(conn, vid, user["id"], lock=True)
        if await coin_balance(conn, vid, user["id"]) < row["entry_coins"]:
            raise HTTPException(409, "Not enough coins")
        await coin_award(
            conn,
            vid,
            user["id"],
            -row["entry_coins"],
            "competition_entry",
            f"entry:{cid}:{user['id']}",
        )
    added = await one(
        conn,
        """INSERT INTO competition_participants
          (competition_id,user_id,entry_lamports_intent) VALUES(%s,%s,%s)
      ON CONFLICT DO NOTHING RETURNING *""",
        (cid, user["id"], row["entry_lamports"]),
    )
    if added:
        await activity(
            conn,
            vid,
            user["id"],
            "competition_joined",
            {"competition_id": str(cid), "entry_lamports_intent": row["entry_lamports"]},
        )
    return await details(conn, row)


async def review_entry(pool, settings, eid):
    async with pool.connection() as conn:
        row = await one(
            conn,
            """SELECT e.*,c.village_id,c.title,c.terms FROM competition_entries e
          JOIN competitions c ON c.id=e.competition_id WHERE e.id=%s""",
            (eid,),
        )
        if not row or row["review"] is not None or not row["evidence_asset_id"]:
            return
    model = MODEL
    try:
        path = asset_path(settings, row["evidence_asset_id"])
        auditor.budget.village_context.set(row["village_id"])
        result = await auditor.vision(
            settings,
            path.read_bytes(),
            mimetypes.guess_type(path.name)[0] or "image/png",
            {"goal": row["title"], "detail": row["terms"], "check_in": row["body"]},
        )
    except Exception:
        model = "fallback"
        result = EvidenceReview(
            verdict="error", confidence=0, reason="AI unavailable; human auditor review required."
        )
    async with pool.connection() as conn:
        stored = await one(
            conn,
            "UPDATE competition_entries SET review=%s WHERE id=%s AND review IS NULL RETURNING id",
            (Jsonb({**result.model_dump(), "model": model}), eid),
        )
        if stored:
            await activity(
                conn,
                row["village_id"],
                row["user_id"],
                "agent_decision",
                {
                    "agent": "auditor",
                    "action": "competition_evidence_review",
                    "reason": result.reason,
                    "model": model,
                    "entry_id": str(eid),
                    "target_user_id": str(row["user_id"]),
                },
            )


@router.post("/{cid}/entries")
async def submit(
    vid: UUID,
    cid: UUID,
    data: Entry,
    request: Request,
    background: BackgroundTasks,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    row = await competition(conn, vid, cid)
    opened(row)
    if row.get("settlement_snapshot") or (
        row.get("deadline") and row["deadline"] <= datetime.now(UTC)
    ):
        raise HTTPException(409, "Evidence submission closed")
    if not await one(
        conn,
        "SELECT 1 FROM competition_participants WHERE competition_id=%s AND user_id=%s",
        (cid, user["id"]),
    ):
        raise HTTPException(403, "Opt in before entering")
    prior = await one(
        conn,
        "SELECT * FROM competition_entries WHERE competition_id=%s AND user_id=%s "
        "AND idempotency_key=%s",
        (cid, user["id"], data.idempotency_key),
    )
    if prior:
        if prior["review"] is None and prior["evidence_asset_id"] and not row["friendly"]:
            from app.security import charge

            if getattr(request.app.state.settings, "google_api_key", ""):
                charge(request.app.state.settings, "llm", consume=False)
            background.add_task(
                review_entry, request.app.state.pool, request.app.state.settings, prior["id"]
            )
        return prior
    numeric = row["scoring"] == "scoreboard" or (row["scoring"] == "ordinal" and row["target"])
    if numeric and data.value is None:
        raise HTTPException(422, "This competition requires a claimed value")
    if row["scoring"] == "cumulative" and data.value is not None:
        raise HTTPException(422, "Cumulative entries use points")
    claimed = data.value if numeric else (1 if row["scoring"] == "ordinal" else None)
    if not row["friendly"] and not data.evidence_asset_id:
        raise HTTPException(422, "Photo evidence required")
    if data.evidence_asset_id:
        owned = await one(
            conn,
            """SELECT 1 FROM activity_events WHERE village_id=%s AND user_id=%s
          AND type='evidence_uploaded' AND payload->>'evidence_asset_id'=%s""",
            (vid, user["id"], data.evidence_asset_id),
        )
        if not owned:
            raise HTTPException(422, "Upload your own evidence in this village")
        asset_path(request.app.state.settings, data.evidence_asset_id)
    entry = await one(
        conn,
        """INSERT INTO
          competition_entries(competition_id,user_id,body,evidence_asset_id,idempotency_key,decision,points,claimed_value,value,confirmed_at)
      VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,CASE WHEN %s THEN now() END) RETURNING *""",
        (
            cid,
            user["id"],
            data.body,
            data.evidence_asset_id,
            data.idempotency_key,
            "confirmed" if row["friendly"] else "pending",
            1 if row["friendly"] else 0,
            claimed,
            claimed if row["friendly"] else None,
            row["friendly"],
        ),
    )
    await activity(
        conn,
        vid,
        user["id"],
        "competition_entry_submitted",
        {"competition_id": str(cid), "entry_id": str(entry["id"])},
    )
    if not row["friendly"]:
        from app.security import charge

        if getattr(request.app.state.settings, "google_api_key", ""):
            charge(request.app.state.settings, "llm", consume=False)
        background.add_task(
            review_entry, request.app.state.pool, request.app.state.settings, entry["id"]
        )
    return entry


@router.post("/{cid}/entries/{eid}/decision")
async def decide(
    vid: UUID,
    cid: UUID,
    eid: UUID,
    data: EntryDecision,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    row = await competition(conn, vid, cid)
    opened(row)
    if row.get("settlement_snapshot"):
        raise HTTPException(409, "Scores frozen for on-chain settlement")
    if user["id"] != row["auditor_id"]:
        raise HTTPException(403, "Assigned auditor required")
    value = data.value
    if data.decision == "confirmed" and row["scoring"] != "cumulative":
        if row["scoring"] == "ordinal" and row["target"] is None:
            value = 1
        elif value is None:
            raise HTTPException(422, "Confirm a numeric value")
    if row["scoring"] == "cumulative" and value is not None:
        raise HTTPException(422, "Cumulative decisions use points")
    entry = await one(
        conn,
        """UPDATE competition_entries SET value=%s,confirmed_at=CASE WHEN %s='confirmed'
        THEN CASE WHEN decision='confirmed' AND value IS NOT DISTINCT FROM %s
          THEN COALESCE(confirmed_at,clock_timestamp()) ELSE clock_timestamp() END END,
        decision=%s,points=%s,reason=%s
      WHERE id=%s AND competition_id=%s RETURNING *""",
        (value, data.decision, value, data.decision, data.points, data.reason, eid, cid),
    )
    if not entry:
        raise HTTPException(404, "Entry not found")
    await activity(
        conn,
        vid,
        user["id"],
        "competition_entry_decided",
        {"competition_id": str(cid), "entry_id": str(eid), **data.model_dump()},
    )
    return entry


@router.post("/{cid}/settle")
async def settle(
    vid: UUID, cid: UUID, user=Depends(member), conn=Depends(connection, scope="function")
):
    row = await competition(conn, vid, cid)
    if user["id"] != (row["creator_id"] if row["friendly"] else row["auditor_id"]):
        raise HTTPException(403, "Auditor (or friendly creator) required")
    if row["status"] == "settled":
        return row
    if row["entry_lamports"]:
        raise HTTPException(409, "Settle with the assigned devnet auditor wallet")
    if await one(
        conn,
        "SELECT 1 FROM competition_entries WHERE competition_id=%s AND decision='pending'",
        (cid,),
    ):
        raise HTTPException(409, "Decide all entries before settlement")
    participants = await many(
        conn,
        "SELECT * FROM competition_participants WHERE competition_id=%s "
        "ORDER BY chain_join_index NULLS LAST,joined_at,user_id",
        (cid,),
    )
    entries = await many(conn, "SELECT * FROM competition_entries WHERE competition_id=%s", (cid,))
    scores, winners = score_competition(row, participants, entries)
    payouts = projection(row, participants, entries)
    if row["entry_coins"]:
        winners = [
            p["user_id"] for p in payouts["payouts"] if int(p["amount"]) and not payouts["refund"]
        ]
        # Lock all accounts in stable order before crediting payouts.
        for uid in sorted({str(p["user_id"]) for p in participants} | {str(row["auditor_id"])}):
            await require_member(conn, vid, UUID(uid), lock=True)
        for payout in payouts["payouts"]:
            await coin_award(
                conn,
                vid,
                payout["user_id"],
                int(payout["amount"]),
                "competition_payout",
                f"payout:{cid}:{payout['user_id']}",
            )
        if int(payouts["fee"]):
            await coin_award(
                conn, vid, row["auditor_id"], int(payouts["fee"]), "competition_fee", f"fee:{cid}"
            )
    for score in scores:
        # Friendly scores are for bragging rights only; no unverified XP farming.
        if not row["friendly"] and score["points"]:
            await require_member(conn, vid, score["user_id"], lock=True)
            await award(
                conn,
                vid,
                score["user_id"],
                min(500, int(score["points"])),
                "competition",
                f"competition:{cid}:{score['user_id']}",
            )
    if not row["friendly"]:
        from app.rewards import grant

        for winner in winners:
            await grant(conn, vid, winner, "competition_win")
    result = {
        "winners": winners,
        "scores": scores,
        "payments_executed": bool(row["entry_coins"]),
        "payouts": payouts,
    }
    row = await one(
        conn,
        "UPDATE competitions SET status='settled',result=%s WHERE id=%s RETURNING *",
        (Jsonb(result), cid),
    )
    await activity(
        conn, vid, user["id"], "competition_settled", {"competition_id": str(cid), **result}
    )
    for winner in winners:
        await activity(
            conn,
            vid,
            winner,
            "competition_won",
            {"competition_id": str(cid), "title": row["title"]},
        )
    return row
