import asyncio
import io
from uuid import uuid4

import httpx
import pytest
from PIL import Image
from psycopg.types.json import Jsonb

from app import auditor, budget, newspaper, scheduler, voice
from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID
from app.events_table import TemplateDecision
from app.mayor import Mayor
from app.models import MayorProposal
from scripts.migrate import apply_additions

UID = str(SEED_USERS[0][0])
TARGET = str(SEED_USERS[1][0])
BASE = f"/api/villages/{VILLAGE_ID}"
GEMINI = Mayor.gemini
OPENROUTER = Mayor.openrouter
SYNTHESIZE = voice.synthesize
GENERATE = Mayor.generate


def memo(count=1):
    return [
        ("files", (f"sample-{n}.wav", b"RIFFsynthetic-test", "audio/wav")) for n in range(count)
    ]


def provider_mock(monkeypatch, handler):
    original = httpx.AsyncClient
    monkeypatch.setattr(
        voice.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )


async def test_clone_consent_request_shape_concurrency_and_delete(api, monkeypatch):
    client, app = api
    app.state.settings.elevenlabs_api_key = "mock-only"
    calls = []

    async def handler(request):
        calls.append(request)
        if request.method == "POST":
            body = await request.aread()
            assert request.url.path == "/v1/voices/add"
            assert request.headers["xi-api-key"] == "mock-only"
            assert "Village \u2014 Iraj".encode() in body
            assert body.count(b'name="files"') == 3
            return httpx.Response(200, json={"voice_id": "mock-clone"})
        assert request.url.path == "/v1/voices/mock-clone"
        return httpx.Response(200, json={"status": "ok"})

    provider_mock(monkeypatch, handler)
    assert (await client.post("/api/me/voice", files=memo())).status_code == 422
    assert (
        await client.post("/api/me/voice", files=memo(4), data={"consent": "true"})
    ).status_code == 422
    results = await asyncio.gather(
        *(client.post("/api/me/voice", files=memo(3), data={"consent": "true"}) for _ in range(2))
    )
    assert sorted(r.status_code for r in results) == [200, 409]
    assert len(calls) == 1
    saved = next(r.json() for r in results if r.status_code == 200)
    assert saved["voice_consent"] and saved["voice_consent_at"]
    assert saved["voice_consent_version"] == voice.CONSENT_VERSION
    assert (await client.get("/api/me")).json()["user"]["voice_id"] == "mock-clone"
    assert (await client.delete("/api/me/voice")).json()["voice_id"] is None
    assert (await client.delete("/api/me/voice")).status_code == 200
    assert len(calls) == 2
    user = (await client.get("/api/me")).json()["user"]
    assert not user["voice_consent"] and user["voice_consent_at"] is None


@pytest.mark.parametrize("status,body", [(500, {}), (200, {}), (200, {"voice_id": "../bad"})])
async def test_clone_provider_failure_keeps_state(api, monkeypatch, status, body):
    client, app = api
    app.state.settings.elevenlabs_api_key = "mock-only"
    provider_mock(monkeypatch, lambda r: httpx.Response(status, json=body))
    result = await client.post("/api/me/voice", files=memo(), data={"consent": "true"})
    assert result.status_code == 502
    assert (await client.get("/api/me")).json()["user"]["voice_id"] is None


async def test_clone_validation_and_delete_failure(api, monkeypatch):
    client, app = api
    assert (
        await client.post("/api/me/voice", files=memo(), data={"consent": "true"})
    ).status_code == 503
    for content, mime, status in [
        (b"x", "text/plain", 415),
        (b"", "audio/wav", 413),
        (b"x" * (voice.MAX_MEMO + 1), "audio/wav", 413),
    ]:
        r = await client.post(
            "/api/me/voice", files={"files": ("sample", content, mime)}, data={"consent": "true"}
        )
        assert r.status_code == status
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET voice_id='mock-clone',voice_consent=true WHERE id=%s", (UID,)
        )
    app.state.settings.elevenlabs_api_key = "mock-only"
    provider_mock(monkeypatch, lambda r: httpx.Response(503))
    assert (await client.delete("/api/me/voice")).status_code == 502
    assert (await client.get("/api/me")).json()["user"]["voice_id"] == "mock-clone"


async def test_profile_roles_validation_and_cors(api):
    client, _ = api
    patch = {
        "display_name": " New name ",
        "phone_e164": "+15555551234",
        "roast_ok": False,
        "agent_msgs_ok": False,
    }
    r = await client.patch("/api/me", json=patch)
    assert r.status_code == 200
    user = r.json()["user"]
    assert user["display_name"] == "New name" and user["phone_e164"] == patch["phone_e164"]
    assert not user["roast_ok"] and not user["agent_msgs_ok"]
    villages = r.json()["villages"]
    assert villages[0]["role"] == "owner" and not villages[0]["is_auditor_this_week"]
    week = (await client.get(BASE + "/weekly/current")).json()
    me = (await client.get("/api/me", headers={"X-Demo-User": week["auditor_id"]})).json()
    assert me["villages"][0]["is_auditor_this_week"]
    for invalid in [
        {"display_name": " "},
        {"display_name": None},
        {"roast_ok": None},
        {"phone_e164": "555-123"},
        {"phone_e164": "+1abcdefg"},
        {"role": "owner"},
        {"voice_id": "bad"},
    ]:
        assert (await client.patch("/api/me", json=invalid)).status_code == 422
    assert (await client.patch("/api/me", json={"phone_e164": None})).json()["user"][
        "phone_e164"
    ] is None
    for method in ["PATCH", "DELETE"]:
        r = await client.options(
            "/api/me",
            headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": method},
        )
        assert r.status_code == 200


async def test_line_job_bridge_polling_and_access(api, outsider):
    client, app = api
    line = (await client.post("/api/voice/lines", json={"user_id": UID, "text": "Hi"})).json()
    assert line["expr_url"] is None and line["job_id"]
    async with app.state.pool.connection() as conn:
        job = await one(conn, "SELECT * FROM avatar_jobs WHERE id=%s", (line["job_id"],))
        assert job["stage"] == "voice_expr" and job["status"] == "queued"
        assert job["input"] == {
            "audio_key": line["audio_url"].removeprefix("/api/assets/"),
            "line_id": line["id"],
            "user_id": UID,
        }
        expr = f"/api/assets/avatars/{UID}/voice/{line['id']}/line_expr.json"
        await conn.execute(
            "UPDATE avatar_jobs SET status='done',result=%s WHERE id=%s",
            (Jsonb({"expr_url": expr}), line["job_id"]),
        )
    path = f"/api/voice/lines/{line['id']}"
    assert (await client.get(path)).json()["expr_url"] == expr
    assert (await client.get(path, headers={"X-Demo-User": TARGET})).status_code == 200
    assert (await client.get(path, headers=outsider)).status_code == 403
    assert (await client.get(f"/api/voice/lines/{uuid4()}")).status_code == 404


async def test_recap_stock_and_nudge_target_expression(api, monkeypatch):
    client, app = api
    calls = []

    async def synthesize(settings, user, text):
        calls.append(voice.voice_id(user))
        return b"ID3mock"

    monkeypatch.setattr(voice, "synthesize", synthesize)
    assert (await client.post(BASE + "/mayor/recap")).status_code == 200
    assert not calls
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET voice_id='custom',voice_consent=true WHERE id=%s", (UID,)
        )
        for uid in [UID, TARGET]:
            await conn.execute(
                "INSERT INTO avatar_assets(user_id,revision,manifest) VALUES (%s,1,%s)",
                (uid, Jsonb({"portrait": {"kind": "lam_head"}})),
            )
    recap = (await client.post(BASE + "/mayor/recap?voice=true")).json()
    assert recap["audio_url"] and recap["job_id"] and recap["expr_url"] is None
    assert calls == [voice.STOCK_VOICES[0]]
    nudge = (await client.post(BASE + "/mayor/nudge", json={"target_user_id": TARGET})).json()
    assert nudge["job_id"] and nudge["line_id"]
    async with app.state.pool.connection() as conn:
        job = await one(conn, "SELECT user_id FROM avatar_jobs WHERE id=%s", (nudge["job_id"],))
        assert str(job["user_id"]) == TARGET


@pytest.mark.parametrize("large_bytes", [False, True])
async def test_large_photos_resized_and_deduplicated(api, large_bytes):
    client, app = api
    data = io.BytesIO()
    Image.new("RGB", (4200, 100) if not large_bytes else (100, 100), "green").save(data, "PNG")
    content = data.getvalue() + (b"\0" * (11 * 1024 * 1024) if large_bytes else b"")
    jobs = []
    for _ in range(2):
        r = await client.post(
            f"/api/avatars/{UID}/photo",
            data={"consent": "true"},
            files={"file": ("large.png", content, "image/png")},
        )
        assert r.status_code == 200
        jobs.append(r.json()["job_id"])
    assert jobs[0] == jobs[1]
    async with app.state.pool.connection() as conn:
        job = await one(conn, "SELECT input FROM avatar_jobs WHERE id=%s", (jobs[0],))
    path = app.state.settings.asset_dir / job["input"]["photo_asset_key"]
    assert path.stat().st_size <= 10 * 1024 * 1024
    with Image.open(path) as img:
        assert max(img.size) <= 4096 and img.format == "JPEG"


async def test_scheduler_ignores_qa_and_no_human_activity(api, monkeypatch):
    _, app = api
    calls = []

    async def generate(self, schema, instruction, context):
        calls.append(schema)
        if schema is newspaper.GazetteDraft:
            return newspaper.GazetteDraft(
                headline="The village keeps building",
                story_keys=["checkins", "competitions", "unlocks"],
            )
        assert schema is TemplateDecision
        return TemplateDecision(action="none", reason="Healthy")

    monkeypatch.setattr(Mayor, "generate", generate)
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE villages SET name='QA-test'")
    await scheduler.tick(app.state.pool, app.state.settings)
    assert not calls
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE villages SET name='Real village'")
        await conn.execute("UPDATE check_ins SET created_at=now()-interval '49 hours'")
        await conn.execute("UPDATE activity_events SET created_at=now()-interval '49 hours'")
        await conn.execute(
            "INSERT INTO activity_events(village_id,user_id,type,payload) "
            "VALUES (%s,%s,'mayor_message','{}')",
            (VILLAGE_ID, UID),
        )
    await scheduler.tick(app.state.pool, app.state.settings)
    assert not calls
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO activity_events(village_id,user_id,type,payload) "
            "VALUES (%s,%s,'goal_set','{}')",
            (VILLAGE_ID, UID),
        )
    await scheduler.tick(app.state.pool, app.state.settings)
    assert calls == [newspaper.GazetteDraft, TemplateDecision]


async def test_global_budget_concurrent_persistent_and_reset(api):
    client, app = api
    settings = app.state.settings
    settings.llm_max_calls_per_hour = 3
    token = budget.village_context.set(VILLAGE_ID)
    try:
        results = await asyncio.gather(
            *(budget.reserve(settings) for _ in range(10)), return_exceptions=True
        )
        assert sum(r is None for r in results) == 3
        assert sum(isinstance(r, budget.BudgetExceeded) for r in results) == 7
        async with app.state.pool.connection() as conn:
            assert (await one(conn, "SELECT calls FROM llm_hourly_budget"))["calls"] == 3
            await conn.execute("UPDATE llm_hourly_budget SET hour=hour-interval '1 hour'")
        await budget.reserve(settings)
        log = (await client.get(BASE + "/agent-log")).json()
        assert len([r for r in log if r["action"] == "throttled"]) == 7
    finally:
        budget.village_context.reset(token)


async def test_all_model_adapters_blocked_at_zero_budget(api, monkeypatch):
    _, app = api
    settings = app.state.settings
    settings.llm_max_calls_per_hour = 0
    settings.google_api_key = settings.openrouter_api_key = "mock-only"
    token = budget.village_context.set(VILLAGE_ID)
    try:
        for operation in [
            GEMINI(Mayor(settings), MayorProposal, "test", {}),
            OPENROUTER(Mayor(settings), MayorProposal, "test", {}),
            auditor.vision(settings, b"image", "image/png", {}),
        ]:
            with pytest.raises(budget.BudgetExceeded):
                await operation
    finally:
        budget.village_context.reset(token)


async def test_repair_counts_as_separate_call_and_stops_fallback(api, monkeypatch):
    _, app = api
    settings = app.state.settings
    settings.llm_max_calls_per_hour = 1
    settings.openrouter_api_key = settings.google_api_key = "mock-only"
    settings.llm_provider = "openrouter"
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": "invalid JSON"}}]})

    provider_mock(monkeypatch, handler)
    token = budget.village_context.set(VILLAGE_ID)
    try:
        with pytest.raises(budget.BudgetExceeded):
            await GENERATE(Mayor(settings), MayorProposal, "test", {})
        assert len(calls) == 1
        async with app.state.pool.connection() as conn:
            assert (await one(conn, "SELECT calls FROM llm_hourly_budget"))["calls"] == 1
    finally:
        budget.village_context.reset(token)


async def test_stock_recap_without_head_and_pending_failed_line(api):
    client, app = api
    recap = (await client.post(BASE + "/mayor/recap?voice=true")).json()
    assert recap["audio_url"] and recap["job_id"] is None
    line = (await client.post("/api/voice/lines", json={"user_id": UID, "text": "Hello"})).json()
    url = f"/api/voice/lines/{line['id']}"
    assert (await client.get(url)).json()["expr_url"] is None
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE avatar_jobs SET status='failed' WHERE id=%s", (line["job_id"],))
    result = (await client.get(url)).json()
    assert result["expr_url"] is None and result["audio_url"] == line["audio_url"]


async def test_migration_idempotent(api):
    import psycopg

    _, app = api
    with psycopg.connect(app.state.settings.database_url) as conn:
        apply_additions(conn)
        apply_additions(conn)
