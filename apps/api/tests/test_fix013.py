import pytest
from test_api003 import RUBRIC, USERS, auth, make_goal, setup_week


@pytest.mark.parametrize("stale_grades", [False, True])
async def test_all_assigned_auditors_excluded_from_finalization(api, stale_grades):
    client, app = api
    initial, path = await setup_week(client)
    original = initial["auditor_id"]
    for uid in USERS:
        await make_goal(client, uid)
    for uid in [u for u in USERS if u != original][:len(USERS) // 2 + 1]:
        response = await client.post(
            path + "/insufficient", headers=auth(uid), json={"generation": 1}
        )
        assert response.status_code == 200, response.text
    current = (await client.get(path)).json()
    replacement = current["auditor_id"]
    assert replacement != original
    excluded = [g for g in current["goals"] if g["excluded"]]
    assert {g["user_id"] for g in excluded} == {original, replacement}
    eligible = [g for g in current["goals"] if not g["excluded"]]
    for goal in excluded:
        response = await client.post(
            path + "/goals/" + goal["id"] + "/grade",
            headers=auth(replacement), json=RUBRIC,
        )
        assert response.status_code == 409
    # Even obsolete/corrupt maximum grades must never enter ranking or awards.
    if stale_grades:
        async with app.state.pool.connection() as conn:
            for goal in excluded:
                await conn.execute(
                    "INSERT INTO weekly_grades VALUES(%s,%s,%s,5,5,5,true,'stale')",
                    (current["id"], goal["id"], replacement),
                )
    for goal in eligible:
        response = await client.post(
            path + "/goals/" + goal["id"] + "/grade",
            headers=auth(replacement), json={**RUBRIC, "ambition": 1},
        )
        assert response.status_code == 200, response.text
    response = await client.post(path + "/finalize", headers=auth(replacement))
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["winner_id"] == min(g["user_id"] for g in eligible)
    assert set(result["stars"]) == {g["user_id"] for g in eligible}
    async with app.state.pool.connection() as conn:
        awards = await conn.execute(
            "SELECT user_id FROM xp_ledger WHERE source_key LIKE 'weekly:%%'"
        )
        assert [str(r["user_id"]) for r in await awards.fetchall()] == [result["winner_id"]]
