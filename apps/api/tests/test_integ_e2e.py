"""Opt-in browser checks against the existing isolated database test fixture."""

import os
import shutil
import subprocess
import threading
import time
from dataclasses import replace

import psycopg
import pytest
import uvicorn

from app.config import ROOT
from app.domain import SEED_USERS, VILLAGE_ID
from app.main import create_app
from scripts.seed import seed


@pytest.mark.skipif(os.getenv("INTEG_E2E") != "1", reason="Opt-in real HTTP browser suites")
def test_integrated_real_browser_suites(test_database, tmp_path, monkeypatch):
    settings, _ = test_database
    with psycopg.connect(settings.database_url) as conn:
        seed(conn)
        # Synthetic competition fixture in this run's private schema only.
        cid = conn.execute(
            """INSERT INTO competitions
            (village_id,creator_id,title,terms,friendly,auditor_id)
            VALUES (%s,%s,'Study streak','Log a focused study session.',false,%s)
            RETURNING id""",
            (VILLAGE_ID, SEED_USERS[0][0], SEED_USERS[0][0]),
        ).fetchone()[0]
        conn.execute(
            """INSERT INTO competition_participants
            (competition_id,user_id,entry_lamports_intent) VALUES (%s,%s,0)""",
            (cid, SEED_USERS[1][0]),
        )
    settings = replace(settings, asset_dir=tmp_path, mayor_voice=False)
    from app import world

    original_world = world.state
    hour = None

    async def preview_world(*args, **kwargs):
        state = await original_world(*args, **kwargs)
        return state if hour is None else {**state, "time_of_day": hour, "weather": "clear"}

    monkeypatch.setattr(world, "state", preview_world)
    app = create_app(settings)

    @app.post("/qa/day")
    async def day():
        nonlocal hour
        hour = 12
        with psycopg.connect(settings.database_url) as conn:
            conn.execute("UPDATE mayor_events SET status='completed'")
            conn.execute("UPDATE users SET idle_activity='studying'")
        return {"ok": True}

    @app.post("/qa/night")
    async def night():
        nonlocal hour
        hour = 22
        return {"ok": True}

    server = uvicorn.Server(
        uvicorn.Config(
            app,
            host="127.0.0.1",
            port=8021,
            loop="app.runtime:selector_loop",
            access_log=False,
        )
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 30
        while not server.started and thread.is_alive() and time.monotonic() < deadline:
            time.sleep(0.1)
        assert server.started, "Scratch API did not start"
        env = {**os.environ, "FEAT001_REAL": "1", "VILLAGE_API_URL": "http://127.0.0.1:8021"}
        for config, extra in (
            ("tests/feat001.config.ts", []),
            ("playwright.web021-real.config.ts", []),
            ("playwright.colosseum.config.ts", ["--project=real"]),
            ("playwright.web023.config.ts", []),
            ("playwright.feat009-real.config.ts", []),
            ("playwright.integ005-house.config.ts", []),
        ):
            selected = os.getenv("INTEG_E2E_CONFIG")
            if selected and config != selected:
                continue
            result = subprocess.run(
                [shutil.which("bun"), "x", "playwright", "test", "--config", config, *extra],
                cwd=ROOT / "apps/web",
                env=env,
                timeout=600,
                check=False,
            )
            assert result.returncode == 0, config
    finally:
        server.should_exit = True
        thread.join(timeout=30)
        assert not thread.is_alive(), "Scratch API failed to shut down"
