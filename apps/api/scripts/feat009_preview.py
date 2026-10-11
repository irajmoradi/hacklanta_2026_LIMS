"""Disposable real-API FEAT-009 screenshot server; credentials loaded at runtime only."""

import asyncio
import sys
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg
import uvicorn
from psycopg import sql
from psycopg.conninfo import make_conninfo

from app import world
from app.config import ROOT, Settings
from app.main import create_app
from app.runtime import selector_loop
from scripts.migrate import apply_additions
from scripts.seed import seed


def main():
    settings = Settings.from_env()
    dsn = make_conninfo(settings.database_url, dbname="village_test", connect_timeout=5)
    schema = "feat009_preview_" + uuid4().hex
    with psycopg.connect(dsn) as conn:
        conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    isolated = make_conninfo(dsn, options=f"-csearch_path={schema},public")
    try:
        with psycopg.connect(isolated) as conn:
            conn.execute((ROOT / "packages/contracts/schema.sql").read_text(encoding="utf-8"))
            apply_additions(conn)
            seed(conn)
            conn.execute("UPDATE mayor_events SET status='completed'")
            conn.execute("UPDATE users SET idle_activity='studying'")
        original = world.state
        hour = 12

        async def preview_world(*args, **kwargs):
            state = await original(*args, **kwargs)
            return {**state, "time_of_day": hour, "weather": "clear"}

        world.state = preview_world
        settings = replace(
            settings,
            database_url=isolated,
            demo_auth=True,
            auth0_domain="",
            mayor_scheduler=False,
            gpu_worker_url="http://127.0.0.1:1/health",
            google_api_key="",
            openrouter_api_key="",
            elevenlabs_api_key="",
            asset_dir=Path(".runtime/feat009-assets"),
        )
        app = create_app(settings)

        @app.post("/qa/day")
        async def day():
            nonlocal hour
            hour = 12
            return {"ok": True}

        @app.post("/qa/night")
        async def night():
            nonlocal hour
            hour = 22
            return {"ok": True}

        @app.post("/qa/stop")
        async def stop():
            server.should_exit = True
            return {"ok": True}

        server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=8029))
        with asyncio.Runner(loop_factory=selector_loop) as runner:
            runner.run(server.serve())
    finally:
        with psycopg.connect(dsn) as conn:
            conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


if __name__ == "__main__":
    main()
