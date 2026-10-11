"""Registry-backed shop seeds and persisted runtime content."""

import json
from copy import deepcopy
from functools import lru_cache

from app.catalog_registry import (
    CATALOG_PATH,
    SCHEMA_PATH,
    CatalogRegistry,
    load_catalog,
)
from app.db import one

# Compatibility for callers that still import the original seed shape.
CATALOG = load_catalog().legacy_rows()

CATALOG_INSERT = """INSERT INTO catalog_items
(id,kind,name,price_coins,requires,requires_building,asset_key,slot,voice_style)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING"""


@lru_cache(maxsize=8)
def _validated_snapshot(data_json, schema_json):
    """Cache pure validation work, never DB state or mutable request objects."""
    return CatalogRegistry(json.loads(data_json), schema=json.loads(schema_json))


async def runtime_catalog(conn):
    """Read one consistent snapshot of the definitions published by sync.

    An unseeded content store uses repository fixtures, keeping offline demos valid.
    """
    row = await one(
        conn,
        """SELECT definition, (SELECT jsonb_agg(definition ORDER BY id)
        FROM content_entries) AS entries FROM content_progression WHERE id=1""",
    )
    fallback = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    data = (
        fallback
        if row is None
        else {**fallback, **row["definition"], "entries": row["entries"] or []}
    )
    # Exact content keys make sync, rollback, schema changes and isolated DBs
    # immediately visible. Copies protect the shared validated object from callers.
    return deepcopy(
        _validated_snapshot(
            json.dumps(data, sort_keys=True, separators=(",", ":")),
            SCHEMA_PATH.read_text(encoding="utf-8"),
        )
    )
