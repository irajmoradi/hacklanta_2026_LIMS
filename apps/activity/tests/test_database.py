"""Opt-in DB verification in a unique schema, removed even after test failure."""

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import make_conninfo

from config import database_url, load_environment
from core import Signal
from link import parser, update
from repository import Repository

pytestmark = pytest.mark.skipif(
    os.getenv("ACTIVITY_TEST_DB") != "1", reason="set ACTIVITY_TEST_DB=1 for isolated DB check"
)


async def test_migration_replay_feed_and_atomic_counters(monkeypatch):
    load_environment()
    url = database_url()
    schema = "activity_test_" + uuid4().hex
    conn = await psycopg.AsyncConnection.connect(url, autocommit=True, connect_timeout=5)
    async with conn:
        await conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        try:
            await conn.execute(
                sql.SQL("SET search_path TO {}, public").format(sql.Identifier(schema))
            )
            # Minimal versions of the existing contract tables, never public application data.
            await conn.execute("""
                CREATE TABLE users(id uuid PRIMARY KEY,display_name text NOT NULL);
                CREATE TABLE villages(id uuid PRIMARY KEY);
                CREATE TABLE village_members(user_id uuid,village_id uuid);
                CREATE TABLE activity_events(
                    village_id uuid,user_id uuid,type text,payload jsonb
                );
            """)
            migration = Path("sql/001_activity.sql").read_bytes()
            assert not migration.startswith(b"\xef\xbb\xbf")
            await conn.execute(migration.decode("utf-8"))
            await conn.execute(migration.decode("utf-8"))
            row = await (
                await conn.execute(
                    "SELECT count(*) FROM timescaledb_information.hypertables "
                    "WHERE hypertable_schema=%s AND hypertable_name='activity_signals'",
                    (schema,),
                )
            ).fetchone()
            assert row[0] == 1
            uid, villages = uuid4(), [uuid4(), uuid4()]
            await conn.execute("INSERT INTO users VALUES (%s,'Iraj')", (uid,))
            for village in villages:
                await conn.execute("INSERT INTO villages VALUES (%s)", (village,))
                await conn.execute("INSERT INTO village_members VALUES (%s,%s)", (uid, village))
            scoped_url = make_conninfo(url, options=f"-c search_path={schema},public")
            monkeypatch.setenv("DATABASE_URL", scoped_url)
            await update(
                parser().parse_args(
                    ["--user", str(uid), "--steam", "76561198000000000", "--consent"]
                )
            )
            repo = Repository(scoped_url)
            account = (await repo.accounts("steam"))[0]
            now = datetime.now(UTC)
            game = {"appid": 1, "name": "Minecraft", "playtime_forever": 500}
            await repo.steam(account, [game], now)
            game["playtime_forever"] = 620
            await repo.steam(account, [game], now + timedelta(hours=2))
            await repo.steam(account, [game], now + timedelta(hours=3))
            rows = await (await conn.execute("SELECT type,payload FROM activity_events")).fetchall()
            assert len(rows) == 2  # one per village, no initial import or replay duplicates
            assert all(r[0] == "external_activity" for r in rows)
            assert all(r[1]["body"] == "Iraj played Minecraft for 2h" for r in rows)
            await update(parser().parse_args(["--user", str(uid), "--opt-out"]))
            assert await repo.accounts("steam") == []
            await repo.record(account, "steam", Signal("playing", "Ignored", 30, now))
            count = await (await conn.execute("SELECT count(*) FROM activity_signals")).fetchone()
            assert count[0] == 2
            await update(parser().parse_args(["--user", str(uid), "--opt-in", "--consent"]))
            account = (await repo.accounts("steam"))[0]
            game["playtime_forever"] = 900
            await repo.steam(account, [game], now + timedelta(hours=4))
            count = await (await conn.execute("SELECT count(*) FROM activity_signals")).fetchone()
            assert count[0] == 2
            # A failed event insert must roll back BOTH its signal and baseline update.
            await conn.execute(
                "ALTER TABLE activity_events ADD CHECK (type <> 'external_activity') NOT VALID"
            )
            game["playtime_forever"] = 930
            with pytest.raises(psycopg.errors.CheckViolation):
                await repo.steam(account, [game], now + timedelta(hours=5))
            counter = await (
                await conn.execute("SELECT lifetime_minutes FROM external_steam_counters")
            ).fetchone()
            assert counter[0] == 900
            count = await (await conn.execute("SELECT count(*) FROM activity_signals")).fetchone()
            assert count[0] == 2
        finally:
            await conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))
