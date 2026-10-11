import asyncio
from pathlib import Path

import psycopg
import pytest

from app import catalog, presence
from app.domain import SEED_USERS, VILLAGE_ID
from scripts.scale_benchmark import seed_scale


async def test_scale_seed_refuses_non_scratch_database(api):
    _, app = api
    with psycopg.connect(app.state.settings.database_url) as conn:
        with pytest.raises(RuntimeError, match="own scale001_ scratch database"):
            seed_scale(conn, 100)
        assert conn.execute("SELECT count(*) FROM village_members").fetchone()[0] == 5


async def test_scale_indexes_are_idempotent(api):
    _, app = api
    migration = Path(__file__).resolve().parents[1] / "migrations/053_scale_hot_reads.sql"
    async with app.state.pool.connection() as conn:
        await conn.execute(migration.read_text())
        await conn.execute(migration.read_text())
        for name in (
            "check_ins_member_recent",
            "check_ins_evidence_lookup",
            "activity_events_village_recent",
            "xp_ledger_member_positive",
        ):
            assert (
                await (await conn.execute("SELECT to_regclass(%s) AS idx", (name,))).fetchone()
            )["idx"]


async def test_catalog_cache_observes_updates_rollback_and_isolates_mutation(api):
    _, app = api
    catalog._validated_snapshot.cache_clear()
    async with app.state.pool.connection() as conn:
        first = await catalog.runtime_catalog(conn)
        second = await catalog.runtime_catalog(conn)
        assert catalog._validated_snapshot.cache_info().hits == 1
        key = next(iter(first.entries))
        original = first.entries[key]["name"]
        first.entries[key]["name"] = "Caller mutation must remain private"
        assert second.entries[key]["name"] == original
        await conn.execute(
            "UPDATE content_entries SET definition=jsonb_set(definition,'{name}','\"Fresh published name\"') WHERE id=%s",
            (key,),
        )
        assert (await catalog.runtime_catalog(conn)).entries[key]["name"] == "Fresh published name"
        await conn.rollback()
        assert (await catalog.runtime_catalog(conn)).entries[key]["name"] == original
        assert catalog._validated_snapshot.cache_info().misses == 2


@pytest.mark.asyncio
async def test_presence_100_listeners_share_reads_and_release_group(api, monkeypatch):
    _, app = api
    reads = 0
    original = presence.many

    async def counted(*args, **kwargs):
        nonlocal reads
        reads += 1
        return await original(*args, **kwargs)

    monkeypatch.setattr(presence, "many", counted)

    async def connected():
        return False

    streams = [
        presence.events(app, VILLAGE_ID, SEED_USERS[i % 5][0], connected) for i in range(100)
    ]
    try:
        frames = await asyncio.gather(*(anext(stream) for stream in streams))
        assert reads == 1
        assert all("event: presence" in frame for frame in frames)
        await asyncio.gather(*(anext(stream) for stream in streams))
        assert reads == 2
        async with app.state.pool.connection() as conn:
            await conn.execute(
                "DELETE FROM village_members WHERE village_id=%s AND user_id=%s",
                (VILLAGE_ID, SEED_USERS[0][0]),
            )
        result = await asyncio.gather(
            *(anext(stream) for stream in streams), return_exceptions=True
        )
        assert sum(isinstance(value, StopAsyncIteration) for value in result) == 20
        assert reads == 3
    finally:
        await asyncio.gather(*(stream.aclose() for stream in streams))
    assert presence.state(app).stream_groups == {}
