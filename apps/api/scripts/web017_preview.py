"""Serve a disposable, seeded real API for WEB-017 browser QA. No paid providers."""

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

from app.config import ROOT, Settings
from app.domain import SEED_USERS, VILLAGE_ID
from app.main import create_app
from app.runtime import selector_loop
from scripts.migrate import apply_additions
from scripts.seed import seed


def main():
    settings = Settings.from_env()
    dsn = make_conninfo(settings.database_url, dbname="village_test", connect_timeout=5)
    schema = "web017_preview_" + uuid4().hex
    with psycopg.connect(dsn) as conn:
        conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    isolated = make_conninfo(dsn, options=f"-csearch_path={schema},public")
    try:
        with psycopg.connect(isolated) as conn:
            conn.execute((ROOT / "packages/contracts/schema.sql").read_text(encoding="utf-8"))
            apply_additions(conn)
            seed(conn)
            conn.execute("UPDATE mayor_events SET status='completed'")
            for (uid, _, _), activity in zip(
                SEED_USERS, ["gardening", "walk_pet", "dancing", "reading", "food"]
            ):
                conn.execute("UPDATE users SET idle_activity=%s WHERE id=%s", (activity, uid))
            conn.execute(
                """INSERT INTO xp_ledger (village_id,user_id,delta,reason,source_key)
                VALUES (%s,%s,5000,'weekly_win','web017-preview')""",
                (VILLAGE_ID, SEED_USERS[0][0]),
            )
            conn.execute(
                """INSERT INTO inventory (village_id,user_id,item_id,equipped)
                VALUES (%s,%s,'pet_dog',true) ON CONFLICT (village_id,user_id,item_id)
                DO UPDATE SET equipped=true""",
                (VILLAGE_ID, SEED_USERS[1][0]),
            )
        settings = replace(
            settings,
            database_url=isolated,
            demo_auth=True,
            auth0_domain="",
            mayor_scheduler=False,
            google_api_key="",
            openrouter_api_key="",
            elevenlabs_api_key="",
            asset_dir=Path(".runtime/web017-assets"),
        )
        server = uvicorn.Server(uvicorn.Config(create_app(settings), host="127.0.0.1", port=8027))
        with asyncio.Runner(loop_factory=selector_loop) as runner:
            runner.run(server.serve())
    finally:
        with psycopg.connect(dsn) as conn:
            conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


if __name__ == "__main__":
    main()
