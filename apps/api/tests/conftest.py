import os
import re
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

import httpx
import psycopg
import pytest
import pytest_asyncio
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app.config import ROOT, Settings
from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID
from app.events_table import TemplateDecision, TemplateProposal
from app.main import create_app
from app.mayor import Mayor
from app.models import MayorProposal, NudgeProposal
from app.newspaper import GazetteDraft
from app.runtime import selector_loop
from scripts.migrate import apply_additions, migrate
from scripts.seed import seed


def pytest_asyncio_loop_factories():
    return {"selector": selector_loop}


def pytest_configure():
    (Path(__file__).resolve().parents[1] / ".runtime").mkdir(exist_ok=True)


@pytest.fixture(scope="session")
def test_database():
    settings = Settings.from_env()
    raw = os.getenv("VILLAGE_TEST_DATABASE_URL")
    dsn = make_conninfo(raw or settings.database_url, connect_timeout=5)
    if not raw:
        dsn = make_conninfo(dsn, dbname="village_test")
    if conninfo_to_dict(dsn).get("dbname") != "village_test":
        raise RuntimeError("Tests refuse any database except village_test")
    # Only CREATE DATABASE is run through the maintenance connection; never mutate village.
    with psycopg.connect(make_conninfo(dsn, dbname="postgres"), autocommit=True) as conn:
        if not conn.execute("SELECT 1 FROM pg_database WHERE datname='village_test'").fetchone():
            conn.execute('CREATE DATABASE "village_test"')
    migrate(dsn)
    schema = "api001_test_" + uuid4().hex
    with psycopg.connect(dsn) as conn:
        conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    isolated = make_conninfo(dsn, options=f"-csearch_path={schema},public")
    with psycopg.connect(isolated) as conn:
        baseline = (ROOT / "packages/contracts/schema.sql").read_text(encoding="utf-8")
        conn.execute(baseline)
        # The baseline already executes these migrations, including non-repeatable DDL.
        conn.execute("CREATE TABLE api_migrations (name text PRIMARY KEY)")
        for name in re.findall(r"^-- folded from apps/api/migrations/(\S+\.sql)$", baseline, re.M):
            conn.execute("INSERT INTO api_migrations(name) VALUES (%s)", (name,))
        apply_additions(conn)
    yield (
        replace(
            settings,
            database_url=isolated,
            tiger_database_url="",
            demo_auth=True,
            auth0_domain="",
            service_key="test-service-only",
            google_api_key="",
            openrouter_api_key="",
            mayor_scheduler=False,
            mayor_voice=True,
            elevenlabs_api_key="",
        ),
        schema,
    )
    with psycopg.connect(dsn) as conn:
        conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


@pytest.fixture(autouse=True)
def providers(monkeypatch):
    async def generate(self, schema, instruction, context):
        if schema is NudgeProposal:
            return NudgeProposal(text="One small win today. You can do it!")
        if schema is GazetteDraft:
            return GazetteDraft(
                headline="The village keeps building",
                story_keys=["checkins", "competitions", "unlocks"],
            )
        if schema is TemplateDecision:
            return TemplateDecision(action="none", reason="Healthy village")
        recap = "kind must be recap" in instruction
        event_schema = MayorProposal if recap else TemplateProposal
        return event_schema(
            **({} if recap else {"template_id": "small_step"}),
            kind="recap" if recap else "challenge",
            title="A little win",
            body=" ".join(p["display_name"] for p in context["villagers"]) + ": keep going!",
            reward_xp=0 if recap else 50,
            penalty=None,
        )

    async def synthesize(*args):
        return b"ID3mock-audio"

    monkeypatch.setattr(Mayor, "generate", generate)
    monkeypatch.setattr("app.voice.synthesize", synthesize)


@pytest_asyncio.fixture
async def api(test_database, tmp_path):
    settings, schema = test_database
    # Every table name is discovered in this run's private schema. No shared test data is erased.
    with psycopg.connect(settings.database_url) as conn:
        tables = conn.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname=%s AND tablename <> 'api_migrations'",
            (schema,),
        )
        names = [sql.Identifier(schema, row[0]) for row in tables.fetchall()]
        conn.execute(sql.SQL("TRUNCATE {} CASCADE").format(sql.SQL(",").join(names)))
        seed(conn)
    from app.security import DailyLimiter

    settings = replace(settings, asset_dir=Path(tmp_path), cost_limiter=DailyLimiter())
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
            headers={"X-Demo-User": str(SEED_USERS[0][0])},
        ) as client:
            yield client, app


@pytest_asyncio.fixture
async def outsider(api):
    client, app = api
    uid = uuid4()
    async with app.state.pool.connection() as conn:
        await one(
            conn,
            """INSERT INTO users (id,auth_issuer,auth_subject,display_name)
            VALUES (%s,'test',%s,'Outsider') RETURNING id""",
            (uid, str(uid)),
        )
    return {"X-Demo-User": str(uid)}


VID = str(VILLAGE_ID)
