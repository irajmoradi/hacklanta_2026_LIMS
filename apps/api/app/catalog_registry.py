"""Repository-owned content, with adapters for the existing shop and world code.

Install packages/catalog/requirements.txt alongside the API dependencies.
Asset checks are opt-in at runtime so a headless API needs no web/GPU assets.
"""

import json
from pathlib import Path

from jsonschema import Draft202012Validator
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = ROOT / "packages/catalog/catalog.json"
SCHEMA_PATH = CATALOG_PATH.with_name("catalog.schema.json")


class CatalogRegistry:
    def __init__(self, data, *, model_directory=None, schema=None):
        if schema is None:
            schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        Draft202012Validator(schema).validate(data)
        self.data = data
        self.entries = self._index(data["entries"])
        self.buildings = self._index(data["buildings"])
        self.event_packs = self._index(data.get("event_packs", []))
        for pack in self.event_packs.values():
            for ident in pack["pieces"]:
                entry = self.entries.get(ident, {})
                if entry.get("kind") != "decoration" or "event_pack" not in entry.get("tags", []):
                    raise ValueError(f"Invalid event pack piece: {ident}")
        districts = self._index(data["districts"])
        self.levels = data["levels"]
        unlocked = set()
        for index, level in enumerate(self.levels):
            if level["level"] != index + 1 or (
                level["xp"] != 0 if index == 0 else level["xp"] <= self.levels[index - 1]["xp"]
            ):
                raise ValueError("Levels must be consecutive with increasing XP starting at zero")
            for ident in level["buildings"]:
                entry = self.entries.get(ident, {})
                if (
                    ident not in self.buildings
                    or ident in unlocked
                    or entry.get("unlock", {}).get("village_level") != level["level"]
                ):
                    raise ValueError(f"Invalid building unlock: {ident}")
                unlocked.add(ident)
        for ident, building in self.buildings.items():
            if self.entries.get(ident, {}).get("kind") != "building" or ident not in unlocked:
                raise ValueError(f"Invalid building: {ident}")
            if building["placement"]["district"] not in districts:
                raise ValueError("Unknown district")
        referenced = set()
        for ident, entry in self.entries.items():
            kind = entry["kind"]
            slots = ["head", "face", "torso", "neck", "bottoms", "shoes"] if kind == "clothing" else [kind]
            if kind == "building":
                if (
                    "slot" in entry
                    or (
                        ident not in self.buildings
                        and "separate_scene" not in entry.get("tags", [])
                    )
                    or "shop" in entry.get("tags", [])
                ):
                    raise ValueError(f"Invalid building slot or shop tag: {ident}")
                if "separate_scene" in entry.get("tags", []) and (
                    ident in self.buildings or entry.get("unlock")
                ):
                    raise ValueError(
                        f"Separate scene buildings cannot have town progression: {ident}"
                    )
            elif entry.get("slot") not in slots:
                raise ValueError(f"Invalid slot: {ident}")
            if (kind == "voice_style") != ("voice_style" in entry):
                raise ValueError(f"Invalid voice style: {ident}")
            if entry.get("unlock", {}).get("village_level", 1) > len(self.levels):
                raise ValueError("Unknown level")
            for dependency in entry.get("requires", []):
                if dependency not in self.entries:
                    raise ValueError(f"Unknown requirement: {dependency}")
            if asset := entry.get("asset"):
                filename = asset["glb"].removeprefix("/models/")
                referenced.add(filename)
                if model_directory is not None and not (Path(model_directory) / filename).is_file():
                    raise ValueError(f"Missing GLB: {filename}")
        visiting, visited = set(), set()

        def visit(ident):
            if ident in visiting:
                raise ValueError(f"Requirement cycle: {ident}")
            if ident in visited:
                return
            visiting.add(ident)
            for dependency in self.entries[ident].get("requires", []):
                visit(dependency)
            visiting.remove(ident)
            visited.add(ident)

        for ident in self.entries:
            visit(ident)
        if model_directory is not None:
            missing = {p.name for p in Path(model_directory).glob("*.glb")} - referenced
            if missing:
                raise ValueError(f"Uncataloged GLBs: {sorted(missing)}")

    @staticmethod
    def _index(entries):
        result = {entry["id"]: entry for entry in entries}
        if len(result) != len(entries):
            raise ValueError("Duplicate IDs")
        return result

    def resolve_requires(self, ident):
        """Transitive dependencies, once each, prerequisites first."""
        result = []

        def visit(key):
            for dependency in self.entries[key].get("requires", []):
                visit(dependency)
                if dependency not in result:
                    result.append(dependency)

        visit(ident)
        return result

    def missing_requirements(self, ident, *, owned=(), unlocked=(), village_level=1):
        missing = []
        for dependency in self.resolve_requires(ident):
            available = unlocked if self.entries[dependency]["kind"] == "building" else owned
            if dependency not in available:
                missing.append(dependency)
        level = self.entries[ident].get("unlock", {}).get("village_level", 1)
        if village_level < level:
            missing.append(f"village_level:{level}")
        return missing

    def progression(self, xp):
        level = max(1, sum(xp >= row["xp"] for row in self.levels))
        return level, self.levels[level]["xp"] if level < len(self.levels) else None

    def unlocked_buildings(self, level):
        return [b for row in self.levels if row["level"] <= level for b in row["buildings"]]

    def legacy_rows(self):
        """Nine-column compatibility summary; content_entries owns full requirements.

        Only purchasable item IDs fit the legacy foreign key. Consumers enforce
        every prerequisite and independent level gate from the full definition.
        """
        rows = []
        for entry in self.entries.values():
            if not {"shop", "earn_only"}.intersection(entry.get("tags", [])):
                continue
            requirements = entry.get("requires", [])
            items = [
                r
                for r in requirements
                if self.entries[r]["kind"] != "building"
                and "shop" in self.entries[r].get("tags", [])
            ]
            buildings = [r for r in requirements if self.entries[r]["kind"] == "building"]
            voice = entry["id"].removeprefix("voice_") if entry["kind"] == "voice_style" else None
            if voice is not None and entry["voice_style"].get("supported") is not True:
                raise ValueError("Shop voice style must be explicitly supported")
            rows.append(
                (
                    entry["id"],
                    entry["kind"],
                    entry["name"],
                    entry["price_coins"],
                    items[0] if items else None,
                    buildings[0] if buildings else None,
                    Path(entry["asset"]["glb"]).stem if "asset" in entry else None,
                    entry["slot"],
                    voice,
                )
            )
        return rows


def load_catalog(path=CATALOG_PATH, *, model_directory=None):
    return CatalogRegistry(
        json.loads(Path(path).read_text(encoding="utf-8")), model_directory=model_directory
    )


def sync_catalog(conn, registry=None):
    """Atomic, additive upsert; never grants village unlocks or deletes inventory.

    Scene entries live in content_entries, avoiding free items in the legacy shop.
    Caller owns commit; transaction context is a savepoint if already in a transaction.
    """
    registry = registry or load_catalog()
    rows = registry.legacy_rows()  # Validate compatibility before any writes.
    with conn.transaction():
        for row in rows:
            existing = conn.execute(
                "SELECT slot FROM catalog_items WHERE id=%s FOR UPDATE", (row[0],)
            ).fetchone()
            if (
                existing
                and (existing["slot"] if isinstance(existing, dict) else existing[0]) != row[7]
            ):
                if conn.execute(
                    "SELECT 1 FROM inventory WHERE item_id=%s LIMIT 1", (row[0],)
                ).fetchone():
                    raise ValueError("Owned item slot changes require an inventory migration")
        for entry in registry.entries.values():
            conn.execute(
                """INSERT INTO content_entries(id,definition) VALUES (%s,%s)
                ON CONFLICT(id) DO UPDATE SET definition=EXCLUDED.definition
                WHERE content_entries.definition IS DISTINCT FROM EXCLUDED.definition""",
                (entry["id"], Jsonb(entry)),
            )
        conn.execute(
            """INSERT INTO content_progression(id,definition) VALUES (1,%s)
            ON CONFLICT(id) DO UPDATE SET definition=EXCLUDED.definition
            WHERE content_progression.definition IS DISTINCT FROM EXCLUDED.definition""",
            (
                Jsonb(
                    {
                        **{k: registry.data[k] for k in ("levels", "buildings", "districts")},
                        "event_packs": list(registry.event_packs.values()),
                    }
                ),
            ),
        )
        # Insert all IDs first, then foreign keys: source order is deliberately irrelevant.
        for row in rows:
            conn.execute(
                """INSERT INTO catalog_items
                (id,kind,name,price_coins,asset_key,slot,voice_style) VALUES (%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT(id) DO NOTHING""",
                row[:4] + row[6:],
            )
        for row in rows:
            conn.execute(
                """UPDATE catalog_items SET kind=%s,name=%s,price_coins=%s,
                requires=%s,requires_building=%s,asset_key=%s,slot=%s,voice_style=%s
                WHERE id=%s AND (kind,name,price_coins,requires,requires_building,asset_key,slot,
                voice_style) IS DISTINCT FROM (%s,%s,%s,%s,%s,%s,%s,%s)""",
                row[1:] + (row[0],) + row[1:],
            )
    return len(rows)
