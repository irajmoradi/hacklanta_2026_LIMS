"""Apply the integrator-owned schema unchanged. Run from apps/api."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402
from psycopg import sql  # noqa: E402

from app.config import ROOT, Settings  # noqa: E402


def apply_additions(conn):
    namespace = conn.execute("SELECT current_schema()").fetchone()[0]
    ledger = sql.Identifier(namespace, "api_migrations")
    conn.execute(sql.SQL("CREATE TABLE IF NOT EXISTS {} (name text PRIMARY KEY)").format(ledger))
    for path in sorted((Path(__file__).resolve().parents[1] / "migrations").glob("*.sql")):
        if conn.execute(
            sql.SQL("SELECT 1 FROM {} WHERE name=%s").format(ledger), (path.name,)
        ).fetchone():
            continue
        conn.execute(path.read_text(encoding="utf-8-sig"))
        conn.execute(sql.SQL("INSERT INTO {}(name) VALUES (%s)").format(ledger), (path.name,))


def migrate(dsn):
    with psycopg.connect(dsn, connect_timeout=5) as conn:
        # Replaying the baseline would restore obsolete checks and clear multi-pet slots.
        if not conn.execute("SELECT to_regclass('villages')").fetchone()[0]:
            conn.execute((ROOT / "packages/contracts/schema.sql").read_text(encoding="utf-8"))
        apply_additions(conn)


if __name__ == "__main__":
    try:
        migrate(Settings.from_env().database_url)
    except Exception as exc:
        print(f"Migration failed ({type(exc).__name__}); verify DB and TimescaleDB availability.")
        sys.exit(1)
    print("Contract schema applied.")
