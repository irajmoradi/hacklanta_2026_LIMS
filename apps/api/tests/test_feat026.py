"""Gameplay over mock HTTP transport; all generation and photo review are mocked."""

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from test_api006 import send
from test_api006 import sender as sender_fixture
from test_feat011 import photo
from test_feat011 import vision as vision_fixture

from app import domain, inbound_play
from app.db import many, one
from app.mayor import Mayor
from app.security import LimitExceeded

sender = sender_fixture
vision = vision_fixture
BASE = f"/api/villages/{domain.VILLAGE_ID}"


@pytest.fixture(autouse=True)
def generous_transport(api):
    _, app = api
    app.state.settings.cost_limiter.caps["photon"] = (500, 500, 500)


@pytest.mark.parametrize(
    "text,kind",
    [
        ("check in: ran", "daily"),
        ("daily: ran", "daily"),
        ("checkin: ran", "daily"),
        ("progress: ran", "progress"),
        ("goal: Run", "goal"),
        ("stretch: More", "stretch"),
        ("go beyond", "stretch"),
        ("challenges", "challenges"),
        ("join abcdef12", "join"),
        ("enter abcdef12: ran", "enter"),
        ("status", "status"),
        ("help", "help"),
    ],
)
def test_parse(text, kind):
    assert inbound_play.parse(text)["intent"] == kind


async def test_daily_caps_status_and_replay(api, sender, monkeypatch):
    client, app = api
    generate = AsyncMock(side_effect=AssertionError("Keywords must not generate"))
    monkeypatch.setattr(Mayor, "generate", generate)
    await send(client, "goal: Run three times")
    first, retry = await asyncio.gather(
        *[send(client, "check in: Ran today", "daily-once") for _ in range(2)]
    )
    assert first.status_code == 200 and first.json() == retry.json()
    assert first.json()["processed_checkin"]
    assert "+10 XP" in first.json()["reply_text"]
    assert "+0 XP" in (await send(client, "daily: Again")).json()["reply_text"]
    assert (await send(client, "daily: changed", "daily-once")).status_code == 409
    status = (await send(client, "status")).json()["reply_text"]
    assert "checked in" in status and "Run three times" in status and "coins" in status
    assert len((await send(client, "help")).json()["reply_text"].splitlines()) == 6
    generate.assert_not_called()
    async with app.state.pool.connection() as conn:
        assert len(await many(conn, "SELECT id FROM check_ins WHERE user_id=%s", (sender,))) == 2


async def test_goal_retitle_stretch_and_finalized_rules(api, sender):
    client, app = api
    headers = {"X-Demo-User": str(sender)}
    await send(client, "goal: Run")
    async with app.state.pool.connection() as conn:
        goal = await inbound_play.current_goal(conn, domain.VILLAGE_ID, sender)
    path = BASE + f"/goals/{goal['id']}"
    await client.post(path + "/status", headers=headers, json={"status": "done"})
    await send(client, "goal: Run three times")
    async with app.state.pool.connection() as conn:
        assert (await inbound_play.current_goal(conn, domain.VILLAGE_ID, sender))[
            "status"
        ] == "active"
    assert "Complete your goal" in (await send(client, "go beyond")).json()["reply_text"]
    await client.post(path + "/status", headers=headers, json={"status": "done"})
    assert "Stretch saved" in (await send(client, "stretch: Run four times")).json()["reply_text"]
    assert (await send(client, "progress: Fourth run")).json()["processed_checkin"]
    async with app.state.pool.connection() as conn:
        row = await one(conn, "SELECT stretch_tier FROM check_ins WHERE user_id=%s", (sender,))
        assert row["stretch_tier"] == 1
        await conn.execute(
            "INSERT INTO weekly_audits(village_id,week_start,status) VALUES(%s,%s,'finalized')",
            (domain.VILLAGE_ID, domain.monday()),
        )
    assert "finalized" in (await send(client, "goal: Replace")).json()["reply_text"]
    assert not (await send(client, "progress: Late run")).json()["processed_checkin"]


@pytest.mark.parametrize(
    "intent,text",
    [
        ("daily", "I had a great day"),
        ("progress", "I ran 5k today"),
        ("goal", "Set my goal to run three times"),
        ("stretch", "I want to go further"),
    ],
)
async def test_classifier_confirmation_cancel_replay(api, sender, monkeypatch, intent, text):
    client, app = api
    await send(client, "goal: Run three times")
    if intent == "stretch":
        async with app.state.pool.connection() as conn:
            await conn.execute("UPDATE goals SET status='done' WHERE user_id=%s", (sender,))
    generate = AsyncMock(return_value=inbound_play.Intent(intent=intent))
    monkeypatch.setattr(Mayor, "generate", generate)
    response = await send(client, text)
    assert "Reply Y/N" in response.json()["reply_text"]
    assert not response.json()["processed_checkin"]
    async with app.state.pool.connection() as conn:
        pending = await one(
            conn,
            "SELECT response FROM inbound_messages WHERE message_id=%s",
            (inbound_play.pending_key(sender),),
        )
        assert pending["response"]["user_id"] == str(sender)
    assert "Cancelled" in (await send(client, "N")).json()["reply_text"]
    await send(client, text)
    results = await asyncio.gather(*[send(client, "Y", "yes-once") for _ in range(2)])
    assert results[0].json() == results[1].json()
    assert "saved" in results[0].json()["reply_text"] or "Logged" in results[0].json()["reply_text"]
    assert "Nothing is waiting" in (await send(client, "Y")).json()["reply_text"]
    assert generate.await_count == 2


async def test_photo_progress_and_inferred_confirmation(api, sender, monkeypatch):
    client, app = api
    await send(client, "goal: Run three times")
    first = await photo(client, mid="explicit", caption="progress: Ran 5k")
    assert first.json()["processed_checkin"], first.text
    monkeypatch.setattr(
        Mayor, "generate", AsyncMock(return_value=inbound_play.Intent(intent="progress"))
    )
    response = await photo(client, mid="natural", caption="I ran 5k today")
    assert "Reply Y/N" in response.json()["reply_text"]
    assert (await send(client, "Y")).json()["processed_checkin"]
    assert (await photo(client, mid="natural", caption="I ran 5k today")).json() == response.json()
    async with app.state.pool.connection() as conn:
        rows = await many(
            conn,
            "SELECT i.*,r.verdict FROM check_ins i JOIN evidence_reviews r "
            "ON r.check_in_id=i.id WHERE i.user_id=%s",
            (sender,),
        )
        assert len(rows) == 2
        assert all(r["evidence_asset_id"] and r["verdict"] == "verified" for r in rows)


async def test_challenge_consent_entries_and_photo_routing(api, sender):
    client, app = api
    async with app.state.pool.connection() as conn:
        await domain.coin_award(conn, domain.VILLAGE_ID, sender, 30, "test", "text-entry-coins")
    # Creator is a different seeded villager; sender can join but cannot audit.
    created = await client.post(
        BASE + "/competitions",
        json={
            "title": "Run 5k",
            "terms": "Show your run",
            "entry_coins": 10,
            "auditor_fee_bps": 100,
            "auditor_id": str(domain.SEED_USERS[1][0]),
        },
    )
    assert created.status_code == 200, created.text
    cid = created.json()["id"]
    code = cid[:8]
    assert code in (await send(client, "challenges")).json()["reply_text"]
    assert "Opt in" in (await send(client, f"enter {code}: Ran")).json()["reply_text"]
    consent = (await send(client, f"join {code}")).json()["reply_text"]
    assert "Show your run" in consent and "10 coins" in consent and "100 bps" in consent
    assert "Joined" in (await send(client, "Y")).json()["reply_text"]
    async with app.state.pool.connection() as conn:
        assert await domain.coin_balance(conn, domain.VILLAGE_ID, sender) == 20
    assert (
        "Photo evidence required" in (await send(client, f"enter {code}: Ran")).json()["reply_text"]
    )
    entry = await photo(client, mid="entry", caption=f"enter {code}: Ran")
    assert "Entry recorded" in entry.json()["reply_text"]
    await photo(client, mid="entry", caption=f"enter {code}: Ran")
    await send(client, "goal: Run more")
    assert (await photo(client, caption="progress: Another run")).json()["processed_checkin"]
    async with app.state.pool.connection() as conn:
        assert (
            len(
                await many(
                    conn, "SELECT * FROM competition_entries WHERE competition_id=%s", (cid,)
                )
            )
            == 1
        )
        assert len(await many(conn, "SELECT * FROM check_ins WHERE user_id=%s", (sender,))) == 1


async def test_sol_text_join_requires_wallet_receipt(api, sender):
    client, app = api
    created = await client.post(
        BASE + "/competitions",
        json={
            "title": "Devnet run",
            "terms": "Show your run",
            "entry_lamports": 123,
            "deadline": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        },
    )
    assert created.status_code == 200, created.text
    cid = created.json()["id"]
    assert (
        "confirmed devnet wallet transaction"
        in (await send(client, f"join {cid[:8]}")).json()["reply_text"]
    )
    assert "Nothing is waiting" in (await send(client, "Y")).json()["reply_text"]
    async with app.state.pool.connection() as conn:
        assert not await one(
            conn, "SELECT 1 FROM competition_participants WHERE competition_id=%s", (cid,)
        )


async def test_coin_join_reconfirms_changed_stake_and_charges_once(api, sender):
    client, app = api
    async with app.state.pool.connection() as conn:
        await domain.coin_award(conn, domain.VILLAGE_ID, sender, 30, "test", "consent-coins")
    created = await client.post(
        BASE + "/competitions",
        json={"title": "Run", "terms": "Run once", "entry_coins": 5},
    )
    assert created.status_code == 200, created.text
    cid = created.json()["id"]
    assert "5 coins" in (await send(client, f"join {cid[:8]}")).json()["reply_text"]
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE competitions SET entry_coins=10 WHERE id=%s", (cid,))
    assert "10 coins" in (await send(client, "Y")).json()["reply_text"]
    async with app.state.pool.connection() as conn:
        assert await domain.coin_balance(conn, domain.VILLAGE_ID, sender) == 30
    assert "Joined" in (await send(client, "Y")).json()["reply_text"]
    await send(client, f"join {cid[:8]}")
    assert "Joined" in (await send(client, "Y")).json()["reply_text"]
    async with app.state.pool.connection() as conn:
        assert await domain.coin_balance(conn, domain.VILLAGE_ID, sender) == 20


async def test_expiry_goal_change_stop_and_classifier_cap(api, sender, monkeypatch):
    client, app = api
    await send(client, "goal: Run")
    monkeypatch.setattr(
        Mayor, "generate", AsyncMock(return_value=inbound_play.Intent(intent="progress"))
    )
    await send(client, "I ran today")
    await send(client, "goal: Swim")
    assert "goal changed" in (await send(client, "Y")).json()["reply_text"]
    await send(client, "I swam today")
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE inbound_messages SET response=jsonb_set(response,'{expires}',"
            "'\"2000-01-01T00:00:00+00:00\"') WHERE message_id=%s",
            (inbound_play.pending_key(sender),),
        )
    assert "expired" in (await send(client, "Y")).json()["reply_text"]
    await send(client, "I swam today")
    assert "off" in (await photo(client, caption="STOP")).json()["reply_text"]
    assert "Nothing is waiting" in (await send(client, "Y")).json()["reply_text"]
    monkeypatch.setattr(Mayor, "generate", AsyncMock(side_effect=LimitExceeded(10)))
    assert (await send(client, "I swam today")).status_code == 429


async def test_scored_friendly_entry_and_changed_join_terms(api, sender):
    client, app = api
    created = await client.post(
        BASE + "/competitions",
        json={
            "title": "Distance",
            "terms": "Kilometres run",
            "friendly": True,
            "scoring": "scoreboard",
            "unit": "km",
        },
    )
    cid = created.json()["id"]
    code = cid[:8]
    await send(client, f"join {code}")
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE competitions SET terms='Miles run' WHERE id=%s", (cid,))
    assert "Miles run" in (await send(client, "Y")).json()["reply_text"]
    async with app.state.pool.connection() as conn:
        assert not await one(
            conn, "SELECT 1 FROM competition_participants WHERE competition_id=%s", (cid,)
        )
    assert "Joined" in (await send(client, "Y")).json()["reply_text"]
    assert (
        "requires a claimed value"
        in (await send(client, f"enter {code}: Ran")).json()["reply_text"]
    )
    first = await send(client, f"enter {code}: value=5 Ran", "numeric-entry")
    assert "Entry recorded" in first.json()["reply_text"]
    assert (
        await send(client, f"enter {code}: value=5 Ran", "numeric-entry")
    ).json() == first.json()
    async with app.state.pool.connection() as conn:
        rows = await many(conn, "SELECT * FROM competition_entries WHERE competition_id=%s", (cid,))
        assert len(rows) == 1 and rows[0]["claimed_value"] == 5
        await conn.execute("UPDATE competitions SET status='settled' WHERE id=%s", (cid,))
    assert (
        "current codes" in (await send(client, f"enter {code}: value=6 Ran")).json()["reply_text"]
    )


async def test_code_collision_is_rejected(monkeypatch):
    monkeypatch.setattr(
        inbound_play,
        "many",
        AsyncMock(
            return_value=[
                {"id": UUID("aaaaaaaa-0000-0000-0000-000000000001")},
                {"id": UUID("aaaaaaaa-0000-0000-0000-000000000002")},
            ]
        ),
    )
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as error:
        await inbound_play.resolve(None, domain.VILLAGE_ID, "aaaaaaaa")
    assert error.value.status_code == 422


async def test_photo_stop_survives_reply_cap(api, sender):
    client, app = api
    app.state.settings.cost_limiter.caps["photon"] = (0, 0, 0)
    assert (await photo(client, caption="STOP")).status_code == 429
    async with app.state.pool.connection() as conn:
        user = await one(
            conn, "SELECT agent_msgs_ok,receive_villagergrams FROM users WHERE id=%s", (sender,)
        )
        assert not user["agent_msgs_ok"] and not user["receive_villagergrams"]


@pytest.mark.parametrize(
    "intent,expected",
    [
        ("status", "Today (UTC)"),
        ("help", "check in:"),
        ("challenges", "No open challenges"),
    ],
)
async def test_classifier_read_intents(api, sender, monkeypatch, intent, expected):
    client, _ = api
    monkeypatch.setattr(
        Mayor, "generate", AsyncMock(return_value=inbound_play.Intent(intent=intent))
    )
    response = await send(client, "Tell me about the village")
    assert expected in response.json()["reply_text"]
    assert not response.json()["processed_checkin"]


async def test_classifier_join_and_entry(api, sender, monkeypatch):
    client, app = api
    created = await client.post(
        BASE + "/competitions",
        json={
            "title": "Run",
            "terms": "Run once",
            "friendly": True,
        },
    )
    cid = created.json()["id"]
    code = cid[:8]
    monkeypatch.setattr(
        Mayor, "generate", AsyncMock(return_value=inbound_play.Intent(intent="join"))
    )
    assert "Text challenges" in (await send(client, "Let me join the run")).json()["reply_text"]
    assert "Reply Y/N" in (await send(client, f"Let me join {code} please")).json()["reply_text"]
    assert "Joined" in (await send(client, "Y")).json()["reply_text"]
    monkeypatch.setattr(
        Mayor, "generate", AsyncMock(return_value=inbound_play.Intent(intent="enter"))
    )
    assert "Reply Y/N" in (await send(client, f"I ran for {code} today")).json()["reply_text"]
    async with app.state.pool.connection() as conn:
        assert not await one(
            conn, "SELECT 1 FROM competition_entries WHERE competition_id=%s", (cid,)
        )
    assert "Entry recorded" in (await send(client, "Y")).json()["reply_text"]
