import httpx
import pytest
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.assets_cache import AssetGZipMiddleware
from app.domain import VILLAGE_ID
from app.read_cache import ReadCacheMiddleware


@pytest.mark.asyncio
async def test_private_reads_revalidate_after_authorization_and_compress():
    app = FastAPI()
    revision = [1]
    calls = []

    @app.get("/api/villages/test/presence/stream")
    async def events():
        return StreamingResponse(
            iter([b"data: " + b"village " * 1000 + b"\n\n"]), media_type="text/event-stream"
        )

    @app.get("/api/villages/test")
    @app.get("/api/villages/test/feed")
    @app.get("/api/houses/test")
    @app.get("/api/villages/test/competitions")
    @app.get("/api/heads/presets")
    async def read(request: Request):
        user = request.headers.get("x-demo-user")
        calls.append(user)
        if user not in {"alice", "bob"}:
            raise HTTPException(403)
        return {"user": user, "revision": revision[0], "data": "village " * 1000}

    app.add_middleware(ReadCacheMiddleware)
    app.add_middleware(AssetGZipMiddleware)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as c:
        for path in ("/api/villages/test", "/api/villages/test/feed?limit=50", "/api/houses/test", "/api/villages/test/competitions", "/api/heads/presets"):
            headers = {"X-Demo-User": "alice"}
            first = await c.get(path, headers=headers)
            assert first.status_code == 200
            assert first.headers["content-encoding"] == "gzip"
            assert int(first.headers["content-length"]) < len(first.content) / 10
            assert first.headers["cache-control"] == "private, no-cache"
            assert "X-Demo-User" in first.headers["vary"]
            etag = first.headers["etag"]
            headers["If-None-Match"] = '"old", ' + etag
            same = await c.get(path, headers=headers)
            assert same.status_code == 304 and same.content == b""
            assert same.headers["etag"] == etag
            assert "content-length" not in same.headers
            assert "content-encoding" not in same.headers
            revision[0] += 1
            changed = await c.get(path, headers=headers)
            assert changed.status_code == 200 and changed.headers["etag"] != etag
            other = await c.get(path, headers={**headers, "X-Demo-User": "bob"})
            assert other.status_code == 200 and other.json()["user"] == "bob"
            denied = await c.get(path, headers={"If-None-Match": "*"})
            assert denied.status_code == 403 and "etag" not in denied.headers
        assert len(calls) == 25
        stream = await c.get("/api/villages/test/presence/stream")
        assert stream.status_code == 200 and stream.content.startswith(b"data: ")
        assert "content-encoding" not in stream.headers  # SSE must not wait on a gzip buffer.


@pytest.mark.asyncio
async def test_seeded_village_and_feed_revalidate_without_bypassing_membership(api, outsider):
    client, _ = api
    for suffix in ("", "/feed?limit=50"):
        path = f"/api/villages/{VILLAGE_ID}{suffix}"
        first = await client.get(path)
        assert first.status_code == 200
        etag = first.headers["etag"]
        second = await client.get(path, headers={"If-None-Match": etag})
        assert second.status_code == 304 and second.content == b""
        denied = await client.get(path, headers={**outsider, "If-None-Match": etag})
        assert denied.status_code == 403


@pytest.mark.asyncio
async def test_noncacheable_json_errors_and_writes_keep_their_semantics():
    app = FastAPI()

    @app.get("/api/me")
    async def private_read():
        from fastapi.responses import JSONResponse
        return JSONResponse({"sensitive": True}, headers={"Cache-Control": "no-store"})

    @app.post("/api/houses/test")
    async def write():
        return {"saved": True}

    @app.get("/api/houses/missing")
    async def missing():
        raise HTTPException(404)

    app.add_middleware(ReadCacheMiddleware)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as c:
        private = await c.get("/api/me", headers={"If-None-Match": "*"})
        assert private.status_code == 200 and private.headers["cache-control"] == "no-store"
        assert "etag" not in private.headers
        changed = await c.post("/api/houses/test", headers={"If-None-Match": "*"})
        assert changed.status_code == 200 and "etag" not in changed.headers
        missing = await c.get("/api/houses/missing", headers={"If-None-Match": "*"})
        assert missing.status_code == 404 and "etag" not in missing.headers
