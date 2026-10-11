import asyncio
import random
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from psycopg.types.json import Jsonb

from app import disasters, world
from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID

BASE = f"/api/villages/{VILLAGE_ID}"
UID = SEED_USERS[0][0]


async def trigger(app, kind):
    async with app.state.pool.connection() as conn:
        event = await one(
            conn,
            """INSERT INTO mayor_events(village_id,kind,title,body,status)
            VALUES (%s,'challenge','Missed event','A shared goal','failed') RETURNING id""",
            (VILLAGE_ID,),
        )
        value = await disasters.start(conn, VILLAGE_ID, event["id"], kind)
        value.pop("repair_plan")  # Persist a pre-FEAT-028 disaster for legacy regression coverage.
        await conn.execute("UPDATE village_world SET disaster=%s WHERE village_id=%s", (Jsonb(value), VILLAGE_ID))
        return value


def test_weighted_selection_excludes_previous():
    rng = random.Random(12)
    for previous in disasters.KINDS:
        picks = [disasters.choose(previous, rng) for _ in range(1000)]
        assert previous not in picks
        assert set(picks) == set(disasters.KINDS) - {previous}
    picks = [disasters.choose(None, rng) for _ in range(10000)]
    assert picks.count("scorch") > picks.count("outbreak") * 1.25


@pytest.mark.parametrize("kind", disasters.KINDS)
async def test_effects_group_repair_and_no_repeat(api, kind):
    client, app = api
    d = await trigger(app, kind)
    async with app.state.pool.connection() as conn:
        with pytest.raises(HTTPException) as error:
            await disasters.start(conn, VILLAGE_ID, None, "blight")
        assert error.value.status_code == 409
    state = (await client.get(BASE)).json()["world"]
    assert state["disaster"]["kind"] == kind
    if kind == "blackout":
        assert (state["weather"], state["time_of_day"]) == ("rain", "night")
        async with app.state.pool.connection() as conn:
            assert not await world.set_weather(conn, VILLAGE_ID, "festival_night", "Party")
    if kind == "blight":
        assert state["gardening_available"] is False and state["garden_xp_bonus"] == 0
        assert (
            await client.patch("/api/me", json={"idle_activity": "gardening"})
        ).status_code == 409
    if kind == "scorch":
        assert state["disaster"]["closed_building"] == "pet_shelter"
        assert (
            await client.post(BASE + "/shop/buy", json={"item_id": "pet_dog_b"})
        ).status_code == 409
    payload = {"kind": "status", "body": "Repair contribution", "idempotency_key": str(uuid4())}
    for _ in range(2):
        assert (await client.post(BASE + "/check-ins", json=payload)).status_code == 200
    assert (await client.get(BASE)).json()["world"]["disaster"]["checkins"] == 1
    # One prolific member cannot meet the distinct-neighbor requirement.
    for _ in range(6):
        await client.post(BASE + "/check-ins", json={**payload, "idempotency_key": str(uuid4())})
    assert (await client.get(BASE)).json()["world"]["disaster"]
    for uid, *_ in SEED_USERS[1:3]:
        await client.post(
            BASE + "/check-ins",
            headers={"X-Demo-User": str(uid)},
            json={**payload, "idempotency_key": str(uuid4())},
        )
    after = (await client.get(BASE)).json()["world"]
    assert after["disaster"] is None and after["rebuilt_at"]
    assert after["gardening_available"] and after["weather"] == "clear"
    async with app.state.pool.connection() as conn:
        assert not await disasters.finish(conn, VILLAGE_ID)
        assert (
            await one(conn, "SELECT status FROM mayor_events WHERE id=%s", (d["repair_event_id"],))
        )["status"] == "completed"
        with pytest.raises(HTTPException):
            await disasters.start(conn, VILLAGE_ID, None, kind)


async def test_away_revive_concurrent_and_repair_idempotent(api):
    client, app = api
    d = await trigger(app, "outbreak")
    async with app.state.pool.connection() as conn:
        await conn.execute(
            (
                "INSERT INTO inventory(village_id,user_id,item_id,equipped) "
                "VALUES(%s,%s,'pet_dog',true) ON CONFLICT DO NOTHING"
            ),
            (VILLAGE_ID, UID),
        )
        d["deadline"] = (datetime.now(UTC) - timedelta(seconds=1)).isoformat()
        await conn.execute(
            "UPDATE village_world SET disaster=%s WHERE village_id=%s", (Jsonb(d), VILLAGE_ID)
        )
    state = (await client.get(BASE)).json()
    assert state["world"]["disaster"]["pets_away"]
    assert (
        "pet_dog"
        not in next(p for p in state["villagers"] if p["user_id"] == str(UID))["equipped_ids"]
    )
    shop = (await client.get(BASE + "/shop")).json()
    assert next(p for p in shop["items"] if p["id"] == "pet_dog")["away"]
    before = shop["balance"]
    xp_before = next(p for p in state["villagers"] if p["user_id"] == str(UID))["xp"]
    results = await asyncio.gather(
        *(client.post(BASE + "/shop/buy", json={"item_id": "revival_potion"}) for _ in range(3))
    )
    assert all(r.status_code == 200 for r in results)
    assert all(r.json()["balance"] == before - 30 for r in results)
    after = (await client.get(BASE)).json()
    assert next(p for p in after["villagers"] if p["user_id"] == str(UID))["xp"] == xp_before
    state = (await client.get(BASE)).json()
    assert (
        "pet_dog" in next(p for p in state["villagers"] if p["user_id"] == str(UID))["equipped_ids"]
    )
    async with app.state.pool.connection() as conn:
        assert await disasters.finish(conn, VILLAGE_ID)
        assert not await disasters.finish(conn, VILLAGE_ID)
    assert (await client.post(BASE + "/shop/buy", json={"item_id": "revival_potion"})).json()[
        "balance"
    ] == before - 30


async def test_failure_queue_and_debug_gate(api):
    client, app = api
    app.state.settings = replace(app.state.settings, demo_debug=False)
    payload = {"idempotency_key": str(uuid4()), "disaster": "blackout"}
    assert (await client.post("/api/demo/debug/disaster", json=payload)).status_code == 404
    app.state.settings = replace(app.state.settings, demo_debug=True)
    assert (await client.post("/api/demo/debug/disaster", json=payload)).status_code == 200
    assert (await client.post("/api/demo/debug/disaster", json=payload)).json()["replayed"]
    assert (
        await client.post("/api/demo/debug/weather", json={"idempotency_key": str(uuid4())})
    ).status_code == 409
    async with app.state.pool.connection() as conn:
        for _ in range(2):
            await conn.execute(
                (
                    "INSERT INTO mayor_events(village_id,kind,title,body,ends_at) "
                    "VALUES(%s,'random_event','Missed','Oops',now()-interval '1 minute')"
                ),
                (VILLAGE_ID,),
            )
    assert (await client.get(BASE)).json()["world"]["disaster"]["kind"] == "blackout"
    await client.post("/api/demo/debug/repair", json={"idempotency_key": str(uuid4())})
    next_disaster = (await client.get(BASE)).json()["world"]["disaster"]
    assert next_disaster["kind"] != "blackout"


async def test_late_repair_rolling_window(api):
    client, app = api
    d = await trigger(app, "blight")
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "DELETE FROM check_ins WHERE village_id=%s",
            (VILLAGE_ID,),
        )
        d["started_at"] = (datetime.now(UTC) - timedelta(days=5)).isoformat()
        d["deadline"] = (datetime.now(UTC) - timedelta(days=3)).isoformat()
        await conn.execute(
            "UPDATE village_world SET disaster=%s WHERE village_id=%s", (Jsonb(d), VILLAGE_ID)
        )
        for uid, *_ in SEED_USERS[:3]:
            for _ in range(2):
                await conn.execute(
                    (
                        "INSERT INTO "
                        "check_ins(village_id,user_id,kind,body,idempotency_key,created_at) "
                        "VALUES(%s,%s,'status','Old help',%s,now()-interval '3 days')"
                    ),
                    (VILLAGE_ID, uid, uuid4()),
                )
    assert (await client.get(BASE)).json()["world"]["disaster"]["checkins"] == 0
    for uid, *_ in SEED_USERS[:3]:
        for _ in range(2):
            await client.post(
                BASE + "/check-ins",
                headers={"X-Demo-User": str(uid)},
                json={"kind": "status", "body": "Fresh help", "idempotency_key": str(uuid4())},
            )
    assert (await client.get(BASE)).json()["world"]["disaster"] is None


async def test_blight_bonus_and_free_pet_recovery(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET idle_activity='gardening' WHERE id=%s", (UID,))
        await conn.execute(
            (
                "INSERT INTO village_unlocks(village_id,building) VALUES(%s,'garden') ON "
                "CONFLICT DO NOTHING"
            ),
            (VILLAGE_ID,),
        )
    await trigger(app, "blight")
    payload = {"kind": "status", "body": "Garden update", "idempotency_key": str(uuid4())}
    assert (await client.post(BASE + "/check-ins", json=payload)).status_code == 200
    async with app.state.pool.connection() as conn:
        assert not await one(conn, "SELECT 1 FROM xp_ledger WHERE reason='garden'")
        await disasters.finish(conn, VILLAGE_ID)
    payload["idempotency_key"] = str(uuid4())
    assert (await client.post(BASE + "/check-ins", json=payload)).json()["xp_awarded"] == 5
    assert (await client.post(BASE + "/check-ins", json=payload)).json()["xp_awarded"] == 0
    d = await trigger(app, "outbreak")
    async with app.state.pool.connection() as conn:
        await conn.execute(
            (
                "INSERT INTO inventory(village_id,user_id,item_id,equipped) "
                "VALUES(%s,%s,'pet_dog',true) ON CONFLICT DO NOTHING"
            ),
            (VILLAGE_ID, UID),
        )
        d["deadline"] = (datetime.now(UTC) - timedelta(seconds=1)).isoformat()
        await conn.execute(
            "UPDATE village_world SET disaster=%s WHERE village_id=%s", (Jsonb(d), VILLAGE_ID)
        )
        await disasters.sync(conn, VILLAGE_ID)
        assert (
            await one(
                conn,
                (
                    "SELECT away FROM inventory WHERE village_id=%s AND user_id=%s AND "
                    "item_id='pet_dog'"
                ),
                (VILLAGE_ID, UID),
            )
        )["away"]
        await conn.execute(
            "DELETE FROM coin_ledger WHERE village_id=%s AND user_id=%s", (VILLAGE_ID, UID)
        )
    assert (
        await client.post(BASE + "/shop/buy", json={"item_id": "revival_potion"})
    ).status_code == 409
    async with app.state.pool.connection() as conn:
        await disasters.finish(conn, VILLAGE_ID)
        pet = await one(
            conn,
            (
                "SELECT away,equipped FROM inventory WHERE village_id=%s AND user_id=%s "
                "AND item_id='pet_dog'"
            ),
            (VILLAGE_ID, UID),
        )
        assert pet == {"away": False, "equipped": True}
