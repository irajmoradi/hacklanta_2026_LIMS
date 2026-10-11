"""Disposable real HTTP QA server; only synthetic data in village_test, no paid providers.

Run: python -m scripts.feat001_server (port 8021). Ctrl+C drops its private schema.
"""

from dataclasses import replace
from uuid import uuid4

import psycopg
import uvicorn
from psycopg import sql
from psycopg.conninfo import make_conninfo

from app.config import ROOT, Settings
from app.main import create_app
from scripts.migrate import apply_additions
from scripts.seed import seed


def main():
    settings = Settings.from_env()
    dsn = make_conninfo(settings.database_url, dbname="village_test", connect_timeout=5)
    schema = "feat001_qa_" + uuid4().hex
    with psycopg.connect(dsn) as conn:
        conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    isolated = make_conninfo(dsn, options=f"-csearch_path={schema},public")
    try:
        with psycopg.connect(isolated) as conn:
            conn.execute((ROOT / "packages/contracts/schema.sql").read_text(encoding="utf-8"))
            apply_additions(conn)
            seed(conn)
        settings = replace(
            settings,
            database_url=isolated,
            demo_auth=True,
            auth0_domain="",
            mayor_scheduler=False,
            mayor_voice=False,
            google_api_key="",
            openrouter_api_key="",
            elevenlabs_api_key="",
            asset_dir=ROOT / "apps/api/.runtime/feat001-assets",
        )
        uvicorn.run(
            create_app(settings),
            host="127.0.0.1",
            port=8021,
            loop="app.runtime:selector_loop",
            access_log=False,
        )
    finally:
        with psycopg.connect(dsn) as conn:
            conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


if __name__ == "__main__":
    main()
