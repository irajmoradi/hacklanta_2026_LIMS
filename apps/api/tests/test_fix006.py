"""FIX-006 regression and repeatable isolated five-seat HTTP benchmark."""

import json
from time import perf_counter
from uuid import uuid4

from psycopg import AsyncConnection

from app.domain import SEED_USERS, VILLAGE_ID, balance, coin_balance, villager, villagers

BASE = f"/api/villages/{VILLAGE_ID}"


async def test_core_timings(api, monkeypatch):
    client, _ = api
    execute = AsyncConnection.execute
    queries = 0

    async def counted(self, *args, **kwargs):
        nonlocal queries
        queries += 1
        return await execute(self, *args, **kwargs)

    monkeypatch.setattr(AsyncConnection, "execute", counted)
    results = {}
    for name, method, path, body in [
        ("village", "GET", BASE, None),
        ("house", "PATCH", "/api/me", {"village_id": str(VILLAGE_ID), "house_style": "modern"}),
        ("idle", "PATCH", "/api/me", {"idle_activity": "home"}),
        ("checkin", "POST", BASE + "/check-ins", {"kind": "status", "body": "FIX-006 benchmark"}),
    ]:
        samples, counts = [], []
        for _ in range(21):
            data = dict(body) if body else None
            if name == "checkin":
                data["idempotency_key"] = str(uuid4())
            queries = 0
            start = perf_counter()
            response = await client.request(method, path, json=data)
            assert response.status_code == 200, response.text
            samples.append(round((perf_counter() - start) * 1000, 2))
            counts.append(queries)
        results[name] = {
            "warm_p95_ms": sorted(samples[1:])[18],
            "queries": counts[-1],
            "samples_ms": samples,
        }
    print("FIX006_TIMINGS=" + json.dumps(results))


async def test_hot_migration_keeps_pooled_requests_available(api):
    client, app = api
    await app.state.pool.resize(1, 1)
    async with app.state.pool.connection() as conn:
        assert conn.prepare_threshold is None
        pid = conn.info.backend_pid
    # Exceed psycopg's default automatic preparation threshold on both SELECT * reads.
    for _ in range(8):
        assert (await client.get(BASE)).status_code == 200
    async with app.state.pool.connection() as conn:
        assert conn.info.backend_pid == pid
        await conn.execute("ALTER TABLE users ADD COLUMN fix006_probe text")
        await conn.execute("ALTER TABLE village_members ADD COLUMN fix006_probe text")
    try:
        assert (await client.get(BASE)).status_code == 200
        assert (await client.get("/api/me")).status_code == 200
        async with app.state.pool.connection() as conn:
            assert conn.info.backend_pid == pid
    finally:
        async with app.state.pool.connection() as conn:
            await conn.execute("ALTER TABLE users DROP COLUMN fix006_probe")
            await conn.execute("ALTER TABLE village_members DROP COLUMN fix006_probe")


async def test_batch_uses_constant_queries_and_preserves_profiles(api, monkeypatch):
    _, app = api
    execute = AsyncConnection.execute
    queries = 0

    async def counted(self, *args, **kwargs):
        nonlocal queries
        queries += 1
        return await execute(self, *args, **kwargs)

    monkeypatch.setattr(AsyncConnection, "execute", counted)
    async with app.state.pool.connection() as conn:
        all_rows = await villagers(conn, VILLAGE_ID)
        batch_queries = queries
        assert len(all_rows) == 5
        assert batch_queries == 7
        for uid, _, _ in SEED_USERS:
            queries = 0
            single = await villager(conn, VILLAGE_ID, uid)
            assert queries == batch_queries
            assert single == next(row for row in all_rows if row["user_id"] == uid)
            assert single["coins"] == await coin_balance(conn, VILLAGE_ID, uid)
            assert single["xp"] == await balance(conn, VILLAGE_ID, uid)
        assert all(row["avatar"]["body"]["kind"] == "preset" for row in all_rows)
