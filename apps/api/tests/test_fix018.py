"""Repair eligibility must use the same database clock as check-in timestamps."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from psycopg.types.json import Jsonb

from app import disasters
from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID, check_in
from app.models import CheckInInput


def skew_clock(monkeypatch, now, days):
    class ApplicationClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return (now + timedelta(days=days)).astimezone(tz or UTC)

    monkeypatch.setattr(disasters, "datetime", ApplicationClock)


@pytest.mark.parametrize("days", [-7, 7])
async def test_repair_counts_same_transaction_checkins_despite_clock_skew(api, monkeypatch, days):
    _, app = api
    async with app.state.pool.connection() as conn:
        now = (await one(conn, "SELECT now() AS t"))["t"]
        skew_clock(monkeypatch, now, days)
        await disasters.start(conn, VILLAGE_ID, None, "scorch")
        await conn.execute("UPDATE village_world SET disaster=disaster-'repair_plan' WHERE village_id=%s", (VILLAGE_ID,))  # legacy check-in repair (pre-FEAT-028)
        # A check-in can itself start a disaster. Both writes then use the same
        # transaction, so even a database wall-clock timestamp would be too late.
        for index, (uid, *_) in enumerate(SEED_USERS[:3]):
            for contribution in range(2):
                await check_in(
                    conn,
                    VILLAGE_ID,
                    uid,
                    CheckInInput(kind="status", body="Repair", idempotency_key=str(uuid4())),
                )
                d = (
                    await one(
                        conn,
                        "SELECT disaster FROM village_world WHERE village_id=%s",
                        (VILLAGE_ID,),
                    )
                )["disaster"]
                count = index * 2 + contribution + 1
                if count < 6:
                    assert d["checkins"] == count
                    assert d["people"] == index + 1
                else:
                    assert d is None


@pytest.mark.parametrize("days", [-7, 7])
async def test_repair_window_and_outbreak_deadline_use_database_clock(api, monkeypatch, days):
    _, app = api
    async with app.state.pool.connection() as conn:
        now = (await one(conn, "SELECT now() AS t"))["t"]
        d = await disasters.start(conn, VILLAGE_ID, None, "outbreak")
        d.pop("repair_plan", None)  # legacy check-in repair (pre-FEAT-028)
        d["started_at"] = (now - timedelta(hours=72)).isoformat()
        d["deadline"] = (now - timedelta(hours=24)).isoformat()
        await conn.execute(
            "UPDATE village_world SET disaster=%s WHERE village_id=%s", (Jsonb(d), VILLAGE_ID)
        )
        await conn.execute("DELETE FROM check_ins WHERE village_id=%s", (VILLAGE_ID,))
        # Two valid check-ins from each of three people except one just outside
        # the inclusive 48-hour boundary: that old contribution must not repair.
        for index, (uid, *_) in enumerate(SEED_USERS[:3]):
            for seconds in (0, -1 if index == 0 else 1):
                await conn.execute(
                    "INSERT INTO check_ins"
                    "(village_id,user_id,kind,body,idempotency_key,created_at) "
                    "VALUES (%s,%s,'status','Repair',%s,%s)",
                    (
                        VILLAGE_ID,
                        uid,
                        str(uuid4()),
                        now - timedelta(hours=48) + timedelta(seconds=seconds),
                    ),
                )
        skew_clock(monkeypatch, now, days)
        await disasters.sync(conn, VILLAGE_ID)
        d = (
            await one(conn, "SELECT disaster FROM village_world WHERE village_id=%s", (VILLAGE_ID,))
        )["disaster"]
        assert d is not None
        assert (d["checkins"], d["people"], d["pets_away"]) == (5, 3, True)
        await check_in(
            conn,
            VILLAGE_ID,
            SEED_USERS[0][0],
            CheckInInput(kind="status", body="Late repair", idempotency_key=str(uuid4())),
        )
        assert (
            await one(conn, "SELECT disaster FROM village_world WHERE village_id=%s", (VILLAGE_ID,))
        )["disaster"] is None
