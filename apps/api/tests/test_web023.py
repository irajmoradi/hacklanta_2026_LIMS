import httpx
import pytest
from fastapi import FastAPI, Request

from app.assets_cache import AssetGZipMiddleware, cached_asset
from app.domain import SEED_USERS


async def test_asset_authorization_precedes_conditional_response(api, outsider):
    client, app = api
    key = f"avatars/{SEED_USERS[0][0]}/face_512.png"
    path = app.state.settings.asset_dir / key
    path.parent.mkdir(parents=True)
    path.write_bytes(b"test portrait")
    url = f"/api/assets/{key}?rev=3"
    response = await client.get(url)
    assert response.status_code == 200
    assert response.headers["cache-control"].endswith("immutable")
    conditional = {"If-None-Match": response.headers["etag"]}
    assert (await client.get(url, headers=conditional)).status_code == 304
    assert (await client.get(url, headers={**outsider, **conditional})).status_code == 403


@pytest.mark.asyncio
async def test_revision_cache_and_compression(tmp_path):
    path = tmp_path / "asset"
    path.write_bytes(b"asset content " * 1000)
    app = FastAPI()
    app.add_middleware(AssetGZipMiddleware)

    @app.get("/api/assets/{key:path}")
    def asset(key: str, request: Request):
        return cached_asset(path, request)

    transport = httpx.ASGITransport(app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        url = "/api/assets/avatars/user/head/avatar.zip?rev=2"
        response = await client.get(url)
        assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
        assert "content-encoding" not in response.headers
        etag = response.headers["etag"]
        for validator in [etag, f'"other", W/{etag}', "*"]:
            cached = await client.get(url, headers={"If-None-Match": validator})
            assert cached.status_code == 304
            assert cached.content == b""
        path.write_bytes(b"changed")
        assert (await client.get(url, headers={"If-None-Match": etag})).status_code == 200
        path.write_bytes(b"compress me " * 1000)
        image = await client.get("/api/assets/avatars/user/face_512.png?rev=2")
        assert image.headers["content-encoding"] == "gzip"
        for private in ["uploads/user/photo.png?rev=2", "avatars/user/face_512.png"]:
            response = await client.get(f"/api/assets/{private}")
            assert response.headers["cache-control"] == "private, no-store"
