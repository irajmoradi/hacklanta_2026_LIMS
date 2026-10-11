import asyncio
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException

from app import bribes, presence
from app.db import many, one
from app.domain import SEED_USERS, VILLAGE_ID

VID = str(VILLAGE_ID)
UID = SEED_USERS[0][0]
PEER = SEED_USERS[1][0]
BASE = f"/api/villages/{VID}"
pytestmark = pytest.mark.asyncio


async def test_mail_privacy_relay_read_and_feed(api, outsider):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET phone_e164='+15555550123' WHERE id=%s", (PEER,))
    row = (
        await client.post(BASE + "/messages", json={"to_user_id": str(PEER), "text": "hello"})
    ).json()
    assert row["kind"] == "message"
    assert (await client.get(BASE + "/messages")).json()["messages"] == []
    assert len((await client.get(BASE + "/messages?box=outbox")).json()["messages"]) == 1
    assert (await client.post(BASE + f"/messages/{row['id']}/read")).status_code == 404
    peer = {"X-Demo-User": str(PEER)}
    assert (await client.get(BASE + "/messages/unread", headers=peer)).json()["unread_count"] == 1
    read = await client.post(BASE + f"/messages/{row['id']}/read", headers=peer)
    again = await client.post(BASE + f"/messages/{row['id']}/read", headers=peer)
    assert read.json()["read_at"] == again.json()["read_at"]
    assert (await client.get(BASE + "/messages", headers=peer)).json()["unread_count"] == 0
    assert (await client.get(BASE + "/messages", headers=outsider)).status_code == 403
    assert (
        await client.post(
            BASE + "/messages", json={"to_user_id": outsider["X-Demo-User"], "text": "x"}
        )
    ).status_code == 403
    assert (
        await client.post(BASE + "/messages", json={"to_user_id": str(UID), "text": "x"})
    ).status_code == 422
    async with app.state.pool.connection() as conn:
        relay = await one(
            conn, "SELECT * FROM mayor_outbox WHERE villager_message_id=%s", (row["id"],)
        )
        assert relay["text"] == "via Village from Iraj: hello"
        assert not await one(
            conn, "SELECT 1 FROM activity_events WHERE payload->>'message_id'=%s", (row["id"],)
        )
        await conn.execute("UPDATE users SET agent_msgs_ok=false WHERE id=%s", (PEER,))
    for kind in ("poke", "cheer"):
        assert (
            await client.post(
                BASE + "/messages", json={"to_user_id": str(PEER), "text": "yay", "kind": kind}
            )
        ).status_code == 201
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT count(*) AS n FROM mayor_outbox"))["n"] == 1
        assert (
            len(await many(conn, "SELECT * FROM activity_events WHERE type IN ('poke','cheer')"))
            == 2
        )


async def test_mail_concurrent_rate_limit_and_validation(api):
    client, app = api
    for text in ("", "   ", "x" * 2001):
        assert (
            await client.post(BASE + "/messages", json={"to_user_id": str(PEER), "text": text})
        ).status_code == 422
    results = await asyncio.gather(
        *(
            client.post(BASE + "/messages", json={"to_user_id": str(PEER), "text": "x"})
            for _ in range(23)
        )
    )
    assert [r.status_code for r in results].count(201) == 20
    assert [r.status_code for r in results].count(429) == 3


async def test_atomic_bribes_and_intents(api, outsider):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute("DELETE FROM coin_ledger WHERE user_id=%s", (UID,))
        await conn.execute(
            "INSERT INTO xp_ledger(village_id,user_id,delta,reason,source_key) "
            "VALUES (%s,%s,100,'test','bribe-test')",
            (VILLAGE_ID, UID),
        )
    results = await asyncio.gather(
        *(
            client.post(BASE + "/mayor/bribe", json={"coins": 70, "wish": "Movie night"})
            for _ in range(2)
        )
    )
    assert sorted(r.status_code for r in results) == [201, 409]
    assert next(r for r in results if r.status_code == 201).json()["balance"] == 30
    assert (
        await client.post(
            BASE + "/mayor/bribe", json={"currency": "sol_intent", "wish": "Movie night"}
        )
    ).status_code == 422
    for data in (
        {"coins": 0},
        {"coins": -1},
        {"coins": True},
        {"coins": 1, "currency": "sol_intent"},
    ):
        assert (
            await client.post(BASE + "/mayor/bribe", json={"wish": "x", **data})
        ).status_code == 422
    assert (
        await client.post(BASE + "/mayor/bribe", json={"coins": 1, "wish": "x"}, headers=outsider)
    ).status_code == 403
    async with app.state.pool.connection() as conn:
        rows = await bribes.pending_bribes(conn, VILLAGE_ID)
        assert len(rows) == 1 and rows[0]["reward_bonus_xp"] == 70
        assert await bribes.pending_bribes(conn, VILLAGE_ID) == rows
        assert not await bribes.pending_bribes(conn, uuid4())
        assert (
            await one(conn, "SELECT count(*) AS n FROM coin_ledger WHERE reason='mayor_bribe'")
        )["n"] == 1


async def test_presence_stream_ttl_and_revocation(api, outsider, monkeypatch):
    client, app = api
    body = {"x": 3.5, "z": -4, "activity": "walking"}
    assert (
        await client.post(BASE + "/presence/heartbeat", json=body, headers=outsider)
    ).status_code == 403
    assert (await client.get(BASE + "/presence/stream", headers=outsider)).status_code == 403
    assert (
        await client.post(BASE + "/presence/heartbeat", json={**body, "x": 10001})
    ).status_code == 422
    assert (await client.post(BASE + "/presence/heartbeat", json=body)).json()["online"][0][
        "x"
    ] == 3.5

    async def connected():
        return False

    stream = presence.events(app, VILLAGE_ID, UID, connected)
    assert "event: presence" in await anext(stream)
    now = presence.time.monotonic()
    # Replace module reference, not asyncio's shared time module.
    from types import SimpleNamespace

    monkeypatch.setattr(presence, "time", SimpleNamespace(monotonic=lambda: now + 31))
    assert '"online": []' in await anext(stream)
    async with app.state.pool.connection() as conn:
        await conn.execute("DELETE FROM village_members WHERE user_id=%s", (UID,))
    with pytest.raises(StopAsyncIteration):
        await anext(stream)
    assert presence.Presence().snapshot(VILLAGE_ID) == {"online": []}


async def test_delete_owner_files_history_messages(api):
    client, app = api
    root = app.state.settings.asset_dir
    owned = [
        f"uploads/{UID}/photo.png",
        f"avatars/{UID}/head/avatar.zip",
        f"voice/{UID}/line.mp3",
        f"evidence/{VID}/{UID}/unused.png",
    ]
    for key in owned + [f"avatars/{PEER}/keep.png"]:
        path = root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"synthetic")
    await client.post(BASE + "/presence/heartbeat", json={"x": 0, "z": 0})
    await client.post(
        BASE + "/messages", json={"to_user_id": str(PEER), "text": "erase me", "kind": "poke"}
    )
    await client.post(
        BASE + "/check-ins",
        json={"kind": "status", "body": "private", "idempotency_key": "delete-test"},
    )
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE village_members SET joined_at=now()-interval '10 days' WHERE user_id=%s",
            (PEER,),
        )
        await conn.execute(
            "INSERT INTO weekly_audits(village_id,week_start,auditor_id,winner_id) "
            "VALUES (%s,'2026-01-01',%s,%s)",
            (VILLAGE_ID, UID, UID),
        )
    assert (await client.request("DELETE", "/api/me", json={"confirm": "yes"})).status_code == 422
    response = await client.request("DELETE", "/api/me", json={"confirm": "DELETE"})
    assert response.status_code == 200, response.text
    assert all(not (root / key).exists() for key in owned)
    assert (root / f"avatars/{PEER}/keep.png").exists()
    assert not presence.state(app).snapshot(VILLAGE_ID)["online"]
    async with app.state.pool.connection() as conn:
        for table in (
            "users",
            "check_ins",
            "activity_events",
            "avatar_assets",
            "avatar_jobs",
            "voice_lines",
            "village_members",
        ):
            column = "id" if table == "users" else "user_id"
            assert not await one(conn, f"SELECT 1 FROM {table} WHERE {column}=%s", (UID,))
        assert not await one(conn, "SELECT 1 FROM villager_messages")
        assert not await one(conn, "SELECT 1 FROM check_in_keys")
        assert (await one(conn, "SELECT role FROM village_members WHERE user_id=%s", (PEER,)))[
            "role"
        ] == "owner"
        audit = await one(conn, "SELECT * FROM account_deletion_audit")
        assert set(audit) == {"id", "deleted_at"}
    assert (await client.get("/api/me")).status_code == 401


async def test_delete_empty_village_and_provider_failure(api, monkeypatch):
    client, app = api
    solo = (await client.post("/api/villages", json={"name": "Solo"})).json()["village"]["id"]

    async def fail(*args):
        raise HTTPException(502, "Voice provider unavailable")

    with monkeypatch.context() as patch:
        patch.setattr("app.voice.delete_clone", fail)
        assert (
            await client.request("DELETE", "/api/me", json={"confirm": "DELETE"})
        ).status_code == 502
    assert (await client.get("/api/me")).status_code == 200
    assert (
        await client.request("DELETE", "/api/me", json={"confirm": "DELETE"})
    ).status_code == 200
    async with app.state.pool.connection() as conn:
        assert not await one(conn, "SELECT 1 FROM villages WHERE id=%s", (solo,))


async def test_delete_clone_uses_existing_adapter(api, monkeypatch):
    client, app = api
    app.state.settings.elevenlabs_api_key = "mock-key"
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET voice_id='mock-clone',voice_consent=true WHERE id=%s", (UID,)
        )
    calls = []

    async def remove(self, url, **kwargs):
        calls.append(url)
        return httpx.Response(404, request=httpx.Request("DELETE", url))

    monkeypatch.setattr(httpx.AsyncClient, "delete", remove)
    assert (
        await client.request("DELETE", "/api/me", json={"confirm": "DELETE"})
    ).status_code == 200
    assert calls == ["https://api.elevenlabs.io/v1/voices/mock-clone"]


async def test_delete_running_job_and_filesystem_failure(api, monkeypatch):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO avatar_jobs(user_id,stage,status,idem_key,input) "
            "VALUES (%s,'head','running','delete-running','{}')",
            (UID,),
        )
    assert (
        await client.request("DELETE", "/api/me", json={"confirm": "DELETE"})
    ).status_code == 409
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE avatar_jobs SET status='done'")

    def fail(*args):
        raise OSError("mock failure")

    with monkeypatch.context() as patch:
        patch.setattr("app.account.erase_path", fail)
        assert (
            await client.request("DELETE", "/api/me", json={"confirm": "DELETE"})
        ).status_code == 503
    assert (await client.get("/api/me")).status_code == 200
    assert (
        await client.request("DELETE", "/api/me", json={"confirm": "DELETE"})
    ).status_code == 200


async def test_migration_replay(api):
    _, app = api
    path = Path(__file__).parents[1] / "migrations/010_social.sql"
    assert not path.read_bytes().startswith(b"\xef\xbb\xbf")
    async with app.state.pool.connection() as conn:
        for _ in range(2):
            await conn.execute(path.read_text(encoding="utf-8"))


async def test_reciprocal_messages_do_not_deadlock(api):
    client, _ = api
    results = await asyncio.gather(
        client.post(BASE + "/messages", json={"to_user_id": str(PEER), "text": "hello"}),
        client.post(
            BASE + "/messages",
            json={"to_user_id": str(UID), "text": "hi"},
            headers={"X-Demo-User": str(PEER)},
        ),
    )
    assert [r.status_code for r in results] == [201, 201]


async def test_asset_erasure_stays_in_root(tmp_path):
    from app.account import erase_path

    root = tmp_path / "assets"
    root.mkdir()
    outside = tmp_path / "keep.txt"
    outside.write_text("keep")
    with pytest.raises(HTTPException):
        erase_path(root, "../keep.txt")
    with pytest.raises(HTTPException):
        erase_path(root, ".")
    assert outside.read_text() == "keep"


async def test_delete_group_claim_competition_and_relay(api):
    from psycopg.types.json import Jsonb

    client, app = api
    group, head, week, competition = (uuid4() for _ in range(4))
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET phone_e164='+15555550123' WHERE id=%s", (PEER,))
        await conn.execute(
            """INSERT INTO avatar_jobs(id,user_id,stage,status,idem_key,input)
            VALUES (%s,%s,'segment','done','group-delete','{}'),
            (%s,%s,'segment','queued','claim-delete',%s)""",
            (group, PEER, head, UID, Jsonb({"group_job_id": str(group)})),
        )
        await conn.execute(
            "INSERT INTO group_photos(job_id,village_id) VALUES (%s,%s)", (group, VILLAGE_ID)
        )
        await conn.execute(
            """INSERT INTO group_photo_claims(job_id,crop_id,user_id,head_job_id)
            VALUES (%s,'crop_0',%s,%s)""",
            (group, UID, head),
        )
        await conn.execute(
            """INSERT INTO weekly_audits(id,village_id,week_start,auditor_id)
            VALUES (%s,%s,'2026-02-02',%s)""",
            (week, VILLAGE_ID, UID),
        )
        for table in ("weekly_assignments", "weekly_badges", "auditor_penalties"):
            await conn.execute(f"INSERT INTO {table}(week_id,user_id) VALUES (%s,%s)", (week, UID))
        await conn.execute(
            "INSERT INTO weekly_votes(week_id,generation,user_id) VALUES (%s,1,%s)", (week, UID)
        )
        await conn.execute(
            """INSERT INTO competitions(id,village_id,creator_id,title,terms,
            friendly,auditor_id) VALUES (%s,%s,%s,'Delete test','terms',false,%s)""",
            (competition, VILLAGE_ID, PEER, UID),
        )
        await conn.execute(
            """INSERT INTO competition_participants
            (competition_id,user_id,entry_lamports_intent) VALUES (%s,%s,0)""",
            (competition, UID),
        )
        await conn.execute(
            """INSERT INTO competition_entries
            (competition_id,user_id,body,idempotency_key) VALUES (%s,%s,'private','delete')""",
            (competition, UID),
        )
    key = f"villages/{VID}/group/{group}/crop_0/face_512.png"
    path = app.state.settings.asset_dir / key
    path.parent.mkdir(parents=True)
    path.write_bytes(b"synthetic")
    await client.post(BASE + "/messages", json={"to_user_id": str(PEER), "text": "private"})
    result = await client.request("DELETE", "/api/me", json={"confirm": "DELETE"})
    assert result.status_code == 200, result.text
    assert not path.exists()
    async with app.state.pool.connection() as conn:
        assert not await one(conn, "SELECT 1 FROM mayor_outbox")
        assert not await one(conn, "SELECT 1 FROM group_photos")
        assert not await one(conn, "SELECT 1 FROM competitions")
        assert await one(conn, "SELECT 1 FROM users WHERE id=%s", (PEER,))


async def test_http_ephemeral_port_and_sse(api):
    """Real HTTP against this test schema; never start or mutate the live :8010 API."""
    import os
    import socket
    import subprocess
    import sys

    _, app = api
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    env = {
        **os.environ,
        "DATABASE_URL": app.state.settings.database_url,
        "DEMO_AUTH": "1",
        "MAYOR_SCHEDULER": "0",
        "ASSET_DIR": str(app.state.settings.asset_dir),
        "UVICORN_LOOP": "app.runtime:selector_loop",
    }
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=Path(__file__).parents[1],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    try:
        async with httpx.AsyncClient(
            base_url=f"http://127.0.0.1:{port}", timeout=5, headers={"X-Demo-User": str(UID)}
        ) as client:
            for _ in range(60):
                assert proc.poll() is None, "Temporary API exited"
                try:
                    schema = await client.get("/openapi.json")
                    if schema.status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.25)
            else:
                pytest.fail("Temporary API startup timeout")
            assert "/api/villages/{vid}/messages" in schema.json()["paths"]
            assert (await client.get("/api/health")).json()["db"] == "up"
            assert (
                await client.post(BASE + "/presence/heartbeat", json={"x": 1, "z": 2})
            ).status_code == 200
            async with client.stream("GET", BASE + "/presence/stream") as response:
                assert response.status_code == 200
                assert response.headers["content-type"].startswith("text/event-stream")
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        assert str(UID) in line
                        break
            print(f"API-010 HTTP/SSE smoke passed on temporary port {port}")
    finally:
        proc.terminate()
        try:
            await asyncio.to_thread(proc.wait, timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            await asyncio.to_thread(proc.wait, timeout=5)
