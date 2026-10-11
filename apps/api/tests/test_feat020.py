import asyncio
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

import pytest

from app import domain
from app.mayor import Mayor
from app.reading import ReadingInput, Suggestions

VID = str(domain.VILLAGE_ID)
PATH = f"/api/villages/{VID}/reading"


@pytest.mark.asyncio
async def test_concurrent_add_cap_migration_and_village_isolation(api):
    client, app = api
    migration = Path(__file__).resolve().parents[1] / "migrations/054_reading.sql"
    async with app.state.pool.connection() as conn:
        await conn.execute(migration.read_text())
        await conn.execute(migration.read_text())
    results = await asyncio.gather(
        *[client.post(PATH, json={"title": f"Concurrent {i}"}) for i in range(12)]
    )
    assert sorted(r.status_code for r in results) == [200] * 10 + [409] * 2
    item = (await client.get(PATH)).json()["items"][0]
    village = (await client.post("/api/villages", json={"name": "Other shelf"})).json()
    other_path = f"/api/villages/{village['village']['id']}/reading"
    assert (await client.get(other_path)).json()["items"] == []
    assert (await client.post(f"{other_path}/{item['id']}/complete", json={})).status_code == 404


@pytest.mark.asyncio
async def test_rewards_caps_and_idempotency(api):
    client, app = api
    before = (await client.get(f"/api/villages/{VID}")).json()["villagers"][0]
    for i in range(10):
        response = await client.post(PATH, json={"title": f"Book {i}"})
        assert response.status_code == 200
    assert (await client.post(PATH, json={"title": "Overflow"})).status_code == 409
    items = response.json()["items"]
    results = await asyncio.gather(
        *[
            client.post(f"{PATH}/{item['id']}/complete", json={"takeaway": "Worth reading"})
            for item in items[:6]
        ]
    )
    assert all(r.status_code == 200 for r in results)
    repeat = await asyncio.gather(
        *[client.post(f"{PATH}/{items[0]['id']}/complete", json={}) for _ in range(3)]
    )
    assert all(r.status_code == 200 for r in repeat)
    shelf = (await client.get(PATH)).json()
    assert shelf["awarded_count"] == 5
    assert sum(len(i["readers"]) for i in shelf["items"]) == 6
    after = (await client.get(f"/api/villages/{VID}")).json()["villagers"][0]
    assert after["xp"] - before["xp"] == 25
    assert after["coins"] - before["coins"] == 25
    async with app.state.pool.connection() as conn:
        rows = await (
            await conn.execute("SELECT source_key FROM xp_ledger WHERE reason='reading'")
        ).fetchall()
        assert len(rows) == 5
    events = (await client.get(f"/api/villages/{VID}/accomplishments")).json()
    assert len([e for e in events if e["type"] == "reading_completed"]) == 6
    week = (await client.get(f"/api/villages/{VID}/weekly/current")).json()
    assert week["reading_bonus"] == [
        {"user_id": str(domain.SEED_USERS[0][0]), "completed": 6, "xp": 25}
    ]
    other = {"X-Demo-User": str(domain.SEED_USERS[1][0])}
    response = await client.post(f"{PATH}/{items[0]['id']}/complete", json={}, headers=other)
    assert response.json()["awarded_count"] == 1
    assert len(response.json()["items"][0]["readers"]) == 2


@pytest.mark.asyncio
async def test_permissions_archive_reactions_validation(api, outsider, monkeypatch):
    client, _ = api
    for method, suffix, body in [
        ("GET", "", None),
        ("POST", "", {"title": "No"}),
        ("POST", "/suggest", None),
        ("POST", f"/{uuid4()}/complete", {}),
    ]:
        assert (
            await client.request(method, PATH + suffix, json=body, headers=outsider)
        ).status_code == 403
    for payload in [
        {"title": " "},
        {"title": "x", "link": "javascript:alert(1)"},
        {"title": "x", "link": "https://"},
        {"title": "x", "user_id": str(uuid4())},
    ]:
        assert (await client.post(PATH, json=payload)).status_code == 422
    assert (await client.get(PATH + "?week_start=2099-01-05")).status_code == 422
    assert (await client.post(f"{PATH}/{uuid4()}/complete", json={})).status_code == 404
    item = (
        await client.post(PATH, json={"title": "A book", "link": "https://example.com"})
    ).json()["items"][0]
    assert (
        await client.post(f"{PATH}/{item['id']}/complete", json={"takeaway": "x" * 281})
    ).status_code == 422
    item = (await client.post(f"{PATH}/{item['id']}/complete", json={})).json()["items"][0]
    reaction = {
        "target_kind": "activity",
        "target_id": item["readers"][0]["activity_id"],
        "emoji": "🔥",
    }
    assert (await client.post(f"/api/villages/{VID}/reactions", json=reaction)).status_code == 200
    current = domain.monday()
    monkeypatch.setattr(domain, "monday", lambda: current + timedelta(days=7))
    archive = (await client.get(PATH, params={"week_start": str(current)})).json()
    assert archive["read_only"]
    assert archive["items"][0]["readers"][0]["reactions"][0]["count"] == 1
    assert (await client.post(f"{PATH}/{item['id']}/complete", json={})).status_code == 409
    assert (await client.post(f"/api/villages/{VID}/reactions", json=reaction)).status_code == 409
    assert (await client.get(PATH)).json()["awarded_count"] == 0


@pytest.mark.asyncio
async def test_suggestion_explicit_cached_and_fallback(api, monkeypatch):
    client, _ = api
    calls = []

    async def generate(self, schema, instruction, context):
        calls.append(context)
        return Suggestions(items=[ReadingInput(title="Suggested book")])

    monkeypatch.setattr(Mayor, "generate", generate)
    await client.get(PATH)
    assert not calls
    replies = await asyncio.gather(*[client.post(PATH + "/suggest") for _ in range(3)])
    assert all(r.status_code == 200 for r in replies)
    assert len(calls) == 1
    assert (await client.get(PATH)).json()["items"] == []
    current = domain.monday()
    monkeypatch.setattr(domain, "monday", lambda: current + timedelta(days=7))

    async def offline(*args):
        raise RuntimeError("offline")

    monkeypatch.setattr(Mayor, "generate", offline)
    assert (await client.post(PATH + "/suggest")).json()["items"][0]["title"] == "Atomic Habits"
