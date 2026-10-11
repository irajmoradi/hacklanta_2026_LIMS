from datetime import UTC, date, datetime, timedelta

import pytest

from app import rewards
from app.catalog_registry import load_catalog
from app.db import many, one
from app.domain import SEED_USERS, VILLAGE_ID

BASE = f"/api/villages/{VILLAGE_ID}"
UID = SEED_USERS[0][0]


def test_calendar_rules_ignore_duplicates_and_require_continuity():
    sunday = date(2026, 10, 11)
    days = [sunday - timedelta(days=i) for i in range(28)]
    assert rewards.checkin_rules(days, sunday) == ["perfect_week", "streak_28"]
    assert rewards.checkin_rules(days[1:], sunday) == []
    assert rewards.checkin_rules([sunday] * 28, sunday) == []
    assert rewards.checkin_rules(days[:7], sunday) == ["perfect_week"]
    assert rewards.checkin_rules(days, sunday - timedelta(days=1)) == []


async def test_all_rewards_idempotent_private_and_not_for_sale(api):
    client, app = api
    registry = load_catalog()
    earned = [e for e in registry.entries.values() if "earn_only" in e.get("tags", [])]
    assert len(earned) == 7
    before = (await client.get(BASE + f"/users/{UID}")).json()["villager"]
    for item in earned:
        assert item["price_coins"] == 0
        assert (
            await client.post(BASE + "/shop/buy", json={"item_id": item["id"]})
        ).status_code == 409
        assert (
            await client.post(BASE + "/inventory/equip", json={"item_id": item["id"]})
        ).status_code == 404
        async with app.state.pool.connection() as conn:
            assert await rewards.grant(conn, VILLAGE_ID, UID, item["source"].split(":")[1]) == [
                item["id"]
            ]
            assert await rewards.grant(conn, VILLAGE_ID, UID, item["source"].split(":")[1]) == []
    after = (await client.get(BASE + f"/users/{UID}")).json()["villager"]
    assert after["xp"] == before["xp"]
    assert after["equipped_ids"] == before["equipped_ids"]
    shop = (await client.get(BASE + "/shop")).json()
    for item in earned:
        actual = next(i for i in shop["items"] if i["id"] == item["id"])
        assert actual["owned"] and actual["acquired_at"]
        assert actual["source"] == item["source"]
    response = await client.post(BASE + "/inventory/equip", json={"item_id": "champion_mantle"})
    assert response.status_code == 200, response.text
    equipped = next(i for i in response.json()["equipped"] if i["item_id"] == "champion_mantle")
    assert equipped["rarity"] == "legendary"
    # ASSET-008 uses an authored cape instead of tinting a shared placeholder.
    assert equipped["asset_key"] == "champion_mantle"
    assert equipped.get("tint") == registry.entries["champion_mantle"].get("tint")
    other = {"X-Demo-User": str(SEED_USERS[1][0])}
    assert (
        await client.post(
            BASE + "/inventory/equip", headers=other, json={"item_id": "champion_mantle"}
        )
    ).status_code == 404


async def test_checkin_path_awards_streak_once(api):
    client, app = api
    today = datetime.now(UTC).date()
    async with app.state.pool.connection() as conn:
        for i in range(1, 28):
            await conn.execute(
                """INSERT INTO check_ins(village_id,user_id,kind,body,idempotency_key,created_at)
                VALUES (%s,%s,'status','Fixture check-in',%s,%s)""",
                (VILLAGE_ID, UID, f"reward-day-{i}", today - timedelta(days=i)),
            )
    data = {"kind": "status", "body": "Day 28", "idempotency_key": "reward-today"}
    for _ in range(2):
        response = await client.post(BASE + "/check-ins", json=data)
        assert response.status_code == 200, response.text
    async with app.state.pool.connection() as conn:
        items = await many(
            conn,
            "SELECT * FROM inventory WHERE village_id=%s AND user_id=%s "
            "AND item_id='streak_flame_scarf'",
            (VILLAGE_ID, UID),
        )
        assert len(items) == 1 and not items[0]["equipped"]


async def test_weekly_finalize_awards_winner_and_auditor(api):
    client, app = api
    week = (await client.get(BASE + "/weekly/current")).json()
    auditor = week["auditor_id"]
    path = BASE + "/weekly/" + week["week_start"]
    goals = (await client.get(path)).json()["goals"]
    eligible = [g for g in goals if not g["excluded"]]
    assert eligible
    for goal in eligible:
        result = await client.post(
            path + f"/goals/{goal['id']}/grade",
            headers={"X-Demo-User": auditor},
            json={
                "ambition": 4,
                "evidence_quality": 4,
                "progress": 4,
                "completed": True,
                "rationale": "Verified fixture work.",
            },
        )
        assert result.status_code == 200, result.text
    for _ in range(2):
        result = await client.post(path + "/finalize", headers={"X-Demo-User": auditor})
        assert result.status_code == 200, result.text
    async with app.state.pool.connection() as conn:
        for uid, item in [
            (auditor, "auditor_badge"),
            (result.json()["winner_id"], "champion_mantle"),
        ]:
            row = await one(
                conn,
                "SELECT count(*) AS n FROM inventory "
                "WHERE village_id=%s AND user_id=%s AND item_id=%s",
                (VILLAGE_ID, uid, item),
            )
            assert row["n"] == 1


async def test_mayor_completion_grants_medal_and_festival_vip(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        event = await one(
            conn,
            """INSERT INTO mayor_events(village_id,kind,title,body,reward_xp,template_id)
            VALUES (%s,'challenge','Game night','Fixture gathering',80,'game_night')
            RETURNING id""",
            (VILLAGE_ID,),
        )
    for _ in range(2):
        result = await client.post(
            BASE + f"/events/{event['id']}/complete", json={"user_ids": [str(UID)]}
        )
        assert result.status_code == 200, result.text
    shop = (await client.get(BASE + "/shop")).json()
    assert all(
        next(i for i in shop["items"] if i["id"] == key)["owned"]
        for key in ["mayor_medal", "festival_vip"]
    )


@pytest.mark.parametrize("friendly", [False, True])
async def test_competition_only_awards_verified_winners(api, friendly):
    client, app = api
    auditor = SEED_USERS[1][0]
    async with app.state.pool.connection() as conn:
        contest = await one(
            conn,
            """INSERT INTO competitions(village_id,creator_id,title,terms,friendly,auditor_id)
            VALUES (%s,%s,'Fixture contest','One verified entry',%s,%s) RETURNING id""",
            (VILLAGE_ID, UID, friendly, None if friendly else auditor),
        )
        await conn.execute(
            "INSERT INTO competition_participants(competition_id,user_id,entry_lamports_intent) "
            "VALUES (%s,%s,0)",
            (contest["id"], UID),
        )
        await conn.execute(
            """INSERT INTO competition_entries
            (competition_id,user_id,body,idempotency_key,decision,points)
            VALUES (%s,%s,'Verified work','reward-test','confirmed',5)""",
            (contest["id"], UID),
        )
    for _ in range(2):
        response = await client.post(
            BASE + f"/competitions/{contest['id']}/settle",
            headers={"X-Demo-User": str(UID if friendly else auditor)},
        )
        assert response.status_code == 200, response.text
    shop = (await client.get(BASE + "/shop")).json()
    assert next(i for i in shop["items"] if i["id"] == "competition_laurels")["owned"] is (
        not friendly
    )
