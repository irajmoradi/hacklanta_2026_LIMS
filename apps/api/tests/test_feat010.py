import asyncio
from types import SimpleNamespace

import httpx
import pytest
from test_feat002 import BASE, SERVICE, SPEAKER, body, buy, setup
from test_feat002 import review as gram_review  # noqa: F401

from app import domain, gpu_client, gram_video
from app.db import one
from app.domain import VILLAGE_ID


async def prepare(api, monkeypatch):
    client, app = api
    await setup(api)
    await buy(client)
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET voice_id='fixture',voice_consent=true WHERE id=%s", (SPEAKER,)
        )
    original = domain.avatar

    async def avatar(conn, uid):
        result = await original(conn, uid)
        if uid == SPEAKER:
            result["portrait"] = {"kind": "lam_head"}
        return result

    monkeypatch.setattr(domain, "avatar", avatar)


def mock_worker(monkeypatch, handler):
    original = httpx.AsyncClient
    mocked_httpx = SimpleNamespace(
        AsyncClient=lambda **kw: original(transport=httpx.MockTransport(handler), **kw),
        HTTPError=httpx.HTTPError,
    )
    monkeypatch.setattr(gram_video, "httpx", mocked_httpx)
    monkeypatch.setattr(gpu_client, "httpx", mocked_httpx)


@pytest.mark.usefixtures("gram_review")
async def test_video_holds_outbox_then_exposes_authenticated_clip(api, monkeypatch):
    client, app = api
    await prepare(api, monkeypatch)
    rendering, finish = asyncio.Event(), asyncio.Event()
    request = body()
    key = f"villages/{VILLAGE_ID}/grams/{request['idempotency_key']}.mp4"

    async def worker(req):
        if req.url.path == "/health":
            return httpx.Response(200, json={"ok": True})
        import json

        payload = json.loads(req.content)
        assert req.url.path == "/avatar/talk_video" and req.url.query == b"wait=true"
        assert payload["user_id"] == str(SPEAKER) and payload["max_seconds"] == 15
        assert payload["audio_path"].endswith(request["idempotency_key"] + ".mp3")
        rendering.set()
        await finish.wait()
        path = app.state.settings.asset_dir / key
        path.write_bytes(b"fixture-mp4")
        return httpx.Response(200, json={"video_path": str(path), "seconds": 3})

    mock_worker(monkeypatch, worker)
    # ASGITransport waits for post-response tasks; observe the committed row while it renders.
    posting = asyncio.create_task(client.post(BASE + "/villagergrams", json=request))
    try:
        await asyncio.wait_for(rendering.wait(), 5)
        status_url = BASE + "/villagergrams/" + request["idempotency_key"]
        assert (await client.get(status_url)).json()["status"] == "rendering_video"
        assert (await client.get("/api/internal/outbox", headers=SERVICE)).json() == []
        duplicate = await client.post(BASE + "/villagergrams", json=request)
        assert duplicate.json()["status"] == "rendering_video"
    finally:
        finish.set()
    response = await posting
    assert response.status_code == 201 and response.json()["status"] == "rendering_video"
    status = (await client.get(status_url)).json()
    assert status["status"] == "queued" and status["video_url"] == "/api/assets/" + key
    assert (await client.get(status["video_url"])).content == b"fixture-mp4"
    row = (await client.get("/api/internal/outbox", headers=SERVICE)).json()[0]
    assert row["video_url"] == "/api/internal/assets/" + key
    assert (await client.get(row["video_url"], headers=SERVICE)).content == b"fixture-mp4"
    assert (await client.get(row["video_url"])).status_code == 401


@pytest.mark.usefixtures("gram_review")
@pytest.mark.parametrize("failure", ["offline", "timeout", "bad_path", "http_error"])
async def test_video_falls_back_to_audio_and_portrait(api, monkeypatch, failure):
    client, app = api
    await prepare(api, monkeypatch)
    calls = []

    async def worker(req):
        calls.append(req.url.path)
        if req.url.path == "/health":
            if failure == "offline":
                raise httpx.ConnectError("offline", request=req)
            return httpx.Response(200)
        if failure == "timeout":
            raise httpx.ReadTimeout("timeout", request=req)
        if failure == "http_error":
            return httpx.Response(503)
        return httpx.Response(200, json={"video_path": "/not/our/asset.mp4", "seconds": 2})

    mock_worker(monkeypatch, worker)
    result = await client.post(BASE + "/villagergrams", json=body())
    assert result.status_code == 201
    row = (await client.get("/api/internal/outbox", headers=SERVICE)).json()[0]
    assert row["video_url"] is None and row["audio_url"] and row["image_url"]
    if failure == "offline":
        assert calls == ["/health"] and result.json()["status"] == "queued"


@pytest.mark.usefixtures("gram_review")
async def test_deadline_releases_gram_after_lost_background_task(api, monkeypatch):
    client, app = api
    await prepare(api, monkeypatch)

    async def reachable(_):
        return True

    async def lost(*_):
        pass

    monkeypatch.setattr(gram_video, "reachable", reachable)
    monkeypatch.setattr(gram_video, "render", lost)
    result = await client.post(BASE + "/villagergrams", json=body())
    assert result.json()["status"] == "rendering_video"
    assert (await client.get("/api/internal/outbox", headers=SERVICE)).json() == []
    async with app.state.pool.connection() as conn:
        row = await one(conn, "SELECT * FROM mayor_outbox")
        assert 118 < (row["video_pending_until"] - row["created_at"]).total_seconds() < 122
        await conn.execute("UPDATE mayor_outbox SET video_pending_until=now()-interval '1 second'")
        await conn.execute("UPDATE villagergrams SET video_pending_until=now()-interval '1 second'")
    row = (await client.get("/api/internal/outbox", headers=SERVICE)).json()[0]
    assert row["video_url"] is None and row["audio_url"] and row["image_url"]
    status = await client.get(BASE + "/villagergrams/" + result.json()["id"])
    assert status.json()["status"] == "queued"


async def test_health_has_hard_two_second_bound(monkeypatch):
    from app.config import Settings

    async def worker(req):
        await asyncio.sleep(10)

    mock_worker(monkeypatch, worker)
    started = asyncio.get_running_loop().time()
    assert not await gram_video.reachable(Settings(database_url=""))
    assert asyncio.get_running_loop().time() - started < 2.5
