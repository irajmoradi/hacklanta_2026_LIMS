from uuid import UUID

from test_api011 import create, finish

from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID

BASE = f"/api/villages/{VILLAGE_ID}"


async def test_buy_repeat_refund_without_poll_and_retry(api):
    client, app = api
    before = (await client.get(BASE + "/shop")).json()["balance"]
    for _ in range(2):
        assert (await client.post(BASE + "/items/token")).status_code == 201
    assert (await client.get(BASE + "/shop")).json()["balance"] == before - 50
    jid = (await create(client)).json()["id"]
    async with app.state.pool.connection() as conn:
        for _ in range(2):
            await conn.execute("UPDATE avatar_jobs SET status='failed' WHERE id=%s", (jid,))
        tokens = await one(
            conn, "SELECT count(*) AS n FROM photo_item_tokens WHERE consumed_at IS NULL"
        )
        assert tokens["n"] == 2
    assert (await create(client)).status_code == 202
    assert (
        await client.post(BASE + "/shop/buy", json={"item_id": "photo_token"})
    ).status_code == 200
    assert (await client.get(BASE + "/items")).json()["photo_item_tokens"] == 2
    async with app.state.pool.connection() as conn:
        await conn.execute("DELETE FROM coin_ledger WHERE user_id=%s", (SEED_USERS[0][0],))
    assert (await client.post(BASE + "/items/token")).status_code == 409
    assert (await client.get(BASE + "/items")).json()["photo_item_tokens"] == 2


async def test_invalid_result_refunds_once(api):
    client, app = api
    await client.post(BASE + "/items/token")
    jid = (await create(client)).json()["id"]
    await finish(app, jid, pattern_png_url="https://bad.example/pattern.png")
    for _ in range(2):
        result = (await client.get(BASE + f"/items/jobs/{jid}")).json()
        assert result["status"] == "failed" and result["refunded"]
    assert (await client.get(BASE + "/items")).json()["photo_item_tokens"] == 1


async def test_guest_gates_join_cleanup_preserves_seeds(api, outsider):
    client, app = api
    app.state.settings.demo_debug = False
    for method in ("post", "delete"):
        assert (await getattr(client, method)("/api/demo/guests")).status_code == 404
    app.state.settings.demo_debug = True
    for method in ("post", "delete"):
        assert (
            await getattr(client, method)("/api/demo/guests", headers=outsider)
        ).status_code == 403
        assert (
            await getattr(client, method)(
                "/api/demo/guests", headers={"Authorization": "Bearer fake"}
            )
        ).status_code == 404
    app.state.settings.demo_auth = False
    assert (await client.post("/api/demo/guests")).status_code == 404
    app.state.settings.demo_auth = True
    guest = (await client.post("/api/demo/guests")).json()
    assert guest["display_name"].startswith("Guest ")
    assert UUID(guest["id"]) not in {u[0] for u in SEED_USERS}
    headers = {"X-Demo-User": guest["id"]}
    assert (await client.get("/api/me", headers=headers)).json()["villages"] == []
    assert (
        await client.post("/api/villages/join", headers=headers, json={"invite_code": "HACKLANTA"})
    ).status_code == 200
    assert (await client.get(BASE, headers=headers)).status_code == 200
    assert (await client.get("/api/demo/debug", headers=headers)).status_code == 200
    response = await client.delete("/api/demo/guests", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["removed"] == 1
    assert (await client.get("/api/me", headers=headers)).status_code == 401
    async with app.state.pool.connection() as conn:
        for uid, *_ in SEED_USERS:
            row = await one(conn, "SELECT id FROM users WHERE id=%s", (uid,))
            assert row is not None
    assert (await client.delete("/api/demo/guests")).json()["removed"] == 0


async def test_guest_cleanup_preserves_seeded_group_photo(api):
    from uuid import uuid4

    client, app = api
    app.state.settings.demo_debug = True
    guest = (await client.post("/api/demo/guests")).json()
    headers = {"X-Demo-User": guest["id"]}
    await client.post("/api/villages/join", headers=headers, json={"invite_code": "HACKLANTA"})
    group, head = uuid4(), uuid4()
    async with app.state.pool.connection() as conn:
        for jid, uid in ((group, SEED_USERS[0][0]), (head, guest["id"])):
            await conn.execute(
                "INSERT INTO avatar_jobs(id,user_id,stage,idem_key,status,input) "
                "VALUES(%s,%s,'segment',%s,'done','{}')",
                (jid, uid, str(jid)),
            )
        await conn.execute(
            "INSERT INTO group_photos(job_id,village_id) VALUES(%s,%s)", (group, VILLAGE_ID)
        )
        await conn.execute(
            "INSERT INTO group_photo_claims(job_id,crop_id,user_id,head_job_id) "
            "VALUES(%s,'guest',%s,%s)",
            (group, guest["id"], head),
        )
    assert (await client.delete("/api/demo/guests")).status_code == 200
    async with app.state.pool.connection() as conn:
        assert await one(conn, "SELECT id FROM avatar_jobs WHERE id=%s", (group,))
        assert await one(conn, "SELECT job_id FROM group_photos WHERE job_id=%s", (group,))
        assert not await one(conn, "SELECT id FROM avatar_jobs WHERE id=%s", (head,))
