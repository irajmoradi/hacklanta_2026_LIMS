"""All provider calls are intercepted; database tests use the suite's scratch schema."""

import io
from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest
from fastapi import FastAPI, Request
from PIL import Image

from app import heads, voice
from app.assets import asset_path
from app.config import Settings
from app.domain import SEED_USERS, VILLAGE_ID
from app.main import create_app
from app.mayor import Mayor
from app.security import DailyLimiter, LimitExceeded, SecurityMiddleware, charge, client_ip
from app.villagergrams import Verdict

SYNTHESIZE = voice.synthesize
GENERATE = Mayor.generate
SELF = SEED_USERS[0][0]


@pytest.mark.parametrize(
    "caps,actors",
    [
        ((2, 10, 10), [("a", "a"), ("b", "b"), ("c", "c")]),
        ((10, 2, 10), [("a", "a"), ("a", "b"), ("a", "c")]),
        ((10, 10, 2), [("a", "a"), ("b", "a"), ("c", "a")]),
    ],
)
def test_each_daily_dimension_and_atomic_denial(caps, actors):
    limiter = DailyLimiter({"llm": caps})
    for ip, seat in actors[:2]:
        limiter.reserve("llm", ip=ip, seat=seat)
    before = limiter.counts.copy()
    with pytest.raises(LimitExceeded) as exc:
        limiter.reserve("llm", ip=actors[2][0], seat=actors[2][1])
    assert exc.value.status_code == 429
    assert int(exc.value.headers["Retry-After"]) > 0
    assert limiter.counts == before


def test_rollover_zero_configuration_and_batch(monkeypatch):
    now = [86400]
    limiter = DailyLimiter({"gpu": (2, 2, 2)}, clock=lambda: now[0])
    limiter.reserve("gpu", count=2)
    with pytest.raises(LimitExceeded):
        limiter.reserve("gpu")
    now[0] += 86400
    limiter.reserve("gpu", consume=False)
    assert limiter.counts == {}
    limiter.reserve("gpu")
    before = limiter.counts.copy()
    with pytest.raises(LimitExceeded):
        limiter.reserve_batch("gpu", [("a", "a"), ("b", "b")])
    assert limiter.counts == before
    monkeypatch.setenv("COST_GPU_GLOBAL_DAILY", "0")
    with pytest.raises(LimitExceeded):
        DailyLimiter.from_env().reserve("gpu")


def test_concurrent_reservations_do_not_overspend():
    limiter = DailyLimiter({"gpu": (7, 7, 7)})

    def attempt(_):
        try:
            limiter.reserve("gpu")
            return 1
        except LimitExceeded:
            return 0

    with ThreadPoolExecutor(max_workers=12) as pool:
        assert sum(pool.map(attempt, range(80))) == 7


@pytest.mark.parametrize(
    "peer,forwarded,expected",
    [
        ("127.0.0.1", "198.51.100.1", "198.51.100.1"),
        ("127.0.0.1", "spoof, 198.51.100.2", "198.51.100.2"),
        ("198.51.100.3", "127.0.0.1", "198.51.100.3"),
        ("::1", "198.51.100.4", "::1"),
        ("127.0.0.1", "invalid", "invalid-proxy-client"),
    ],
)
def test_proxy_trust(peer, forwarded, expected):
    assert (
        client_ip({"client": (peer, 123), "headers": [(b"x-forwarded-for", forwarded.encode())]})
        == expected
    )


@pytest.mark.parametrize(
    "enabled,peer,headers,expected",
    [
        (False, "127.0.0.1", {}, 404),
        (True, "127.0.0.1", {}, 200),
        (True, "::1", {}, 200),
        (True, "198.51.100.2", {}, 404),
        (True, "127.0.0.1", {"X-Forwarded-For": "127.0.0.1"}, 404),
        (True, "127.0.0.1", {"X-Forwarded-For": ""}, 404),
    ],
)
async def test_all_debug_routes_gate_before_database(enabled, peer, headers, expected):
    from app import demo

    app = create_app(Settings(database_url="", demo_auth=True, demo_debug=enabled))
    app.dependency_overrides[demo.demo_tester] = lambda: {"id": SELF}
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, client=(peer, 123)),
        base_url="http://test",
        headers={"X-Demo-User": str(SELF), **headers},
    ) as client:
        assert (await client.get("/api/demo/debug")).status_code == expected
        if expected == 404:
            for path in (
                "/api/demo/guests",
                "/api/demo/debug/reset",
                "/api/demo/debug/disaster",
                "/api/demo/debug/event",
            ):
                response = await client.post(path, json={})
                assert response.status_code == 404
            assert (await client.delete("/api/demo/guests")).status_code == 404


async def test_upload_request_bound_including_chunked():
    app = FastAPI()
    app.add_middleware(SecurityMiddleware, settings=Settings(database_url=""))

    @app.post("/upload")
    async def upload(request: Request):
        async for _ in request.stream():
            pass
        return {}

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        assert (
            await client.post("/upload", headers={"Content-Length": str(66 * 1024 * 1024)})
        ).status_code == 413

        async def chunks():
            for _ in range(66):
                yield b"x" * (1024 * 1024)

        assert (await client.post("/upload", content=chunks())).status_code == 413


def test_asset_traversal_and_symlinks(tmp_path):
    settings = Settings(database_url="", asset_dir=tmp_path / "assets")
    settings.asset_dir.mkdir()
    outside = tmp_path / "private.txt"
    outside.write_text("synthetic secret")
    for key in ("../private.txt", "/private.txt", "a\\private.txt", "C:/private.txt", "a/../x"):
        with pytest.raises(Exception) as exc:
            asset_path(settings, key)
        assert exc.value.status_code == 404
    try:
        (settings.asset_dir / "escape.txt").symlink_to(outside)
    except OSError:
        return  # Windows may require a privilege; Linux runner always exercises this.
    with pytest.raises(Exception) as exc:
        asset_path(settings, "escape.txt")
    assert exc.value.status_code == 404


async def test_provider_failure_consumes_budget_without_leaking(monkeypatch, tmp_path):
    settings = Settings(database_url="", elevenlabs_api_key="synthetic-only", asset_dir=tmp_path)
    settings.cost_limiter = DailyLimiter({"elevenlabs": (1, 1, 1)})
    calls = []

    async def post(*args, **kwargs):
        calls.append(1)
        raise httpx.ConnectError("synthetic provider secret")

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    with pytest.raises(Exception) as exc:
        await SYNTHESIZE(settings, {"id": SELF}, "hello")
    assert exc.value.status_code == 502
    assert "secret" not in exc.value.detail
    with pytest.raises(LimitExceeded):
        await SYNTHESIZE(settings, {"id": SELF}, "hello")
    assert len(calls) == 1


async def test_llm_limit_does_not_fallback_to_second_provider(api, monkeypatch):
    _, app = api
    settings = app.state.settings
    settings.openrouter_api_key = "synthetic-only"
    settings.cost_limiter.caps["llm"] = (0, 0, 0)

    async def forbidden(*args, **kwargs):
        pytest.fail("Over-budget request reached provider")

    monkeypatch.setattr(httpx.AsyncClient, "post", forbidden)
    monkeypatch.setattr(Mayor, "gemini", forbidden)
    with pytest.raises(LimitExceeded):
        await GENERATE(Mayor(settings), Verdict, "test", {})


async def test_head_cache_is_free_and_actor_gets_429(api, monkeypatch):
    client, app = api

    async def safe(*args):
        return None

    async def synth(settings, user, text):
        charge(settings, "elevenlabs")
        return b"ID3synthetic"

    monkeypatch.setattr(heads, "moderate", safe)
    monkeypatch.setattr(voice, "synthesize", synth)
    app.state.settings.cost_limiter.caps["elevenlabs"] = (1, 1, 1)
    friend = SEED_USERS[1][0]
    await client.patch(
        "/api/me", headers={"X-Demo-User": str(friend)}, json={"allow_voice_by_friends": True}
    )
    url = f"/api/heads/{friend}/say"
    assert (await client.post(url, json={"preset_id": "0"})).status_code == 200
    before = app.state.settings.cost_limiter.counts.copy()
    cached = await client.post(url, json={"preset_id": "0"})
    assert cached.status_code == 200 and cached.json()["cached"]
    assert app.state.settings.cost_limiter.counts == before
    denied = await client.post(url, json={"preset_id": "1"})
    assert denied.status_code == 429
    assert isinstance(denied.json()["detail"], str)
    assert "retry-after" in denied.headers
    assert ("elevenlabs", "seat", str(SELF)) in before


async def test_gpu_replay_free_and_new_photo_denied(api):
    client, app = api
    app.state.settings.cost_limiter.caps["gpu"] = (3, 3, 3)

    def photo(color):
        output = io.BytesIO()
        Image.new("RGB", (8, 8), color).save(output, "PNG")
        return {"file": ("photo.png", output.getvalue(), "image/png")}

    url = f"/api/avatars/{SELF}/photo"
    first = await client.post(url, data={"consent": "true"}, files=photo("red"))
    assert first.status_code == 200
    again = await client.post(url, data={"consent": "true"}, files=photo("red"))
    assert again.json() == first.json()
    denied = await client.post(url, data={"consent": "true"}, files=photo("blue"))
    assert denied.status_code == 429
    assert len(list(app.state.settings.asset_dir.rglob("*.png"))) == 1


async def test_outbox_cap_rolls_back_claims_and_counts_retries(api):
    client, app = api
    app.state.settings.cost_limiter.caps["photon"] = (1, 1, 1)
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET phone_e164='+15555550100',agent_msgs_ok=true WHERE id=%s", (SELF,)
        )
        await conn.execute(
            "INSERT INTO mayor_outbox(village_id,user_id,phone_e164,text) VALUES(%s,%s,%s,'hello')",
            (VILLAGE_ID, SELF, "+15555550100"),
        )
    headers = {"X-Service-Key": "test-service-only"}
    first = await client.get("/api/internal/outbox", headers=headers)
    assert first.status_code == 200 and len(first.json()) == 1
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE mayor_outbox SET claimed_until=now()-interval '1 second'")
    assert (await client.get("/api/internal/outbox", headers=headers)).status_code == 429
    async with app.state.pool.connection() as conn:
        row = await (
            await conn.execute("SELECT claimed_until<now() AS expired FROM mayor_outbox")
        ).fetchone()
        assert row["expired"]


async def test_cors_and_validation_do_not_expose_inputs(api):
    client, _ = api
    response = await client.options(
        "/api/me",
        headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "PATCH"},
    )
    assert "access-control-allow-origin" not in response.headers
    response = await client.post(f"/api/heads/{SELF}/say", json={"preset_id": "secret-marker"})
    assert response.status_code == 422
    assert "secret-marker" not in response.text


async def test_reply_budget_does_not_undo_stop(api):
    client, app = api
    app.state.settings.cost_limiter.caps["photon"] = (0, 0, 0)
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET phone_e164='+15555550100',agent_msgs_ok=true WHERE id=%s", (SELF,)
        )
    response = await client.post(
        "/api/internal/inbound",
        headers={"X-Service-Key": "test-service-only"},
        json={"phone_e164": "+15555550100", "text": "STOP", "message_id": "sec-stop"},
    )
    assert response.status_code == 429
    async with app.state.pool.connection() as conn:
        row = await (
            await conn.execute("SELECT agent_msgs_ok FROM users WHERE id=%s", (SELF,))
        ).fetchone()
    assert row["agent_msgs_ok"] is False


async def test_partial_outbox_batch_does_not_starve_delivery(api):
    client, app = api
    app.state.settings.cost_limiter.caps["photon"] = (1, 1, 1)
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET phone_e164='+15555550100',agent_msgs_ok=true WHERE id=%s", (SELF,)
        )
        for _ in range(2):
            await conn.execute(
                "INSERT INTO mayor_outbox(village_id,user_id,phone_e164,text) "
                "VALUES(%s,%s,%s,'hello')",
                (VILLAGE_ID, SELF, "+15555550100"),
            )
    response = await client.get(
        "/api/internal/outbox", headers={"X-Service-Key": "test-service-only"}
    )
    assert response.status_code == 200 and len(response.json()) == 1
    async with app.state.pool.connection() as conn:
        rows = await (
            await conn.execute("SELECT status FROM mayor_outbox ORDER BY status")
        ).fetchall()
    assert [row["status"] for row in rows] == ["claimed", "pending"]


async def test_cached_reply_keeps_authenticated_seat(api):
    client, app = api
    app.state.settings.cost_limiter.caps["photon"] = (5, 5, 1)
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET phone_e164='+15555550100' WHERE id=%s", (SELF,))
    payload = {"phone_e164": "+15555550100", "text": "STATUS", "message_id": "cached-reply"}
    headers = {"X-Service-Key": "test-service-only"}
    assert (
        await client.post("/api/internal/inbound", headers=headers, json=payload)
    ).status_code == 200
    assert (
        await client.post("/api/internal/inbound", headers=headers, json=payload)
    ).status_code == 429
    assert app.state.settings.cost_limiter.counts[("photon", "seat", str(SELF))] == 1


async def test_hourly_rejection_does_not_consume_daily_budget(api):
    from app import budget

    _, app = api
    app.state.settings.llm_max_calls_per_hour = 0
    with pytest.raises(budget.BudgetExceeded):
        await budget.reserve(app.state.settings)
    assert app.state.settings.cost_limiter.counts == {}


async def test_outbox_reserves_text_and_attachment_send_units(api):
    client, app = api
    limiter = app.state.settings.cost_limiter
    limiter.caps["photon"] = (2, 2, 2)
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET phone_e164='+15555550100',agent_msgs_ok=true WHERE id=%s", (SELF,)
        )
        await conn.execute(
            "INSERT INTO mayor_outbox(village_id,user_id,phone_e164,text,audio_key,image_key) "
            "VALUES(%s,%s,%s,'hello','synthetic.mp3','synthetic.png')",
            (VILLAGE_ID, SELF, "+15555550100"),
        )
    headers = {"X-Service-Key": "test-service-only"}
    assert (await client.get("/api/internal/outbox", headers=headers)).status_code == 429
    assert limiter.counts == {}
    limiter.caps["photon"] = (3, 3, 3)
    assert (await client.get("/api/internal/outbox", headers=headers)).status_code == 200
    assert limiter.counts[("photon", "global", "*")] == 3
