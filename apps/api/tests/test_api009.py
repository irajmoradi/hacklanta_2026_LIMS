import asyncio
import json
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app import budget, disasters, mayor, memory, newspaper, scheduler
from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID
from app.events_table import TEMPLATES, TemplateDecision, TemplateProposal
from app.models import MayorProposal, NudgeProposal

BASE = f"/api/villages/{VILLAGE_ID}"
UID = SEED_USERS[0][0]
REAL_GENERATE = mayor.Mayor.generate


def proposal(key="small_step", **changes):
    table = TEMPLATES[key]
    return TemplateProposal.model_validate(
        {
            "template_id": key,
            "kind": "challenge",
            "title": "Together",
            "body": "Complete one activity together.",
            "reward_xp": table["xp"][0],
            "penalty": table["penalty"],
            **changes,
        }
    )


@pytest.mark.parametrize(
    "text",
    ["long" * 3000, "😀日本語" * 2000, '\\"\n' * 4000],
    ids=["ascii", "unicode", "escapes"],
)
def test_memory_compact_bound(text):
    result = memory.compact({"weeks": [text] * 30, "facts": [text] * 50, "recent": [text]})
    assert len(json.dumps(result).encode()) <= 1400
    assert set(result) == {"weeks", "facts", "recent"}


@pytest.mark.parametrize("key", list(TEMPLATES)[:-1])
def test_template_bounds(key):
    assert proposal(key)
    with pytest.raises(ValidationError):
        proposal(key, reward_xp=TEMPLATES[key]["xp"][1] + 1)
    with pytest.raises(ValidationError):
        proposal(key, penalty="crater" if key != "village_project" else None)


async def test_insert_rejects_unvetted_and_mutated(api):
    _, app = api
    async with app.state.pool.connection() as conn:
        legacy = MayorProposal(
            kind="challenge", title="Free XP", body="No", reward_xp=500, penalty=None
        )
        with pytest.raises(ValueError):
            await mayor.insert_event(conn, VILLAGE_ID, UID, legacy, "mock")
        changed = proposal()
        changed.reward_xp = 499
        with pytest.raises(ValueError):
            await mayor.insert_event(conn, VILLAGE_ID, UID, changed, "mock")


async def test_prayer_template_and_award_once(api, monkeypatch):
    client, app = api

    async def generate(self, schema, instruction, context):
        assert schema is TemplateProposal and "template_id" in instruction
        assert context["prayer"] == "Help me start"
        return proposal()

    monkeypatch.setattr(mayor.Mayor, "generate", generate)
    response = await client.post(BASE + "/mayor/pray", json={"text": "Help me start"})
    assert response.status_code == 200
    event = response.json()
    assert event["template_id"] == "small_step" and event["reward_xp"] == 25

    async def complete():
        return await client.post(
            BASE + f"/events/{event['id']}/complete", json={"user_ids": [str(UID)]}
        )

    replies = await asyncio.gather(complete(), complete())
    assert sorted(r.json()["xp_awarded"] for r in replies) == [0, 25]
    document = (await client.get(BASE + "/mayor/memory")).json()["document"]
    assert any(r["status"] == "completed" for r in document["recent"])


async def test_memory_weeks_recaps_and_repeat_evidence(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        for offset in (14, 7):
            await conn.execute(
                "INSERT INTO weekly_audits(village_id,week_start,status,winner_id) "
                "VALUES(%s,%s,'finalized',%s)",
                (VILLAGE_ID, date.today() - timedelta(days=offset), UID),
            )
        for _ in range(3):
            await conn.execute(
                "INSERT INTO check_ins"
                "(village_id,user_id,kind,body,evidence_asset_id,idempotency_key) "
                "VALUES(%s,%s,'status','A recorded update','synthetic-evidence',%s)",
                (VILLAGE_ID, UID, str(uuid4())),
            )
    response = await client.post(BASE + "/mayor/recap")
    assert response.status_code == 200
    result = (await client.get(BASE + "/mayor/memory")).json()
    assert len(result["document"]["weeks"]) == 2
    fact = next(f for f in result["document"]["facts"] if f["villager"] == str(UID))
    assert fact["wins"] == 2 and fact["reused_evidence"] == 2
    assert any(r["kind"] == "recap" for r in result["document"]["recent"])
    assert len(json.dumps(result["document"]).encode()) <= 1400
    async with app.state.pool.connection() as conn:
        assert (
            await one(
                conn,
                "SELECT octet_length(document::text) AS n FROM mayor_memory WHERE village_id=%s",
                (VILLAGE_ID,),
            )
        )["n"] <= 1400


async def test_every_generate_loads_memory(api, monkeypatch):
    _, app = api
    captured = []

    async def provider(self, schema, instruction, context):
        captured.append(context)
        return proposal()

    monkeypatch.setattr(mayor.Mayor, "openrouter", provider)
    app.state.settings.llm_provider = "openrouter"
    token = budget.village_context.set(VILLAGE_ID)
    try:
        await REAL_GENERATE(mayor.Mayor(app.state.settings), TemplateProposal, "Test", {})
    finally:
        budget.village_context.reset(token)
    assert captured[0]["mayor_memory"]["facts"]


@pytest.mark.parametrize(
    "path",
    ["/mayor/memory", "/mayor/event-templates", "/mayor/effects", "/gazette", "/gazette/latest"],
)
async def test_membership(api, outsider, path):
    client, _ = api
    assert (await client.get(BASE + path, headers=outsider)).status_code == 403
    assert (await client.get(f"/api/villages/{uuid4()}" + path)).status_code == 403


async def test_gazette_concurrent_daily_and_consent(api, monkeypatch):
    client, app = api
    calls = []

    async def generate(self, schema, instruction, context):
        assert schema is newspaper.GazetteDraft
        assert "mayor_memory" in context
        calls.append(True)
        self.last_source = "mock-editor"
        return newspaper.GazetteDraft(
            headline="Small steps, big village energy",
            story_keys=["checkins", "competitions", "unlocks"],
            gossip_target=UID,
        )

    monkeypatch.setattr(mayor.Mayor, "generate", generate)
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET roast_ok=true WHERE id=%s", (UID,))

    async def publish():
        async with app.state.pool.connection() as conn:
            return await newspaper.publish(conn, app.state.settings, VILLAGE_ID)

    editions = await asyncio.gather(*(publish() for _ in range(4)))
    assert len(calls) == 1 and len({row["id"] for row in editions}) == 1
    result = (await client.get(BASE + "/gazette/latest")).json()
    assert result["ai_generated"] and result["model"] == "mock-editor:gazette-v1"
    assert len(result["content"]["stories"]) == 3
    assert result["content"]["gossip"]["target_user_id"] == str(UID)
    await client.patch("/api/me", json={"roast_ok": False})
    result = (await client.get(BASE + "/gazette/latest")).json()
    assert result["content"]["gossip"] == {"target_user_id": None, "text": newspaper.QUIET_GOSSIP}
    assert len((await client.get(BASE + "/gazette?limit=1")).json()) == 1
    assert (await client.get(BASE + "/gazette?limit=31")).status_code == 422
    assert len(calls) == 1  # GETs never generate.
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE village_gazettes SET edition_date=edition_date-1")
    await publish()
    assert len(calls) == 2
    assert len((await client.get(BASE + "/gazette")).json()) == 2


@pytest.mark.parametrize("failure", ["consent", "source", "budget"])
async def test_gazette_safe_fallback(api, monkeypatch, failure):
    client, app = api
    calls = []

    async def generate(self, schema, instruction, context):
        calls.append(True)
        if failure == "budget":
            raise budget.BudgetExceeded()
        return newspaper.GazetteDraft(
            headline="A quiet day in the village",
            story_keys=["invented", "competitions", "unlocks"]
            if failure == "source"
            else ["checkins", "competitions", "unlocks"],
            gossip_target=UID,
        )

    monkeypatch.setattr(mayor.Mayor, "generate", generate)
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE users SET roast_ok=false")
        await newspaper.publish(conn, app.state.settings, VILLAGE_ID)
    async with app.state.pool.connection() as conn:
        await newspaper.publish(conn, app.state.settings, VILLAGE_ID)
    result = (await client.get(BASE + "/gazette/latest")).json()
    assert result["model"] == "fallback:gazette-v1" and len(calls) == 1
    assert result["content"]["gossip"]["target_user_id"] is None
    assert len(result["content"]["stories"]) == 3


@pytest.mark.parametrize("key", ["buddy_chat", "game_night", "village_project", "weekend_build"])
@pytest.mark.parametrize("kind", ["scorch", "outbreak", "blackout", "blight"])
async def test_penalties_recover(api, monkeypatch, key, kind):
    client, app = api
    # Disaster selection is independent of the template's legacy penalty.
    monkeypatch.setattr(disasters, "choose", lambda last: kind)
    async with app.state.pool.connection() as conn:
        event = await mayor.insert_event(conn, VILLAGE_ID, UID, proposal(key), "mock")
        await conn.execute(
            "UPDATE mayor_events SET ends_at=now()-interval '1 second' WHERE id=%s", (event["id"],)
        )
    state = (await client.get(BASE + "/mayor/effects")).json()
    world = (await client.get(BASE)).json()["world"]
    disaster = world["disaster"]
    assert disaster["kind"] == kind
    assert state["weather"] == ("rain" if kind == "blackout" else "clear")
    if kind == "blackout":
        assert world["time_of_day"] == "night"
    assert world["gardening_available"] == (kind != "blight")
    assert disaster["closed_building"] == ("pet_shelter" if kind == "scorch" else None)
    assert (disaster["target_checkins"], disaster["target_people"]) == (6, 3)
    # This matrix preserves legacy penalty/rolling-check-in recovery coverage.
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE village_world SET disaster=disaster-'repair_plan' WHERE village_id=%s", (VILLAGE_ID,))
    repair = next(r for r in state["repairs"] if r["event_id"] == str(event["id"]))
    assert repair["repair_event_id"] == disaster["repair_event_id"]
    result = await client.post(
        BASE + f"/events/{repair['repair_event_id']}/complete", json={"user_ids": [str(UID)]}
    )
    assert result.status_code == 409
    assert "shared check-ins" in result.json()["detail"]
    for uid, *_ in SEED_USERS[:3]:
        for _ in range(2):
            result = await client.post(
                BASE + "/check-ins",
                headers={"X-Demo-User": str(uid)},
                json={
                    "kind": "status",
                    "body": "Repair contribution",
                    "idempotency_key": str(uuid4()),
                },
            )
            assert result.status_code == 200
    state = (await client.get(BASE + "/mayor/effects")).json()
    world = (await client.get(BASE)).json()["world"]
    assert world["disaster"] is None and world["rebuilt_at"]
    assert not state["repairs"] and not state["pet_sad"] and not state["house_downgrade"]
    assert not state["crater"]
    assert state["weather"] == "clear" and world["gardening_available"]
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT status FROM mayor_events WHERE id=%s", (event["id"],)))[
            "status"
        ] == "failed"
        assert (
            await one(
                conn, "SELECT status FROM mayor_events WHERE id=%s", (repair["repair_event_id"],)
            )
        )["status"] == "completed"


async def test_scheduler_daily_and_template(api, monkeypatch):
    client, app = api
    calls = []

    async def generate(self, schema, instruction, context):
        calls.append(schema)
        if schema is newspaper.GazetteDraft:
            return newspaper.GazetteDraft(
                headline="The village keeps building",
                story_keys=["checkins", "competitions", "unlocks"],
            )
        return TemplateDecision(action="event", reason="Small step", event=proposal())

    monkeypatch.setattr(mayor.Mayor, "generate", generate)
    async with app.state.pool.connection() as conn:
        await conn.execute("DELETE FROM mayor_events")
    await asyncio.gather(*(scheduler.tick(app.state.pool, app.state.settings) for _ in range(2)))
    assert calls.count(newspaper.GazetteDraft) == 1
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT count(*) AS n FROM mayor_events"))["n"] == 1
    assert (await client.get(BASE + "/gazette/latest")).status_code == 200


async def test_migration_idempotent(api):
    _, app = api
    raw = (Path(__file__).parents[1] / "migrations/009_mayor.sql").read_bytes()
    assert not raw.startswith(b"\xef\xbb\xbf")
    async with app.state.pool.connection() as conn:
        await conn.execute(raw.decode())
        await conn.execute(raw.decode())


async def test_real_global_budget_blocks_gazette_without_retry(api, monkeypatch):
    client, app = api
    app.state.settings.llm_provider = "openrouter"
    app.state.settings.llm_max_calls_per_hour = 0
    attempts = []

    async def provider(self, schema, instruction, context):
        attempts.append(True)
        await budget.reserve(self.settings)
        raise AssertionError("Zero budget must block before any network call")

    monkeypatch.setattr(mayor.Mayor, "generate", REAL_GENERATE)
    monkeypatch.setattr(mayor.Mayor, "openrouter", provider)
    for _ in range(2):
        async with app.state.pool.connection() as conn:
            await asyncio.wait_for(newspaper.publish(conn, app.state.settings, VILLAGE_ID), 5)
    assert attempts == [True]
    result = (await client.get(BASE + "/gazette/latest")).json()
    assert result["model"] == "fallback:gazette-v1"


async def test_invalid_scheduler_event_preserves_daily_edition(api, monkeypatch):
    client, app = api

    async def generate(self, schema, instruction, context):
        if schema is newspaper.GazetteDraft:
            return newspaper.GazetteDraft(
                headline="The village keeps building",
                story_keys=["checkins", "competitions", "unlocks"],
            )
        changed = proposal()
        changed.reward_xp = 500
        return TemplateDecision.model_construct(action="event", reason="Bad reward", event=changed)

    monkeypatch.setattr(mayor.Mayor, "generate", generate)
    async with app.state.pool.connection() as conn:
        await conn.execute("DELETE FROM mayor_events")
    await scheduler.tick(app.state.pool, app.state.settings)
    assert (await client.get(BASE + "/gazette/latest")).status_code == 200
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT count(*) AS n FROM mayor_events"))["n"] == 0


async def test_scheduler_nudge_consent_and_cap_with_daily_editor(api, monkeypatch):
    _, app = api
    target = SEED_USERS[1][0]
    app.state.settings.mayor_voice = False
    nudge_instructions = []
    editions = []

    async def generate(self, schema, instruction, context):
        if schema is newspaper.GazetteDraft:
            editions.append(True)
            return newspaper.GazetteDraft(
                headline="The village keeps building",
                story_keys=["checkins", "competitions", "unlocks"],
            )
        if schema is TemplateDecision:
            return TemplateDecision(action="nudge", target_user_id=target, reason="Idle friend")
        assert schema is NudgeProposal
        nudge_instructions.append(instruction)
        return NudgeProposal(text="You can do it!")

    monkeypatch.setattr(mayor.Mayor, "generate", generate)
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET roast_ok=false,agent_msgs_ok=true,phone_e164='+15555550111' "
            "WHERE id=%s",
            (target,),
        )
        await conn.execute("DELETE FROM check_ins WHERE user_id=%s", (target,))
    for _ in range(4):
        await scheduler.tick(app.state.pool, app.state.settings)
        async with app.state.pool.connection() as conn:
            await conn.execute(
                "UPDATE activity_events SET created_at=now()-interval '10 minutes' "
                "WHERE type='agent_decision' AND payload->>'agent'='scheduler'"
            )
    assert editions == [True]
    assert len(nudge_instructions) == 3
    assert all("No roasting" in text for text in nudge_instructions)
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT count(*) AS n FROM mayor_outbox"))["n"] == 3
