"""Isolated synthetic village for FEAT-015 browser QA (no provider generation)."""

import re
import sys
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import psycopg
import uvicorn
from psycopg import sql
from psycopg.conninfo import make_conninfo

from app.config import ROOT, Settings
from app.main import create_app
from scripts.migrate import apply_additions
from scripts.seed import seed
from scripts.tiger_migrate import migrate_houses

settings = Settings.from_env()
namespace = "feat015_qa_" + uuid4().hex[:12]
local = make_conninfo(settings.database_url, dbname="village_test")
targets = [local] + ([settings.tiger_database_url] if settings.tiger_database_url else [])
try:
    for dsn in targets:
        with psycopg.connect(dsn) as conn:
            conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(namespace)))
    local = make_conninfo(local, options=f"-csearch_path={namespace},public")
    with psycopg.connect(local) as conn:
        baseline = (ROOT / "packages/contracts/schema.sql").read_text(encoding="utf-8")
        conn.execute(baseline)
        conn.execute("CREATE TABLE api_migrations (name text PRIMARY KEY)")
        for name in re.findall(r"^-- folded from apps/api/migrations/(\S+\.sql)$", baseline, re.M):
            conn.execute("INSERT INTO api_migrations(name) VALUES (%s)", (name,))
        apply_additions(conn)
        seed(conn)
    tiger = (
        make_conninfo(settings.tiger_database_url, options=f"-csearch_path={namespace},public")
        if settings.tiger_database_url
        else ""
    )
    migrate_houses(tiger or local)
    app = create_app(
        replace(
            settings,
            database_url=local,
            tiger_database_url=tiger,
            demo_auth=True,
            mayor_scheduler=False,
            asset_dir=Path(__file__).resolve().parents[1] / ".runtime" / namespace,
            google_api_key="",
            openrouter_api_key="",
            elevenlabs_api_key="",
        )
    )
    print(
        f"Isolated synthetic QA village ready; schema={namespace}; Tiger={bool(tiger)}", flush=True
    )
    uvicorn.run(
        app, host="127.0.0.1", port=8015, loop="app.runtime:selector_loop", access_log=False
    )
finally:
    for dsn in targets:
        with psycopg.connect(dsn) as conn:
            conn.execute(
                sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(sql.Identifier(namespace))
            )
