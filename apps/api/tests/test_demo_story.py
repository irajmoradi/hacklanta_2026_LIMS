from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from PIL import Image
from psycopg.types.json import Jsonb

from app import auditor, competitions
from app.db import many, one
from app.domain import VILLAGE_ID, villager
from app.mayor import Mayor
from scripts.demo_check import summary
from scripts.demo_server import add_demo_evidence
from scripts.demo_story import UIDS, clear_demo, make_evidence, post_times, story


async def snapshot(conn):
    """Compare complete rows, not merely counts, including IDs and timestamps."""
    return await many(
        conn,
        """SELECT tablename FROM pg_tables
        WHERE schemaname=current_schema() ORDER BY tablename""",
    )


async def all_rows(conn):
    from psycopg import sql

    result = {}
    for row in await snapshot(conn):
        result[row["tablename"]] = await many(
            conn,
            sql.SQL("SELECT to_jsonb(t) AS row FROM {} t ORDER BY to_jsonb(t)::text").format(
                sql.Identifier(row["tablename"])
            ),
        )
    return result


@pytest.fixture
def no_paid(monkeypatch):
    async def fail(*args, **kwargs):
        pytest.fail("Demo must never call a paid provider or background reviewer")

    monkeypatch.setattr(Mayor, "generate", fail)
    monkeypatch.setattr(auditor, "vision", fail)
    monkeypatch.setattr(competitions, "review_entry", fail)
    monkeypatch.setattr("app.voice.synthesize", fail)


async def test_demo_replay_and_state(api, no_paid):
    client, app = api
    async with app.state.pool.connection() as conn:
        await story(conn, reset=True, asset_dir=app.state.settings.asset_dir)
    async with app.state.pool.connection() as conn:
        before = await all_rows(conn)
        assert not await story(conn, asset_dir=app.state.settings.asset_dir)
        assert await all_rows(conn) == before
        villagers = [await villager(conn, VILLAGE_ID, uid) for uid in UIDS]
        assert [v["has_crown"] for v in villagers] == [False, False, True, False, False]
        assert {"pet_dog", "house_backyard"} <= set(villagers[1]["equipped_ids"])
        assert len({v["xp"] for v in villagers}) == 5
        assert len({v["level"] for v in villagers}) >= 3
        assert [v["coins"] for v in villagers] == [450, 410, 915, 220, 375]
        assert [v["xp"] for v in villagers] == [500, 610, 1085, 220, 385]
        counts = await many(
            conn,
            "SELECT user_id,count(*) AS n FROM check_ins WHERE village_id=%s "
            "GROUP BY user_id ORDER BY user_id",
            (VILLAGE_ID,),
        )
        assert [r["n"] for r in counts] == [4, 3, 5, 2, 4]
        suspicious = await one(
            conn,
            "SELECT c.* FROM check_ins c JOIN evidence_reviews r "
            "ON c.id=r.check_in_id WHERE r.verdict='suspicious'",
        )
        assert not await one(
            conn,
            "SELECT 1 FROM xp_ledger WHERE source_key=%s",
            (f"checkin:{VILLAGE_ID}:{UIDS[1]}:{suspicious['idempotency_key']}",),
        )
        assert not await one(conn, "SELECT 1 FROM check_ins WHERE created_at>now()")
        assert not await one(conn, "SELECT 1 FROM mayor_outbox")
        output = await summary(conn)
        assert "Agent decisions: 18" in output and "10 coins / 5% auditor fee" in output
        assert not await one(conn, "SELECT 1 FROM solana_intents")
    base = f"/api/villages/{VILLAGE_ID}"
    village = (await client.get(base)).json()
    assert any(e["penalty"] == "crater" for e in village["active_events"])
    assert sum(e["kind"] == "challenge" for e in village["active_events"]) == 1
    current = (await client.get(base + "/weekly/current")).json()
    assert current["auditor_id"] == str(UIDS[3])
    assert [g["user_id"] for g in current["goals"] if g["excluded"]] == [str(UIDS[3])]
    comps = (await client.get(base + "/competitions")).json()
    study = next(c for c in comps if not c["friendly"])
    assert study["entry_coins"] == 10 and study["entry_lamports"] == 0
    detail = (await client.get(base + f"/competitions/{study['id']}")).json()
    assert sorted(e["decision"] for e in detail["entries"]) == ["confirmed", "pending"]
    assert all(p["user_id"] != str(UIDS[3]) for p in detail["participants"])
    async with app.state.pool.connection() as conn:
        keys = await many(
            conn,
            "SELECT DISTINCT evidence_asset_id AS key FROM check_ins "
            "WHERE evidence_asset_id IS NOT NULL",
        )
    for row in keys:
        response = await client.get("/api/assets/" + row["key"])
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
    agent_log = await client.get(base + "/agent-log")
    assert agent_log.status_code == 200


async def test_demo_reset_preserves_other_village_and_global_assets(api, no_paid):
    _, app = api
    other = uuid4()
    async with app.state.pool.connection() as conn:
        await story(conn, reset=True, asset_dir=app.state.settings.asset_dir)
        # Same user in two villages catches unsafe user-scoped deletion/reset.
        await conn.execute(
            "INSERT INTO villages(id,name,seed,invite_code) VALUES(%s,'Other',8,%s)",
            (other, str(other)),
        )
        await conn.execute(
            "INSERT INTO village_members(village_id,user_id,house_slot) VALUES(%s,%s,0)",
            (other, UIDS[4]),
        )
        goal = await one(
            conn,
            "INSERT INTO goals(village_id,user_id,week_start,title) "
            "VALUES(%s,%s,CURRENT_DATE,'Unrelated') RETURNING id",
            (other, UIDS[4]),
        )
        cid = uuid4()
        key = "other:" + str(cid)
        await conn.execute(
            "INSERT INTO check_ins(id,village_id,user_id,goal_id,kind,body,idempotency_key) "
            "VALUES(%s,%s,%s,%s,'progress','Keep me',%s)",
            (cid, other, UIDS[4], goal["id"], key),
        )
        await conn.execute(
            "INSERT INTO check_in_keys(idempotency_key,check_in_id) VALUES(%s,%s)", (key, cid)
        )
        await conn.execute(
            "INSERT INTO evidence_reviews(check_in_id,verdict,confidence,reason,model) "
            "VALUES(%s,'verified',1,'Keep me','test')",
            (cid,),
        )
        await conn.execute(
            "INSERT INTO activity_events(village_id,user_id,type,payload) "
            "VALUES(%s,%s,'checkin',%s)",
            (other, UIDS[4], Jsonb({"body": "Keep me"})),
        )
        await conn.execute(
            "INSERT INTO xp_ledger(village_id,user_id,delta,reason,source_key) "
            "VALUES(%s,%s,77,'test',%s)",
            (other, UIDS[4], key),
        )
        await conn.execute(
            "INSERT INTO avatar_assets(user_id,revision,manifest) VALUES(%s,77,%s)",
            (UIDS[4], Jsonb({"head": {"kind": "lam_head", "asset": "do-not-touch"}})),
        )
        before = await all_rows(conn)
    async with app.state.pool.connection() as conn:
        await story(conn, reset=True, asset_dir=app.state.settings.asset_dir)
        after = await all_rows(conn)
        for table in before:
            preserved = [r for r in before[table] if r["row"].get("village_id") == str(other)]
            assert all(r in after[table] for r in preserved), table
        for table in ["users", "avatar_assets", "avatar_jobs", "voice_lines", "catalog_items"]:
            assert before[table] == after[table], table
        assert (
            next(r for r in before["villages"] if r["row"]["id"] == str(other)) in after["villages"]
        )
        for table in ["check_in_keys", "evidence_reviews"]:
            keep = [r for r in before[table] if r["row"]["check_in_id"] == str(cid)]
            assert all(r in after[table] for r in keep)
        assert len(before["check_ins"]) == len(after["check_ins"])
        assert len(before["evidence_reviews"]) == len(after["evidence_reviews"])


async def test_demo_rollback_and_legacy_guard(api, monkeypatch, no_paid):
    _, app = api
    async with app.state.pool.connection() as conn:
        before = await all_rows(conn)
        with pytest.raises(ValueError, match="legacy"):
            await story(conn, asset_dir=app.state.settings.asset_dir)
        assert await all_rows(conn) == before

    async def fail(*args, **kwargs):
        raise RuntimeError("injected late failure")

    monkeypatch.setattr("scripts.demo_story.seed_events", fail)
    with pytest.raises(RuntimeError, match="late failure"):
        async with app.state.pool.connection() as conn:
            await story(conn, reset=True, asset_dir=app.state.settings.asset_dir)
    async with app.state.pool.connection() as conn:
        assert await all_rows(conn) == before


async def test_demo_fresh_and_name_guard(api, no_paid):
    _, app = api
    async with app.state.pool.connection() as conn:
        await clear_demo(conn)
        assert await story(conn, asset_dir=app.state.settings.asset_dir)
        await conn.execute("UPDATE villages SET name='Not the demo' WHERE id=%s", (VILLAGE_ID,))
        with pytest.raises(ValueError, match="differently named"):
            await story(conn, reset=True, asset_dir=app.state.settings.asset_dir)


@pytest.mark.parametrize("weekday", range(7))
def test_demo_week_boundary_dates(weekday):
    now = datetime(2026, 10, 5, 0, 0, 1, tzinfo=UTC) + timedelta(days=weekday)
    for slot, count in enumerate([4, 3, 5, 2, 4]):
        dates = post_times(now, count, slot)
        assert len(dates) == count
        assert all(t <= now and t.date() >= now.date() - timedelta(days=weekday) for t in dates)
        assert dates == sorted(dates)


def test_demo_synthetic_images(tmp_path):
    keys = make_evidence(tmp_path)
    before = {key: (tmp_path / key).read_bytes() for key in keys.values()}
    make_evidence(tmp_path)
    assert before == {key: (tmp_path / key).read_bytes() for key in keys.values()}
    for key in keys.values():
        with Image.open(tmp_path / key) as image:
            assert image.size == (720, 460)
            image.verify()


async def test_demo_server_keeps_existing_assets_and_authorizes(api, outsider, tmp_path):
    client, app = api
    original = app.state.settings.asset_dir
    keys = make_evidence(tmp_path / "demo")
    add_demo_evidence(app, tmp_path / "demo")
    assert app.state.settings.asset_dir == original
    path = "/api/assets/" + keys["canvas"]
    assert (await client.get(path)).status_code == 200
    assert (await client.get(path, headers=outsider)).status_code == 403
    client.headers.pop("X-Demo-User")
    assert (await client.get(path)).status_code == 401
