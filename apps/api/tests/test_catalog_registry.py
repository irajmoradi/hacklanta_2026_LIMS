import copy
import json
import re
from uuid import uuid4

import psycopg
import pytest
from jsonschema import ValidationError
from psycopg import sql
from psycopg.conninfo import make_conninfo

from app.catalog import CATALOG
from app.catalog_registry import CATALOG_PATH, ROOT, CatalogRegistry, load_catalog, sync_catalog
from app.domain import SEED_USERS, VILLAGE_ID
from scripts.migrate import apply_additions
from scripts.seed import seed


class PrivateDSN(str):
    """Pytest must not include connection credentials in fixture failure reprs."""

    def __repr__(self):
        return "<private test database DSN>"


@pytest.fixture
def catalog_database(test_database):
    settings, _ = test_database
    schema = "catalog_test_" + uuid4().hex
    with psycopg.connect(settings.database_url) as conn:
        conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    dsn = make_conninfo(settings.database_url, options=f"-csearch_path={schema},public")
    try:
        with psycopg.connect(dsn) as conn:
            baseline = (ROOT / "packages/contracts/schema.sql").read_text(encoding="utf-8")
            conn.execute(baseline)
            # Match the main test fixture: folded migrations have already run.
            conn.execute("CREATE TABLE api_migrations (name text PRIMARY KEY)")
            for name in re.findall(r"^-- folded from apps/api/migrations/(\S+\.sql)$", baseline, re.M):
                conn.execute("INSERT INTO api_migrations(name) VALUES (%s)", (name,))
            apply_additions(conn)
        yield PrivateDSN(dsn)
    finally:
        with psycopg.connect(settings.database_url) as conn:
            conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


def test_shipped_registry_and_legacy_parity():
    # Art packs may ship ahead of their catalog rollout. Every catalog reference
    # must exist, but unrelated GLBs need not already be purchasable/registered.
    registry = load_catalog()
    for entry in registry.entries.values():
        if asset := entry.get("asset"):
            assert (ROOT / "apps/web/public" / asset["glb"].lstrip("/")).is_file()
    assert registry.legacy_rows() == CATALOG
    shipped = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))["entries"]
    assert len(registry.entries) == len(shipped)
    assert registry.entries == {entry["id"]: entry for entry in shipped}
    assert registry.entries["colosseum"]["tags"] == ["separate_scene"]
    assert "colosseum" not in registry.buildings
    assert "colosseum" not in {row[0] for row in registry.legacy_rows()}
    assert "study_nook" in registry.unlocked_buildings(1)
    assert registry.entries["villagergram"]["kind"] == "consumable"
    assert registry.entries["villagergram"]["price_coins"] == 150
    assert registry.progression(-1) == (1, 500)
    assert registry.progression(1500) == (3, 2500)
    assert registry.progression(99999) == (6, None)
    assert registry.unlocked_buildings(4) == [
        "study_nook",
        "fitness_corner",
        "garden",
        "festival_lights",
        "pet_shelter",
        "farm_store",
    ]


@pytest.mark.parametrize(
    "mutation",
    [
        lambda d: d["entries"].append(d["entries"][0]),
        lambda d: next(e for e in d["entries"] if e["id"] == "colosseum").update(
            unlock={"village_level": 1}
        ),
        lambda d: d["entries"][0].update(requires=["missing"]),
        lambda d: (
            d["entries"][0].update(requires=["hat_cap"])
            or next(e for e in d["entries"] if e["id"] == "hat_cap").update(requires=["hat_beanie"])
        ),
        lambda d: d["entries"][0].update(slot="pet"),
        lambda d: d["entries"][0].update(price_coins=-1),
        lambda d: d["entries"][0]["asset"].update(glb="/models/../secret.glb"),
        lambda d: d["entries"][0]["asset"]["attach"].update(offset=[0, 1]),
        lambda d: d["levels"][1].update(xp=0),
        lambda d: d["levels"][1].update(buildings=[]),
        lambda d: d["buildings"][0]["placement"].update(district="missing"),
    ],
)
def test_invalid_registry(mutation):
    data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    mutation(data)
    with pytest.raises((ValueError, ValidationError)):
        CatalogRegistry(data)


def test_optional_assets_and_coverage(tmp_path):
    registry = load_catalog()  # Headless deployment needs no models on disk.
    with pytest.raises(ValueError, match="Missing GLB"):
        CatalogRegistry(registry.data, model_directory=tmp_path)
    for entry in registry.entries.values():
        if "asset" in entry:
            (tmp_path / entry["asset"]["glb"].split("/")[-1]).touch()
    (tmp_path / "unlisted.glb").touch()
    with pytest.raises(ValueError, match="Uncataloged"):
        CatalogRegistry(registry.data, model_directory=tmp_path)


def test_requires_resolution_and_legacy_projection():
    registry = load_catalog()
    assert registry.resolve_requires("pet_dog") == ["house_backyard", "pet_shelter"]
    assert (
        registry.missing_requirements(
            "pet_dog", owned=["house_backyard"], unlocked=["pet_shelter"], village_level=4
        )
        == []
    )
    assert registry.missing_requirements("pet_dog") == [
        "house_backyard",
        "pet_shelter",
        "village_level:4",
    ]
    data = copy.deepcopy(registry.data)
    next(e for e in data["entries"] if e["id"] == "house_lv3")["requires"] = [
        "house_lv2",
        "house_backyard",
    ]
    registry = CatalogRegistry(data)
    assert registry.resolve_requires("house_lv3") == ["house_lv2", "house_backyard"]
    row = next(row for row in registry.legacy_rows() if row[0] == "house_lv3")
    assert row[4] == "house_lv2"


def test_idempotent_sync_and_updates(catalog_database):
    registry = load_catalog()
    with psycopg.connect(catalog_database) as conn:
        # Exercise migration replay and deliberately reversed foreign-key order.
        migration = (ROOT / "apps/api/migrations/008_content_registry.sql").read_text(
            encoding="utf-8"
        )
        conn.execute(migration)
        conn.execute(migration)
        data = copy.deepcopy(registry.data)
        data["entries"].reverse()
        sync_catalog(conn, CatalogRegistry(data))
        before = conn.execute("SELECT id,definition,ctid::text FROM content_entries ORDER BY id")
        before = before.fetchall()
        shop_before = conn.execute("SELECT * FROM catalog_items ORDER BY id").fetchall()
        sync_catalog(conn, registry)
        assert (
            conn.execute(
                "SELECT id,definition,ctid::text FROM content_entries ORDER BY id"
            ).fetchall()
            == before
        )
        assert conn.execute("SELECT * FROM catalog_items ORDER BY id").fetchall() == shop_before
        assert conn.execute("SELECT count(*) FROM catalog_items").fetchone()[0] == len(CATALOG)
        assert conn.execute("SELECT count(*) FROM village_unlocks").fetchone()[0] == 0
        data = copy.deepcopy(registry.data)
        data["entries"][0]["price_coins"] = 31
        sync_catalog(conn, CatalogRegistry(data))
        assert (
            conn.execute("SELECT price_coins FROM catalog_items WHERE id='hat_beanie'").fetchone()[
                0
            ]
            == 31
        )
        conn.rollback()


def test_sync_preserves_owned_and_external_items_and_rolls_back(catalog_database):
    with psycopg.connect(catalog_database) as conn:
        seed(conn)
        conn.execute("""INSERT INTO catalog_items(id,kind,name,price_coins,slot)
            VALUES ('external_hat','clothing','External hat',10,'head')""")
        conn.execute(
            """INSERT INTO inventory(village_id,user_id,item_id,equipped)
            VALUES (%s,%s,'hat_beanie',true)""",
            (VILLAGE_ID, SEED_USERS[0][0]),
        )
        inventory = conn.execute("SELECT * FROM inventory ORDER BY item_id").fetchall()
        sync_catalog(conn)
        assert conn.execute("SELECT * FROM inventory ORDER BY item_id").fetchall() == inventory
        assert conn.execute("SELECT 1 FROM catalog_items WHERE id='external_hat'").fetchone()
        data = copy.deepcopy(load_catalog().data)
        data["entries"][0]["slot"] = "face"
        with pytest.raises(ValueError, match="Owned item slot"):
            sync_catalog(conn, CatalogRegistry(data))
        assert conn.execute("SELECT slot FROM catalog_items WHERE id='hat_beanie'").fetchone() == (
            "head",
        )
        # Force a real database error after definition writes; the savepoint must undo them.
        conn.execute(
            "ALTER TABLE catalog_items ADD CONSTRAINT test_price CHECK (price_coins <> 31)"
        )
        data = copy.deepcopy(load_catalog().data)
        data["entries"][0]["price_coins"] = 31
        with pytest.raises(psycopg.errors.CheckViolation):
            sync_catalog(conn, CatalogRegistry(data))
        assert conn.execute(
            "SELECT definition->>'price_coins' FROM content_entries WHERE id='hat_beanie'"
        ).fetchone() == ("30",)
        conn.rollback()
