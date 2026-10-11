import asyncio
from datetime import timedelta
from uuid import uuid4

from app.domain import SEED_USERS, VILLAGE_ID, monday

BASE = f"/api/villages/{VILLAGE_ID}"


async def test_stretch_lifecycle_cap_ownership_and_idempotency(api):
    client, app = api
    goal = (await client.post(BASE + "/goals", json={"title": "Run three times"})).json()
    path = BASE + f"/goals/{goal['id']}"
    legacy = {"kind": "progress", "body": "Base progress", "idempotency_key": "legacy-base"}
    response = await client.post(BASE + "/check-ins", json=legacy)
    assert response.status_code == 200
    assert response.json()["check_in"]["goal_id"] == goal["id"]
    assert (await client.post(path + "/stretch", json={})).status_code == 409
    assert (await client.post(path + "/status", json={"status": "done"})).status_code == 200
    legacy["idempotency_key"] = "legacy-closed"
    assert (await client.post(BASE + "/check-ins", json=legacy)).status_code == 422
    other = {"X-Demo-User": str(SEED_USERS[1][0])}
    assert (await client.post(path + "/stretch", json={}, headers=other)).status_code == 403
    assert (await client.post(BASE + f"/goals/{uuid4()}/stretch", json={})).status_code == 404
    for tier in range(1, 4):
        starts = await asyncio.gather(
            *[
                client.post(path + "/stretch", json={"title": f"Run {tier + 3} times"})
                for _ in range(3)
            ]
        )
        assert all(r.status_code == 200 for r in starts)
        assert len(starts[0].json()["stretches"]) == tier
        assert starts[0].json()["status"] == "stretch"
        assert (
            await client.post(path + "/stretch", json={"title": "Another target"})
        ).status_code == 409
        assert (
            await client.post(
                path + f"/stretch/{tier}/status", json={"status": "done"}, headers=other
            )
        ).status_code == 403
        assert (await client.post(path + "/status", json={"status": "missed"})).status_code == 409
        check = {
            "kind": "progress",
            "body": "Another run",
            "goal_id": goal["id"],
            "idempotency_key": str(uuid4()),
        }
        assert (await client.post(BASE + "/check-ins", json=check)).status_code == 422
        check["stretch_tier"] = tier
        response = await client.post(BASE + "/check-ins", json=check)
        assert response.status_code == 200, response.text
        assert response.json()["check_in"]["stretch_tier"] == tier
        ends = await asyncio.gather(
            *[
                client.post(path + f"/stretch/{tier}/status", json={"status": "done"})
                for _ in range(3)
            ]
        )
        assert all(r.status_code == 200 for r in ends)
        assert ends[0].json()["stretch_bonus"] == tier
        assert (await client.post(BASE + "/check-ins", json=check)).json()["xp_awarded"] == 0
    assert (await client.post(path + "/stretch", json={})).status_code == 409
    async with app.state.pool.connection() as conn:
        for table in ("xp_ledger", "coin_ledger"):
            row = await (
                await conn.execute(
                    f"SELECT count(*),sum(delta) FROM {table} WHERE reason='goal_stretch'"
                )
            ).fetchone()
            assert row == {"count": 3, "sum": 30}
    profile = (await client.get(BASE + f"/users/{goal['user_id']}")).json()
    assert len(profile["goal"]["stretches"]) == 3
    feed = (await client.get(BASE + "/feed")).json()
    assert len([f for f in feed if f["type"] == "stretch_completed"]) == 3
    accomplishments = (await client.get(BASE + "/accomplishments")).json()
    assert len([f for f in accomplishments if f["type"] == "stretch_completed"]) == 3


async def test_weekly_stretch_bonus_and_closed_week(api):
    client, app = api
    week = (await client.get(BASE + "/weekly/current")).json()
    judge = {"X-Demo-User": week["auditor_id"]}
    competitors = [str(u[0]) for u in SEED_USERS if str(u[0]) != week["auditor_id"]]
    uid = max(competitors)  # Lose the UUID tiebreak without the bonus.
    headers = {"X-Demo-User": uid}
    goal = (await client.post(BASE + "/goals", headers=headers, json={"title": "Walk"})).json()
    path = BASE + f"/goals/{goal['id']}"
    await client.post(path + "/status", headers=headers, json={"status": "done"})
    await client.post(path + "/stretch", headers=headers, json={})
    await client.post(path + "/stretch/1/status", headers=headers, json={"status": "done"})
    state = (await client.get(BASE + "/weekly/current")).json()
    weekpath = BASE + f"/weekly/{week['week_start']}"
    for g in state["goals"]:
        if not g["excluded"]:
            result = await client.post(
                weekpath + f"/goals/{g['id']}/grade",
                headers=judge,
                json={
                    "ambition": 3,
                    "evidence_quality": 3,
                    "progress": 3,
                    "completed": True,
                    "rationale": "Reviewed base and stretch evidence",
                },
            )
            assert result.status_code == 200
    result = await client.post(weekpath + "/finalize", headers=judge)
    assert result.status_code == 200, result.text
    assert result.json()["winner_id"] == uid
    assert (await client.post(path + "/stretch", headers=headers, json={})).status_code == 409
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE goals SET week_start=%s WHERE id=%s", (monday() - timedelta(days=7), goal["id"])
        )
    assert (await client.post(path + "/stretch", headers=headers, json={})).status_code == 409
