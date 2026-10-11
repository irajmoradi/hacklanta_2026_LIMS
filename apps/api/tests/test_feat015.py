import asyncio

import pytest
from fastapi import HTTPException

from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID
from app.houses import Edit, reduce, validate_position

UID = SEED_USERS[0][0]
VID = str(VILLAGE_ID)
BASE = f"/api/houses/{UID}"


def test_geometry():
    item = dict(item_id="sofa", kind="sofa", x=0.13, z=0, rot=8, stashed=False)
    assert validate_position(item, [])["x"] == 0.25
    assert item["rot"] == 15
    with pytest.raises(HTTPException):
        validate_position(dict(item, x=4), [])
    with pytest.raises(HTTPException):
        validate_position(item, [dict(item, item_id="armchair", kind="armchair")])
    art = dict(item, item_id="wall_art_moon", kind="wall_art_moon", x=0, z=-2)
    assert validate_position(art, [])["z"] == -3.75


async def test_reducers_auth_and_history(api, outsider):
    client, app = api
    assert (await client.get(BASE, params={"vid": VID}, headers=outsider)).status_code == 403
    assert (await client.get(BASE, params={"vid": VID})).json()["seq"] == 0
    payload = dict(action="move_item", item_id="sofa", x=-1.75, z=-2, rot=0, client_seq=1)
    other = {"X-Demo-User": str(SEED_USERS[1][0])}
    assert (
        await client.post(BASE + "/edit", params={"vid": VID}, json=payload, headers=other)
    ).status_code == 403
    response = await client.post(BASE + "/edit", params={"vid": VID}, json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["seq"] == 1
    bad = await client.post(BASE + "/edit", params={"vid": VID}, json={**payload, "x": 2})
    assert bad.status_code == 409
    assert (await client.get(BASE, params={"vid": VID})).json()["seq"] == 1
    assert (
        await client.post(
            BASE + "/editors",
            params={"vid": VID},
            json={"user_id": str(SEED_USERS[1][0]), "enabled": True},
        )
    ).status_code == 410
    payload["x"] = -1.5
    assert (
        await client.post(BASE + "/edit", params={"vid": VID}, json=payload, headers=other)
    ).status_code == 403
    history = (await client.get(BASE + "/history", params={"vid": VID})).json()
    assert history["as_of"]
    assert len(history["moves"]) == 1
    assert history["moves"][0]["seq"] == 1
    busy = await client.get(f"/api/villages/{VID}/busy-houses")
    assert busy.status_code == 200
    assert busy.json()[0]["moves"] == 1
    assert (
        await client.post(
            BASE + "/edit",
            params={"vid": VID},
            json={**payload, "action": "place_item", "item_id": "arcade_cabinet", "x": 0, "z": 2},
        )
    ).status_code == 403
    await client.post(
        BASE + "/editors",
        params={"vid": VID},
        json={"user_id": str(SEED_USERS[1][0]), "enabled": False},
    )
    assert (
        await client.post(BASE + "/edit", params={"vid": VID}, json=payload, headers=other)
    ).status_code == 403


async def test_concurrent_ordering_and_stash(api):
    client, app = api

    async def move(n):
        async with app.state.house_pool.connection() as conn:
            return await reduce(
                conn,
                UID,
                UID,
                Edit(action="move_item", item_id="sofa", x=-2 + n * 0.25, z=-2, client_seq=n),
                set(),
            )

    rows = await asyncio.gather(move(1), move(2), move(3))
    assert sorted(r["seq"] for r in rows) == [1, 2, 3]
    for action in ["stash_item", "place_item", "rotate_item"]:
        response = await client.post(
            BASE + "/edit",
            params={"vid": VID},
            json=dict(action=action, item_id="sofa", x=-2, z=-2, rot=15, client_seq=4),
        )
        assert response.status_code == 200, response.text
    assert (await client.get(BASE, params={"vid": VID})).json()["seq"] == 6


async def test_purchase_once(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO coin_ledger(village_id,user_id,delta,reason,source_key) "
            "VALUES(%s,%s,200,'test','house-test')",
            (VILLAGE_ID, UID),
        )
    for _ in range(2):
        assert (
            await client.post(BASE + "/buy", params={"vid": VID}, json={"kind": "arcade_cabinet"})
        ).status_code == 200
    async with app.state.pool.connection() as conn:
        row = await one(
            conn,
            "SELECT count(*) AS n FROM coin_ledger WHERE source_key=%s",
            (f"house:{UID}:arcade_cabinet",),
        )
        assert row["n"] == 1
    assert (
        await client.post(
            BASE + "/edit",
            params={"vid": VID},
            json=dict(action="place_item", item_id="arcade_cabinet", x=0, z=2, client_seq=1),
        )
    ).status_code == 200


async def test_two_websocket_clients(api):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from app.runtime import selector_loop

    client, app = api

    def scenario():
        with TestClient(
            create_app(app.state.settings), backend_options={"loop_factory": selector_loop}
        ) as http:
            with (
                http.websocket_connect(f"{BASE}/live?vid={VID}") as a,
                http.websocket_connect(f"{BASE}/live?vid={VID}") as b,
            ):
                connections = []
                for ws in (a, b):
                    ws.send_json({"X-Demo-User": str(UID)})
                    initial = ws.receive_json()
                    assert initial["type"] == "snapshot"
                    connections.append(initial["client_id"])
                assert connections[0] != connections[1]
                a.send_json(dict(action="move_item", item_id="sofa", x=-1.75, z=-2, client_seq=1))

                def receive_type(ws, kind):
                    for _ in range(20):
                        event = ws.receive_json()
                        if event["type"] == kind:
                            return event
                    raise AssertionError("Missing websocket event")

                ack = receive_type(a, "ack")
                delta = receive_type(b, "delta")
                assert ack["seq"] == delta["seq"] == 1
                assert ack["client_id"] == delta["client_id"] == connections[0]
                assert delta["item"]["x"] == -1.75
                a.send_json(dict(action="move_item", item_id="sofa", x=-1.5, z=-2, client_seq=1))
                assert receive_type(a, "rejected")["snapshot"]["seq"] == 1

    await asyncio.wait_for(asyncio.to_thread(scenario), 30)


def test_tiger_hypertable():
    import psycopg

    from app.config import Settings

    settings = Settings.from_env()
    if not settings.tiger_database_url:
        pytest.skip("Tiger not configured")
    with psycopg.connect(settings.tiger_database_url, connect_timeout=10) as conn:
        assert conn.execute(
            "SELECT 1 FROM timescaledb_information.hypertables WHERE "
            "hypertable_schema='public' AND hypertable_name='house_item_moves' AND "
            "compression_enabled"
        ).fetchone()
        assert conn.execute(
            "SELECT 1 FROM timescaledb_information.continuous_aggregates WHERE "
            "view_schema='public' AND view_name='house_activity_hourly'"
        ).fetchone()
