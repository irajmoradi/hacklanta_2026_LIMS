from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError
from test_api003 import BASE, USERS, auth, photo

from app.competition_models import CompetitionCreate, Entry, EntryDecision
from app.competition_scoring import score_competition


@pytest.mark.parametrize(
    "terms",
    [
        {"scoring": "unknown"},
        {"scoring": "scoreboard"},
        {"scoring": "scoreboard", "unit": " "},
        {"target": 1},
        {"scoring": "ordinal", "target": 0},
        {"scoring": "ordinal", "target": float("inf")},
    ],
)
def test_invalid_terms(terms):
    with pytest.raises(ValidationError):
        CompetitionCreate(title="Test", terms="Terms", **terms)


def test_finite_values_and_rejection():
    with pytest.raises(ValidationError):
        Entry(body="x", idempotency_key="x", value=float("nan"))
    with pytest.raises(ValidationError):
        EntryDecision(decision="rejected", points=0, value=2, reason="No")


@pytest.mark.parametrize("mode", ["cumulative", "scoreboard", "ordinal"])
async def test_mode_end_to_end(api, monkeypatch, mode):
    client, app = api

    async def no_ai(*args):
        return None

    monkeypatch.setattr("app.competitions.review_entry", no_ai)
    terms = {
        "title": "Mode test",
        "terms": "Confirmed progress",
        "auditor_id": USERS[1],
        "scoring": mode,
    }
    if mode != "cumulative":
        terms.update(unit="hours", target=2.5)
    response = await client.post(BASE + "/competitions", json=terms)
    assert response.status_code == 200, response.text
    row = response.json()
    assert row["scoring"] == mode
    path = BASE + "/competitions/" + row["id"]
    await client.post(path + "/join")
    proof = await photo(client)
    payload = {"body": "Done", "evidence_asset_id": proof, "idempotency_key": "one"}
    if mode != "cumulative":
        assert (await client.post(path + "/entries", json=payload)).status_code == 422
        payload["value"] = 3.5
    response = await client.post(path + "/entries", json=payload)
    assert response.status_code == 200, response.text
    entry = response.json()
    assert (await client.post(path + "/entries", json=payload)).json()["id"] == entry["id"]
    assert (await client.post(path + "/settle", headers=auth(USERS[1]))).status_code == 409
    decision = {
        "decision": "confirmed",
        "points": 20 if mode == "cumulative" else 0,
        "reason": "Checked",
    }
    if mode != "cumulative":
        decision["value"] = 2.5
    endpoint = path + "/entries/" + entry["id"] + "/decision"
    assert (await client.post(endpoint, json=decision)).status_code == 403
    response = await client.post(endpoint, headers=auth(USERS[1]), json=decision)
    assert response.status_code == 200, response.text
    confirmed_at = response.json()["confirmed_at"]
    assert confirmed_at
    replay = await client.post(endpoint, headers=auth(USERS[1]), json=decision)
    assert replay.json()["confirmed_at"] == confirmed_at
    if mode != "cumulative":
        edited = await client.post(endpoint, headers=auth(USERS[1]), json={**decision, "value": 1})
        assert edited.json()["confirmed_at"] > confirmed_at
        await client.post(endpoint, headers=auth(USERS[1]), json=decision)
    result = (await client.post(path + "/settle", headers=auth(USERS[1]))).json()
    assert result["result"]["winners"] == [USERS[0]]
    assert result["result"]["scores"][0]["points"] == (20 if mode == "cumulative" else 2.5)
    assert (await client.post(path + "/settle", headers=auth(USERS[1]))).json() == result
    assert (await client.post(endpoint, headers=auth(USERS[1]), json=decision)).status_code == 409


def test_race_confirmation_order_submission_tie_and_no_finish():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    people = [{"user_id": "a"}, {"user_id": "b"}]
    entries = [
        {
            "id": uid,
            "user_id": uid,
            "decision": "confirmed",
            "value": 2,
            "points": 500,
            "created_at": now + timedelta(seconds=i),
            "confirmed_at": now + timedelta(seconds=10),
        }
        for i, uid in enumerate(["b", "a"])
    ]
    row = {"scoring": "ordinal", "target": 2}
    assert score_competition(row, people, entries)[1] == ["b"]
    entries[1]["confirmed_at"] = now + timedelta(seconds=5)
    assert score_competition(row, people, entries)[1] == ["a"]
    row["target"] = 3
    assert score_competition(row, people, entries)[1] == []
    entries.append(
        {**entries[0], "id": "extra", "value": 1, "confirmed_at": now + timedelta(seconds=20)}
    )
    assert score_competition(row, people, entries)[1] == ["b"]


@pytest.mark.parametrize("mode", ["cumulative", "scoreboard"])
def test_ties_rejected_pending_and_zero(mode):
    now = datetime.now(timezone.utc)
    people = [{"user_id": "a"}, {"user_id": "b"}]
    entries = [
        {
            "id": uid,
            "user_id": uid,
            "decision": "confirmed",
            "points": 4,
            "value": 2.5,
            "created_at": now,
        }
        for uid in ["a", "b"]
    ]
    entries.append({**entries[0], "decision": "pending", "points": 500, "value": 999})
    assert score_competition({"scoring": mode}, people, entries)[1] == ["a", "b"]
    assert score_competition({"scoring": mode}, people, [])[1] == []


@pytest.mark.parametrize("mode", ["scoreboard", "ordinal"])
async def test_friendly_modes_self_confirm_without_assets(api, mode):
    client, _ = api
    terms = {"title": "Friendly", "terms": "Complete", "friendly": True, "scoring": mode}
    if mode == "scoreboard":
        terms["unit"] = "km"
    response = await client.post(BASE + "/competitions", json=terms)
    assert response.status_code == 200
    path = BASE + "/competitions/" + response.json()["id"]
    await client.post(path + "/join")
    payload = {"body": "Complete", "idempotency_key": "done"}
    if mode == "scoreboard":
        payload["value"] = 1.25
    entry = (await client.post(path + "/entries", json=payload)).json()
    assert entry["decision"] == "confirmed"
    assert entry["value"] == (1.25 if mode == "scoreboard" else 1)
    result = (await client.post(path + "/settle")).json()["result"]
    assert result["winners"] == [USERS[0]]
    assert result["payments_executed"] is False
