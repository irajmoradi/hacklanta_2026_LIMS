import asyncio
from pathlib import Path
from uuid import uuid4

import pytest

from app import domain
from app.auth import require_member
from app.reactions import PALETTE

BASE = f"/api/villages/{domain.VILLAGE_ID}"
OWNER, FRIEND = [str(u[0]) for u in domain.SEED_USERS[:2]]


async def test_completion_idempotency_order_and_goal_reactions(api):
    client, _ = api
    goal = (await client.post(BASE + "/goals", json={"title": "Ship a little joy"})).json()
    path = BASE + "/goals/" + goal["id"] + "/status"
    replies = await asyncio.gather(*(client.post(path, json={"status": "done"}) for _ in range(3)))
    assert all(r.status_code == 200 for r in replies)
    assert len({r.json()["completed_at"] for r in replies}) == 1
    events = (await client.get(BASE + "/feed?limit=200")).json()
    matching = [
        e for e in events if e["type"] == "goal_completed" and e["payload"]["goal_id"] == goal["id"]
    ]
    assert len(matching) == 1 and "Ship a little joy" in matching[0]["text"]
    data = {"target_kind": "goal", "target_id": goal["id"], "emoji": "🎉"}
    responses = await asyncio.gather(
        *(client.post(BASE + "/reactions", json=data) for _ in range(3))
    )
    assert all(r.json() == [{"emoji": "🎉", "count": 1, "mine": True}] for r in responses)
    assert (
        await client.post(BASE + "/reactions", json=data, headers={"X-Demo-User": FRIEND})
    ).json()[0]["count"] == 2
    profile = (await client.get(BASE + "/users/" + OWNER)).json()
    assert profile["goal"]["reactions"] == [{"emoji": "🎉", "count": 2, "mine": True}]
    wall = (await client.get(BASE + "/accomplishments")).json()
    record = next(a for a in wall if a["target_id"] == goal["id"])
    assert record["display_name"] == "Iraj" and record["title"] == goal["title"]
    assert record["reactions"] == profile["goal"]["reactions"]
    assert [a["created_at"] for a in wall] == sorted([a["created_at"] for a in wall], reverse=True)
    assert len((await client.get(BASE + "/accomplishments?limit=1")).json()) == 1
    for _ in range(2):
        response = await client.request("DELETE", BASE + "/reactions", json=data)
        assert response.json() == [{"emoji": "🎉", "count": 1, "mine": False}]
    await client.post(path, json={"status": "missed"})
    assert not any(
        a["target_id"] == goal["id"] for a in (await client.get(BASE + "/accomplishments")).json()
    )


@pytest.mark.parametrize("kind", ["activity", "goal", "check_in"])
async def test_target_membership_palette_and_viewer_isolation(api, outsider, kind):
    client, _ = api
    profile = (await client.get(BASE + "/users/" + OWNER)).json()
    target = (
        (await client.get(BASE + "/feed")).json()[0]
        if kind == "activity"
        else profile["goal"]
        if kind == "goal"
        else profile["check_ins"][0]
    )
    data = {"target_kind": kind, "target_id": target["id"], "emoji": "🔥"}
    for method in ("POST", "DELETE"):
        assert (
            await client.request(method, BASE + "/reactions", json=data, headers=outsider)
        ).status_code == 403
        assert (
            await client.request(
                method, BASE + "/reactions", json={**data, "target_id": str(uuid4())}
            )
        ).status_code == 404
    assert (await client.get(BASE + "/accomplishments", headers=outsider)).status_code == 403
    for emoji in PALETTE:
        assert (
            await client.post(BASE + "/reactions", json={**data, "emoji": emoji})
        ).status_code == 200
    for changes in (
        {"emoji": "💩"},
        {"emoji": "heart"},
        {"target_kind": "user"},
        {"target_id": "bad"},
    ):
        assert (await client.post(BASE + "/reactions", json={**data, **changes})).status_code == 422
    if kind == "activity":
        feed = (await client.get(BASE + "/feed", headers={"X-Demo-User": FRIEND})).json()
        assert all(
            not r["mine"] and r["count"] == 1
            for r in next(f for f in feed if f["id"] == target["id"])["reactions"]
        )
    other = (await client.post("/api/villages", json={"name": "Another village"})).json()["village"]
    assert (
        await client.post(f"/api/villages/{other['id']}/reactions", json=data)
    ).status_code == 404
    for limit in (0, 201, "bad"):
        assert (await client.get(BASE + f"/accomplishments?limit={limit}")).status_code == 422


async def test_competition_badges_and_levels_are_reactable_and_not_duplicated(api):
    client, app = api
    c = (
        await client.post(
            BASE + "/competitions",
            json={"title": "Weekend walk", "terms": "Take a walk", "friendly": True},
        )
    ).json()
    path = BASE + "/competitions/" + c["id"]
    assert (await client.post(path + "/join")).status_code == 200
    assert (
        await client.post(
            path + "/entries", json={"body": "Walked to the park", "idempotency_key": "walk"}
        )
    ).status_code == 200
    for _ in range(2):
        assert (await client.post(path + "/settle")).status_code == 200
    week = (await client.get(BASE + "/weekly/current")).json()
    h = {"X-Demo-User": week["auditor_id"]}
    path = BASE + "/weekly/" + week["week_start"]
    eligible = [g for g in week["goals"] if not g["excluded"]]
    for g in eligible:
        assert (
            await client.post(
                path + "/goals/" + g["id"] + "/grade",
                headers=h,
                json={
                    "ambition": 4,
                    "evidence_quality": 4,
                    "progress": 4,
                    "completed": True,
                    "rationale": "Observed completed work",
                },
            )
        ).status_code == 200
    for _ in range(2):
        assert (await client.post(path + "/finalize", headers=h)).status_code == 200
    async with app.state.pool.connection() as conn:
        await require_member(conn, domain.VILLAGE_ID, OWNER, lock=True)
        await domain.award(conn, domain.VILLAGE_ID, OWNER, 1000, "test", "feat001-level")
        await domain.award(conn, domain.VILLAGE_ID, OWNER, 1000, "test", "feat001-level")
    wall = (await client.get(BASE + "/accomplishments?limit=200")).json()
    wins = [a for a in wall if a["type"] == "competition_won"]
    assert len(wins) == 1 and wins[0]["title"] == "Weekend walk" and wins[0]["user_id"] == OWNER
    assert len([a for a in wall if a["type"] == "badge_earned"]) == len(eligible)
    assert any(a["type"] == "level_up" and a["user_id"] == OWNER for a in wall)
    for achievement in wall:
        assert (
            await client.post(
                BASE + "/reactions",
                json={
                    "target_kind": achievement["target_kind"],
                    "target_id": achievement["target_id"],
                    "emoji": "👏",
                },
            )
        ).status_code == 200
    # Older villages get the same reactable wins/stars on migration, without duplicates.
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "DELETE FROM activity_events WHERE type IN ('competition_won','badge_earned')"
        )
        migration = (Path(__file__).parents[1] / "migrations/016_reactions.sql").read_text(
            encoding="utf-8"
        )
        for _ in range(2):
            await conn.execute(migration)
    backfilled = (await client.get(BASE + "/accomplishments?limit=200")).json()
    assert len([a for a in backfilled if a["type"] == "competition_won"]) == 1
    assert len([a for a in backfilled if a["type"] == "badge_earned"]) == len(eligible)
