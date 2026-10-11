import psycopg
import pytest

from app.domain import SEED_USERS, VILLAGE_ID

BASE = f"/api/villages/{VILLAGE_ID}"
UID = SEED_USERS[0][0]


@pytest.mark.parametrize(
    "activity",
    ["working_out", "gaming", "studying", "home", "gardening", "dancing", "reading", "food"]
)
async def test_idle_activity_round_trip(api, activity):
    client, _ = api
    response = await client.patch("/api/me", json={"idle_activity": activity})
    assert response.status_code == 200
    assert response.json()["user"]["idle_activity"] == activity
    assert (await client.get("/api/me")).json()["user"]["idle_activity"] == activity
    village = (await client.get(BASE)).json()
    assert (
        next(p for p in village["villagers"] if p["user_id"] == str(UID))["idle_activity"]
        == activity
    )
    assert (await client.get(f"{BASE}/users/{UID}")).json()["villager"]["idle_activity"] == activity
    # An unrelated partial update preserves the preference.
    assert (await client.patch("/api/me", json={"roast_ok": True})).json()["user"][
        "idle_activity"
    ] == activity


@pytest.mark.parametrize("value", ["flying", "", None, 1])
async def test_invalid_idle_activity(api, value):
    client, _ = api
    assert (await client.patch("/api/me", json={"idle_activity": value})).status_code == 422


async def test_pet_required_and_database_constraint(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE inventory SET equipped=false WHERE user_id=%s", (UID,))
        await conn.execute("UPDATE custom_items SET equipped=false WHERE owner=%s", (UID,))
    assert not (await client.get("/api/me")).json()["user"]["has_equipped_pet"]
    assert (await client.patch("/api/me", json={"idle_activity": "walk_pet"})).status_code == 422
    async with app.state.pool.connection() as conn:
        await conn.execute(
            """INSERT INTO inventory (village_id,user_id,item_id,equipped)
            VALUES (%s,%s,'pet_dog',true) ON CONFLICT (village_id,user_id,item_id)
            DO UPDATE SET equipped=true""",
            (VILLAGE_ID, UID),
        )
    assert (await client.get("/api/me")).json()["user"]["has_equipped_pet"]
    assert (await client.patch("/api/me", json={"idle_activity": "walk_pet"})).status_code == 200
    async with app.state.pool.connection() as conn:
        with pytest.raises(psycopg.errors.CheckViolation):
            async with conn.transaction():
                await conn.execute("UPDATE users SET idle_activity='flying' WHERE id=%s", (UID,))


async def test_studying_migration_is_repeatable_and_preserves_preferences(api):
    from pathlib import Path

    client, app = api
    await client.patch("/api/me", json={"idle_activity": "studying"})
    migration = Path(__file__).parents[1] / "migrations/021_idle_studying.sql"
    async with app.state.pool.connection() as conn:
        # This historical migration narrows the constraint installed by 046.
        # TRUNCATE between tests resets rows, not DDL; don't leak the old schema.
        async with conn.transaction(force_rollback=True):
            for _ in range(2):
                await conn.execute(migration.read_text(encoding="utf-8"))
            row = await (
                await conn.execute("SELECT idle_activity FROM users WHERE id=%s", (UID,))
            ).fetchone()
            assert row["idle_activity"] == "studying"
    assert (await client.get("/api/me")).json()["user"]["idle_activity"] == "studying"
