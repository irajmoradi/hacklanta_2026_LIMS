"""Gazette editorial contract, transport repair and explicit two-call demo proof."""

import json
import os
from copy import deepcopy
from uuid import uuid4

import httpx
import psycopg
import pytest
from psycopg.rows import dict_row
from pydantic import ValidationError

from app import budget, mayor, newspaper
from app.config import Settings
from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID

REAL_GENERATE = mayor.Mayor.generate
REAL_RESERVE = budget.reserve
UID = str(SEED_USERS[0][0])
BASE = f"/api/villages/{VILLAGE_ID}"


def edition(context):
    roster = {str(p["id"]): p for p in context["villagers"]}
    facts = [
        (k, f)
        for k, f in context["facts"].items()
        if f["source"] == "check_ins" and f.get("user_id") in roster
    ][:3]
    return {
        "headline": "Small steps crowd the front page",
        "body": "The village reports more progress; town hall is considering a bigger noticeboard.",
        "weather": "Clear — excellent visibility for the town hall noticeboard.",
        "stories": [
            {
                "text": f"{roster[f['user_id']]['display_name']} reports progress; "
                "the noticeboard has room for this small win.",
                "source_key": key,
                "user_id": f["user_id"],
            }
            for key, f in facts
        ],
        "gossip": {
            "text": "The town hall kettle is requesting its own press secretary.",
            "target_user_id": None,
        },
    }


def mock_transport(monkeypatch, app, change=None):
    calls = []
    monkeypatch.setattr(mayor.Mayor, "generate", REAL_GENERATE)
    app.state.settings.openrouter_api_key = "mock-only"
    app.state.settings.llm_provider = "openrouter"

    async def post(self, url, **kwargs):
        assert url == "https://openrouter.ai/api/v1/chat/completions"
        messages = kwargs["json"]["messages"]
        context = json.loads(messages[1]["content"])
        calls.append(deepcopy(messages))
        value = edition(context)
        if change:
            change(value, context, len(calls))
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={"choices": [{"message": {"content": json.dumps(value)}}]},
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    return calls


async def test_context_prose_and_current_consent(api, monkeypatch):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET roast_ok=true WHERE id=%s", (UID,))
        ci = await one(conn, "SELECT id FROM check_ins WHERE user_id=%s LIMIT 1", (UID,))
        await conn.execute(
            "INSERT INTO evidence_reviews(check_in_id,verdict,confidence,reason,model) "
            "VALUES(%s,'suspicious',0.6,'Needs a clearer photo','mock')",
            (ci["id"],),
        )
        await conn.execute(
            "INSERT INTO mayor_bribes(village_id,user_id,currency,xp,wish) "
            "VALUES(%s,%s,'xp',25,'A game night, please')",
            (VILLAGE_ID, UID),
        )
        await conn.execute(
            "INSERT INTO weekly_audits(village_id,week_start,status,winner_id) "
            "VALUES(%s,current_date-7,'finalized',%s)",
            (VILLAGE_ID, UID),
        )
        await conn.execute(
            "INSERT INTO external_accounts(user_id,provider,external_id,consent_at) "
            "VALUES(%s,'steam','private-account',now()-interval '1 day')",
            (UID,),
        )
        await conn.execute(
            "INSERT INTO activity_signals"
            "(user_id,village_id,provider,kind,title,minutes,started_at) "
            "VALUES(%s,%s,'steam','playing','Stardew Valley',30,now())",
            (UID, VILLAGE_ID),
        )

    def gossip(value, context, attempt):
        value["gossip"] = {
            "text": "Iraj, the town hall kettle would like your autograph.",
            "target_user_id": UID,
        }

    calls = mock_transport(monkeypatch, app, gossip)
    async with app.state.pool.connection() as conn:
        issue = await newspaper.publish(conn, app.state.settings, VILLAGE_ID)
        again = await newspaper.publish(conn, app.state.settings, VILLAGE_ID)
    assert issue["id"] == again["id"] and len(calls) == 1
    context = json.loads(calls[0][1]["content"])
    facts = context["facts"]
    assert {"goals", "mayor_bribes", "weekly_audits", "mayor_events", "activity_signals"} <= {
        f["source"] for f in facts.values()
    }
    assert any(f.get("evidence", {}).get("verdict") == "suspicious" for f in facts.values())
    assert context["mayor_memory"]["facts"] and "active_pack" in context["world"]
    assert "private-account" not in json.dumps(context)
    assert "phone_e164" not in json.dumps(context)
    result = (await client.get(BASE + "/gazette/latest")).json()["content"]
    assert result["body"] and " — " in result["weather"]
    assert all(s.get("user_id") and s["source"] == "check_ins" for s in result["stories"])
    assert result["gossip"]["text"].startswith("Iraj,")
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET roast_ok=false WHERE id=%s", (UID,))
    result = (await client.get(BASE + "/gazette/latest")).json()["content"]
    assert result["gossip"] == {"text": newspaper.QUIET_GOSSIP, "target_user_id": None}
    assert len(calls) == 1


@pytest.mark.parametrize(
    "fault", ["source", "duplicate", "user", "name", "consent", "second", "count", "extra", "blank"]
)
async def test_semantic_and_structural_repair(api, monkeypatch, fault):
    _, app = api

    def corrupt(value, context, attempt):
        if attempt > 1:
            return
        if fault == "source":
            value["stories"][0]["source_key"] = "invented"
        elif fault == "duplicate":
            value["stories"][1] = value["stories"][0]
        elif fault == "user":
            value["stories"][0]["user_id"] = str(uuid4())
        elif fault == "name":
            value["stories"][0]["text"] = "Someone made progress today."
        elif fault == "consent":
            value["gossip"] = {
                "text": "Iraj, your kettle has called the press.",
                "target_user_id": UID,
            }
        elif fault == "second":
            value["gossip"]["text"] = "Iraj and Lance have stolen the kettle's thunder."
        elif fault == "count":
            value["stories"] = value["stories"][:2]
        elif fault == "extra":
            value["stories"][0]["reward_xp"] = 500
        elif fault == "blank":
            value["body"] = " " * 30

    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET roast_ok=false")
    calls = mock_transport(monkeypatch, app, corrupt)
    async with app.state.pool.connection() as conn:
        result = await newspaper.publish(conn, app.state.settings, VILLAGE_ID)
    if fault in ("consent", "second"):
        # Consent violations are sanitized in place (anonymous town gossip), not repaired.
        assert len(calls) == 1
        assert "Iraj" not in result["content"]["gossip"]["text"]
    else:
        assert len(calls) == 2 and "Repair the JSON" in calls[1][-1]["content"]
    assert result["model"] != "fallback:gazette-v1"
    assert result["content"]["gossip"]["target_user_id"] is None


async def test_failed_repair_is_cached_and_never_fails_over(api, monkeypatch):
    _, app = api

    def corrupt(value, context, attempt):
        value["stories"][0]["source_key"] = "never-a-source"

    calls = mock_transport(monkeypatch, app, corrupt)
    app.state.settings.google_api_key = "must-not-be-used"
    async with app.state.pool.connection() as conn:
        issue = await newspaper.publish(conn, app.state.settings, VILLAGE_ID)
        await newspaper.publish(conn, app.state.settings, VILLAGE_ID)
    assert len(calls) == 2
    assert issue["model"] == "fallback:gazette-v1"
    assert issue["content"]["provenance"]["fallback_reason"] == "ValidationError"
    assert newspaper._editor_context.get() is None


async def test_external_optout_and_unlinked_are_excluded(api):
    _, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO activity_signals"
            "(user_id,village_id,provider,kind,title,minutes,started_at) "
            "VALUES(%s,%s,'steam','playing','Private game',30,now())",
            (UID, VILLAGE_ID),
        )
        context = await mayor.context_for(conn, VILLAGE_ID)
        extra = await newspaper.editorial_context(conn, VILLAGE_ID, context, {})
        assert not any(f["source"] == "activity_signals" for f in extra["facts"].values())
        await conn.execute(
            "INSERT INTO external_accounts(user_id,provider,external_id,consent_at) "
            "VALUES(%s,'steam','hidden',now()-interval '1 day')",
            (UID,),
        )
        await conn.execute(
            "INSERT INTO external_activity_preferences(user_id,opted_out) VALUES(%s,true)",
            (UID,),
        )
        extra = await newspaper.editorial_context(conn, VILLAGE_ID, context, {})
        assert not any(f["source"] == "activity_signals" for f in extra["facts"].values())


async def test_gemini_repairs_once(monkeypatch):
    calls = []

    async def gemini(self, schema, instruction, context):
        calls.append(instruction)
        if len(calls) == 1:
            raise ValidationError.from_exception_data("GazetteEdition", [])
        return "repaired"

    monkeypatch.setattr(mayor.Mayor, "gemini", gemini)
    adapter = newspaper.GazetteEditor(Settings(database_url="", llm_provider="gemini"))
    assert await adapter.gemini(newspaper.GazetteDraft, "Edit.", {}) == "repaired"
    assert len(calls) == 2 and "Repair" in calls[-1]


async def test_operator_refresh_preserves_id_and_scheduler_cache(api, monkeypatch):
    _, app = api
    calls = mock_transport(monkeypatch, app)
    async with app.state.pool.connection() as conn:
        first = await newspaper.publish(conn, app.state.settings, VILLAGE_ID)
        refreshed = await newspaper.publish(conn, app.state.settings, VILLAGE_ID, refresh=True)
        cached = await newspaper.publish(conn, app.state.settings, VILLAGE_ID)
    assert first["id"] == refreshed["id"] == cached["id"]
    assert len(calls) == 2


@pytest.mark.skipif(os.getenv("API012_LIVE_GAZETTE") != "1", reason="Explicit paid demo proof only")
async def test_live_demo_gazette(monkeypatch):
    # Explicit opt-in refreshes the configured demo, not the isolated test seed.
    # Any failed assertion rolls back, retaining the prior live edition.
    settings = Settings.from_env()
    calls = 0

    async def bounded(settings):
        nonlocal calls
        if calls >= 2:
            raise budget.BudgetExceeded("API-012 two-call demo ceiling")
        calls += 1
        await REAL_RESERVE(settings)

    monkeypatch.setattr(budget, "reserve", bounded)
    monkeypatch.setattr(mayor.Mayor, "generate", REAL_GENERATE)
    async with await psycopg.AsyncConnection.connect(
        settings.database_url, row_factory=dict_row, connect_timeout=5
    ) as conn:
        village = await one(conn, "SELECT name FROM villages WHERE id=%s", (VILLAGE_ID,))
        assert village and village["name"] == "Hacklanta Crew"
        issue = await newspaper.publish(conn, settings, VILLAGE_ID, refresh=True)
        print(f"API012_LIVE calls={calls} model={issue['model']}")
        print(f"edition={issue['id']} date={issue['edition_date']}")
        print(
            json.dumps(
                {
                    "headline": issue["content"]["headline"],
                    "stories": len(issue["content"]["stories"]),
                    "provenance": issue["content"]["provenance"],
                },
                ensure_ascii=True,
            )
        )
        assert issue["model"] != "fallback:gazette-v1"
        assert issue["content"]["body"]
        assert all(s.get("user_id") for s in issue["content"]["stories"])
