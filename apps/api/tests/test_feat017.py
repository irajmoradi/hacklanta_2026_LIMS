from uuid import uuid4

import pytest
from fastapi import HTTPException

from app import heads
from app.domain import SEED_USERS
from app.villagergrams import Verdict

SELF, FRIEND = (SEED_USERS[i][0] for i in range(2))


@pytest.fixture
def safety(monkeypatch):
    calls = []

    async def generate(self, schema, instruction, context):
        calls.append(schema)
        if schema is Verdict:
            return Verdict(allowed=context["line"] != "blocked fictional line")
        return heads.SillyLine(text="The council of frogs approves.")

    monkeypatch.setattr("app.mayor.Mayor.generate", generate)
    return calls


def test_cache_key_voice_and_person():
    user = {"id": SELF, "voice_id": "clone-a", "voice_consent": True}
    assert heads.cache_key(user, "Hi") == heads.cache_key(user.copy(), "Hi")
    assert heads.cache_key(user, "Hi") != heads.cache_key(user, "Bye")
    assert heads.cache_key(user, "Hi") != heads.cache_key({**user, "voice_id": "clone-b"}, "Hi")
    assert heads.cache_key(user, "Hi") != heads.cache_key({**user, "id": FRIEND}, "Hi")


async def test_self_cache_and_daily_limit(api, safety):
    client, app = api
    url = f"/api/heads/{SELF}/say"
    first = await client.post(url, json={"preset_id": "1"})
    assert first.status_code == 200, first.text
    assert first.json()["cached"] is False
    assert first.json()["audio_url"] and first.json()["job_id"]
    assert (await client.get(first.json()["audio_url"])).status_code == 200
    again = await client.post(url, json={"text": heads.PRESETS[1]})
    assert again.json()["cached"] is True
    assert again.json()["id"] == first.json()["id"]
    assert safety == [Verdict]
    async with app.state.pool.connection() as conn:
        for _ in range(9):
            await conn.execute(
                "INSERT INTO head_speech_attempts(id,requester_id) VALUES (%s,%s)", (uuid4(), SELF)
            )
    assert (await client.post(url, json={"preset_id": "2"})).status_code == 429
    assert (await client.post(url, json={"preset_id": "1"})).json()["cached"] is True
    assert (await client.post(url, json={"preset_id": "surprise"})).status_code == 429


async def test_consent_and_revoked_cache(api, safety, outsider):
    client, _ = api
    url = f"/api/heads/{FRIEND}/say"
    assert (await client.post(url, json={"preset_id": "0"})).status_code == 403
    assert (await client.post(url, json={"preset_id": "0"}, headers=outsider)).status_code == 403
    await client.patch(
        "/api/me", headers={"X-Demo-User": str(FRIEND)}, json={"allow_voice_by_friends": True}
    )
    assert (await client.post(url, json={"preset_id": "0"})).status_code == 200
    await client.patch(
        "/api/me", headers={"X-Demo-User": str(FRIEND)}, json={"allow_voice_by_friends": False}
    )
    assert (await client.post(url, json={"preset_id": "0"})).status_code == 403


async def test_moderation_surprise_and_validation(api, safety):
    client, _ = api
    url = f"/api/heads/{SELF}/say"
    for data in ({}, {"preset_id": "bad"}, {"text": "x" * 101}, {"text": "ok", "preset_id": "0"}):
        assert (await client.post(url, json=data)).status_code == 422
    assert (await client.post(url, json={"text": "visit example.com"})).status_code == 422
    assert (await client.post(url, json={"text": "blocked fictional line"})).status_code == 422
    result = await client.post(url, json={"preset_id": "surprise"})
    assert result.status_code == 200, result.text
    assert len(result.json()["text"]) <= 100
    assert heads.SillyLine in safety and safety[-1] is Verdict
    assert len((await client.get("/api/heads/presets")).json()["presets"]) == 20


async def test_failure_reservation_and_retry(api, safety, monkeypatch):
    client, app = api

    async def fail(*args):
        raise HTTPException(502, "Synthetic provider failure")

    monkeypatch.setattr("app.voice.synthesize", fail)
    for _ in range(2):
        assert (
            await client.post(f"/api/heads/{SELF}/say", json={"preset_id": "0"})
        ).status_code == 502
    async with app.state.pool.connection() as conn:
        row = await (
            await conn.execute("SELECT count(*) AS n FROM head_speech_attempts")
        ).fetchone()
        assert row["n"] == 2


async def test_concurrent_request_reuses_reservation(api, safety, monkeypatch):
    import asyncio

    client, _ = api
    started, release = asyncio.Event(), asyncio.Event()

    async def moderate(*args):
        started.set()
        await release.wait()

    monkeypatch.setattr(heads, "moderate", moderate)
    url = f"/api/heads/{SELF}/say"
    task = asyncio.create_task(client.post(url, json={"preset_id": "0"}))
    await started.wait()
    try:
        assert (await client.post(url, json={"preset_id": "0"})).status_code == 409
    finally:
        release.set()
    assert (await task).status_code == 200
