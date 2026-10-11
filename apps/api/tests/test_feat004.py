from uuid import uuid4

from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID


async def test_debug_gates(api, outsider):
    client, app = api
    app.state.settings.demo_debug = False
    assert (await client.get("/api/demo/debug")).status_code == 404
    assert (
        await client.post("/api/demo/debug/xp", json={"idempotency_key": str(uuid4())})
    ).status_code == 404
    app.state.settings.demo_debug = True
    assert (await client.get("/api/demo/debug", headers=outsider)).status_code == 403
    assert (
        await client.get("/api/demo/debug", headers={"Authorization": "Bearer real"})
    ).status_code == 404
    app.state.settings.demo_auth = False
    assert (await client.get("/api/demo/debug")).status_code == 404


async def test_seat_conflicts(api):
    client, app = api
    body = {"user_id": str(SEED_USERS[0][0]), "client_id": str(uuid4())}
    assert (await client.post("/api/demo/seat", json=body)).json() == {"conflict": False}
    assert (await client.post("/api/demo/seat", json=body)).json() == {"conflict": False}
    body["client_id"] = str(uuid4())
    assert (await client.post("/api/demo/seat", json=body)).json() == {"conflict": True}
    assert (await client.get("/api/demo/seats")).json()["seats"][0]["clients"] == 2
    app.state.demo_seats = {k: (v[0], v[1] - 601) for k, v in app.state.demo_seats.items()}
    assert (await client.get("/api/demo/seats")).json() == {"seats": []}
    body["user_id"] = str(SEED_USERS[1][0])
    assert (await client.post("/api/demo/seat", json=body)).status_code == 403


async def test_actions_scoped_and_replayed(api):
    client, app = api
    app.state.settings.demo_debug = True
    uid = SEED_USERS[0][0]
    other = (await client.post("/api/villages", json={"name": "Other village"})).json()["village"][
        "id"
    ]
    async with app.state.pool.connection() as conn:
        before = await one(conn, "SELECT count(*) n FROM xp_ledger WHERE village_id=%s", (other,))

    async def act(action, **kwargs):
        body = {"idempotency_key": str(uuid4()), **kwargs}
        response = await client.post("/api/demo/debug/" + action, json=body)
        assert response.status_code == 200, response.text
        replay = await client.post("/api/demo/debug/" + action, json=body)
        assert replay.json() == {"ok": True, "replayed": True}
        return body

    body = await act("xp", amount=500, reason="Test shop")
    assert (
        await client.post("/api/demo/debug/xp", json={**body, "amount": 100})
    ).status_code == 409
    async with app.state.pool.connection() as conn:
        row = await one(conn, "SELECT sum(delta) n FROM xp_ledger WHERE source_key LIKE 'debug:%%'")
        assert row["n"] == 500
    peer = SEED_USERS[1][0]
    async with app.state.pool.connection() as conn:
        for member_id in (uid, peer):
            await conn.execute(
                "INSERT INTO inventory(village_id,user_id,item_id,equipped) "
                "VALUES(%s,%s,'pet_dog_b',true)",
                (VILLAGE_ID, member_id),
            )
            await conn.execute(
                "UPDATE village_members SET house_level=3 WHERE village_id=%s AND user_id=%s",
                (VILLAGE_ID, member_id),
            )
    await act("inventory")
    async with app.state.pool.connection() as conn:
        assert not await one(
            conn, "SELECT 1 FROM inventory WHERE village_id=%s AND user_id=%s", (VILLAGE_ID, uid)
        )
        assert await one(
            conn, "SELECT 1 FROM inventory WHERE village_id=%s AND user_id=%s", (VILLAGE_ID, peer)
        )
        assert (
            await one(
                conn,
                "SELECT house_level FROM village_members WHERE village_id=%s AND user_id=%s",
                (VILLAGE_ID, uid),
            )
        )["house_level"] == 1
    for member_id in (uid, peer):
        response = await client.post(
            f"/api/villages/{VILLAGE_ID}/check-ins",
            headers={"X-Demo-User": str(member_id)},
            json={"kind": "status", "body": "Debug check-in", "idempotency_key": str(uuid4())},
        )
        assert response.status_code == 200

    await client.post(f"/api/villages/{VILLAGE_ID}/goals", json={"title": "Debug goal"})
    await act("goal-done")
    assert (await client.get(f"/api/villages/{VILLAGE_ID}/users/{uid}")).json()["goal"][
        "status"
    ] == "done"
    await act("event")
    await act("weather")
    world = (await client.get(f"/api/villages/{VILLAGE_ID}")).json()["world"]
    assert world["weather"] == "festival_night"
    await act("week")
    profile = (await client.get(f"/api/villages/{VILLAGE_ID}/users/{uid}")).json()
    assert profile["goal"] is None and not profile["check_ins"]
    assert (await client.get(f"/api/villages/{VILLAGE_ID}/users/{peer}")).json()["check_ins"]
    assert (
        await client.post("/api/demo/debug/reset", json={"idempotency_key": str(uuid4())})
    ).status_code == 422
    await act("reset", confirm="RESET")
    async with app.state.pool.connection() as conn:
        assert (
            await one(conn, "SELECT count(*) n FROM xp_ledger WHERE village_id=%s", (other,))
            == before
        )
        assert await one(conn, "SELECT 1 FROM villages WHERE id=%s", (other,))
        assert (
            await one(
                conn,
                "SELECT count(*) n FROM activity_events WHERE village_id=%s AND type='debug'",
                (VILLAGE_ID,),
            )
        )["n"] == 7
