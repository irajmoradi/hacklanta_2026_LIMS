import asyncio
from uuid import uuid4

import pytest

from app import domain, villagergrams
from app.db import many, one
from app.domain import SEED_USERS, VILLAGE_ID

BASE = f"/api/villages/{VILLAGE_ID}"
SENDER, SPEAKER, RECIPIENT = [u[0] for u in SEED_USERS[:3]]
SERVICE = {"X-Service-Key": "test-service-only"}


async def test_legacy_voice_cannot_bypass_permission(api):
    client, app = api
    request = {
        "user_id": str(SPEAKER),
        "text": "A tiny fictional cheer!",
        "village_id": str(VILLAGE_ID),
    }
    assert (await client.post("/api/voice/lines", json=request)).status_code == 403
    await client.patch(
        "/api/me", headers={"X-Demo-User": str(SPEAKER)}, json={"allow_voice_by_friends": True}
    )
    assert (await client.post("/api/voice/lines", json=request)).status_code == 200
    feed = (await client.get(BASE + "/feed")).json()
    assert any(
        e["type"] == "friend_voice" and "Iraj made your villager say:" in e["text"] for e in feed
    )


def body(**changes):
    return dict(
        speaker_id=str(SPEAKER),
        recipient_id=str(RECIPIENT),
        text="The village ducks salute your tiny victory!",
        idempotency_key=str(uuid4()),
        **changes,
    )


@pytest.fixture
def review(monkeypatch):
    calls = []

    async def generate(self, schema, instruction, context):
        calls.append(context)
        return villagergrams.Verdict(allowed=context["line"] != "I really robbed a bank")

    monkeypatch.setattr(villagergrams.Mayor, "generate", generate)
    return calls


async def setup(api):
    client, app = api
    for uid in (SENDER, SPEAKER, RECIPIENT):
        response = await client.patch(
            "/api/me",
            headers={"X-Demo-User": str(uid)},
            json={
                "allow_voice_by_friends": True,
                "receive_villagergrams": True,
                "phone_e164": f"+15555550{str(uid)[-3:]}",
                "agent_msgs_ok": False,
            },
        )
        assert response.status_code == 200
    async with app.state.pool.connection() as conn:
        await domain.award(conn, VILLAGE_ID, SENDER, 2000, "test", str(uuid4()))


async def buy(client):
    response = await client.post(BASE + "/shop/buy", json={"item_id": "villagergram"})
    assert response.status_code == 200, response.text


async def test_defaults_membership_and_consent(api, outsider, review):
    client, app = api
    me = (await client.get("/api/me")).json()["user"]
    assert me["allow_voice_by_friends"] is False and me["receive_villagergrams"] is False
    assert (await client.post(BASE + "/villagergrams", json=body())).status_code == 403
    assert (await client.get(BASE + "/villagergrams/options", headers=outsider)).status_code == 403
    await setup(api)
    await buy(client)
    request = body()
    request["recipient_id"] = outsider["X-Demo-User"]
    assert (await client.post(BASE + "/villagergrams", json=request)).status_code == 403
    await client.patch(
        "/api/me", headers={"X-Demo-User": str(RECIPIENT)}, json={"phone_e164": None}
    )
    assert (await client.post(BASE + "/villagergrams", json=body())).status_code == 403
    assert review == []


@pytest.mark.parametrize(
    "line", ["https://evil.example", "+1 (555) 555-1234", "kill yourself", "I really robbed a bank"]
)
async def test_moderation_preserves_item(api, review, line):
    client, app = api
    await setup(api)
    await buy(client)
    request = body()
    request["text"] = line
    assert (await client.post(BASE + "/villagergrams", json=request)).status_code == 422
    shop = (await client.get(BASE + "/shop")).json()
    assert next(i for i in shop["items"] if i["id"] == "villagergram")["owned"]
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT count(*) AS n FROM villagergrams"))["n"] == 0


async def test_outbox_audio_retry_feed_rebuy_and_dry_run(api, review, monkeypatch):
    client, app = api
    await setup(api)
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET voice_id='test-clone',voice_consent=true WHERE id=%s", (SPEAKER,)
        )
    calls = []

    async def synthesize(settings, speaker, text):
        calls.append(speaker["id"])
        return b"ID3test"

    monkeypatch.setattr("app.voice.synthesize", synthesize)
    await buy(client)
    before = (await client.get(BASE + "/shop")).json()["balance"]
    request = body()
    results = await asyncio.gather(
        *[client.post(BASE + "/villagergrams", json=request) for _ in range(2)]
    )
    assert all(r.status_code == 201 for r in results), [r.text for r in results]
    assert calls == [SPEAKER] and len(review) == 1
    rows = (await client.get("/api/internal/outbox", headers=SERVICE)).json()
    assert len(rows) == 1
    row = rows[0]
    assert row["text"].startswith("🎙️ Lance's villager (AI voice), sent by Iraj via Village:")
    assert "/grams/" in row["audio_url"] and row["image_url"].endswith(".png")
    assert (await client.get(row["audio_url"], headers=SERVICE)).content == b"ID3test"
    assert (await client.get(row["image_url"], headers=SERVICE)).status_code == 200
    assert (
        await client.post(f"/api/internal/outbox/{row['id']}/ready", headers=SERVICE)
    ).status_code == 200
    assert (
        await client.post(f"/api/internal/outbox/{row['id']}/dry-run", headers=SERVICE, json={})
    ).status_code == 200
    assert (await client.get("/api/internal/outbox", headers=SERVICE)).json() == []
    feed = (await client.get(BASE + "/feed")).json()
    assert any("Iraj made your villager say:" in e["text"] for e in feed)
    await buy(client)
    assert (await client.get(BASE + "/shop")).json()["balance"] == before - 150


async def test_limits_revocation_and_text_only(api, review, monkeypatch):
    client, app = api
    await setup(api)

    async def no_voice(*args):
        raise AssertionError("No clone must never synthesize")

    monkeypatch.setattr("app.voice.synthesize", no_voice)
    for _ in range(3):
        await buy(client)
        assert (await client.post(BASE + "/villagergrams", json=body())).status_code == 201
    claimed = (await client.get("/api/internal/outbox?limit=1", headers=SERVICE)).json()[0]
    await buy(client)
    assert (await client.post(BASE + "/villagergrams", json=body())).status_code == 429
    await client.patch(
        "/api/me", headers={"X-Demo-User": str(SPEAKER)}, json={"allow_voice_by_friends": False}
    )
    assert (await client.get("/api/internal/outbox", headers=SERVICE)).json() == []
    assert (
        await client.post(f"/api/internal/outbox/{claimed['id']}/ready", headers=SERVICE)
    ).status_code == 409
    async with app.state.pool.connection() as conn:
        rows = await many(conn, "SELECT status,audio_key FROM mayor_outbox")
        assert all(r["status"] == "failed" and r["audio_key"] is None for r in rows)


async def test_recipient_limit_and_provider_failure(api, review, monkeypatch):
    client, app = api
    await setup(api)
    await buy(client)

    async def unavailable(*args):
        raise RuntimeError("offline")

    monkeypatch.setattr(villagergrams.Mayor, "generate", unavailable)
    assert (await client.post(BASE + "/villagergrams", json=body())).status_code == 503
    async with app.state.pool.connection() as conn:
        for _ in range(5):
            await conn.execute(
                """INSERT INTO villagergrams(id,village_id,sender_id,speaker_id,recipient_id,text)
                VALUES (%s,%s,%s,%s,%s,'fixture')""",
                (uuid4(), VILLAGE_ID, SPEAKER, SPEAKER, RECIPIENT),
            )
    assert (await client.post(BASE + "/villagergrams", json=body())).status_code == 429
