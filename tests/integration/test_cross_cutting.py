import asyncio
import io

import pytest
from PIL import Image
from app import budget


def auth(uid):
    return {"X-Demo-User": uid}


async def competition(client, base, auditor):
    response = await client.post(base + "/competitions", json={
        "title": "QA reading", "terms": "One point per verified chapter",
        "friendly": False, "auditor_id": auditor,
    })
    assert response.status_code == 200, response.text
    return base + "/competitions/" + response.json()["id"]


async def test_competition_evidence_retry_decision_settlement(qa_api):
    client, app, ids, base = qa_api
    path = await competition(client, base, ids[1])
    assert (await client.post(path + "/join")).status_code == 200
    image = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(image, "PNG")
    upload = await client.post(base + "/evidence", files={"file": ("qa.png", image.getvalue(), "image/png")})
    assert upload.status_code == 200
    key = upload.json()["evidence_asset_id"]
    assert (await client.get("/api/assets/" + key, headers=auth(ids[3]))).status_code == 403
    assert (await client.get("/api/assets/" + key)).status_code == 200
    body = {"body": "QA read chapter", "evidence_asset_id": key, "idempotency_key": "qa-entry"}
    first = await client.post(path + "/entries", json=body)
    assert first.status_code == 200, first.text
    entry = first.json()["id"]
    assert (await client.post(path + "/entries", json=body)).json()["id"] == entry
    detail = (await client.get(path)).json()
    assert len(detail["entries"]) == 1
    assert detail["entries"][0]["review"]["verdict"] == "verified"
    assert (await client.post(path + "/settle", headers=auth(ids[1]))).status_code == 409
    decision = {"decision": "confirmed", "points": 25, "reason": "QA human inspected evidence"}
    assert (await client.post(path + f"/entries/{entry}/decision", json=decision)).status_code == 403
    assert (await client.post(path + f"/entries/{entry}/decision", json=decision,
                              headers=auth(ids[1]))).status_code == 200
    results = await asyncio.gather(*(client.post(path + "/settle", headers=auth(ids[1])) for _ in range(3)))
    assert all(r.status_code == 200 for r in results)
    assert results[0].json()["result"]["winners"] == [ids[0]]
    assert results[0].json()["result"]["payments_executed"] is False
    async with app.state.pool.connection() as conn:
        ledger = await (await conn.execute("SELECT count(*) AS n,sum(delta) AS xp FROM xp_ledger WHERE reason='competition'")).fetchone()
    assert ledger == {"n": 1, "xp": 25}
    assert (await client.post(path + "/entries", json={**body, "idempotency_key": "late"})).status_code == 409


async def test_voice_line_enqueues_expression_without_gpu_execution(qa_api):
    client, app, ids, _ = qa_api
    response = await client.post("/api/voice/lines", json={"user_id": ids[0], "text": "QA synthetic speech"})
    assert response.status_code == 200, response.text
    line = response.json()
    assert line["job_id"] and line["expr_url"] is None
    async with app.state.pool.connection() as conn:
        job = await (await conn.execute("SELECT * FROM avatar_jobs WHERE id=%s", (line["job_id"],))).fetchone()
    assert job["stage"] == "voice_expr" and job["status"] == "queued" and job["attempts"] == 0
    assert job["input"]["line_id"] == line["id"] and job["input"]["user_id"] == ids[0]
    assert job["input"]["audio_key"] == line["audio_url"].removeprefix("/api/assets/")
    assert (await client.get("/api/voice/lines/" + line["id"], headers=auth(ids[2]))).status_code == 200
    assert (await client.get("/api/voice/lines/" + line["id"], headers=auth(ids[3]))).status_code == 403
    assert (await client.post("/api/voice/lines", headers=auth(ids[3]),
                               json={"user_id": ids[0], "text": "Forbidden"})).status_code == 403


async def test_membership_all_new_families_and_self_only_settings(qa_api):
    client, _, ids, base = qa_api
    outsider = auth(ids[3])
    week = (await client.get(base + "/weekly/current")).json()
    path = base + "/weekly/" + week["week_start"]
    goal = (await client.post(base + "/goals", json={"title": "QA goal"})).json()
    comp = await competition(client, base, ids[1])
    for url in [path, base + "/weekly/current", base + "/competitions", comp, base + "/agent-log"]:
        assert (await client.get(url, headers=outsider)).status_code == 403, url
    grade = {"ambition": 4, "evidence_quality": 4, "progress": 4, "completed": True, "rationale": "QA"}
    for url, body in [(path + "/finalize", {}), (path + "/insufficient", {"generation": 1}),
                      (path + f"/goals/{goal['id']}/grade", grade),
                      (path + f"/goals/{goal['id']}/suggestion", {}),
                      (base + "/competitions", {"title": "QA", "terms": "QA", "friendly": True}),
                      (comp + "/join", {}), (comp + "/settle", {}),
                      (comp + "/entries", {"body": "QA", "idempotency_key": "forbidden"})]:
        assert (await client.post(url, headers=outsider, json=body)).status_code == 403, url
    before = (await client.get("/api/me")).json()["user"]
    assert (await client.patch("/api/me", headers=outsider, json={"display_name": "QA·Changed"})).status_code == 200
    assert (await client.get("/api/me")).json()["user"] == before
    assert (await client.patch("/api/me", headers=outsider,
                               json={"user_id": ids[0], "display_name": "QA·Attack"})).status_code == 422
    assert (await client.get("/api/me", headers={"X-Demo-User": ""})).status_code == 401


async def test_budget_throttle_persists_and_is_visible_in_agent_log(qa_api):
    client, app, _, base = qa_api
    app.state.settings.llm_max_calls_per_hour = 1
    token = budget.village_context.set(base.rsplit("/", 1)[1])
    try:
        await budget.reserve(app.state.settings)
        for _ in range(2):
            with pytest.raises(budget.BudgetExceeded):
                await budget.reserve(app.state.settings)
    finally:
        budget.village_context.reset(token)
    logs = (await client.get(base + "/agent-log")).json()
    throttled = [r for r in logs if r["action"] == "throttled"]
    assert len(throttled) == 2
    assert all(r["model"] == "server" and "budget" in r["reason"].lower() for r in throttled)
    async with app.state.pool.connection() as conn:
        row = await (await conn.execute("SELECT calls FROM llm_hourly_budget")).fetchone()
    assert row["calls"] == 1
