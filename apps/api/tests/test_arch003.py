"""ARCH-003 publication and event-pack contract coverage (no provider calls)."""

import json
import subprocess
import sys

import psycopg
import pytest
import test_catalog_registry
from jsonschema import ValidationError

from app.catalog import CATALOG
from app.catalog_registry import ROOT, CatalogRegistry, load_catalog, sync_catalog

registry_database = test_catalog_registry.catalog_database


@pytest.mark.parametrize(
    "mutation",
    [
        lambda d: d["event_packs"].append(d["event_packs"][0]),
        lambda d: d["event_packs"][0].update(pieces=["missing"]),
        lambda d: d["event_packs"][0].update(pieces=["tree_a"]),
        lambda d: d["event_packs"][0].update(pieces=[]),
        lambda d: d["event_packs"][0].update(pieces=["neon_arch", "neon_arch"]),
        lambda d: d["event_packs"][0].update(weather="snow"),
        lambda d: d["event_packs"][0].update(mood=""),
        lambda d: d["event_packs"][0].update(unexpected=True),
    ],
)
def test_invalid_event_packs(mutation):
    data = load_catalog().data
    mutation(data)
    with pytest.raises((ValueError, ValidationError)):
        CatalogRegistry(data)


def test_asset004_complete():
    registry = load_catalog()
    suggestions = json.loads((ROOT / "assets/catalog_additions_004.json").read_text())
    for entry in suggestions["entries"]:
        actual = registry.entries[entry["id"]]
        assert actual["asset"] == entry["asset"]
        assert set(entry["tags"]) <= set(actual["tags"])
        assert "shop" not in actual["tags"]
    assert set(registry.event_packs) == {
        "festival_night",
        "spooky",
        "winter",
        "birthday",
        "movie_night",
        "game_night",
    }
    for pack in registry.event_packs.values():
        assert set(pack["pieces"]) == {
            e["id"] for e in suggestions["entries"] if "pack_" + pack["id"] in e["tags"]
        }
    assert len([e for e in registry.entries.values() if "weather_fx" in e.get("tags", [])]) == 5


def test_new_event_pack_temp_registry_validates_and_syncs(tmp_path, registry_database):
    data = load_catalog().data
    piece = {
        "id": "test_confetti",
        "kind": "decoration",
        "slot": "decoration",
        "name": "Test Confetti",
        "description": "Meshless procedural confetti.",
        "source": "event:test_reunion",
        "rarity": "common",
        "price_coins": 0,
        "tags": ["event_pack"],
    }
    pack = {"id": "test_reunion", "name": "Reunion", "pieces": [piece["id"]], "mood": "joyful"}
    data["entries"].append(piece)
    data["event_packs"].append(pack)
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "apps/api/scripts/sync_catalog.py"),
            "--catalog",
            str(path),
            "--dry-run",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "7 event packs" in result.stdout
    registry = load_catalog(path)
    with psycopg.connect(registry_database) as conn:
        assert sync_catalog(conn, registry) == len(CATALOG)
        assert (
            conn.execute(
                "SELECT definition FROM content_entries WHERE id=%s", (piece["id"],)
            ).fetchone()[0]
            == piece
        )
        before = conn.execute(
            "SELECT definition,ctid::text FROM content_progression WHERE id=1"
        ).fetchone()
        assert before[0]["event_packs"][-1] == pack
        sync_catalog(conn, registry)
        assert (
            conn.execute(
                "SELECT definition,ctid::text FROM content_progression WHERE id=1"
            ).fetchone()
            == before
        )
        assert conn.execute("SELECT count(*) FROM village_unlocks").fetchone()[0] == 0
        assert (
            conn.execute(
                "SELECT count(*) FROM catalog_items WHERE id=%s", (piece["id"],)
            ).fetchone()[0]
            == 0
        )
        # Old catalog files are still valid; omitted packs clear the published list.
        del data["event_packs"]
        sync_catalog(conn, CatalogRegistry(data))
        assert (
            conn.execute(
                "SELECT definition->'event_packs' FROM content_progression WHERE id=1"
            ).fetchone()[0]
            == []
        )


def test_richer_requirements_sync(registry_database):
    data = load_catalog().data
    cap = next(e for e in data["entries"] if e["id"] == "hat_cap")
    cap["requires"] = ["tree_a", "hat_beanie", "glasses_round", "garden", "festival_lights"]
    cap["unlock"] = {"village_level": 4}
    level_only = next(e for e in data["entries"] if e["id"] == "hat_crown")
    level_only["requires"] = []
    level_only["unlock"] = {"village_level": 5}
    registry = CatalogRegistry(data)
    assert registry.missing_requirements("hat_cap") == cap["requires"] + ["village_level:4"]
    assert registry.missing_requirements("hat_crown") == ["village_level:5"]
    with psycopg.connect(registry_database) as conn:
        assert sync_catalog(conn, registry) == len(CATALOG)
        assert conn.execute(
            "SELECT requires,requires_building FROM catalog_items WHERE id='hat_cap'"
        ).fetchone() == ("hat_beanie", "garden")
        assert (
            conn.execute("SELECT definition FROM content_entries WHERE id='hat_cap'").fetchone()[0]
            == cap
        )
        assert conn.execute(
            "SELECT requires,requires_building FROM catalog_items WHERE id='hat_crown'"
        ).fetchone() == (None, None)
        assert (
            conn.execute("SELECT definition FROM content_entries WHERE id='hat_crown'").fetchone()[
                0
            ]
            == level_only
        )


@pytest.mark.parametrize("supported", [False, None])
def test_unsupported_voice_cannot_be_published_in_shop(supported):
    data = load_catalog().data
    entry = next(e for e in data["entries"] if e["id"] == "voice_pirate")
    entry["voice_style"].pop("supported")
    if supported is not None:
        entry["voice_style"]["supported"] = supported
    with pytest.raises(ValueError, match="explicitly supported"):
        CatalogRegistry(data).legacy_rows()


def test_new_supported_voice_projection_and_contract_blocker(registry_database):
    data = load_catalog().data
    voice = {
        "id": "voice_storyteller",
        "kind": "voice_style",
        "slot": "voice_style",
        "name": "Storyteller",
        "description": "A vetted new style.",
        "source": "shop",
        "rarity": "common",
        "price_coins": 10,
        "tags": ["shop"],
        "voice_style": {"prompt": "Speak as a storyteller.", "supported": True},
    }
    data["entries"].append(voice)
    registry = CatalogRegistry(data)
    row = next(row for row in registry.legacy_rows() if row[0] == voice["id"])
    assert row[-1] == "storyteller"
    with psycopg.connect(registry_database) as conn:
        sync_catalog(conn)
        # Migration 012 opened the voice_style constraint to registry-defined identifiers.
        sync_catalog(conn, registry)
        assert (
            conn.execute(
                "SELECT count(*) FROM content_entries WHERE id=%s", (voice["id"],)
            ).fetchone()[0]
            == 1
        )
