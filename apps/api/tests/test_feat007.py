import asyncio
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

import pytest

from app import domain
from app.db import one

VID = domain.VILLAGE_ID
UID = domain.SEED_USERS[0][0]
BASE = f"/api/villages/{VID}"


@pytest.mark.parametrize(
    "reason", ["checkin", "goal_set", "mayor_event", "competition", "weekly_win", "audit"]
)
async def test_awards_mirror_once(api, reason):
    _, app = api
    async with app.state.pool.connection() as conn:
        xp = await domain.balance(conn, VID, UID)
        coins = await domain.coin_balance(conn, VID, UID)
        key = f"coins-test:{reason}"
        assert await domain.award(conn, VID, UID, 25, reason, key) == 25
        assert await domain.award(conn, VID, UID, 25, reason, key) == 0
        assert await domain.balance(conn, VID, UID) == xp + 25
        assert await domain.coin_balance(conn, VID, UID) == coins + 25


async def test_buy_spends_coins_preserves_progress_and_retry(api):
    client, app = api
    before = (await client.get(BASE)).json()
    item = next(
        i for i in (await client.get(BASE + "/shop")).json()["items"] if i["id"] == "hat_cap"
    )
    results = await asyncio.gather(
        *(client.post(BASE + "/shop/buy", json={"item_id": "hat_cap"}) for _ in range(2))
    )
    assert sorted(r.status_code for r in results) == [200, 409]
    after = (await client.get(BASE)).json()
    old, new = before["villagers"][0], after["villagers"][0]
    assert new["coins"] == old["coins"] - item["price_coins"]
    assert (new["xp"], new["level"], after["world"]["xp"]) == (
        old["xp"],
        old["level"],
        before["world"]["xp"],
    )
    async with app.state.pool.connection() as conn:
        assert not await one(conn, "SELECT id FROM xp_ledger WHERE delta<0")


async def test_insufficient_coins_even_with_xp(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await domain.coin_award(conn, VID, UID, -300, "test", "drain-coins")
    assert (await client.post(BASE + "/shop/buy", json={"item_id": "hat_cap"})).status_code == 409
    assert (await client.get(BASE + f"/users/{UID}")).json()["villager"]["xp"] == 300


async def test_photo_and_bribe_use_coins_only(api):
    client, _ = api
    before = (await client.get(BASE + f"/users/{UID}")).json()["villager"]
    photo = await client.post(BASE + "/shop/buy", json={"item_id": "photo_token"})
    assert photo.status_code == 200
    bribe = await client.post(BASE + "/mayor/bribe", json={"coins": 10, "wish": "A picnic"})
    assert bribe.status_code == 201
    after = (await client.get(BASE + f"/users/{UID}")).json()["villager"]
    assert after["coins"] == photo.json()["balance"] - 10
    assert after["xp"] == before["xp"]
    assert (
        await client.post(BASE + "/mayor/bribe", json={"currency": "sol_intent", "wish": "No"})
    ).status_code == 422


async def test_historical_backfill_replay_and_progress(api):
    _, app = api
    migration = (Path(__file__).parents[1] / "migrations/027_coins.sql").read_text()
    async with app.state.pool.connection() as conn:
        # Historical DDL must not replace the current Treasury-aware trigger in later tests.
        async with conn.transaction(force_rollback=True):
            # Reproduce a pre-migration account with 300 earned and 40 spent.
            await conn.execute("DROP TRIGGER xp_awards_coins ON xp_ledger")
            await conn.execute(
                "INSERT INTO xp_ledger(village_id,user_id,delta,reason,source_key) "
                "VALUES(%s,%s,-40,'purchase','legacy-buy')",
                (VID, UID),
            )
            await conn.execute("DELETE FROM coin_ledger")
            await conn.execute(migration)
            await domain.coin_award(conn, VID, UID, -10, "purchase", "new-buy")
            await conn.execute(migration)
            assert await domain.coin_balance(conn, VID, UID) == 250
            assert await domain.balance(conn, VID, UID) == 300
            assert (
                await one(
                    conn, "SELECT count(*) AS n FROM coin_ledger WHERE source_key='legacy-buy'"
                )
            )["n"] == 1
            assert await domain.award(conn, VID, UID, 20, "goal_set", "post-migration") == 20
            assert await domain.coin_balance(conn, VID, UID) == 270
            with pytest.raises(ValueError, match="progress only"):
                await domain.award(conn, VID, UID, -1, "purchase", "forbidden")
        coins = await domain.coin_balance(conn, VID, UID)
        await domain.award(conn, VID, UID, 200, "treasury_devnet", "after-migration-rollback")
        assert await domain.coin_balance(conn, VID, UID) == coins


async def test_debug_coins_do_not_grant_xp_and_replay(api):
    client, app = api
    app.state.settings = replace(app.state.settings, demo_debug=True)
    body = {"amount": 500, "reason": "Coins rehearsal", "idempotency_key": str(uuid4())}
    for _ in range(2):
        assert (await client.post("/api/demo/debug/coins", json=body)).status_code == 200
    person = (await client.get(BASE + f"/users/{UID}")).json()["villager"]
    assert (person["coins"], person["xp"]) == (800, 300)


async def test_repurchase_after_debug_inventory_clear_is_not_free(api):
    client, app = api
    app.state.settings = replace(app.state.settings, demo_debug=True)
    for attempt in range(2):
        result = await client.post(BASE + "/shop/buy", json={"item_id": "hat_cap"})
        assert result.status_code == 200
        assert result.json()["balance"] == 300 - 25 * (attempt + 1)
        if attempt == 0:
            cleared = await client.post(
                "/api/demo/debug/inventory", json={"idempotency_key": str(uuid4())}
            )
            assert cleared.status_code == 200
    person = (await client.get(BASE + f"/users/{UID}")).json()["villager"]
    assert (person["coins"], person["xp"]) == (250, 300)
