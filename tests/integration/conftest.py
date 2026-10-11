"""Production API and real PostgreSQL, private schema; never shared demo rows."""
import importlib.util
import sys
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

import httpx
import psycopg
import pytest_asyncio
from psycopg import sql

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps/api"))
spec = importlib.util.spec_from_file_location("qa_api_fixtures", ROOT / "apps/api/tests/conftest.py")
upstream = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upstream)
test_database = upstream.test_database
pytest_asyncio_loop_factories = upstream.pytest_asyncio_loop_factories


def pytest_configure():
    (ROOT / "tests/.runtime").mkdir(exist_ok=True)


@pytest_asyncio.fixture
async def qa_api(test_database, tmp_path, monkeypatch):
    from app.main import create_app
    from app import voice, auditor
    from app.models import EvidenceReview

    settings, schema = test_database
    ids = [str(uuid4()) for _ in range(4)]
    with psycopg.connect(settings.database_url) as conn:
        tables = conn.execute("SELECT tablename FROM pg_tables WHERE schemaname=%s", (schema,))
        names = [sql.Identifier(schema, row[0]) for row in tables.fetchall()]
        conn.execute(sql.SQL("TRUNCATE {} CASCADE").format(sql.SQL(",").join(names)))
        for n, uid in enumerate(ids):
            conn.execute("INSERT INTO users(id,auth_issuer,auth_subject,display_name,agent_msgs_ok) "
                         "VALUES(%s,'qa002',%s,%s,false)", (uid, uid, f"QA·Isolated{n}"))

    async def synthesize(*args):
        return b"ID3-QA-synthetic-audio"

    async def vision(*args):
        return EvidenceReview(verdict="verified", confidence=0.9, reason="QA synthetic provider")

    monkeypatch.setattr(voice, "synthesize", synthesize)
    monkeypatch.setattr(auditor, "vision", vision)
    settings = replace(settings, asset_dir=tmp_path, mayor_voice=False)
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                                     base_url="http://qa", headers={"X-Demo-User": ids[0]}) as client:
            response = await client.post("/api/villages", json={"name": "QA-002 isolated"})
            assert response.status_code == 200
            v = response.json()["village"]
            for uid in ids[1:3]:
                joined = await client.post("/api/villages/join", headers={"X-Demo-User": uid},
                                           json={"invite_code": v["invite_code"]})
                assert joined.status_code == 200
            yield client, app, ids, "/api/villages/" + v["id"]
