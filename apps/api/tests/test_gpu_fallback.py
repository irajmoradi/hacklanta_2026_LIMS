"""FIX-019: real HTTPX routing/redirects over mock transports; no GPU or DB needed."""

import asyncio
import base64
import importlib.util
import logging
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import httpx
import pytest

from app import config, gpu_client, gram_video
from app.config import Settings

KEY = "synthetic-gpu-key-fix019"
LOCAL = "http://local.test"
MODAL = "https://modal.test"


@pytest.fixture
def settings(tmp_path):
    return Settings(
        database_url="", asset_dir=tmp_path, gpu_worker_url=LOCAL + "/health/",
        gpu_fallback_url=MODAL, gpu_fallback_key=KEY,
    )


@pytest.fixture
def mock_http(monkeypatch):
    """Keep HTTPX request construction and redirect handling, replace only I/O."""
    async_client, client = httpx.AsyncClient, httpx.Client

    def install(handler):
        transport = httpx.MockTransport(handler)
        monkeypatch.setattr(
            httpx, "AsyncClient", lambda **kw: async_client(transport=transport, **kw)
        )
        # Top-level httpx.get/post create Client internally.
        monkeypatch.setattr(
            httpx._api, "Client", lambda **kw: client(transport=transport, **kw)
        )

    # Any test forgetting its handler must fail before accessing the network.
    def unexpected(request):
        pytest.fail(f"Unexpected HTTP request: {request.method} {request.url}")

    install(unexpected)
    return install


def health_response(request, outcome):
    assert request.method == "GET" and str(request.url) == LOCAL + "/health"
    assert "x-gpu-key" not in request.headers
    assert request.extensions["timeout"]["read"] == 2
    if outcome == "down":
        raise httpx.ConnectError("offline", request=request)
    if outcome == "slow":
        raise httpx.ReadTimeout("slow", request=request)
    return httpx.Response(outcome)


@pytest.mark.parametrize("outcome", [200, 503, 302, "down", "slow"])
@pytest.mark.parametrize("configured", [True, False])
async def test_api_selects_local_fallback_or_offline(settings, mock_http, outcome, configured):
    if not configured:
        settings = replace(settings, gpu_fallback_url="", gpu_fallback_key="")
    mock_http(lambda request: health_response(request, outcome))
    expected = "local" if outcome == 200 else "modal" if configured else None
    assert await gpu_client.pick(settings) == expected
    assert await gram_video.reachable(settings) is (configured or outcome == 200)


async def test_api_health_has_total_two_second_deadline(settings, mock_http):
    cancelled = asyncio.Event()

    async def stalled(request):
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    mock_http(stalled)
    # MockTransport does not enforce socket timeouts: this exercises asyncio.timeout.
    assert await asyncio.wait_for(gpu_client.pick(settings), 3) == "modal"
    assert cancelled.is_set()


@pytest.mark.parametrize("missing", [None, "gpu_fallback_url", "gpu_fallback_key"])
async def test_api_modal_preference_requires_url_and_key(settings, mock_http, missing):
    settings = replace(settings, gpu_prefer="modal", **({missing: ""} if missing else {}))
    calls = []

    def handler(request):
        calls.append(request)
        return health_response(request, 200)

    mock_http(handler)
    assert await gpu_client.pick(settings) == ("local" if missing else "modal")
    assert len(calls) == (1 if missing else 0)


@pytest.fixture
def media(settings):
    audio = settings.asset_dir / "voice" / "line.mp3"
    audio.parent.mkdir()
    audio.write_bytes(b"synthetic audio")
    face = settings.asset_dir / "avatars" / "user" / "face_512.png"
    face.parent.mkdir(parents=True)
    face.write_bytes(b"synthetic face")
    return audio, face.parent / "head" / "talk_prep.pt"


@pytest.mark.parametrize("cached_prep", [False, True])
async def test_modal_video_follows_303_and_writes_artifacts(
    settings, media, mock_http, caplog, cached_prep,
):
    audio, prep = media
    if cached_prep:
        prep.parent.mkdir()
        prep.write_bytes(b"cached prep")
    calls = []

    def handler(request):
        calls.append((request.method, request.url.path))
        assert request.headers["x-gpu-key"] == KEY
        assert request.extensions["timeout"]["read"] == gpu_client.MODAL_TIMEOUT
        if request.method == "POST":
            assert request.url.path == "/avatar/talk_video"
            assert b"synthetic audio" in request.content
            assert b"synthetic face" in request.content
            assert (b"cached prep" in request.content) is cached_prep
            return httpx.Response(303, headers={"Location": "/result"})
        assert request.method == "GET" and request.content == b""
        return httpx.Response(200, json={
            "status": "ready", "video_b64": base64.b64encode(b"video").decode(),
            "prep_b64": base64.b64encode(b"new prep").decode(), "gpu_seconds": 3,
        })

    mock_http(handler)
    caplog.set_level(logging.DEBUG)
    key, meta = await gpu_client.talk_video_modal(settings, "user", "voice/line.mp3")
    assert calls == [("POST", "/avatar/talk_video"), ("GET", "/result")]
    assert key == "voice/line.mp4" and audio.with_suffix(".mp4").read_bytes() == b"video"
    assert prep.read_bytes() == (b"cached prep" if cached_prep else b"new prep")
    assert meta["gpu_seconds"] == 3
    assert KEY not in caplog.text


@pytest.mark.parametrize("route", ["local", "modal", "offline", "modal_failed"])
async def test_render_routes_and_releases_pending_delivery(
    settings, media, mock_http, monkeypatch, caplog, route,
):
    calls = []
    if route == "offline":
        settings = replace(settings, gpu_fallback_url="", gpu_fallback_key="")

    def handler(request):
        calls.append((request.url.host, request.url.path))
        if request.url.path == "/health":
            return health_response(request, 200 if route == "local" else "down")
        if request.url.host == "local.test":
            assert route == "local" and "x-gpu-key" not in request.headers
            assert request.url.query == b"wait=true"
            media[0].with_suffix(".mp4").write_bytes(b"local video")
            return httpx.Response(200, json={
                "status": "ready", "result": {"video_key": "voice/line.mp4"},
            })
        assert request.url.host == "modal.test" and request.headers["x-gpu-key"] == KEY
        if route == "modal_failed":
            return httpx.Response(200, json={"status": "failed", "error": KEY})
        return httpx.Response(200, json={
            "status": "ready", "video_b64": base64.b64encode(b"modal video").decode(),
        })

    mock_http(handler)
    conn = AsyncMock()

    class Pool:
        @asynccontextmanager
        async def connection(self):
            yield conn

    expected_key = "voice/line.mp4" if route in ("local", "modal") else None
    update = AsyncMock(return_value={"video_key": expected_key})
    monkeypatch.setattr(gram_video, "one", update)
    caplog.set_level(logging.DEBUG)
    await gram_video.render(Pool(), settings, "gram", "user", "voice/line.mp3")
    assert update.call_args.args[2] == (expected_key, "gram")
    assert conn.execute.call_args.args[1] == (expected_key, "gram")
    assert "video_pending_until=NULL" in update.call_args.args[1]
    assert "video_pending_until>now()" in update.call_args.args[1]
    assert len(calls) == (1 if route == "offline" else 2)
    assert KEY not in caplog.text


@pytest.fixture
def bridge(monkeypatch, tmp_path):
    # Run bridge regressions in the API suite, using its lightweight dependencies.
    path = Path(__file__).resolve().parents[3] / "workers" / "gpu" / "bridge.py"
    spec = importlib.util.spec_from_file_location("fix019_bridge", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(module, "ROOT", tmp_path / "repo")
    monkeypatch.setenv("GPU_FALLBACK_URL", MODAL + "/")
    monkeypatch.setenv("GPU_FALLBACK_KEY", KEY)
    monkeypatch.setenv("GPU_FALLBACK_KEY_FILE", str(tmp_path / "absent.key"))
    monkeypatch.setenv("GPU_PREFER", "local")
    return module


@pytest.mark.parametrize("outcome", [200, 503, 302, "down", "slow"])
def test_bridge_routes_on_health(bridge, mock_http, outcome):
    mock_http(lambda request: health_response(request, outcome))
    assert bridge.use_modal(LOCAL) is (outcome != 200)


@pytest.mark.parametrize("prefer", ["local", "modal"])
@pytest.mark.parametrize("missing", [None, "GPU_FALLBACK_URL", "GPU_FALLBACK_KEY"])
def test_bridge_preference_and_missing_configuration(
    bridge, mock_http, monkeypatch, prefer, missing,
):
    monkeypatch.setenv("GPU_PREFER", prefer.upper())
    if missing:
        monkeypatch.setenv(missing, "")
    calls = []

    def handler(request):
        calls.append(request)
        return health_response(request, 200)

    mock_http(handler)
    assert bridge.use_modal(LOCAL) is (prefer == "modal" and missing is None)
    assert len(calls) == (1 if prefer == "local" and missing is None else 0)


def test_bridge_without_fallback_requeues_offline_job(
    bridge, mock_http, monkeypatch, tmp_path,
):
    monkeypatch.setenv("GPU_FALLBACK_URL", "")
    monkeypatch.setenv("GPU_FALLBACK_KEY", "")
    photo = tmp_path / "photo.png"
    photo.write_bytes(b"synthetic photo")
    job = {
        "id": "job", "user_id": "user", "stage": "segment", "attempts": 1,
        "input": {"photo_asset_key": "photo.png"},
    }
    monkeypatch.setattr(bridge, "claim", lambda conn: job)
    calls = []

    def handler(request):
        calls.append(request.url.host)
        assert request.url.host == "local.test" and "x-gpu-key" not in request.headers
        raise httpx.ConnectError("offline", request=request)

    mock_http(handler)
    conn = Mock()
    assert bridge.process_one(conn, tmp_path, LOCAL) is None
    assert calls == ["local.test"]
    query, params = conn.execute.call_args.args
    assert "status='queued'" in query and "attempts=attempts-1" in query
    assert params == ("job",)


@pytest.mark.parametrize("outcome", [200, "down", "slow"])
def test_bridge_segment_uses_selected_backend(
    bridge, mock_http, monkeypatch, tmp_path, outcome,
):
    photo = tmp_path / "photo.png"
    photo.write_bytes(b"synthetic photo")
    face = tmp_path / "avatars" / "user" / "face_512.png"
    result = {
        "crops": [{"crop_id": "person_0", "area_frac": 1, "colors": {}}],
        "selected_crop_id": "person_0",
    }
    calls = []

    def handler(request):
        calls.append((request.url.host, request.url.path))
        if request.url.path == "/health":
            return health_response(request, outcome)
        assert request.method == "POST" and request.url.path == "/segment"
        assert b"synthetic photo" in request.content
        if outcome == 200:
            assert request.url.host == "local.test" and "x-gpu-key" not in request.headers
            face.parent.mkdir(parents=True)
            face.write_bytes(b"local face")
            return httpx.Response(200, json={"status": "ready", "result": result})
        assert request.url.host == "modal.test" and request.headers["x-gpu-key"] == KEY
        return httpx.Response(200, json={
            "status": "ready", "result": result,
            "files": {"person_0/face_512.png": base64.b64encode(b"modal face").decode()},
        })

    mock_http(handler)
    done = Mock(return_value={"manifest_revision": 1})
    monkeypatch.setattr(bridge, "_member_segment_done", done)
    job = {"user_id": "user", "input": {"photo_asset_key": "photo.png"}}
    assert bridge.do_segment(Mock(), job, tmp_path, LOCAL) == {"manifest_revision": 1}
    assert face.read_bytes() == (b"local face" if outcome == 200 else b"modal face")
    assert calls == [
        ("local.test", "/health"),
        ("local.test" if outcome == 200 else "modal.test", "/segment"),
    ]


def test_bridge_modal_call_follows_303_with_key(bridge, mock_http, caplog):
    calls = []

    def handler(request):
        calls.append((request.method, request.url.path))
        assert request.headers["x-gpu-key"] == KEY
        assert request.extensions["timeout"]["read"] == 900
        if request.method == "POST":
            assert b"synthetic photo" in request.content
            return httpx.Response(303, headers={"Location": "/result"})
        assert request.content == b""
        return httpx.Response(200, json={"status": "ready", "result": {"ok": True}})

    mock_http(handler)
    caplog.set_level(logging.DEBUG)
    result = bridge.modal_call("/segment", {"user_id": "user"}, {
        "file": ("photo.png", b"synthetic photo", "image/png"),
    })
    assert result["result"] == {"ok": True}
    assert calls == [("POST", "/segment"), ("GET", "/result")]
    assert KEY not in caplog.text


@pytest.mark.parametrize("failure", [401, 503, "failed", "down", "slow"])
def test_bridge_modal_failures_never_log_key(bridge, mock_http, caplog, failure):
    def handler(request):
        if failure == "down":
            raise httpx.ConnectError(KEY, request=request)
        if failure == "slow":
            raise httpx.ReadTimeout(KEY, request=request)
        return httpx.Response(
            failure if isinstance(failure, int) else 200,
            json={"status": "failed", "error": f"Rejected X-GPU-Key: {KEY}"},
        )

    mock_http(handler)
    caplog.set_level(logging.DEBUG)
    with pytest.raises((ConnectionError, bridge.JobError)) as exc:
        bridge.modal_call("/segment", {}, {})
    assert KEY not in str(exc.value)
    assert KEY not in caplog.text


@pytest.mark.parametrize("source", ["env", "file", "default_file", "missing"])
def test_fallback_key_sources_are_isolated_from_real_secrets(
    bridge, monkeypatch, tmp_path, source,
):
    monkeypatch.setattr(config, "ROOT", bridge.ROOT)
    monkeypatch.setattr(config, "load_environment", lambda: None)
    key_file = tmp_path / "configured.key"
    if source == "default_file":
        key_file = bridge.ROOT / "data" / "run" / "gpu_fallback.key"
        monkeypatch.delenv("GPU_FALLBACK_KEY_FILE")
    else:
        monkeypatch.setenv("GPU_FALLBACK_KEY_FILE", str(key_file))
    if source != "missing":
        key_file.parent.mkdir(parents=True, exist_ok=True)
        key_file.write_text("  synthetic-file-key\n", encoding="utf-8")
    monkeypatch.setenv("GPU_FALLBACK_KEY", KEY if source == "env" else "")
    monkeypatch.setenv("GPU_PREFER", "MODAL")
    expected = KEY if source == "env" else "" if source == "missing" else "synthetic-file-key"
    api_settings = Settings.from_env()
    assert api_settings.gpu_fallback_key == expected
    assert api_settings.gpu_fallback_url == MODAL and api_settings.gpu_prefer == "modal"
    assert bridge.modal_cfg() == {"url": MODAL, "key": expected, "prefer": "modal"}
    if expected:
        assert expected not in repr(api_settings)
