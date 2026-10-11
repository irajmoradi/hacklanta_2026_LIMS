"""Farm economy exercises the real PostgreSQL inventory and serialized buys."""

import asyncio

import psycopg

from app.domain import SEED_USERS, VILLAGE_ID, award
from scripts.migrate import apply_additions

BASE = f"/api/villages/{VILLAGE_ID}"
UID = SEED_USERS[0][0]


async def buy(client, item):
    return await client.post(BASE + "/shop/buy", json={"item_id": item})


async def test_farm_gates_cap_concurrency_and_migration_replay(api, outsider):
    client, app = api
    assert (await buy(client, "house_paddock")).status_code == 409
    assert (await buy(client, "chicken")).status_code == 409
    async with app.state.pool.connection() as conn:
        await award(conn, VILLAGE_ID, UID, 3000, "checkin", "farm-test-funding")
    # Village XP unlocks farm_store through the same progression as pet_shelter.
    village = (await client.get(BASE)).json()
    assert "farm_store" in village["world"]["unlocked"]
    assert (await buy(client, "chicken")).status_code == 409  # paddock still needed
    assert (await buy(client, "house_paddock")).status_code == 200
    for item in (
        "house_backyard",
        "pet_dog",
        "chicken",
        "duckling",
        "goat_kid",
        "calf",
        "chicken_friend",
    ):
        assert (await buy(client, item)).status_code == 200
    before = (await client.get(BASE + "/shop")).json()["balance"]
    results = await asyncio.gather(buy(client, "duckling_friend"), buy(client, "goat_kid_friend"))
    assert sorted(r.status_code for r in results) == [200, 409]
    won = "duckling_friend" if results[0].status_code == 200 else "goat_kid_friend"
    assert (await buy(client, "calf_friend")).status_code == 409
    assert (await buy(client, won)).status_code == 409
    assert (await client.get(BASE + "/shop")).json()["balance"] == before - (
        25 if won == "duckling_friend" else 60
    )
    assert (
        await client.post(BASE + "/inventory/unequip", json={"item_id": "house_paddock"})
    ).status_code == 409
    assert (
        await client.post(BASE + "/shop/buy", headers=outsider, json={"item_id": "chicken"})
    ).status_code == 403
    with psycopg.connect(app.state.settings.database_url) as conn:
        apply_additions(conn)
        apply_additions(conn)
    person = next(
        p for p in (await client.get(BASE)).json()["villagers"] if p["user_id"] == str(UID)
    )
    assert len([i for i in person["equipped"] if i["slot"] == "farm_animal"]) == 6
    assert {"pet_dog", "house_backyard", "house_paddock"} <= set(person["equipped_ids"])
    await client.post(BASE + "/inventory/unequip", json={"item_id": "chicken"})
    assert (await buy(client, "calf_friend")).status_code == 409  # cap is ownership
    result = await client.post(BASE + "/inventory/equip", json={"item_id": "chicken"})
    assert len([i for i in result.json()["equipped"] if i["slot"] == "farm_animal"]) == 6


async def test_farm_insufficient_xp_does_not_mutate(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO village_unlocks(village_id,building) VALUES(%s,'farm_store')",
            (VILLAGE_ID,),
        )
    assert (await buy(client, "house_paddock")).status_code == 200
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "DELETE FROM coin_ledger WHERE village_id=%s AND user_id=%s", (VILLAGE_ID, UID)
        )
    assert (await buy(client, "chicken")).status_code == 409
    shop = (await client.get(BASE + "/shop")).json()
    assert shop["balance"] == 0
    assert not next(i for i in shop["items"] if i["id"] == "chicken")["owned"]
