import asyncio
import io
from uuid import uuid4

import pytest
from PIL import Image
from test_api006 import PHONE, SERVICE, send
from test_api006 import sender as sender_fixture

from app import domain
from app.db import many, one
from app.inbound_queries import Intent, keyword_intent
from app.mayor import Mayor
from app.models import EvidenceReview

sender = sender_fixture


def png():
    output = io.BytesIO()
    Image.new("RGB", (4, 4), "blue").save(output, "PNG")
    return output.getvalue()


async def photo(
    client,
    mid=None,
    phone=PHONE,
    caption="checkin: Ran three miles",
    content=None,
    mime="image/png",
    headers=SERVICE,
):
    return await client.post(
        "/api/internal/inbound/evidence",
        headers=headers,
        data={"phone_e164": phone, "caption": caption, "message_id": mid or str(uuid4())},
        files={"file": ("test.png", png() if content is None else content, mime)},
    )


@pytest.fixture(autouse=True)
def vision(monkeypatch):
    async def review(*args):
        return EvidenceReview(verdict="verified", confidence=0.9, reason="Test evidence")

    monkeypatch.setattr("app.auditor.vision", review)


async def competition(client, uid, title="Run 20 miles", friendly=False):
    headers = {"X-Demo-User": str(uid)}
    result = await client.post(
        f"/api/villages/{domain.VILLAGE_ID}/competitions",
        headers=headers,
        json={"title": title, "terms": "Show a running photo", "friendly": friendly},
    )
    assert result.status_code == 200, result.text
    cid = result.json()["id"]
    assert (
        await client.post(
            f"/api/villages/{domain.VILLAGE_ID}/competitions/{cid}/join", headers=headers
        )
    ).status_code == 200
    return cid


@pytest.mark.parametrize(
    "text,intent",
    [
        ("what are my goals", "goals"),
        ("my goal", "goals"),
        ("competitions", "competitions"),
        ("what am I in", "competitions"),
        ("standings", "standings"),
        ("rank", "standings"),
        ("XP", "stats"),
        ("level", "stats"),
        ("streak", "stats"),
        ("help", "help"),
        ("thanks", None),
        ("ranking", "standings"),
        ("goalkeeper", None),
    ],
)
def test_keywords(text, intent):
    assert keyword_intent(text) == intent


async def test_real_answers_and_classifier(api, sender, monkeypatch):
    client, app = api
    # Exercise the full conversation script within a configurable test-only allowance.
    app.state.settings.cost_limiter.caps["photon"] = (30, 30, 30)
    assert "No goal" in (await send(client, "my goals")).json()["reply_text"]
    await send(client, "goal: Run 20 miles")
    await send(client, "progress: Ran three miles")
    text = (await send(client, "what are my goals")).json()["reply_text"]
    assert "Run 20 miles" in text and "active" in text and "1 progress check-ins" in text
    assert "days left" in text
    for question in ["XP", "level", "streak"]:
        assert "45 XP" in (await send(client, question)).json()["reply_text"]
    assert "STOP" in (await send(client, "help")).json()["reply_text"]
    assert "not in any" in (await send(client, "competitions")).json()["reply_text"]
    await competition(client, sender)
    for question in ["competitions", "what am I in", "standings", "rank"]:
        text = (await send(client, question)).json()["reply_text"]
        assert "rank 1/1" in text and "0 confirmed points" in text and "no deadline set" in text
    calls = []

    async def classify(self, schema, instruction, context):
        calls.append(schema)
        return Intent(intent="goals")

    monkeypatch.setattr(Mayor, "generate", classify)
    assert (
        "Run 20 miles"
        in (await send(client, "What did I promise to work on?")).json()["reply_text"]
    )
    assert calls == [Intent]
    await send(client, "XP")
    assert calls == [Intent]  # rules never spend a classifier call


async def test_goal_photo_and_replay(api, sender):
    client, app = api
    await send(client, "goal: Run 20 miles")
    results = await asyncio.gather(photo(client, "same"), photo(client, "same"))
    assert all(r.status_code == 200 for r in results)
    assert results[0].json() == results[1].json()
    assert results[0].json()["processed_checkin"] is True
    assert (await photo(client, "same", caption="different")).status_code == 409
    async with app.state.pool.connection() as conn:
        rows = await many(conn, "SELECT * FROM check_ins WHERE user_id=%s", (sender,))
        assert len(rows) == 1 and rows[0]["body"] == "Ran three miles"
        assert rows[0]["kind"] == "progress" and rows[0]["evidence_asset_id"]
        review = await one(
            conn, "SELECT verdict FROM evidence_reviews WHERE check_in_id=%s", (rows[0]["id"],)
        )
        assert review["verdict"] == "verified"


async def test_competition_photo_pending_choice(api, sender):
    client, app = api
    first = await competition(client, sender)
    assert "Run 20 miles" in (await photo(client)).json()["reply_text"]
    second = await competition(client, sender, "Build a shed")
    await competition(client, sender, "Friendly", friendly=True)
    result = await photo(client, "pending")
    assert "1. Run 20 miles" in result.json()["reply_text"]
    assert "2. Build a shed" in result.json()["reply_text"]
    assert "Friendly" not in result.json()["reply_text"]
    await photo(client, "pending")  # duplicate does not append
    await photo(client, "another-photo")
    assert "Which competition" in (await send(client, "9")).json()["reply_text"]
    assert "invite" in (await send(client, "2", phone="+15555550999")).json()["reply_text"]
    result = await send(client, "2", "choice")
    assert (
        "Build a shed" in result.json()["reply_text"] and "2 photos" in result.json()["reply_text"]
    )
    assert (await send(client, "2", "choice")).json() == result.json()
    assert "No photo" in (await send(client, "2")).json()["reply_text"]
    async with app.state.pool.connection() as conn:
        rows = await many(conn, "SELECT * FROM competition_entries WHERE user_id=%s", (sender,))
        assert len(rows) == 3
        assert sum(str(r["competition_id"]) == first for r in rows) == 1
        assert sum(str(r["competition_id"]) == second for r in rows) == 2
        assert all(r["review"]["verdict"] == "verified" for r in rows)


async def test_standings_use_confirmed_points_and_only_joined_competitions(api, sender):
    client, app = api
    cid = await competition(client, sender)
    await photo(client)
    other = domain.SEED_USERS[0][0]
    # An unjoined competition must never be disclosed as the sender's competition.
    await competition(client, other, "Private race")
    async with app.state.pool.connection() as conn:
        await conn.execute("INSERT INTO competition_participants VALUES (%s,%s,0)", (cid, other))
        await conn.execute(
            "UPDATE competition_entries SET decision='confirmed',points=5 WHERE competition_id=%s",
            (cid,),
        )
        await conn.execute(
            """INSERT INTO competition_entries
            (competition_id,user_id,body,idempotency_key,decision,points)
            VALUES (%s,%s,'Other runner','other-score','confirmed',10),
                   (%s,%s,'Unreviewed','pending-score','pending',500)""",
            (cid, other, cid, sender),
        )
    text = (await send(client, "rank")).json()["reply_text"]
    assert "rank 2/2, 5 confirmed points" in text
    assert "Private race" not in text


async def test_classifier_failure_keeps_friendly_fallback(api, sender, monkeypatch):
    client, _ = api

    async def unavailable(*args):
        raise RuntimeError("provider offline")

    monkeypatch.setattr(Mayor, "generate", unavailable)
    result = await send(client, "How are you today?")
    assert result.status_code == 200
    assert "Use goal: to set a goal" in result.json()["reply_text"]


async def test_expiry_cancel_and_closed_choice(api, sender):
    client, app = api
    first = await competition(client, sender)
    await competition(client, sender, "Second")
    await photo(client)
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE inbound_evidence_pending SET expires_at=now()-interval '1 second'"
        )
    assert "No photo" in (await send(client, "1")).json()["reply_text"]
    await photo(client)
    assert "cancelled" in (await send(client, "cancel")).json()["reply_text"]
    await photo(client)
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE competitions SET status='settled' WHERE id=%s", (first,))
    assert "no longer available" in (await send(client, "1")).json()["reply_text"]


async def test_unknown_auth_limits_and_missing_goal(api, sender):
    client, app = api
    assert (await photo(client, headers={})).status_code in {401, 403}
    assert "Join the village" in (await photo(client, phone="+15555550999")).json()["reply_text"]
    assert not list(app.state.settings.asset_dir.rglob("*.png"))
    assert (await photo(client, mime="text/plain")).status_code == 415
    assert (await photo(client, content=b"not an image")).status_code == 415
    assert (await photo(client, content=b"x" * (10 * 1024 * 1024 + 1))).status_code == 413
    assert "active weekly goal" in (await photo(client)).json()["reply_text"]
