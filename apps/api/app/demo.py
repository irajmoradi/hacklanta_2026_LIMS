"""Demo-only rehearsal tools. No model calls or user-selected village targets."""

import random
import time
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg import sql
from pydantic import BaseModel, Field

from app import world
from app.auth import current_user, require_member
from app.db import connection, many, one
from app.domain import SEED_USERS, VILLAGE_ID, activity, award, coin_award, monday

router = APIRouter(prefix="/demo")


async def demo_gate(request: Request):
    if (
        not request.app.state.settings.demo_auth
        or request.headers.get("authorization")
        or not request.headers.get("x-demo-user")
    ):
        raise HTTPException(404, "Not found")


async def debug_gate(request: Request):
    await demo_gate(request)
    from app.security import local_debug

    if not local_debug(request):
        raise HTTPException(404, "Not found")


async def demo_member(user=Depends(current_user), conn=Depends(connection, scope="function")):
    if user["id"] not in {u[0] for u in SEED_USERS}:
        raise HTTPException(403, "Seeded demo seat required")
    await require_member(conn, VILLAGE_ID, user["id"])
    return user


class Seat(BaseModel):
    user_id: UUID
    client_id: UUID


def seats(request):
    now = time.monotonic()
    active = getattr(request.app.state, "demo_seats", {})
    active = {key: value for key, value in active.items() if now - value[1] < 600}
    request.app.state.demo_seats = active
    return active


@router.get("/seats", dependencies=[Depends(demo_gate)])
async def list_seats(request: Request, user=Depends(demo_member)):
    active = seats(request)
    return {
        "seats": [
            {"user_id": str(uid), "clients": sum(v[0] == uid for v in active.values())}
            for uid in {v[0] for v in active.values()}
        ]
    }


@router.post("/seat", dependencies=[Depends(demo_gate)])
async def claim_seat(body: Seat, request: Request, user=Depends(demo_member)):
    if body.user_id != user["id"]:
        raise HTTPException(403, "Claim your own seat")
    active = seats(request)
    active[body.client_id] = (body.user_id, time.monotonic())
    return {
        "conflict": any(k != body.client_id and v[0] == body.user_id for k, v in active.items())
    }


async def demo_tester(user=Depends(current_user)):
    if user["id"] not in {u[0] for u in SEED_USERS} and user["auth_issuer"] != "village-demo-guest":
        raise HTTPException(403, "Demo tester required")
    return user


@router.get("/debug", dependencies=[Depends(debug_gate)])
async def debug_available(user=Depends(demo_tester)):
    return {"enabled": True}


@router.post("/guests", status_code=201, dependencies=[Depends(debug_gate)])
async def create_guest(user=Depends(demo_tester), conn=Depends(connection, scope="function")):
    number = await one(conn, "SELECT nextval('demo_guest_number') AS n")
    uid = uuid4()
    return await one(
        conn,
        "INSERT INTO users(id,auth_issuer,auth_subject,display_name) "
        "VALUES(%s,'village-demo-guest',%s,%s) RETURNING id,display_name",
        (uid, str(uid), f"Guest {number['n']}"),
    )


@router.delete("/guests", dependencies=[Depends(debug_gate)])
async def remove_guests(
    request: Request, user=Depends(demo_tester), conn=Depends(connection, scope="function")
):
    from app.account import DeleteAccount, delete_me

    guests = await many(
        conn, "SELECT * FROM users WHERE auth_issuer='village-demo-guest' ORDER BY id"
    )
    # Use the established account cleanup, including jobs, references and uploaded files.
    for guest in guests:
        if guest["id"] not in {u[0] for u in SEED_USERS}:
            await delete_me(DeleteAccount(confirm="DELETE"), request, user=guest, conn=conn)
    return {"removed": len(guests), "seat": str(SEED_USERS[0][0])}


class Action(BaseModel):
    idempotency_key: UUID
    amount: Literal[100, 500, 2000] = 100
    reason: str = Field(default="Rehearsal", min_length=1, max_length=200)
    confirm: str = ""
    disaster: Literal["scorch", "outbreak", "blackout", "blight"] | None = None


@router.post("/debug/{action}", dependencies=[Depends(debug_gate)])
async def debug_action(
    action: Literal[
        "xp",
        "coins",
        "inventory",
        "week",
        "goal-done",
        "event",
        "weather",
        "reset",
        "disaster",
        "repair",
    ],
    body: Action,
    request: Request,
    user=Depends(demo_member),
    conn=Depends(connection, scope="function"),
):
    # Same lock order as story reset; serialize actions and keep replay durable even after reset.
    await conn.execute("SELECT pg_advisory_xact_lock(1337001)")
    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (VILLAGE_ID,))
    uid = user["id"]
    await require_member(conn, VILLAGE_ID, uid, lock=True)
    key = f"debug:{uid}:{body.idempotency_key}"
    previous = await one(
        conn,
        "SELECT payload FROM activity_events WHERE village_id=%s AND "
        "type='debug' AND payload->>'key'=%s",
        (VILLAGE_ID, key),
    )
    signature = {
        "action": action,
        "amount": body.amount,
        "reason": body.reason,
        "confirm": body.confirm,
        "disaster": body.disaster,
    }
    if previous:
        previous_input = {"disaster": None, **previous["payload"]["input"]}
        if previous_input != signature:
            raise HTTPException(409, "Idempotency key already used for another action")
        return {"ok": True, "replayed": True}
    if action in {"disaster", "repair"}:
        from app import disasters

        if action == "repair":
            await disasters.finish(conn, VILLAGE_ID)
        else:
            event = await one(
                conn,
                (
                    "INSERT INTO mayor_events(village_id,kind,title,body,status,model) "
                    "VALUES(%s,'random_event','Debug disaster','Offline "
                    "rehearsal','failed','debug-fixture') RETURNING id"
                ),
                (VILLAGE_ID,),
            )
            await disasters.start(conn, VILLAGE_ID, event["id"], body.disaster, request.app.state.settings)
    elif action == "xp":
        await award(conn, VILLAGE_ID, uid, body.amount, f"debug: {body.reason}", key)
    elif action == "coins":
        await coin_award(conn, VILLAGE_ID, uid, body.amount, f"debug: {body.reason}", key)
    elif action == "inventory":
        await conn.execute(
            "DELETE FROM inventory WHERE village_id=%s AND user_id=%s", (VILLAGE_ID, uid)
        )
        await conn.execute(
            "DELETE FROM custom_items WHERE village_id=%s AND owner=%s", (VILLAGE_ID, uid)
        )
        await conn.execute(
            "UPDATE village_members SET house_level=1 WHERE village_id=%s AND user_id=%s",
            (VILLAGE_ID, uid),
        )
    elif action == "week":
        for table in ("evidence_reviews", "check_in_keys"):
            await conn.execute(
                sql.SQL(
                    "DELETE FROM {} WHERE check_in_id IN (SELECT id FROM "
                    "check_ins WHERE village_id=%s AND user_id=%s AND "
                    "created_at >= %s)"
                ).format(sql.Identifier(table)),
                (VILLAGE_ID, uid, monday()),
            )
        await conn.execute(
            "DELETE FROM check_ins WHERE village_id=%s AND user_id=%s AND created_at >= %s",
            (VILLAGE_ID, uid, monday()),
        )
        await conn.execute(
            "DELETE FROM goals WHERE village_id=%s AND user_id=%s AND week_start=%s",
            (VILLAGE_ID, uid, monday()),
        )
    elif action == "goal-done":
        goal = await one(
            conn,
            "UPDATE goals SET status='done' WHERE village_id=%s AND user_id=%s "
            "AND week_start=%s RETURNING id",
            (VILLAGE_ID, uid, monday()),
        )
        if not goal:
            raise HTTPException(409, "Set a weekly goal first")
    elif action == "event":
        title = random.choice(["Share a tiny win", "Village stretch break", "Celebrate a teammate"])
        await conn.execute(
            "INSERT INTO "
            "mayor_events(village_id,kind,title,body,reward_xp,status,model,ends_at) "
            "VALUES(%s,'random_event',%s,'Offline debug Mayor: join in and test "
            "event completion.',50,'active','debug-fixture',now()+interval '1 "
            "day')",
            (VILLAGE_ID, title),
        )
    elif action == "weather":
        d = (await world.state(conn, VILLAGE_ID))["disaster"]
        if d and d["kind"] == "blackout":
            raise HTTPException(409, "Repair the blackout before festival night")
        await conn.execute(
            "INSERT INTO village_world(village_id) VALUES(%s) ON CONFLICT DO NOTHING", (VILLAGE_ID,)
        )
        await conn.execute(
            "UPDATE village_world SET weather=CASE WHEN "
            "weather='festival_night' THEN 'clear' ELSE 'festival_night' "
            "END,weather_changed_at=now() WHERE village_id=%s",
            (VILLAGE_ID,),
        )
    elif action == "reset":
        if body.confirm != "RESET":
            raise HTTPException(422, "Confirm with RESET")
        # Preserve debug receipts across story reset so retries cannot erase fresh progress.
        receipts = await (
            await conn.execute(
                "SELECT user_id,payload FROM activity_events WHERE village_id=%s AND type='debug'",
                (VILLAGE_ID,),
            )
        ).fetchall()
        from scripts.demo_story import story

        await story(conn, reset=True, asset_dir=request.app.state.settings.asset_dir)
        for receipt in receipts:
            await activity(conn, VILLAGE_ID, receipt["user_id"], "debug", receipt["payload"])
    await activity(
        conn,
        VILLAGE_ID,
        uid,
        "debug",
        {"key": key, "input": signature, "text": f"{action} — {body.reason}"},
    )
    return {"ok": True, "replayed": False}
