"""Publish content, then exercise unchanged HTTP consumers."""

import json
import runpy
from pathlib import Path

import psycopg
import pytest
from psycopg.types.json import Jsonb

from app import models
from app.catalog_registry import CatalogRegistry, load_catalog, sync_catalog
from app.domain import SEED_USERS, VILLAGE_ID

BASE = f"/api/villages/{VILLAGE_ID}"
UID = SEED_USERS[0][0]


def publish(app, tmp_path, data):
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    with psycopg.connect(app.state.settings.database_url) as conn:
        sync_catalog(conn, load_catalog(path))


async def buy(client, item):
    return await client.post(BASE + "/shop/buy", json={"item_id": item})


async def grant(app, amount, key):
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO xp_ledger(village_id,user_id,delta,reason,source_key) "
            "VALUES (%s,%s,%s,'weekly_win',%s)",
            (VILLAGE_ID, UID, amount, key),
        )


async def test_new_hat_sync_purchase_and_equip(api, tmp_path):
    client, app = api
    data = load_catalog().data
    data["entries"].append(
        {
            "id": "hat_sun",
            "kind": "clothing",
            "slot": "head",
            "name": "Sun Hat",
            "description": "An entirely new meshless hat.",
            "source": "shop",
            "rarity": "common",
            "price_coins": 17,
            "tags": ["shop"],
        }
    )
    publish(app, tmp_path, data)
    items = (await client.get(BASE + "/shop")).json()["items"]
    assert next(i for i in items if i["id"] == "hat_sun")["price_coins"] == 17
    before = (await client.get(BASE + "/shop")).json()["balance"]
    result = await buy(client, "hat_sun")
    assert result.status_code == 200, result.text
    assert result.json()["balance"] == before - 17
    assert (await buy(client, "hat_sun")).status_code == 409
    assert (await buy(client, "hat_cap")).status_code == 200
    result = await client.post(BASE + "/inventory/equip", json={"item_id": "hat_sun"})
    assert result.status_code == 200, result.text
    assert "hat_sun" in result.json()["equipped_ids"]
    assert "hat_cap" not in result.json()["equipped_ids"]


async def test_new_buildings_use_registered_threshold_and_order(api, tmp_path):
    client, app = api
    data = load_catalog().data
    # Multiple unlocks at one level catches the old ordered-building slice.
    for ident in ("test_library", "observatory"):
        data["entries"].append(
            {
                "id": ident,
                "kind": "building",
                "name": ident.title(),
                "description": "New landmark.",
                "source": "earned:village_progression",
                "rarity": "common",
                "price_coins": 0,
                "tags": ["scene", "unlock"],
                "unlock": {"village_level": 7},
            }
        )
        data["buildings"].append(
            {
                "id": ident,
                "placement": {"district": "park", "offset": [2, 0, 4], "size": 3},
            }
        )
    data["levels"].append({"level": 7, "xp": 12000, "buildings": ["observatory", "test_library"]})
    publish(app, tmp_path, data)
    state = (await client.get(BASE)).json()["world"]
    assert state["upcoming"][-2:] == [
        {"building": ident, "level": 7, "xp": 12000} for ident in ("observatory", "test_library")
    ]
    await grant(app, 12000 - state["xp"], "registry-growth")
    state = (await client.get(BASE)).json()["world"]
    assert state["level"] == 7 and state["next_level_xp"] is None
    assert state["upcoming"] == []
    assert state["unlocked"][-2:] == ["observatory", "test_library"]
    assert (await client.get(BASE)).json()["world"] == state


async def test_registered_house_levels_and_transitive_requirements(api, tmp_path):
    client, app = api
    data = load_catalog().data
    data["entries"] = [e for e in data["entries"] if e["id"] not in {"house_lv4", "house_lv5"}]
    for level in (4, 5):
        data["entries"].append(
            {
                "id": f"house_lv{level}",
                "kind": "house",
                "slot": "house",
                "name": f"House Level {level}",
                "description": "New logical upgrade.",
                "source": "shop",
                "rarity": "common",
                "price_coins": 1,
                "tags": ["shop"],
                "requires": [f"house_lv{level - 1}"],
            }
        )
    publish(app, tmp_path, data)
    await grant(app, 1000, "registry-houses")
    async with app.state.pool.connection() as conn:
        # Gifting a prerequisite must not waive its transitive prerequisite.
        await conn.execute(
            "INSERT INTO inventory(village_id,user_id,item_id) VALUES (%s,%s,'house_lv3')",
            (VILLAGE_ID, UID),
        )
    assert (await buy(client, "house_lv4")).status_code == 409
    assert (await buy(client, "house_lv2")).status_code == 200
    for level in (4, 5):
        result = await buy(client, f"house_lv{level}")
        assert result.status_code == 200, result.text
        async with app.state.pool.connection() as conn:
            row = await (
                await conn.execute(
                    "SELECT house_level FROM village_members WHERE village_id=%s AND user_id=%s",
                    (VILLAGE_ID, UID),
                )
            ).fetchone()
            assert row["house_level"] == level


async def test_full_definition_gates_purchase_and_equip(api):
    client, app = api
    # Legacy sync still guards these publication shapes (outside allowed_paths).
    entry = load_catalog().entries["hat_cap"]
    entry["requires"] = ["hat_beanie", "glasses_round"]
    entry["unlock"] = {"village_level": 4}
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE content_entries SET definition=%s WHERE id='hat_cap'",
            (Jsonb(entry),),
        )
    assert (await buy(client, "hat_cap")).status_code == 409
    for ident in ("hat_beanie", "glasses_round"):
        assert (await buy(client, ident)).status_code == 200
    assert (await buy(client, "hat_cap")).status_code == 409
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO inventory(village_id,user_id,item_id) VALUES (%s,%s,'hat_cap')",
            (VILLAGE_ID, UID),
        )
    assert (
        await client.post(BASE + "/inventory/equip", json={"item_id": "hat_cap"})
    ).status_code == 409
    await grant(app, 2000, "registry-gate")
    assert (
        await client.post(BASE + "/inventory/equip", json={"item_id": "hat_cap"})
    ).status_code == 200


def test_voice_enum_only_includes_explicitly_supported_styles(monkeypatch):
    data = load_catalog().data
    for value, supported in (("storyteller", True), ("unvetted", False), ("unspecified", None)):
        style = {"prompt": f"Speak as {value}."}
        if supported is not None:
            style["supported"] = supported
        data["entries"].append(
            {
                "id": f"voice_{value}",
                "kind": "voice_style",
                "slot": "voice_style",
                "name": value,
                "description": "Test voice.",
                "source": "shop",
                "rarity": "common",
                "price_coins": 0,
                "voice_style": style,
            }
        )
    registry = CatalogRegistry(data)
    monkeypatch.setattr("app.catalog_registry.load_catalog", lambda: registry)
    namespace = runpy.run_path(str(Path(models.__file__)))
    enum = namespace["VoiceStyle"]
    assert enum("storyteller").value == "storyteller"
    assert namespace["VOICE_STYLE_PROMPTS"]["storyteller"] == "Speak as storyteller."
    for value in ("unvetted", "unspecified"):
        with pytest.raises(ValueError):
            enum(value)
