"""Face checks exercise real auth, transactions and XP with a mocked worker."""

import asyncio
from dataclasses import replace

import httpx
import pytest

from app import auth_face
from app.db import one
from app.domain import SEED_USERS

UID = str(SEED_USERS[0][0])
OTHER = str(SEED_USERS[1][0])
VERIFY = "/api/auth/face-verify"
ENROLL = "/api/auth/face-enroll"
SELFIE = {"file": ("private-name.png", b"mock selfie bytes", "image/png")}
REAL_CLIENT = httpx.AsyncClient


def mock_worker(monkeypatch, payload=None, status=200, down=False):
    calls = []

    def handle(request):
        calls.append(request)
        if down:
            raise httpx.ConnectError("private worker details", request=request)
        return httpx.Response(status, json=payload, request=request)

    monkeypatch.setattr(
        auth_face.httpx,
        "AsyncClient",
        lambda **kwargs: REAL_CLIENT(transport=httpx.MockTransport(handle), **kwargs),
    )
    return calls


async def state(app, uid=UID):
    async with app.state.pool.connection() as conn:
        return await one(conn, "SELECT face_verified_at FROM users WHERE id=%s", (uid,))


async def test_match_flag_expiry_and_one_time_badge(api, monkeypatch):
    client, app = api
    calls = mock_worker(monkeypatch, {"match": True, "face_found": True, "score": 0.97})
    assert (await client.get("/api/me")).json()["user"]["face_verified_at"] is None
    for _ in range(2):
        response = await client.post(VERIFY, files=SELFIE)
        assert response.status_code == 200
        assert response.json() == {"match": True, "face_found": True}
    assert (await state(app))["face_verified_at"] is not None
    assert (await client.get("/api/me")).json()["user"]["face_verified_at"]
    assert (await client.patch("/api/me", json={"display_name": "Recognized"})).json()["user"][
        "face_verified_at"
    ]
    assert b"0.40" in calls[0].content
    assert b"private-name" not in calls[0].content
    async with app.state.pool.connection() as conn:
        ledger = await one(
            conn,
            "SELECT count(*) AS n FROM xp_ledger WHERE source_key=%s",
            (f"face-recognized:{UID}",),
        )
        assert ledger["n"] == 1
        await conn.execute(
            "UPDATE users SET face_verified_at=now()-interval '6 minutes' WHERE id=%s", (UID,)
        )
    assert (await client.get("/api/me")).json()["user"]["face_verified_at"] is None
    assert not list(app.state.settings.asset_dir.rglob("*"))


@pytest.mark.parametrize("match,face_found", [(False, True), (False, False), (True, False)])
async def test_no_match_or_no_face(api, monkeypatch, match, face_found):
    client, app = api
    mock_worker(monkeypatch, {"match": match, "face_found": face_found, "score": 0.1})
    response = await client.post(VERIFY, files=SELFIE)
    assert response.json() == {"match": False, "face_found": face_found}
    assert (await state(app))["face_verified_at"] is None
    async with app.state.pool.connection() as conn:
        assert not await one(
            conn, "SELECT id FROM xp_ledger WHERE source_key=%s", (f"face-recognized:{UID}",)
        )


@pytest.mark.parametrize("status,expected", [(500, 503), (404, 404), (422, 422), (302, 503)])
async def test_worker_errors_are_sanitized(api, monkeypatch, status, expected):
    client, app = api
    mock_worker(monkeypatch, {"detail": "private worker details"}, status=status)
    response = await client.post(VERIFY, files=SELFIE)
    assert response.status_code == expected
    assert "private worker details" not in response.text
    assert (await state(app))["face_verified_at"] is None


async def test_down_failures_count_and_window_recovers(api, monkeypatch):
    client, app = api
    calls = mock_worker(monkeypatch, down=True)
    for _ in range(5):
        response = await client.post(VERIFY, files=SELFIE)
        assert response.status_code == 503
        assert "private worker details" not in response.text
    response = await client.post(VERIFY, files=SELFIE)
    assert response.status_code == 429
    assert 1 <= int(response.headers["Retry-After"]) <= 60
    assert len(calls) == 5
    assert (await client.post(ENROLL)).status_code == 429
    assert (
        await client.post(VERIFY, files=SELFIE, headers={"X-Demo-User": OTHER})
    ).status_code == 503
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE face_auth_limits SET attempts=ARRAY[now()-interval '61 seconds'] "
            "WHERE user_id=%s",
            (UID,),
        )
    assert (await client.post(VERIFY, files=SELFIE)).status_code == 503


async def test_self_only_enroll_and_verify(api, monkeypatch):
    client, app = api
    calls = mock_worker(monkeypatch, {"match": True, "face_found": True})
    response = await client.post(
        VERIFY + f"?user_id={OTHER}", data={"user_id": OTHER, "threshold": "0"}, files=SELFIE
    )
    assert response.status_code == 200
    assert UID.encode() in calls[0].content
    assert OTHER.encode() not in calls[0].content
    assert (await state(app, OTHER))["face_verified_at"] is None
    calls = mock_worker(monkeypatch, {"enrolled": True, "face_found": True, "score": 0.9})
    response = await client.post(ENROLL, json={"user_id": OTHER})
    assert response.json() == {"enrolled": True, "face_found": True}
    assert calls[0].content == ('{"user_id":"' + UID + '"}').encode()
    assert (await state(app))["face_verified_at"] is None


async def test_auth_required(api, monkeypatch):
    client, app = api
    calls = mock_worker(monkeypatch, {"match": True, "face_found": True})
    for path in (VERIFY, ENROLL):
        response = await client.post(path, files=SELFIE, headers={"X-Demo-User": ""})
        assert response.status_code == 401
    assert not calls


@pytest.mark.parametrize("payload", [{}, {"match": "true", "face_found": True}, []])
async def test_invalid_worker_payload(api, monkeypatch, payload):
    client, _ = api
    mock_worker(monkeypatch, payload)
    assert (await client.post(VERIFY, files=SELFIE)).status_code == 503


async def test_upload_limits(api, monkeypatch):
    client, _ = api
    calls = mock_worker(monkeypatch, {"match": True, "face_found": True})
    for content, mime, expected in [
        (b"", "image/png", 422),
        (b"x", "text/plain", 415),
        (b"x" * (auth_face.MAX_SELFIE_BYTES + 1), "image/png", 413),
    ]:
        response = await client.post(VERIFY, files={"file": ("selfie", content, mime)})
        assert response.status_code == expected
    assert not calls


@pytest.mark.parametrize("url", ["http://worker:8100", "http://worker:8100/health/"])
async def test_worker_base_url(api, monkeypatch, url):
    client, app = api
    app.state.settings = replace(app.state.settings, gpu_worker_url=url)
    calls = mock_worker(monkeypatch, {"match": False, "face_found": True})
    assert (await client.post(VERIFY, files=SELFIE)).status_code == 200
    assert str(calls[0].url) == "http://worker:8100/face/verify"


async def test_concurrent_checks_cannot_bypass_limit_or_duplicate_badge(api, monkeypatch):
    client, app = api
    calls = mock_worker(monkeypatch, {"match": True, "face_found": True})
    responses = await asyncio.gather(*(client.post(VERIFY, files=SELFIE) for _ in range(12)))
    assert sorted(r.status_code for r in responses) == [200] * 5 + [429] * 7
    assert len(calls) == 5
    async with app.state.pool.connection() as conn:
        assert (
            await one(
                conn,
                "SELECT count(*) AS n FROM xp_ledger WHERE source_key=%s",
                (f"face-recognized:{UID}",),
            )
        )["n"] == 1


async def test_user_without_village_can_verify(api, outsider, monkeypatch):
    client, _ = api
    mock_worker(monkeypatch, {"match": True, "face_found": True})
    assert (await client.post(VERIFY, files=SELFIE, headers=outsider)).status_code == 200
    assert (await client.get("/api/me", headers=outsider)).json()["user"]["face_verified_at"]


async def test_selfie_never_rolls_to_disk_and_is_closed(api, monkeypatch):
    import starlette.formparsers

    client, _ = api
    files = []
    original = starlette.formparsers.SpooledTemporaryFile

    def tracked(*args, **kwargs):
        file = original(*args, **kwargs)
        files.append(file)
        return file

    monkeypatch.setattr(starlette.formparsers, "SpooledTemporaryFile", tracked)
    mock_worker(monkeypatch, {"match": False, "face_found": True})
    # Exceeds Starlette's default 1 MiB disk-spooling threshold.
    response = await client.post(
        VERIFY, files={"file": ("selfie.png", b"x" * (2 * 1024 * 1024), "image/png")}
    )
    assert response.status_code == 200
    assert files and all(f.closed and not f._rolled for f in files)
    response = await client.post(
        VERIFY, files={"file": ("selfie.png", b"x" * (9 * 1024 * 1024), "image/png")}
    )
    assert response.status_code == 413
    assert all(f.closed and not f._rolled for f in files)


async def test_bad_multipart_and_missing_file(api, monkeypatch):
    client, _ = api
    calls = mock_worker(monkeypatch, {})
    response = await client.post(
        VERIFY, content=b"broken", headers={"Content-Type": "multipart/form-data; boundary=missing"}
    )
    assert response.status_code == 422
    assert (
        await client.post(VERIFY, files={"wrong": ("x.png", b"x", "image/png")})
    ).status_code == 422
    assert (await client.post(VERIFY, json={})).status_code == 415
    assert not calls


async def test_rate_limit_survives_new_app_instance(api, monkeypatch):
    from app.main import create_app

    client, app = api
    mock_worker(monkeypatch, {"match": False, "face_found": True})
    for _ in range(5):
        assert (await client.post(VERIFY, files=SELFIE)).status_code == 200
    second = create_app(app.state.settings)
    second.state.pool = app.state.pool
    async with REAL_CLIENT(
        transport=httpx.ASGITransport(app=second), base_url="http://test"
    ) as other:
        response = await other.post(VERIFY, files=SELFIE, headers={"X-Demo-User": UID})
    assert response.status_code == 429


async def test_migration_is_idempotent(api):
    from app.config import ROOT

    _, app = api
    migration = ROOT / "apps/api/migrations/013_face_auth.sql"
    assert not migration.read_bytes().startswith(b"\xef\xbb\xbf")
    async with app.state.pool.connection() as conn:
        await conn.execute(migration.read_text(encoding="utf-8"))
        await conn.execute(migration.read_text(encoding="utf-8"))
