"""Run from apps/api; reads VILLAGE_ENV_FILE at runtime, never prints credentials."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402

from app.catalog_registry import CATALOG_PATH, load_catalog, sync_catalog  # noqa: E402
from app.config import Settings  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Validate without connecting to DB")
    parser.add_argument(
        "--catalog", type=Path, default=CATALOG_PATH, help="Registry JSON to publish"
    )
    args = parser.parse_args()
    registry = load_catalog(args.catalog)
    rows = registry.legacy_rows()
    if args.dry_run:
        print(
            f"Valid: {len(registry.entries)} content entries, {len(rows)} shop items, "
            f"{len(registry.event_packs)} event packs"
        )
        return
    settings = Settings.from_env()
    if not settings.database_url:
        raise ValueError("DATABASE_URL required")
    with psycopg.connect(settings.database_url, connect_timeout=5) as conn:
        migration = Path(__file__).resolve().parents[1] / "migrations/008_content_registry.sql"
        conn.execute(migration.read_text(encoding="utf-8"))
        count = sync_catalog(conn, registry)
    print(
        f"Synced {len(registry.entries)} content entries, {count} shop items, "
        f"{len(registry.event_packs)} event packs"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Catalog sync failed ({type(exc).__name__}); check catalog, dependencies and DB.")
        sys.exit(1)
