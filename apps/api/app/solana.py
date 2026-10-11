"""Devnet intents and confirmed receipts. Wallet signatures stay in the browser."""

import struct
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg.types.json import Jsonb
from pydantic import Field

from app import solana_rpc as chain
from app.auth import member, require_member
from app.competition_scoring import score_competition
from app.db import connection, many, one
from app.domain import activity, award
from app.models import Input
from app.payouts import MODES, projection, score_units

router = APIRouter(prefix="/villages/{vid}")
LAMPORTS_PER_XP = 100_000  # 0.01 devnet SOL = 100 XP
DAILY_XP = 1000  # per account across all villages, UTC intent date


class IntentInput(Input):
    wallet: str = Field(min_length=32, max_length=44)
    action: Literal["treasury", "create", "join", "settle", "refund"]
    competition_id: UUID | None = None
    auditor_wallet: str | None = None
    xp: int = Field(default=100, ge=1, le=DAILY_XP, strict=True)


class Receipt(Input):
    signature: str = Field(min_length=64, max_length=88)


async def usage(conn, uid):
    return (
        await one(
            conn,
            """SELECT COALESCE(sum((metadata->>'xp')::int),0)::int AS used
        FROM solana_intents WHERE user_id=%s AND action='treasury'
        AND (created_at AT TIME ZONE 'UTC')::date=(now() AT TIME ZONE 'UTC')::date""",
            (uid,),
        )
    )["used"]


@router.get("/treasury")
async def treasury(
    vid: UUID, request: Request, user=Depends(member), conn=Depends(connection, scope="function")
):
    settings = request.app.state.settings
    return {
        "cluster": "devnet",
        "enabled": bool(settings.solana_treasury),
        "destination": settings.solana_treasury,
        "lamports_per_xp": str(LAMPORTS_PER_XP),
        "daily_cap_xp": DAILY_XP,
        "used_xp": await usage(conn, user["id"]),
    }


@router.post("/solana/intents")
async def prepare(
    vid: UUID,
    data: IntentInput,
    request: Request,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    settings = request.app.state.settings
    chain.key(data.wallet)
    # Global user lock serializes cap reservations across villages.
    await conn.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (user["id"],))
    ident = uuid4()
    metadata = {"cluster": "devnet"}
    if data.action == "treasury":
        if data.competition_id:
            raise HTTPException(422, "Treasury cannot reference a competition")
        if not settings.solana_treasury:
            raise HTTPException(503, "Treasury is not configured yet")
        chain.key(settings.solana_treasury)
        if data.wallet == settings.solana_treasury:
            raise HTTPException(422, "Treasury cannot buy its own XP")
        pending_intent = await one(
            conn,
            "SELECT * FROM solana_intents WHERE village_id=%s AND user_id=%s "
            "AND action='treasury' AND wallet=%s AND (metadata->>'xp')::int=%s "
            "AND signature IS NULL AND expires_at>now() "
            "AND (created_at AT TIME ZONE 'UTC')::date=(now() AT TIME ZONE 'UTC')::date "
            "ORDER BY created_at DESC LIMIT 1",
            (vid, user["id"], data.wallet, data.xp),
        )
        if pending_intent:
            await chain.devnet(settings)
            return pending_intent
        if await usage(conn, user["id"]) + data.xp > DAILY_XP:
            raise HTTPException(409, "Daily Treasury XP cap reached (including pending purchases)")
        metadata.update(
            xp=data.xp,
            lamports=str(data.xp * LAMPORTS_PER_XP),
            destination=settings.solana_treasury,
        )
        ix = chain.instruction(
            chain.SYSTEM,
            [(data.wallet, 3), (settings.solana_treasury, 1)],
            struct.pack("<IQ", 2, data.xp * LAMPORTS_PER_XP),
        )
    else:
        from app.competitions import competition, details

        row = await competition(conn, vid, data.competition_id)
        if not row["entry_lamports"] or row["friendly"]:
            raise HTTPException(409, "This competition has no SOL stake")
        if row["status"] != "open":
            raise HTTPException(409, "Competition finalized")
        now = datetime.now(UTC)
        if data.action == "create":
            if user["id"] != row["creator_id"]:
                raise HTTPException(403, "Creator required")
            if row["chain_config"]:
                # Reuse the same addresses/terms on retries, never orphan a funded pot.
                config = row["chain_config"]
                if config["creator"] != data.wallet:
                    raise HTTPException(409, "Reconnect the original creator wallet")
            else:
                if not settings.solana_program_id or not data.auditor_wallet:
                    raise HTTPException(
                        503, "Approved devnet program and auditor wallet are required"
                    )
                chain.key(data.auditor_wallet)
                config = {
                    "program": settings.solana_program_id,
                    "creator": data.wallet,
                    "auditor": data.auditor_wallet,
                    "week": str(int(row["id"]) % (2**64)),
                }
                pot, vault = chain.addresses(config["program"], data.wallet, int(config["week"]))
                config.update(pot=pot, vault=vault)
                await conn.execute(
                    "UPDATE competitions SET chain_config=%s WHERE id=%s",
                    (Jsonb(config), row["id"]),
                )
            if not row["deadline"] or row["deadline"] <= now:
                raise HTTPException(409, "Competition deadline has passed")
            body = (
                chain.tag("create_pot")
                + struct.pack("<QQ", int(config["week"]), row["entry_lamports"])
                + bytes(chain.key(config["auditor"]))
                + struct.pack(
                    "<HqBI",
                    row["auditor_fee_bps"],
                    int(row["deadline"].timestamp()),
                    MODES[row["payout_mode"]],
                    len(row["ranked_bps"]),
                )
                + b"".join(struct.pack("<H", v) for v in row["ranked_bps"])
            )
            ix = chain.instruction(
                config["program"],
                [(data.wallet, 3), (config["pot"], 1), (config["vault"], 1), (chain.SYSTEM, 0)],
                body,
            )
            metadata["config"] = config
            metadata["rent_lamports"] = str(
                sum(
                    [
                        await chain.rpc(settings, "getMinimumBalanceForRentExemption", [size])
                        for size in (386, 8)
                    ]
                )
            )
        else:
            config = row["chain_config"]
            if not config or not row["pot_address"]:
                raise HTTPException(409, "Creator must confirm the pot first")
            if data.action == "join":
                if row["deadline"] <= now or row["settlement_snapshot"]:
                    raise HTTPException(409, "Entry closed")
                if user["id"] == row["auditor_id"] or data.wallet == config["auditor"]:
                    raise HTTPException(409, "Auditor sits out")
                prior = await one(
                    conn,
                    "SELECT wallet FROM solana_intents WHERE competition_id=%s "
                    "AND user_id=%s AND action='join' LIMIT 1",
                    (row["id"], user["id"]),
                )
                if prior and prior["wallet"] != data.wallet:
                    raise HTTPException(409, "Reconnect your original entry wallet")
                if await one(
                    conn,
                    "SELECT 1 FROM competition_participants WHERE competition_id=%s "
                    "AND (user_id=%s OR wallet_address=%s)",
                    (row["id"], user["id"], data.wallet),
                ):
                    raise HTTPException(409, "Already joined")
                ix = chain.instruction(
                    config["program"],
                    [(data.wallet, 3), (config["pot"], 1), (config["vault"], 1), (chain.SYSTEM, 0)],
                    chain.tag("join"),
                )
            else:
                await chain.devnet(settings)
                wallets = await chain.pot_participants(settings, row)
                accounts = [(config["pot"], 1), (config["vault"], 1)] + [(w, 1) for w in wallets]
                if data.action == "refund":
                    if now.timestamp() < row["deadline"].timestamp() + 259200:
                        raise HTTPException(409, "Refunds open 72 hours after deadline")
                    ix = chain.instruction(config["program"], accounts, chain.tag("refund_all"))
                else:
                    if user["id"] != row["auditor_id"] or data.wallet != config["auditor"]:
                        raise HTTPException(
                            403, "Assigned auditor and original auditor wallet required"
                        )
                    if now.timestamp() >= row["deadline"].timestamp() + 259200:
                        raise HTTPException(409, "Settlement window expired; request refunds")
                    if now < row["deadline"]:
                        raise HTTPException(409, "Wait until the competition deadline")
                    detail = await details(conn, row)
                    if any(e["decision"] == "pending" for e in detail["entries"]):
                        raise HTTPException(409, "Decide all evidence first")
                    by_wallet = {p["wallet_address"]: p for p in detail["participants"]}
                    if set(wallets) != set(by_wallet):
                        raise HTTPException(
                            409,
                            "Verify all on-chain joins before settlement, or wait for refunds",
                        )
                    participants = [by_wallet[w] for w in wallets]
                    scores = score_units(row, participants, detail["entries"])
                    if any(score > 2**64 - 1 for score in scores):
                        raise HTTPException(
                            409, "Aggregate score exceeds on-chain u64 precision limit"
                        )
                    if not any(scores):
                        raise HTTPException(409, "No positive scores; refunds open after 72 hours")
                    snapshot = row["settlement_snapshot"] or {
                        "scores": scores,
                        "score_rows": score_competition(row, participants, detail["entries"])[0],
                        "projection": projection(row, participants, detail["entries"]),
                    }
                    await conn.execute(
                        "UPDATE competitions SET settlement_snapshot=%s WHERE id=%s",
                        (Jsonb(snapshot), row["id"]),
                    )
                    metadata["snapshot"] = snapshot
                    ix = chain.instruction(
                        config["program"],
                        [(data.wallet, 3)] + accounts,
                        chain.tag("settle")
                        + struct.pack("<I", len(scores))
                        + b"".join(struct.pack("<Q", n) for n in snapshot["scores"]),
                    )
        metadata.update(
            pot=config["pot"],
            vault=config["vault"],
            auditor=config["auditor"],
            auditor_fee_bps=row["auditor_fee_bps"],
            entry_lamports=str(row["entry_lamports"]),
            payout_mode=row["payout_mode"],
            ranked_bps=row["ranked_bps"],
        )
    await chain.devnet(settings)
    instructions = [ix, chain.instruction(chain.MEMO, [(data.wallet, 2)], str(ident).encode())]
    result = await one(
        conn,
        """INSERT INTO solana_intents
        (id,village_id,user_id,competition_id,action,wallet,instructions,metadata)
        VALUES(%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
        (
            ident,
            vid,
            user["id"],
            data.competition_id,
            data.action,
            data.wallet,
            Jsonb(instructions),
            Jsonb(metadata),
        ),
    )
    return result


@router.get("/solana/intents")
async def pending(vid: UUID, user=Depends(member), conn=Depends(connection, scope="function")):
    return await many(
        conn,
        "SELECT * FROM solana_intents WHERE village_id=%s AND user_id=%s "
        "ORDER BY created_at DESC LIMIT 20",
        (vid, user["id"]),
    )


@router.post("/solana/intents/{iid}/confirm")
async def confirm(
    vid: UUID,
    iid: UUID,
    data: Receipt,
    request: Request,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    await conn.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (user["id"],))
    intent = await one(
        conn,
        "SELECT * FROM solana_intents WHERE id=%s AND village_id=%s AND user_id=%s FOR UPDATE",
        (iid, vid, user["id"]),
    )
    if not intent:
        raise HTTPException(404, "Intent not found")
    if intent["signature"]:
        if intent["signature"] != data.signature:
            raise HTTPException(409, "Intent already used")
        return {"confirmed": True, "signature": data.signature, "xp_awarded": 0}
    # A unique signature index is the final concurrent replay barrier.
    if await one(conn, "SELECT 1 FROM solana_intents WHERE signature=%s", (data.signature,)):
        raise HTTPException(409, "Signature already used")
    tx = await chain.transaction(request.app.state.settings, data.signature)
    chain.verify_receipt(tx, intent)
    xp = 0
    if intent["action"] == "treasury":
        # Recheck actual confirmed total for the original UTC day: expired reservations
        # can be confirmed later without bypassing the cap.
        day_used = (
            await one(
                conn,
                """SELECT COALESCE(sum((metadata->>'xp')::int),0)::int AS used FROM solana_intents
            WHERE user_id=%s AND action='treasury' AND signature IS NOT NULL
            AND (created_at AT TIME ZONE 'UTC')::date=%s""",
                (user["id"], intent["created_at"].astimezone(UTC).date()),
            )
        )["used"]
        if day_used + intent["metadata"]["xp"] > DAILY_XP:
            raise HTTPException(
                409,
                "Original purchase day cap exceeded; contact the village owner with the signature",
            )
        await require_member(conn, vid, user["id"], lock=True)
        xp = await award(
            conn,
            vid,
            user["id"],
            intent["metadata"]["xp"],
            "treasury_devnet",
            "solana:" + data.signature,
        )
    else:
        from app.competitions import competition

        row = await competition(conn, vid, intent["competition_id"])
        if intent["action"] == "create":
            await conn.execute(
                "UPDATE competitions SET pot_address=%s,chain_status='open' WHERE id=%s",
                (intent["metadata"]["config"]["pot"], row["id"]),
            )
        elif intent["action"] == "join":
            wallets = await chain.pot_participants(request.app.state.settings, row)
            if intent["wallet"] not in wallets:
                raise HTTPException(409, "Confirmed join is not yet visible; retry verification")
            await conn.execute(
                """INSERT INTO competition_participants
                (competition_id,user_id,entry_lamports_intent,wallet_address,chain_join_index)
                VALUES(%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                (
                    row["id"],
                    user["id"],
                    row["entry_lamports"],
                    intent["wallet"],
                    wallets.index(intent["wallet"]),
                ),
            )
        else:
            result = {
                "winners": [],
                "scores": [],
                "payments_executed": True,
                "signature": data.signature,
                "refunded": intent["action"] == "refund",
            }
            if intent["action"] == "settle":
                result["scores"] = intent["metadata"]["snapshot"]["score_rows"]
                result["payouts"] = intent["metadata"]["snapshot"]["projection"]
                result["winners"] = [
                    p["user_id"] for p in result["payouts"]["payouts"] if int(p["amount"]) > 0
                ]
            if intent["action"] == "settle":
                for score in sorted(result["scores"], key=lambda s: s["user_id"]):
                    await require_member(conn, vid, score["user_id"], lock=True)
                    if score["points"]:
                        await award(
                            conn,
                            vid,
                            score["user_id"],
                            min(500, int(score["points"])),
                            "competition",
                            f"competition:{row['id']}:{score['user_id']}",
                        )
                from app.rewards import grant

                for winner in result["winners"]:
                    await grant(conn, vid, winner, "competition_win")
            await activity(
                conn,
                vid,
                user["id"],
                "competition_settled",
                {"competition_id": str(row["id"]), **result},
            )
            await conn.execute(
                "UPDATE competitions SET status='settled',chain_status=%s,result=%s WHERE id=%s",
                ("refunded" if result["refunded"] else "settled", Jsonb(result), row["id"]),
            )
    await conn.execute(
        "UPDATE solana_intents SET signature=%s,confirmed_at=now() WHERE id=%s",
        (data.signature, iid),
    )
    return {"confirmed": True, "signature": data.signature, "xp_awarded": xp}
