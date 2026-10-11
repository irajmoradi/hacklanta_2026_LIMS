import asyncio

from app import chorus
from app.domain import VILLAGE_ID
from tests.test_feat017 import FRIEND, SELF

pytest_plugins = ["tests.test_feat017"]


async def test_batch_cache_poll_limits_and_consent(api, safety, monkeypatch):
    client, app = api
    renders = []
    release = asyncio.Event()

    async def render(settings, uid, audio_key, marker):
        import json

        renders.append(uid)
        await release.wait()
        key = audio_key.replace(".mp3", ".mp4")
        (settings.asset_dir / key).write_bytes(b"synthetic-mp4")
        marker.write_text(json.dumps({"status": "ready", "video_key": key}))

    monkeypatch.setattr(chorus, "render", render)
    await client.patch(
        "/api/me", headers={"X-Demo-User": str(FRIEND)}, json={"allow_voice_by_friends": True}
    )
    body = {"village_id": str(VILLAGE_ID), "preset_id": "1"}
    first = await client.post("/api/heads/chorus", json=body)
    assert first.status_code == 200, first.text
    members = first.json()["members"]
    assert {m["user_id"] for m in members} == {str(SELF), str(FRIEND)}
    assert all(m["status"] == "pending" for m in members)
    again = (await client.post("/api/heads/chorus", json=body)).json()["members"]
    assert all(m["cached"] for m in again)
    assert len(renders) == 2
    release.set()
    await asyncio.gather(*chorus._tasks)
    for member in members:
        polled = await client.get("/api/heads/chorus/" + member["id"])
        assert polled.json()["status"] == "ready"
        assert (await client.get(polled.json()["video_url"])).status_code == 200
    assert len(safety) == 2
    async with app.state.pool.connection() as conn:
        await conn.execute(
            """INSERT INTO head_speech_attempts(id,requester_id)
                           SELECT gen_random_uuid(),%s FROM generate_series(1,8)""",
            (SELF,),
        )
    assert all(
        m["cached"] for m in (await client.post("/api/heads/chorus", json=body)).json()["members"]
    )
    limited = (await client.post("/api/heads/chorus", json={"preset_id": "2"})).json()
    assert all(m["code"] == 429 for m in limited["members"])
    await client.patch(
        "/api/me", headers={"X-Demo-User": str(FRIEND)}, json={"allow_voice_by_friends": False}
    )
    friend = next(m for m in members if m["user_id"] == str(FRIEND))
    assert (await client.get("/api/heads/chorus/" + friend["id"])).status_code == 403
    video_url = friend["audio_url"].replace(".mp3", ".mp4")
    assert (await client.get(video_url)).status_code == 403
    assert len((await client.post("/api/heads/chorus", json=body)).json()["members"]) == 1


async def test_offline_and_poll_never_queues(api, safety, monkeypatch, outsider):
    client, _ = api
    calls = []

    async def offline(settings):
        calls.append(1)
        return None

    monkeypatch.setattr(chorus.gpu_client, "pick", offline)
    response = await client.post("/api/heads/chorus", json={"preset_id": "0"})
    member = response.json()["members"][0]
    await asyncio.gather(*chorus._tasks)
    for _ in range(3):
        response = await client.get("/api/heads/chorus/" + member["id"])
        assert response.json()["status"] == "unavailable"
    await client.post("/api/heads/chorus", json={"preset_id": "0"})
    assert calls == [1]
    assert (
        await client.post(
            "/api/heads/chorus",
            json={"village_id": str(VILLAGE_ID), "text": "Hi"},
            headers=outsider,
        )
    ).status_code == 403
    assert (
        await client.post("/api/heads/chorus", json={"text": "Hi", "preset_id": "0"})
    ).status_code == 422


async def test_worker_adapter_and_member_filter(api, safety, monkeypatch):
    import httpx

    client, app = api
    calls = []
    original_client = httpx.AsyncClient

    def worker(request):
        calls.append(request.url.path)
        if request.url.path == "/health":
            return httpx.Response(200, json={"ok": True})
        import json

        body = json.loads(request.content)
        assert body["user_id"] == str(SELF)
        assert body["max_seconds"] == 15
        assert request.url.query == b"wait=true"
        key = body["audio_path"].replace(".mp3", ".mp4")
        (app.state.settings.asset_dir / key).write_bytes(b"mock-mp4")
        return httpx.Response(200, json={"status": "done", "result": {"video_key": key}})

    monkeypatch.setattr(
        chorus.httpx,
        "AsyncClient",
        lambda **kw: original_client(transport=httpx.MockTransport(worker), **kw),
    )
    await client.patch(
        "/api/me", headers={"X-Demo-User": str(FRIEND)}, json={"allow_voice_by_friends": True}
    )
    response = await client.post(
        "/api/heads/chorus", json={"preset_id": "0", "member_ids": [str(SELF)]}
    )
    members = response.json()["members"]
    assert len(members) == 1
    await asyncio.gather(*chorus._tasks)
    result = await client.get("/api/heads/chorus/" + members[0]["id"])
    assert result.json()["status"] == "ready"
    assert calls == ["/health", "/avatar/talk_video"]
    assert len(safety) == 1


async def test_modal_route_writes_marker(api, safety, monkeypatch):
    """Modal-only prod (no local worker URL): chorus clips render through gpu_client.talk_video_modal."""
    client, app = api
    calls = []

    async def modal(settings):
        return "modal"

    async def talk(settings, uid, audio_key, max_seconds=15):
        calls.append(str(uid))
        key = audio_key.replace(".mp3", ".mp4")
        (settings.asset_dir / key).write_bytes(b"modal-mp4")
        return key, {"cold": False}

    monkeypatch.setattr(chorus.gpu_client, "pick", modal)
    monkeypatch.setattr(chorus.gpu_client, "talk_video_modal", talk)
    response = await client.post(
        "/api/heads/chorus", json={"preset_id": "3", "member_ids": [str(SELF)]}
    )
    member = response.json()["members"][0]
    await asyncio.gather(*chorus._tasks)
    polled = (await client.get("/api/heads/chorus/" + member["id"])).json()
    assert polled["status"] == "ready" and polled["video_url"].endswith(".mp4")
    assert calls == [str(SELF)]
