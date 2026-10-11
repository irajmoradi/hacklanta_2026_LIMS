import asyncio
import io
from uuid import uuid4

import httpx
import pytest
from PIL import Image

from app import auditor, newspaper, scheduler
from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID
from app.events_table import TemplateDecision, TemplateProposal
from app.mayor import MODEL as GEMINI_MODEL
from app.mayor import Mayor
from app.models import EvidenceReview, NudgeProposal

GENERATE = Mayor.generate
BASE = f"/api/villages/{VILLAGE_ID}"
OWNER, TARGET = (u[0] for u in SEED_USERS[:2])
SERVICE = {"X-Service-Key": "test-service-only"}


@pytest.mark.parametrize("primary", ["openrouter", "gemini"])
async def test_provider_fallback_provenance(api, monkeypatch, primary):
    _, app = api
    app.state.settings.llm_provider = primary
    calls = []

    async def first(self, *args):
        calls.append(primary)
        raise ValueError("empty content")

    async def second(self, schema, *args):
        calls.append("other")
        return schema(text="Hello")

    monkeypatch.setattr(Mayor, primary, first)
    monkeypatch.setattr(Mayor, "gemini" if primary == "openrouter" else "openrouter", second)
    adapter = Mayor(app.state.settings)
    assert (await GENERATE(adapter, NudgeProposal, "greet", {})).text == "Hello"
    assert calls == [primary, "other"]
    assert adapter.last_source == (
        GEMINI_MODEL if primary == "openrouter" else app.state.settings.openrouter_model
    )
    monkeypatch.setattr(Mayor, "generate", GENERATE)
    monkeypatch.setattr(Mayor, "gemini", first)
    monkeypatch.setattr(Mayor, "openrouter", first)
    text = await adapter.nudge(
        {}, {"display_name": "Friend"}, {"display_name": "Target", "roast_ok": False}
    )
    assert "how is your goal going?" in text and adapter.last_source == "fallback"


@pytest.mark.parametrize("content", ["", None, "{}", '{"text":"Good job"}'])
async def test_openrouter_wire_empty_validation(api, monkeypatch, content):
    _, app = api
    app.state.settings.openrouter_api_key = "mock-key"
    captured = []

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            captured.append(kwargs["json"])
            return httpx.Response(
                200,
                request=httpx.Request("POST", url),
                json={"choices": [{"message": {"content": content}}]},
            )

    monkeypatch.setattr("app.mayor.httpx.AsyncClient", Client)
    adapter = Mayor(app.state.settings)
    if content == '{"text":"Good job"}':
        assert (await adapter.openrouter(NudgeProposal, "greet", {})).text == "Good job"
    else:
        with pytest.raises(ValueError):
            await adapter.openrouter(NudgeProposal, "greet", {})
    assert captured[0]["reasoning"] == {"enabled": False}
    assert captured[0]["response_format"] == {"type": "json_object"}


@pytest.mark.parametrize("verdict", ["verified", "suspicious", "rejected", "error"])
async def test_review_withholding_override(api, monkeypatch, verdict):
    client, app = api

    async def vision(*args):
        if verdict == "error":
            raise RuntimeError("mock outage")
        return EvidenceReview(verdict=verdict, confidence=0.9, reason="Test evidence verdict")

    monkeypatch.setattr(auditor, "vision", vision)
    image = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(image, "PNG")
    key = (
        await client.post(
            BASE + "/evidence", files={"file": ("test.png", image.getvalue(), "image/png")}
        )
    ).json()["evidence_asset_id"]
    data = {
        "kind": "progress",
        "body": "Built a thing",
        "idempotency_key": "review-test",
        "evidence_asset_id": key,
    }
    response = await client.post(BASE + "/check-ins", json=data)
    assert response.status_code == 200, response.text
    assert response.json()["xp_awarded"] == 0
    cid = response.json()["check_in"]["id"]
    route = BASE + f"/check-ins/{cid}/review"
    review = (await client.get(route)).json()
    assert review["verdict"] == verdict
    async with app.state.pool.connection() as conn:
        amount = await one(
            conn,
            "SELECT sum(delta) AS n FROM xp_ledger WHERE source_key LIKE 'checkin:%%review-test'",
        )
        assert (amount["n"] or 0) == (25 if verdict == "verified" else 0)
    unauthorized = await client.post(
        route + "/override", json={"reason": "Looks fine"}, headers={"X-Demo-User": str(TARGET)}
    )
    assert unauthorized.status_code == 403
    override = await client.post(route + "/override", json={"reason": "Owner verified"})
    assert override.json()["xp_awarded"] == (0 if verdict == "verified" else 25)
    assert (await client.post(route + "/override", json={"reason": "Retry"})).json()[
        "xp_awarded"
    ] == 0
    retry = (await client.post(BASE + "/check-ins", json=data)).json()
    assert retry["xp_awarded"] == 0 and retry["check_in"]["review"]["verdict"] == "verified"
    profile = (await client.get(BASE + f"/users/{OWNER}")).json()
    assert profile["check_ins"][0]["review"]["verdict"] == "verified"
    assert any(r["agent"] == "auditor" for r in (await client.get(BASE + "/agent-log")).json())


async def test_evidence_ownership_and_global_key(api):
    client, app = api
    bad = await client.post(
        BASE + "/check-ins",
        json={
            "kind": "progress",
            "body": "fake",
            "idempotency_key": "bad",
            "evidence_asset_id": "../outside.png",
        },
    )
    assert bad.status_code == 404
    data = {"kind": "progress", "body": "Work", "idempotency_key": "global-key"}
    assert (await client.post(BASE + "/check-ins", json=data)).status_code == 200
    assert (
        await client.post(BASE + "/check-ins", json=data, headers={"X-Demo-User": str(TARGET)})
    ).status_code == 409
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT count(*) AS n FROM check_in_keys"))["n"] == 1


async def test_event_awards_once_and_goal_status(api):
    client, app = api
    event = (await client.post(BASE + "/mayor/pray", json={"text": "Challenge"})).json()
    path = BASE + f"/events/{event['id']}/complete"
    data = {"user_ids": [str(OWNER), str(TARGET), str(TARGET)]}
    assert (
        await client.post(path, json=data, headers={"X-Demo-User": str(TARGET)})
    ).status_code == 403
    results = await asyncio.gather(client.post(path, json=data), client.post(path, json=data))
    assert sorted(r.json()["xp_awarded"] for r in results) == [0, 100]
    goal = (await client.post(BASE + "/goals", json={"title": "Build"})).json()
    path = BASE + f"/goals/{goal['id']}/status"
    assert (
        await client.post(path, json={"status": "done"}, headers={"X-Demo-User": str(TARGET)})
    ).status_code == 403
    assert (await client.post(path, json={"status": "done"})).json()["status"] == "done"
    assert (await client.post(BASE + f"/events/{uuid4()}/complete", json=data)).status_code == 404


async def test_outbox_claim_lease_and_ack(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET phone_e164='+15555550111' WHERE id=%s", (TARGET,))
    await client.post(BASE + "/mayor/nudge", json={"target_user_id": str(TARGET)})
    batches = await asyncio.gather(
        *(client.get("/api/internal/outbox", headers=SERVICE) for _ in range(2))
    )
    assert sorted(len(r.json()) for r in batches) == [0, 1]
    item = next(r.json()[0] for r in batches if r.json())
    assert (await client.get(item["audio_url"], headers=SERVICE)).status_code == 200
    assert (await client.get(item["audio_url"])).status_code == 401
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE mayor_outbox SET claimed_until=now()-interval '1 minute'")
    assert (await client.get("/api/internal/outbox", headers=SERVICE)).json()[0]["id"] == item["id"]
    path = f"/api/internal/outbox/{item['id']}"
    assert (
        await client.post(path + "/sent", headers=SERVICE, json={"provider_msg_id": "msg-1"})
    ).status_code == 200
    assert (
        await client.post(path + "/failed", headers=SERVICE, json={"error": "late failure"})
    ).status_code == 200
    assert (await client.post(path + "/sent", headers=SERVICE)).status_code == 200
    async with app.state.pool.connection() as conn:
        row = await one(conn, "SELECT * FROM mayor_outbox")
        assert row["status"] == "sent" and row["provider_msg_id"] == "msg-1"


async def age_tick(app):
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE activity_events SET created_at=created_at-interval '10 minutes' "
            "WHERE type='agent_decision'"
        )


async def test_scheduler_limits_consent_roast_and_idle(api, monkeypatch):
    client, app = api
    app.state.settings.mayor_voice = False
    instructions = []

    async def generate(self, schema, instruction, context):
        if schema is newspaper.GazetteDraft:
            return newspaper.GazetteDraft(
                headline="The village keeps building",
                story_keys=["checkins", "competitions", "unlocks"],
            )
        if schema is TemplateDecision:
            return TemplateDecision(action="nudge", target_user_id=TARGET, reason="Idle friend")
        assert schema is NudgeProposal
        instructions.append(instruction)
        return NudgeProposal(text="You can do it")

    monkeypatch.setattr(Mayor, "generate", generate)
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET phone_e164='+15555550111',roast_ok=false WHERE id=%s", (TARGET,)
        )
        await conn.execute("DELETE FROM check_ins WHERE user_id=%s", (TARGET,))
    for _ in range(4):
        await scheduler.tick(app.state.pool, app.state.settings)
        await age_tick(app)
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT count(*) AS n FROM mayor_outbox"))["n"] == 3
    assert len(instructions) == 3 and all("No roasting" in i for i in instructions)
    log = (await client.get(BASE + "/agent-log")).json()
    assert any("Daily limit" in r["reason"] for r in log)
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET agent_msgs_ok=false WHERE id=%s", (TARGET,))
    await scheduler.tick(app.state.pool, app.state.settings)
    assert len(instructions) == 3
    assert (await client.get("/api/internal/outbox", headers=SERVICE)).json() == []
    await age_tick(app)
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET agent_msgs_ok=true WHERE id=%s", (TARGET,))
    await client.post(
        BASE + "/check-ins",
        headers={"X-Demo-User": str(TARGET)},
        json={"kind": "status", "body": "Here", "idempotency_key": "idle-stop"},
    )
    await scheduler.tick(app.state.pool, app.state.settings)
    assert any("24 hours" in r["reason"] for r in (await client.get(BASE + "/agent-log")).json())


async def test_scheduler_event_cooldown_and_none(api, monkeypatch):
    client, app = api
    decision = TemplateDecision(
        action="event",
        reason="A new challenge",
        event=TemplateProposal(
            template_id="small_step",
            kind="challenge",
            title="Build",
            body="Make a thing",
            reward_xp=30,
            penalty=None,
        ),
    )

    async def generate(self, schema, instruction, context):
        if schema is newspaper.GazetteDraft:
            return newspaper.GazetteDraft(
                headline="The village keeps building",
                story_keys=["checkins", "competitions", "unlocks"],
            )
        assert schema is TemplateDecision
        return decision

    monkeypatch.setattr(Mayor, "generate", generate)
    async with app.state.pool.connection() as conn:
        await conn.execute("DELETE FROM mayor_events")
        await conn.execute("UPDATE users SET phone_e164='+15555550111' WHERE id=%s", (TARGET,))
    await asyncio.gather(*(scheduler.tick(app.state.pool, app.state.settings) for _ in range(2)))
    await age_tick(app)
    await scheduler.tick(app.state.pool, app.state.settings)
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT count(*) AS n FROM mayor_events"))["n"] == 1
        assert (await one(conn, "SELECT count(*) AS n FROM mayor_outbox WHERE kind='event'"))[
            "n"
        ] == 1
    log = (await client.get(BASE + "/agent-log")).json()
    assert any("cooldown" in r["reason"] for r in log)
    await age_tick(app)
    decision = TemplateDecision(action="none", reason="Everyone is active")
    await scheduler.tick(app.state.pool, app.state.settings)
    assert (await client.get(BASE + "/agent-log")).json()[0]["reason"] == "Everyone is active"


async def test_response_sent_before_vision_and_override_race(api, monkeypatch):
    from starlette.responses import Response

    client, app = api
    started, release, sent = asyncio.Event(), asyncio.Event(), asyncio.Event()
    original_call = Response.__call__

    async def track_response(self, scope, receive, send):
        async def track_send(message):
            await send(message)
            if scope["path"].endswith("/check-ins") and message["type"] == "http.response.body":
                sent.set()

        await original_call(self, scope, receive, track_send)

    async def vision(*args):
        assert sent.is_set(), "Model call must start after HTTP response is sent"
        started.set()
        await release.wait()
        return EvidenceReview(verdict="rejected", confidence=1, reason="Late model verdict")

    monkeypatch.setattr(Response, "__call__", track_response)
    monkeypatch.setattr(auditor, "vision", vision)
    image = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(image, "PNG")
    upload = await client.post(
        BASE + "/evidence", files={"file": ("image.png", image.getvalue(), "image/png")}
    )
    request = asyncio.create_task(
        client.post(
            BASE + "/check-ins",
            json={
                "kind": "progress",
                "body": "Proof",
                "idempotency_key": "background-race",
                "evidence_asset_id": upload.json()["evidence_asset_id"],
            },
        )
    )
    try:
        await asyncio.wait_for(started.wait(), timeout=5)
        async with app.state.pool.connection() as conn:
            row = await one(
                conn, "SELECT id FROM check_ins WHERE idempotency_key='background-race'"
            )
        path = BASE + f"/check-ins/{row['id']}/review"
        assert (await client.get(path)).json() is None
        assert (
            await client.post(path + "/override", json={"reason": "Verified in person"})
        ).json()["xp_awarded"] == 25
    finally:
        release.set()
        await request
    assert (await client.get(path)).json()["verdict"] == "verified"


async def test_failed_outbox_terminal(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET phone_e164='+15555550111' WHERE id=%s", (TARGET,))
    await client.post(BASE + "/mayor/nudge", json={"target_user_id": str(TARGET)})
    row = (await client.get("/api/internal/outbox", headers=SERVICE)).json()[0]
    path = f"/api/internal/outbox/{row['id']}"
    for _ in range(2):
        assert (
            await client.post(
                path + "/failed", headers=SERVICE, json={"error": "untrusted provider details"}
            )
        ).status_code == 200
    assert (await client.get("/api/internal/outbox", headers=SERVICE)).json() == []
    assert (await client.post(path + "/sent", headers=SERVICE)).status_code == 409


async def test_scheduler_lifespan_start_stop(api, monkeypatch):
    from dataclasses import replace

    from app.main import create_app

    _, existing = api
    started, stopped = asyncio.Event(), asyncio.Event()

    async def run(*args):
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            stopped.set()

    monkeypatch.setattr(scheduler, "run", run)
    application = create_app(replace(existing.state.settings, mayor_scheduler=True))
    async with application.router.lifespan_context(application):
        await asyncio.wait_for(started.wait(), timeout=2)
    assert stopped.is_set()
