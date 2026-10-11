"""Apply the house schema to local Postgres AND Tiger without logging credentials."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg

from app.config import Settings


def migrate_houses(dsn):
    with psycopg.connect(dsn, connect_timeout=10) as conn:
        conn.execute(
            (Path(__file__).resolve().parents[1] / "migrations/050_house_interiors.sql").read_text()
        )
        conn.execute(
            (Path(__file__).resolve().parents[1] / "migrations/051_house_presence.sql").read_text()
        )
        conn.execute(
            (Path(__file__).resolve().parents[1] / "migrations/052_house_floors.sql").read_text()
        )
        if conn.execute("SELECT 1 FROM pg_extension WHERE extname='timescaledb'").fetchone():
            conn.execute("""CREATE MATERIALIZED VIEW IF NOT EXISTS house_activity_hourly
                WITH (timescaledb.continuous) AS
                SELECT time_bucket(INTERVAL '1 hour',time) AS hour,house_id,count(*) AS moves
                FROM house_item_moves GROUP BY 1,2 WITH NO DATA""")
            conn.execute("""SELECT add_continuous_aggregate_policy('house_activity_hourly',
                start_offset=>INTERVAL '2 days',end_offset=>INTERVAL '1 hour',
                schedule_interval=>INTERVAL '1 hour',if_not_exists=>true)""")
            conn.execute(
                "ALTER MATERIALIZED VIEW house_activity_hourly SET "
                "(timescaledb.materialized_only=false)"
            )
        else:
            conn.execute("""CREATE OR REPLACE VIEW house_activity_hourly AS
                SELECT date_trunc('hour',time) AS hour,house_id,count(*) AS moves
                FROM house_item_moves GROUP BY 1,2""")


if __name__ == "__main__":
    settings = Settings.from_env()
    failed = False
    for label, dsn in [("local", settings.database_url), ("Tiger", settings.tiger_database_url)]:
        if not dsn:
            print(f"{label}: not configured; local fallback enabled")
            continue
        try:
            migrate_houses(dsn)
            print(f"{label}: house schema and activity aggregate applied")
        except Exception as exc:
            print(f"{label}: migration failed ({type(exc).__name__})")
            failed = True
    sys.exit(1 if failed else 0)
