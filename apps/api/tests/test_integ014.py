from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest

from app import disasters
from app.domain import SEED_USERS, VILLAGE_ID


async def test_renumbered_migrations_preserve_stretch_and_furniture(api):
    client, app = api
    base = f"/api/villages/{VILLAGE_ID}"
    goal = (await client.post(base + "/goals", json={"title": "Integration goal"})).json()
    path = base + f"/goals/{goal['id']}"
    assert (await client.post(path + "/status", json={"status": "done"})).status_code == 200
    assert (await client.post(path + "/stretch", json={"title": "Another run"})).status_code == 200
    house = f"/api/houses/{SEED_USERS[0][0]}?vid={VILLAGE_ID}"
    before = (await client.get(house)).json()
    migrations = Path(__file__).resolve().parents[1] / "migrations"
    numbers = [p.name.split("_")[0] for p in migrations.glob("*.sql")]
    assert len(numbers) == len(set(numbers))
    async with app.state.pool.connection() as conn:
        for _ in range(2):
            for name in [
                "049_goal_stretch.sql",
                "050_house_interiors.sql",
                "051_house_presence.sql",
            ]:
                await conn.execute((migrations / name).read_text())
    profile = (await client.get(base + f"/users/{SEED_USERS[0][0]}")).json()
    assert profile["goal"]["stretches"][0]["title"] == "Another run"
    assert (await client.get(house)).json()["items"] == before["items"]


@pytest.mark.parametrize("skew", [-3600, 3600])
async def test_repair_counts_use_database_clock(api, monkeypatch, skew):
    client, app = api

    class SkewedClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime.now(tz) + timedelta(seconds=skew)

    monkeypatch.setattr(disasters, "datetime", SkewedClock)
    async with app.state.pool.connection() as conn:
        await disasters.start(conn, VILLAGE_ID, None, "scorch")
        await conn.execute("UPDATE village_world SET disaster=disaster-'repair_plan' WHERE village_id=%s", (VILLAGE_ID,))  # legacy check-in repair (pre-FEAT-028)
    base = f"/api/villages/{VILLAGE_ID}"
    assert (await client.get(base)).json()["world"]["disaster"]["checkins"] == 0
    for uid, *_ in SEED_USERS[:3]:
        for _ in range(2):
            response = await client.post(
                base + "/check-ins",
                headers={"X-Demo-User": str(uid)},
                json={"kind": "status", "body": "Repair", "idempotency_key": str(uuid4())},
            )
            assert response.status_code == 200
    assert (await client.get(base)).json()["world"]["disaster"] is None
