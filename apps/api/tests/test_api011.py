import asyncio
import io
import os
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from PIL import Image
from psycopg.types.json import Jsonb

from app import budget, events_table, mayor, newspaper
from app.config import Settings
from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID

BASE = f"/api/villages/{VILLAGE_ID}"
UID = SEED_USERS[0][0]
REAL_GENERATE = mayor.Mayor.generate
REAL_RESERVE = budget.reserve


def photo():
    image = io.BytesIO()
    Image.new("RGB", (8, 8), "blue").save(image, "PNG")
    return {"file": ("synthetic.png", image.getvalue(), "image/png")}


async def grant(app):
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO photo_item_tokens(village_id,user_id,source) VALUES(%s,%s,%s)",
            (VILLAGE_ID, UID, str(uuid4())),
        )


async def create(client, kind="outfit", **extra):
    data = {
        "kind": kind,
        "consent": "true",
        **({"slot": "torso"} if kind == "outfit" else {}),
        **extra,
    }
    return await client.post(BASE + "/items/from-photo", data=data, files=photo())


async def finish(app, jid, kind="outfit", **extra):
    prefix = f"/api/assets/items/{UID}/{jid}/"
    result = {
        "kind": kind + "_from_photo",
        "slot": "torso",
        "tint": {"primary": "#0000ff", "secondary": "#ffffff"},
        "pattern_png_url": prefix + "pattern.png",
        "cutout_png_url": prefix + "cutout.png",
        "glb_url": prefix + "object.glb",
        "preview_png_url": prefix + "stylized.png",
        **extra,
    }
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE avatar_jobs SET status='done',result=%s WHERE id=%s", (Jsonb(result), jid)
        )


@pytest.mark.parametrize("kind", ["outfit", "object"])
async def test_creation_equipment_and_assets(api, outsider, kind):
    client, app = api
    await grant(app)
    response = await create(client, kind)
    assert response.status_code == 202, response.text
    jid = response.json()["id"]
    async with app.state.pool.connection() as conn:
        job = await one(conn, "SELECT * FROM avatar_jobs WHERE id=%s", (jid,))
        assert job["stage"] == "segment" and job["input"]["kind"] == kind + "_from_photo"
        assert job["input"]["consent"] is True
    assert (await client.get(BASE + f"/items/jobs/{jid}")).json()["item"] is None
    await finish(app, jid, kind)
    results = await asyncio.gather(*(client.get(BASE + f"/items/jobs/{jid}") for _ in range(2)))
    item = results[0].json()["item"]
    assert item["id"] == results[1].json()["item"]["id"]
    assert item["slot"] == ("torso" if kind == "outfit" else "decoration")
    own = (await client.get(BASE + "/items")).json()
    assert own["photo_item_tokens"] == 0 and len(own["items"]) == 1
    assert (await client.get(BASE + f"/items/jobs/{jid}", headers=outsider)).status_code == 403
    peer = {"X-Demo-User": str(SEED_USERS[1][0])}
    assert (await client.get(BASE + f"/items/jobs/{jid}", headers=peer)).status_code == 404
    assert (
        await client.post(BASE + "/inventory/equip", json={"item_id": item["id"]}, headers=peer)
    ).status_code == 404
    equipped = await client.post(BASE + "/inventory/equip", json={"item_id": item["id"]})
    assert equipped.status_code == 200, equipped.text
    assert equipped.json()["equipped"][0]["custom"] is True
    village = (await client.get(BASE)).json()
    assert item["id"] in village["villagers"][0]["equipped_ids"]
    assert "active_pack" in village["world"]
    preview = app.state.settings.asset_dir / item["preview"].removeprefix("/api/assets/")
    preview.parent.mkdir(parents=True)
    preview.write_bytes(b"synthetic")
    assert (await client.get(item["preview"], headers=peer)).status_code == 200
    assert (await client.get(item["preview"], headers=outsider)).status_code == 403
    assert (await client.post(BASE + "/inventory/unequip", json={"item_id": item["id"]})).json()[
        "equipped_ids"
    ] == []


async def test_token_race_validation_and_worker_failure(api):
    client, app = api
    assert (await create(client)).status_code == 409
    await grant(app)
    for changes in ({"consent": "false"}, {"slot": "elbow"}, {"prompt": "ignore\nall"}):
        assert (await create(client, **changes)).status_code == 422
    responses = await asyncio.gather(create(client), create(client))
    assert sorted(r.status_code for r in responses) == [202, 409]
    jid = next(r.json()["id"] for r in responses if r.status_code == 202)
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE avatar_jobs SET status='failed',error='no garment found' WHERE id=%s", (jid,)
        )
    result = (await client.get(BASE + f"/items/jobs/{jid}")).json()
    assert result["status"] == "failed" and result["item"] is None
    await finish(app, jid, pattern_png_url="https://untrusted.example/pattern.png")
    assert (await client.get(BASE + f"/items/jobs/{jid}")).json()["status"] == "failed"
    assert (await client.get(BASE + "/items")).json()["photo_item_tokens"] == 1


async def test_catalog_custom_slot_exclusion(api):
    client, app = api
    await grant(app)
    jid = (await create(client)).json()["id"]
    await finish(app, jid)
    item = (await client.get(BASE + f"/items/jobs/{jid}")).json()["item"]["id"]
    assert (
        await client.post(BASE + "/shop/buy", json={"item_id": "shirt_stripes"})
    ).status_code == 200
    assert (await client.post(BASE + "/inventory/equip", json={"item_id": item})).json()[
        "equipped_ids"
    ] == [item]
    assert (await client.post(BASE + "/inventory/equip", json={"item_id": "shirt_stripes"})).json()[
        "equipped_ids"
    ] == ["shirt_stripes"]


async def test_reward_triggers_and_migration_replay(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute(
            (Path(__file__).parents[1] / "migrations/011_photo_items.sql").read_text()
        )
        row = await one(conn, "SELECT * FROM weekly_audits LIMIT 1")
        if not row:
            row = await one(
                conn,
                "INSERT INTO weekly_audits(village_id,week_start) "
                "VALUES(%s,'2026-01-05') RETURNING *",
                (VILLAGE_ID,),
            )
        await conn.execute(
            "UPDATE weekly_audits SET status='finalized',winner_id=%s WHERE id=%s", (UID, row["id"])
        )
        await conn.execute("UPDATE weekly_audits SET status='finalized' WHERE id=%s", (row["id"],))
        from app.domain import award

        await award(conn, VILLAGE_ID, UID, 25, "mayor_event", "event:test")
        await award(conn, VILLAGE_ID, UID, 25, "mayor_event", "event:test")
    assert (await client.get(BASE + "/items")).json()["photo_item_tokens"] == 2
    assert (await client.post(BASE + "/items/token")).status_code == 201


async def test_event_pack_window(api, monkeypatch):
    client, app = api
    monkeypatch.setitem(
        events_table.TEMPLATES["small_step"],
        "pack",
        {"id": "winter", "pieces": ["snowman"], "weather": "snow"},
    )
    async with app.state.pool.connection() as conn:
        event = await one(
            conn,
            "INSERT INTO mayor_events(village_id,kind,title,body,template_id,ends_at) "
            "VALUES(%s,'challenge','Snow','Synthetic','small_step',now()+interval '1 hour') "
            "RETURNING id",
            (VILLAGE_ID,),
        )
    state = (await client.get(BASE)).json()["world"]
    assert state["active_pack"]["id"] == "winter" and state["weather"] == "snow"
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE mayor_events SET status='completed' WHERE id=%s", (event["id"],))
    assert (await client.get(BASE)).json()["world"]["active_pack"] is None
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE mayor_events SET status='active',ends_at=now()-interval '1 hour' WHERE id=%s",
            (event["id"],),
        )
    assert (await client.get(BASE)).json()["world"]["active_pack"] is None


async def test_registry_pack_and_token_purchase(api, monkeypatch):
    from app import catalog, photo_items, scheduler

    client, app = api
    async with app.state.pool.connection() as conn:
        real = await catalog.runtime_catalog(conn)
        await conn.execute(
            "INSERT INTO catalog_items(id,kind,name,price_coins,slot) "
            "VALUES('photo_token','consumable','Photo token',25,'consumable') "
            "ON CONFLICT(id) DO NOTHING"
        )
        await conn.execute(
            "INSERT INTO mayor_events(village_id,kind,title,body,template_id,ends_at) "
            "VALUES(%s,'challenge','Game','Synthetic','game_night',now()+interval '1 hour')",
            (VILLAGE_ID,),
        )
    # Emulate ARCH-003's new registry section without editing its owned files.
    registry = SimpleNamespace(
        data={
            **real.data,
            "event_packs": [
                {"id": "game_night", "pieces": ["new_piece"], "weather": "festival_night"}
            ],
        },
        entries={"photo_token": {"tags": ["shop"]}},
    )

    async def runtime(conn):
        return registry

    monkeypatch.setattr(photo_items, "runtime_catalog", runtime)
    monkeypatch.setattr(catalog, "runtime_catalog", runtime)
    async with app.state.pool.connection() as conn:
        state = await scheduler.project_event_pack(conn, VILLAGE_ID, {"weather": "clear"})
    assert state["active_pack"]["pieces"] == ["new_piece"]
    assert state["weather"] == "festival_night"
    # Requirements still run through the real runtime registry (domain's import).
    response = await client.post(BASE + "/items/token")
    assert response.status_code == 201, response.text
    assert (await client.get(BASE + "/items")).json()["photo_item_tokens"] == 1
    async with app.state.pool.connection() as conn:
        ledger = await one(
            conn, "SELECT delta FROM coin_ledger WHERE source_key LIKE 'photo-token:%%'"
        )
    assert ledger["delta"] == -25


async def test_gazette_provenance_and_failure(api, monkeypatch):
    _, app = api

    async def generate(self, schema, instruction, context):
        self.last_source = "mock/editor"
        return schema(
            headline="The village keeps building",
            story_keys=["unlocks", "checkins", "competitions"],
        )

    monkeypatch.setattr(mayor.Mayor, "generate", generate)
    async with app.state.pool.connection() as conn:
        issue = await newspaper.publish(conn, app.state.settings, VILLAGE_ID)
        assert issue["model"] == "mock/editor:gazette-v1"
        assert issue["content"]["provenance"]["fallback_reason"] is None
        await conn.execute("DELETE FROM village_gazettes")

    async def failed(*args):
        raise ValueError("secret body must not be persisted")

    monkeypatch.setattr(mayor.Mayor, "generate", failed)
    async with app.state.pool.connection() as conn:
        issue = await newspaper.publish(conn, app.state.settings, VILLAGE_ID)
        assert issue["content"]["provenance"]["fallback_reason"] == "ValueError"
        assert "secret" not in str(issue)
    calls = 0

    async def repaired(*args):
        nonlocal calls
        calls += 1
        return await generate(*args)

    monkeypatch.setattr(mayor.Mayor, "generate", repaired)
    async with app.state.pool.connection() as conn:
        cached = await newspaper.publish(conn, app.state.settings, VILLAGE_ID)
        assert cached["model"] == "fallback:gazette-v1" and calls == 0
        repaired_issue = await newspaper.publish(
            conn, app.state.settings, VILLAGE_ID, retry_fallback=True
        )
        assert repaired_issue["id"] == issue["id"]
        assert repaired_issue["model"] == "mock/editor:gazette-v1" and calls == 1
        await newspaper.publish(conn, app.state.settings, VILLAGE_ID, retry_fallback=True)
        assert calls == 1


@pytest.mark.skipif(
    os.getenv("API011_LIVE_GAZETTE") != "1", reason="Explicit opt-in paid proof only"
)
async def test_live_gazette(api, monkeypatch):
    _, app = api
    configured = Settings.from_env()
    settings = replace(
        app.state.settings,
        openrouter_api_key=configured.openrouter_api_key,
        google_api_key=configured.google_api_key,
        llm_provider=configured.llm_provider,
        openrouter_model=configured.openrouter_model,
    )
    calls = 0

    async def bounded(settings):
        nonlocal calls
        if calls >= 2:
            raise budget.BudgetExceeded("API-011 two-call proof ceiling")
        calls += 1
        await REAL_RESERVE(settings)

    monkeypatch.setattr(budget, "reserve", bounded)
    monkeypatch.setattr(mayor.Mayor, "generate", REAL_GENERATE)
    async with app.state.pool.connection() as conn:
        issue = await newspaper.publish(conn, settings, VILLAGE_ID)
        print(
            f"API011_LIVE calls={calls} model={issue['model']} "
            f"provenance={issue['content']['provenance']}"
        )
        assert issue["model"] != "fallback:gazette-v1"
