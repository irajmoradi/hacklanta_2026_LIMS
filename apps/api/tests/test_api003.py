import asyncio
import copy
import io
import json
from datetime import timedelta
from uuid import uuid4

import httpx
import pytest
from PIL import Image
from pydantic import ValidationError

from app import auditor
from app.competition_models import Grade
from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID, monday
from app.mayor import Mayor, normalize_proposal
from app.models import EvidenceReview, MayorProposal, NudgeProposal

BASE = f"/api/villages/{VILLAGE_ID}"
USERS = [str(u[0]) for u in SEED_USERS]
RUBRIC = dict(
    ambition=4,
    evidence_quality=3,
    progress=5,
    completed=True,
    rationale="Verified the work in person.",
)


def auth(uid):
    return {"X-Demo-User": str(uid)}


async def setup_week(client):
    row = (await client.get(BASE + "/weekly/current")).json()
    return row, BASE + "/weekly/" + row["week_start"]


async def make_goal(client, uid):
    response = await client.post(
        BASE + "/goals",
        headers=auth(uid),
        json={"title": "Read a book", "detail": "Read all 12 chapters"},
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_weekly_awards_suggestions_and_concurrency(api, monkeypatch):
    client, app = api
    row, path = await setup_week(client)
    who = row["auditor_id"]
    participant = next(u for u in USERS if u != who)
    goal = await make_goal(client, participant)
    own = await make_goal(client, who)
    h = auth(who)
    assert (
        await client.post(path + "/goals/" + own["id"] + "/grade", headers=h, json=RUBRIC)
    ).status_code == 409
    assert (
        await client.post(
            path + "/goals/" + goal["id"] + "/grade", headers=auth(participant), json=RUBRIC
        )
    ).status_code == 403
    assert (await client.post(path + "/finalize", headers=h)).status_code == 409
    calls = []

    async def generate(self, schema, instruction, context):
        calls.append(context)
        self.last_source = "mock-grade"
        return Grade(**RUBRIC)

    monkeypatch.setattr(Mayor, "generate", generate)
    for _ in range(2):
        suggested = await client.post(path + "/goals/" + goal["id"] + "/suggestion", headers=h)
        assert suggested.status_code == 200, suggested.text
        assert suggested.json()["suggestion"] == RUBRIC
    assert len(calls) == 1 and calls[0]["goal"]["title"] == "Read a book"
    assert (
        await client.post(path + "/goals/" + goal["id"] + "/grade", headers=h, json=RUBRIC)
    ).status_code == 200
    for other in (await client.get(path)).json()["goals"]:
        if not other["excluded"] and other["id"] != goal["id"]:
            await client.post(
                path + "/goals/" + other["id"] + "/grade",
                headers=h,
                json={**RUBRIC, "completed": False},
            )
    responses = await asyncio.gather(
        *(client.post(path + "/finalize", headers=h) for _ in range(3))
    )
    assert all(r.status_code == 200 for r in responses), [r.text for r in responses]
    assert all(r.json()["winner_id"] == participant for r in responses)
    assert responses[0].json()["stars"] == [participant]
    async with app.state.pool.connection() as conn:
        ledger = await one(
            conn,
            """SELECT count(*) AS n,sum(delta) AS xp FROM xp_ledger
            WHERE source_key LIKE 'weekly:%%'""",
        )
    assert ledger == {"n": 1, "xp": 100}
    village = (await client.get(BASE)).json()["villagers"]
    winner = next(v for v in village if v["user_id"] == participant)
    assert winner["has_crown"] and winner["star_badges"][0]["kind"] == "star"
    assert sum(v["has_crown"] for v in village) == 1
    assert (
        await client.post(path + "/goals/" + goal["id"] + "/grade", headers=h, json=RUBRIC)
    ).status_code == 409
    logs = (await client.get(BASE + "/agent-log")).json()
    assert any(log["action"] == "weekly_pregrade" and log["model"] == "mock-grade" for log in logs)


async def test_majority_replacement_stale_votes_penalty_expiry(api):
    client, app = api
    row, path = await setup_week(client)
    old = row["auditor_id"]
    voters = [u for u in USERS if u != old]
    for uid in voters[:2]:
        response = await client.post(
            path + "/insufficient", headers=auth(uid), json={"generation": 1}
        )
        assert response.status_code == 200, response.text
        assert response.json()["auditor_id"] == old
    duplicate = await client.post(
        path + "/insufficient", headers=auth(voters[0]), json={"generation": 1}
    )
    assert duplicate.json()["votes"] == 2
    response = await client.post(
        path + "/insufficient", headers=auth(voters[2]), json={"generation": 1}
    )
    assert response.json()["auditor_id"] != old and response.json()["generation"] == 2
    assert (
        await client.post(path + "/insufficient", headers=auth(voters[3]), json={"generation": 1})
    ).status_code == 409
    assert (await client.post(path + "/finalize", headers=auth(old))).status_code == 403
    profile = (await client.get(BASE + "/users/" + old)).json()["villager"]
    assert profile["pet_sad"]
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE auditor_penalties SET expires_at=now()-interval '1 second'")
    assert not (await client.get(BASE + "/users/" + old)).json()["villager"]["pet_sad"]


async def test_week_rotation_membership_and_invalid_dates(api, outsider):
    client, app = api
    assert (await client.get(BASE + "/weekly/current", headers=outsider)).status_code == 403
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO weekly_audits(village_id,week_start,auditor_id) VALUES(%s,%s,%s)",
            (VILLAGE_ID, monday() - timedelta(days=7), USERS[0]),
        )
    rows = await asyncio.gather(*(client.get(BASE + "/weekly/current") for _ in range(3)))
    assert len({r.json()["id"] for r in rows}) == 1
    assert rows[0].json()["auditor_id"] != USERS[0]
    assert (
        await client.get(BASE + "/weekly/" + str(monday() + timedelta(days=1)))
    ).status_code == 422
    assert (
        await client.get(BASE + "/weekly/" + str(monday() - timedelta(days=14)))
    ).status_code == 404


async def test_grade_bounds_and_fallback(api):
    client, _ = api
    row, path = await setup_week(client)
    goal = await make_goal(client, next(u for u in USERS if u != row["auditor_id"]))
    route = path + "/goals/" + goal["id"]
    for patch in ({"ambition": 0}, {"progress": 6}, {"evidence_quality": "4"}, {"rationale": ""}):
        assert (
            await client.post(
                route + "/grade", headers=auth(row["auditor_id"]), json={**RUBRIC, **patch}
            )
        ).status_code == 422
    # Automatic provider mock does not implement Grade: the endpoint must degrade safely.
    response = await client.post(route + "/suggestion", headers=auth(row["auditor_id"]))
    assert response.json()["model"] == "fallback"
    assert not response.json()["suggestion"]["completed"]
    assert (
        await client.post(
            path + "/goals/" + str(uuid4()) + "/grade", headers=auth(row["auditor_id"]), json=RUBRIC
        )
    ).status_code == 404


async def make_competition(client, friendly=False):
    data = {"title": "Reading", "terms": "One point per chapter", "friendly": friendly}
    if not friendly:
        data.update(auditor_id=USERS[1], entry_lamports=0, auditor_fee_bps=250)
    response = await client.post(BASE + "/competitions", json=data)
    assert response.status_code == 200, response.text
    return response.json(), BASE + "/competitions/" + response.json()["id"]


async def photo(client, uid=USERS[0]):
    output = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(output, "PNG")
    return (
        await client.post(
            BASE + "/evidence",
            headers=auth(uid),
            files={"file": ("proof.png", output.getvalue(), "image/png")},
        )
    ).json()["evidence_asset_id"]


@pytest.mark.parametrize("verdict", ["verified", "suspicious", "rejected", "error"])
async def test_audited_competition_evidence_settlement(api, monkeypatch, verdict):
    client, app = api
    row, path = await make_competition(client)
    calls = []

    async def vision(*args):
        calls.append(args[-1])
        if verdict == "error":
            raise RuntimeError("mock provider failure")
        return EvidenceReview(verdict=verdict, confidence=0.8, reason="Synthetic review")

    monkeypatch.setattr(auditor, "vision", vision)
    key = await photo(client)
    payload = dict(body="Read three chapters", evidence_asset_id=key, idempotency_key="entry1")
    assert (await client.post(path + "/entries", json=payload)).status_code == 403
    assert (await client.post(path + "/join", headers=auth(USERS[1]))).status_code == 409
    joined = await client.post(path + "/join")
    assert joined.json()["participants"][0]["entry_lamports_intent"] == 0
    await client.post(path + "/join")
    assert len((await client.get(path)).json()["participants"]) == 1
    entry = await client.post(path + "/entries", json=payload)
    assert entry.status_code == 200, entry.text
    eid = entry.json()["id"]
    assert (await client.post(path + "/entries", json=payload)).json()["id"] == eid
    assert len(calls) == 1
    entries = (await client.get(path)).json()["entries"]
    assert entries[0]["review"]["verdict"] == verdict
    assert entries[0]["decision"] == "pending"
    assert (await client.post(path + "/settle", headers=auth(USERS[1]))).status_code == 409
    decision = {"decision": "confirmed", "points": 25, "reason": "I inspected the evidence"}
    assert (
        await client.post(path + "/entries/" + eid + "/decision", json=decision)
    ).status_code == 403
    assert (
        await client.post(
            path + "/entries/" + eid + "/decision", headers=auth(USERS[1]), json=decision
        )
    ).status_code == 200
    results = await asyncio.gather(
        *(client.post(path + "/settle", headers=auth(USERS[1])) for _ in range(3))
    )
    assert all(r.status_code == 200 for r in results)
    assert results[0].json()["result"]["winners"] == [USERS[0]]
    assert not results[0].json()["result"]["payments_executed"]
    async with app.state.pool.connection() as conn:
        ledger = await one(
            conn, "SELECT count(*) AS n,sum(delta) AS xp FROM xp_ledger WHERE reason='competition'"
        )
    assert ledger == {"n": 1, "xp": 25}
    assert (
        await client.post(path + "/entries", json={**payload, "idempotency_key": "late"})
    ).status_code == 409
    assert (
        await client.post(
            path + "/entries/" + eid + "/decision", headers=auth(USERS[1]), json=decision
        )
    ).status_code == 409
    assert any(
        log["action"] == "competition_evidence_review"
        for log in (await client.get(BASE + "/agent-log")).json()
    )


async def test_competition_ownership_friendly_and_validation(api, outsider):
    client, app = api
    row, path = await make_competition(client)
    assert (await client.get(path, headers=outsider)).status_code == 403
    await client.post(path + "/join")
    other_key = await photo(client, USERS[2])
    assert (
        await client.post(path + "/entries", json=dict(body="No proof", idempotency_key="x"))
    ).status_code == 422
    assert (
        await client.post(
            path + "/entries",
            json=dict(body="Not mine", evidence_asset_id=other_key, idempotency_key="x"),
        )
    ).status_code == 422
    assert (
        await client.post(
            BASE + "/competitions",
            json={"title": "x", "terms": "y", "friendly": True, "entry_lamports": 1},
        )
    ).status_code == 422
    assert (
        await client.post(
            BASE + "/competitions", json={"title": "x", "terms": "y", "auditor_fee_bps": 10001}
        )
    ).status_code == 422
    row, path = await make_competition(client, True)
    assert row["auditor_id"] is None and not row["participants"]
    for uid in USERS[:2]:
        await client.post(path + "/join", headers=auth(uid))
        assert (
            await client.post(
                path + "/entries",
                headers=auth(uid),
                json=dict(body="One chapter", idempotency_key="x"),
            )
        ).status_code == 200
    assert (await client.post(path + "/settle", headers=auth(USERS[1]))).status_code == 403
    settled = (await client.post(path + "/settle")).json()
    assert set(settled["result"]["winners"]) == set(USERS[:2])
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT count(*) AS n FROM xp_ledger WHERE reason='competition'"))[
            "n"
        ] == 0


@pytest.mark.parametrize(
    "raw",
    [
        {
            "proposal": {
                "type": "challenge",
                "title": "Tiny win",
                "description": "Take one step",
                "reward": "20",
                "penalty": "none",
            }
        },
        {
            "kind": "challenge",
            "title": "Tiny win",
            "body": "Take one step",
            "reward_xp": 20,
            "penalty": None,
        },
    ],
)
def test_deepseek_normalization(raw):
    result = normalize_proposal(MayorProposal, "```json\n" + json.dumps(raw) + "\n```")
    assert result.reward_xp == 20 and result.penalty is None


async def test_deepseek_repair_exactly_once(api, monkeypatch):
    _, app = api
    app.state.settings.openrouter_api_key = "mock"
    calls = []
    outputs = ['{"text": ""}', '{"message":"Try one small step"}']

    class Client:
        def __init__(self, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kw):
            calls.append(copy.deepcopy(kw["json"]))
            return httpx.Response(
                200,
                request=httpx.Request("POST", url),
                json={"choices": [{"message": {"content": outputs[min(len(calls) - 1, 1)]}}]},
            )

    monkeypatch.setattr("app.mayor.httpx.AsyncClient", Client)
    assert (
        await Mayor(app.state.settings).openrouter(NudgeProposal, "nudge", {})
    ).text == "Try one small step"
    assert len(calls) == 2 and "Concrete JSON example" in calls[0]["messages"][0]["content"]
    assert "Validation errors" in calls[1]["messages"][-1]["content"]
    calls.clear()
    outputs[:] = ['{"text":""}', '{"text":""}']
    with pytest.raises(ValidationError):
        await Mayor(app.state.settings).openrouter(NudgeProposal, "nudge", {})
    assert len(calls) == 2


@pytest.mark.parametrize("reward", [-1, 501, True, 1.5, "501"])
def test_normalization_preserves_reward_bounds(reward):
    with pytest.raises(ValidationError):
        normalize_proposal(
            MayorProposal,
            json.dumps(dict(kind="challenge", title="x", body="y", reward_xp=reward, penalty=None)),
        )


async def test_goal_edit_invalidates_grades_and_finalization_freezes_goal(api):
    client, _ = api
    row, path = await setup_week(client)
    h = auth(row["auditor_id"])
    uid = next(u for u in USERS if u != row["auditor_id"])
    goal = await make_goal(client, uid)
    await client.post(path + "/goals/" + goal["id"] + "/grade", headers=h, json=RUBRIC)
    await client.post(path + "/goals/" + goal["id"] + "/suggestion", headers=h)
    await client.post(BASE + "/goals", headers=auth(uid), json={"title": "Changed objective"})
    changed = next(g for g in (await client.get(path)).json()["goals"] if g["id"] == goal["id"])
    assert changed["grade"] is None and changed["suggestion"] is None
    for g in (await client.get(path)).json()["goals"]:
        if not g["excluded"]:
            await client.post(
                path + "/goals/" + g["id"] + "/grade",
                headers=h,
                json={**RUBRIC, "completed": False},
            )
    finalized = await client.post(path + "/finalize", headers=h)
    assert finalized.status_code == 200, finalized.text
    assert finalized.json()["winner_id"] is None and finalized.json()["stars"] == []
    assert (
        await client.post(BASE + "/goals", headers=auth(uid), json={"title": "Too late"})
    ).status_code == 409


async def test_weekly_tie_and_crown_transfer(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute(
            """INSERT INTO weekly_audits(village_id,week_start,auditor_id,status,winner_id)
          VALUES(%s,%s,%s,'finalized',%s)""",
            (VILLAGE_ID, monday() - timedelta(days=7), USERS[4], USERS[4]),
        )
    row, path = await setup_week(client)
    eligible = [u for u in USERS if u != row["auditor_id"]]
    for uid in eligible:
        goal = await make_goal(client, uid)
        response = await client.post(
            path + "/goals/" + goal["id"] + "/grade", headers=auth(row["auditor_id"]), json=RUBRIC
        )
        assert response.status_code == 200
    finalized = await client.post(path + "/finalize", headers=auth(row["auditor_id"]))
    assert finalized.json()["winner_id"] == min(eligible)
    assert set(finalized.json()["stars"]) == set(eligible)
    village = (await client.get(BASE)).json()["villagers"]
    assert [v["user_id"] for v in village if v["has_crown"]] == [min(eligible)]


async def test_rejected_competition_entry_and_empty_settle(api):
    client, _ = api
    _, path = await make_competition(client)
    await client.post(path + "/join")
    entry = await client.post(
        path + "/entries",
        json=dict(body="A claim", evidence_asset_id=await photo(client), idempotency_key="reject"),
    )
    route = path + "/entries/" + entry.json()["id"] + "/decision"
    h = auth(USERS[1])
    assert (
        await client.post(
            route, headers=h, json=dict(decision="rejected", points=1, reason="No evidence")
        )
    ).status_code == 422
    assert (
        await client.post(
            route, headers=h, json=dict(decision="rejected", points=0, reason="No evidence")
        )
    ).status_code == 200
    assert (await client.post(path + "/settle", headers=h)).json()["result"]["winners"] == []
    _, empty = await make_competition(client, True)
    assert (await client.post(empty + "/settle")).json()["result"] == dict(
        winners=[],
        scores=[],
        payments_executed=False,
        payouts={"currency": "lamports", "fee": "0", "payouts": [], "refund": True},
    )


async def test_solo_week_is_unassigned(api):
    client, _ = api
    new = (await client.post("/api/villages", json={"name": "Solo"})).json()["village"]["id"]
    route = f"/api/villages/{new}/weekly/current"
    assert (await client.get(route)).json()["auditor_id"] is None
