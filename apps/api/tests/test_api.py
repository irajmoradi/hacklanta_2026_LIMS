import asyncio
import io
from uuid import uuid4

import pytest
from fastapi import HTTPException
from PIL import Image

from app.catalog import CATALOG
from app.db import many, one
from app.domain import SEED_USERS, VILLAGE_ID
from app.mayor import Mayor
from scripts.seed import seed

VID = str(VILLAGE_ID)
BASE = f"/api/villages/{VID}"
IRA = str(SEED_USERS[0][0])
LANCE = str(SEED_USERS[1][0])


def photo():
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), "blue").save(buf, format="PNG")
    return {"file": ("fixture.png", buf.getvalue(), "image/png")}


async def test_seed_and_contract(api):
    client, app = api
    village = (await client.get(BASE)).json()
    assert village["seed"] == 1337
    assert [v["display_name"] for v in village["villagers"]] == [u[1] for u in SEED_USERS]
    assert len(village["active_events"]) == 1
    assert village["villagers"][0]["avatar"]["portrait"]["kind"] == "initials"
    assert len((await client.get(BASE + "/shop")).json()["items"]) == len(CATALOG)
    me = (await client.get("/api/me")).json()
    assert me["user"]["id"] == IRA and me["villages"][0]["id"] == VID
    assert me["user"]["phone_e164"] is None
    assert len(app.openapi()["paths"]) >= 49  # grows as features land


@pytest.mark.parametrize(
    "method,suffix,body",
    [
        ("GET", "", None),
        ("GET", "/feed", None),
        ("GET", f"/users/{IRA}", None),
        ("POST", "/goals", {"title": "Nope"}),
        ("POST", "/check-ins", {"kind": "status", "body": "Nope", "idempotency_key": "nope"}),
        ("GET", "/shop", None),
        ("POST", "/shop/buy", {"item_id": "hat_beanie"}),
        ("POST", "/mayor/pray", {"text": "Nope"}),
        ("POST", "/mayor/recap", None),
        ("POST", "/mayor/nudge", {"target_user_id": IRA}),
    ],
)
async def test_membership_every_village_route(api, outsider, method, suffix, body):
    client, _ = api
    response = await client.request(method, BASE + suffix, json=body, headers=outsider)
    assert response.status_code == 403, response.text


async def test_evidence_membership(api, outsider):
    client, _ = api
    assert (
        await client.post(BASE + "/evidence", files=photo(), headers=outsider)
    ).status_code == 403


async def test_cross_village_goal_and_profile(api):
    client, _ = api
    other = (await client.post("/api/villages", json={"name": "Other"})).json()["village"]
    goal = (await client.post(f"/api/villages/{other['id']}/goals", json={"title": "Other"})).json()
    response = await client.post(
        BASE + "/check-ins",
        json={
            "kind": "progress",
            "body": "Wrong village",
            "goal_id": goal["id"],
            "idempotency_key": "cross-goal",
        },
    )
    assert response.status_code == 422
    assert (
        await client.get(f"/api/villages/{other['id']}", headers={"X-Demo-User": LANCE})
    ).status_code == 403
    assert (await client.get(f"/api/villages/{other['id']}/users/{LANCE}")).status_code == 404


async def test_checkin_retries_concurrent_and_daily_limit(api):
    client, app = api
    data = {"kind": "progress", "body": "Shipped!", "idempotency_key": "parallel-key"}
    responses = await asyncio.gather(
        *(client.post(BASE + "/check-ins", json=data) for _ in range(8))
    )
    assert all(r.status_code == 200 for r in responses)
    results = [r.json() for r in responses]
    assert sum(r["xp_awarded"] for r in results) == 25
    assert len({r["check_in"]["id"] for r in results}) == 1
    assert "evidence_url" in results[0]["check_in"]
    statuses = await asyncio.gather(
        *(
            client.post(
                BASE + "/check-ins",
                json={"kind": "status", "body": "Here!", "idempotency_key": f"daily-{i}"},
            )
            for i in range(4)
        )
    )
    assert sum(r.json()["xp_awarded"] for r in statuses) == 10
    async with app.state.pool.connection() as conn:
        count = await one(
            conn, "SELECT count(*) AS n FROM check_ins WHERE idempotency_key=%s", ("parallel-key",)
        )
    assert count["n"] == 1


async def test_goal_upsert_awards_once(api):
    client, _ = api
    before = (await client.get(BASE + "/shop")).json()["balance"]
    first = await client.post(BASE + "/goals", json={"title": "First"})
    second = await client.post(BASE + "/goals", json={"title": "Revised", "detail": "Tiny steps"})
    assert first.json()["id"] == second.json()["id"]
    assert second.json()["title"] == "Revised"
    assert (await client.get(BASE + "/shop")).json()["balance"] == before + 20
    profile = (await client.get(BASE + f"/users/{IRA}")).json()
    assert profile["goal"]["title"] == "Revised"


async def test_purchase_requirements_insufficient_and_equipped(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO village_unlocks(village_id,building) VALUES(%s,'pet_shelter')",
            (VILLAGE_ID,),
        )
    assert (await client.post(BASE + "/shop/buy", json={"item_id": "pet_dog"})).status_code == 409
    assert (await client.get(BASE + "/shop")).json()["balance"] == 300
    assert (
        await client.post(BASE + "/shop/buy", json={"item_id": "house_backyard"})
    ).status_code == 200
    assert (await client.post(BASE + "/shop/buy", json={"item_id": "pet_dog"})).status_code == 200
    assert (await client.post(BASE + "/shop/buy", json={"item_id": "hat_crown"})).status_code == 409
    assert (await client.post(BASE + "/shop/buy", json={"item_id": "pet_dog"})).status_code == 409
    shop = (await client.get(BASE + "/shop")).json()
    assert shop["balance"] == 100
    assert {i["id"] for i in shop["items"] if i["owned"]} == {"pet_dog", "house_backyard"}
    assert "pet_dog" in (await client.get(BASE)).json()["villagers"][0]["equipped_ids"]


async def test_purchase_concurrent_cannot_overspend(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE coin_ledger SET delta=40 WHERE user_id=%s", (IRA,))
    results = await asyncio.gather(
        *(
            client.post(BASE + "/shop/buy", json={"item_id": item})
            for item in ("shirt_hoodie", "hat_beanie")
        )
    )
    assert sorted(r.status_code for r in results) == [200, 409]
    shop = (await client.get(BASE + "/shop")).json()
    assert shop["balance"] in {0, 10}
    assert sum(i["owned"] for i in shop["items"]) == 1


async def test_purchase_rolls_back_inventory_on_failure(api, monkeypatch):
    client, app = api

    async def fail(*args):
        raise HTTPException(503, "Injected ledger outage")

    monkeypatch.setattr("app.domain.coin_award", fail)
    assert (
        await client.post(BASE + "/shop/buy", json={"item_id": "hat_beanie"})
    ).status_code == 503
    async with app.state.pool.connection() as conn:
        assert not await many(conn, "SELECT * FROM inventory")
    assert (await client.get(BASE + "/shop")).json()["balance"] == 300


async def test_feed_after_mutations(api):
    client, _ = api
    await client.post(BASE + "/goals", json={"title": "Ship API"})
    await client.post(
        BASE + "/check-ins", json={"kind": "progress", "body": "Done!", "idempotency_key": "feed"}
    )
    await client.post(BASE + "/shop/buy", json={"item_id": "house_lv2"})
    await client.post(BASE + "/mayor/pray", json={"text": "Help"})
    feed = (await client.get(BASE + "/feed")).json()
    assert {"goal_set", "checkin", "purchase", "mayor_event", "xp"} <= {r["type"] for r in feed}
    assert all(r["text"] and "display_name" not in r for r in feed)
    assert any("Iraj checked in: Done!" in r["text"] for r in feed)
    assert (await client.get(BASE)).json()["villagers"][0]["house_level"] == 2
    assert len((await client.get(BASE + "/feed?limit=2")).json()) == 2
    assert (await client.get(BASE + "/feed?limit=10000")).status_code == 422


async def test_join_idempotent_and_concurrent_slots(api, outsider):
    client, _ = api
    results = await asyncio.gather(
        *(
            client.post("/api/villages/join", headers=outsider, json={"invite_code": "hacklanta"})
            for _ in range(4)
        )
    )
    assert all(r.status_code == 200 for r in results)
    village = (await client.get(BASE)).json()
    assert len(village["villagers"]) == 6
    assert len({v["house_slot"] for v in village["villagers"]}) == 6
    assert (
        sum(r["type"] == "village_joined" for r in (await client.get(BASE + "/feed")).json()) == 1
    )


async def test_avatar_upload_consent_dedup_access_and_assets(api, outsider):
    client, app = api
    path = f"/api/avatars/{IRA}/photo"
    assert (await client.post(path, files=photo())).status_code == 422
    assert (
        await client.post(path, files=photo(), data={"consent": "true"}, headers=outsider)
    ).status_code == 403
    result = await client.post(path, files=photo(), data={"consent": "true"})
    assert result.status_code == 200, result.text
    retry = await client.post(path, files=photo(), data={"consent": "true"})
    assert retry.json() == result.json()
    job = await client.get("/api/jobs/" + result.json()["job_id"])
    assert job.json()["stage"] == "segment" and job.json()["status"] == "queued"
    assert (
        await client.get("/api/jobs/" + result.json()["job_id"], headers={"X-Demo-User": LANCE})
    ).status_code == 403
    assert (await client.get(f"/api/avatars/{IRA}")).json()["generation"]["segment"] == "queued"
    async with app.state.pool.connection() as conn:
        key = (await one(conn, "SELECT input FROM avatar_jobs"))["input"]["asset_key"]
    assert (await client.get("/api/assets/" + key)).status_code == 200
    assert (
        await client.get("/api/assets/" + key, headers={"X-Demo-User": LANCE})
    ).status_code == 403
    assert len(list(app.state.settings.asset_dir.rglob("*.png"))) == 1
    assert (await client.get(f"/api/avatars/{IRA}", headers=outsider)).status_code == 403


async def test_evidence_and_path_traversal(api, outsider):
    client, app = api
    response = await client.post(BASE + "/evidence", files=photo())
    key = response.json()["evidence_asset_id"]
    assert (await client.get("/api/assets/" + key)).status_code == 200
    assert (await client.get("/api/assets/" + key, headers=outsider)).status_code == 403
    for path in ("%2e%2e%2fsecret", "uploads%5c..%5csecret", "C:%5csecret"):
        assert (await client.get("/api/assets/" + path)).status_code == 404
    bad = await client.post(BASE + "/evidence", files={"file": ("x.png", b"not png", "image/png")})
    assert bad.status_code == 415


async def test_voice_authorization_and_audio(api, outsider):
    client, _ = api
    data = {"user_id": IRA, "text": "Hello village"}
    assert (await client.post("/api/voice/lines", json=data, headers=outsider)).status_code == 403
    response = await client.post("/api/voice/lines", json=data)
    assert response.status_code == 200
    audio = await client.get(response.json()["audio_url"])
    assert audio.content == b"ID3mock-audio"
    assert (await client.get(response.json()["audio_url"], headers=outsider)).status_code == 403


async def test_mayor_fallback_and_recap(api, monkeypatch):
    client, _ = api

    async def fail(*args):
        raise ValueError("malformed provider output")

    monkeypatch.setattr(Mayor, "generate", fail)
    response = await client.post(BASE + "/mayor/pray", json={"text": "Please help"})
    assert response.status_code == 200 and response.json()["reward_xp"] == 0
    recap = (await client.post(BASE + "/mayor/recap")).json()
    assert recap["kind"] == "recap" and recap["body"].startswith("[AI Mayor]")
    assert all(name in recap["body"] for _, name, _ in SEED_USERS)


async def test_internal_nudge_outbox_sent_optout(api, monkeypatch):
    client, app = api
    phone = "+15555550123"
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET phone_e164=%s,roast_ok=false WHERE id=%s", (phone, LANCE)
        )
    captured = []

    async def nudge(self, context, speaker, target):
        captured.append((speaker["id"], target["roast_ok"]))
        return "[AI as Iraj] Keep going, Lance!"

    monkeypatch.setattr(Mayor, "nudge", nudge)
    result = await client.post(BASE + "/mayor/nudge", json={"target_user_id": LANCE})
    assert result.status_code == 200
    assert captured == [(SEED_USERS[0][0], False)]
    assert (await client.get("/api/internal/outbox")).status_code == 401
    service = {"X-Service-Key": "test-service-only"}
    pending = (await client.get("/api/internal/outbox", headers=service)).json()
    assert len(pending) == 1 and pending[0]["phone_e164"] == phone
    feed = (await client.get(BASE + "/feed")).json()
    assert phone not in str(feed) and all("delivery" not in r["payload"] for r in feed)
    route = "/api/internal/outbox/" + pending[0]["id"] + "/sent"
    assert (await client.post(route, headers=service)).status_code == 200
    assert (await client.post(route, headers=service)).status_code == 200
    assert (await client.get("/api/internal/outbox", headers=service)).json() == []
    inbound = await client.post(
        "/api/internal/inbound",
        headers=service,
        json={"phone_e164": phone, "text": "checkin: I did it"},
    )
    assert "+10 XP" in inbound.json()["reply_text"]
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET agent_msgs_ok=false WHERE id=%s", (LANCE,))
    await client.post(BASE + "/mayor/nudge", json={"target_user_id": LANCE})
    assert (await client.get("/api/internal/outbox", headers=service)).json() == []


async def test_auth_required_and_cors(api):
    client, _ = api
    assert (await client.get(BASE, headers={"X-Demo-User": "bad"})).status_code == 401
    assert (await client.get(BASE, headers={"X-Demo-User": str(uuid4())})).status_code == 401
    response = await client.options(
        BASE,
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "X-Demo-User",
        },
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


async def test_seed_is_idempotent(api):
    import psycopg

    client, app = api
    before = (await client.get(BASE)).json()
    with psycopg.connect(app.state.settings.database_url) as conn:
        seed(conn)
        seed(conn)
    assert (await client.get(BASE)).json() == before
