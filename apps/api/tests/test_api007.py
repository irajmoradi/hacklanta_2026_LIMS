import asyncio
import io
from uuid import uuid4

import pytest
from PIL import Image
from psycopg.types.json import Jsonb
from pydantic import ValidationError

from app import scheduler, world
from app.db import many, one
from app.domain import SEED_USERS, VILLAGE_ID
from app.models import MayorDecision
from scripts.demo_story import story

BASE = f"/api/villages/{VILLAGE_ID}"
OWNER = SEED_USERS[0][0]
OTHER = {"X-Demo-User": str(SEED_USERS[1][0])}


@pytest.mark.parametrize(
    "xp,level,next_xp",
    [
        (0, 1, 500),
        (499, 1, 500),
        (500, 2, 1500),
        (1499, 2, 1500),
        (1500, 3, 2500),
        (2499, 3, 2500),
        (2500, 4, 5000),
        (4999, 4, 5000),
        (5000, 5, 8000),
        (8000, 6, None),
        (999999, 6, None),
    ],
)
def test_thresholds(xp, level, next_xp):
    assert world.progression(xp) == (level, next_xp)


async def test_growth_idempotency_purchase_and_event_bonus(api, outsider):
    client, app = api
    assert (await client.get(BASE, headers=outsider)).status_code == 403
    assert (await client.post(BASE + "/shop/buy", json={"item_id": "pet_dog_b"})).status_code == 409
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO xp_ledger(village_id,user_id,delta,reason,source_key) "
            "VALUES (%s,%s,1350,'mayor_event','growth-test')",
            (VILLAGE_ID, OWNER),
        )
    responses = await asyncio.gather(*(client.get(BASE) for _ in range(4)))
    state = responses[0].json()["world"]
    assert state["xp"] == 2500 and state["level"] == 4
    assert state["unlocked"] == [
        "study_nook",
        "fitness_corner",
        "garden",
        "festival_lights",
        "pet_shelter",
        "farm_store",
    ]
    assert state["upcoming"][0] == {"building": "ferris_wheel", "level": 5, "xp": 5000}
    assert state["time_of_day"] in {"day", "night"}
    assert (
        await client.post(BASE + "/shop/buy", json={"item_id": "house_backyard"})
    ).status_code == 200
    assert (await client.post(BASE + "/shop/buy", json={"item_id": "pet_dog_b"})).status_code == 200
    assert (await client.get(BASE)).json()["world"]["xp"] == 2500
    items = (await client.get(BASE + "/shop")).json()["items"]
    assert next(i for i in items if i["id"] == "pet_dog_b")["requires"] == "pet_shelter"
    async with app.state.pool.connection() as conn:
        assert (
            await one(
                conn, "SELECT count(*) AS n FROM activity_events WHERE type='building_unlocked'"
            )
        )["n"] == len(state["unlocked"])
        assert (
            await one(
                conn,
                "SELECT count(*) AS n FROM activity_events WHERE type='agent_decision' "
                "AND payload->>'action'='building_unlocked'",
            )
        )["n"] == len(state["unlocked"])


async def test_weather_limit_validation_and_scheduler(api, monkeypatch):
    _, app = api
    with pytest.raises(ValidationError):
        MayorDecision(action="weather", weather="tornado", reason="No")

    async def change(value):
        async with app.state.pool.connection() as conn:
            return await world.set_weather(conn, VILLAGE_ID, value, "Seasonal change")

    assert sorted(await asyncio.gather(change("rain"), change("festival_night"))) == [False, True]
    async with app.state.pool.connection() as conn:
        with pytest.raises(ValueError):
            await world.set_weather(conn, VILLAGE_ID, "snow", "Invalid")
        await conn.execute("UPDATE village_world SET weather_changed_at=now()-interval '3 hours'")

    async def generate(*args):
        return MayorDecision(action="weather", weather="fog", reason="A quiet morning")

    monkeypatch.setattr("app.mayor.Mayor.generate", generate)
    await scheduler.tick(app.state.pool, app.state.settings)
    async with app.state.pool.connection() as conn:
        assert (await world.state(conn, VILLAGE_ID))["weather"] == "fog"
        logs = await many(
            conn,
            "SELECT payload FROM activity_events WHERE type='agent_decision' "
            "AND payload->>'action'='weather'",
        )
        assert any("A quiet morning" in r["payload"]["reason"] for r in logs)


async def test_failure_fog_and_linked_repair(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        event = await one(
            conn,
            """INSERT INTO mayor_events(village_id,kind,title,body,penalty,ends_at)
            VALUES (%s,'challenge','Missed movie','Join us','crater',now()-interval '1 minute')
            RETURNING id""",
            (VILLAGE_ID,),
        )
    before = (await client.get(BASE)).json()
    assert before["world"]["disaster"]["kind"] in {"scorch", "outbreak", "blackout", "blight"}
    repair = next(e for e in before["active_events"] if e["repairs_event_id"] == str(event["id"]))
    assert repair["penalty"] == "crater"
    # Exercise a persisted legacy check-in repair; task repairs have separate coverage.
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE village_world SET disaster=disaster-'repair_plan' WHERE village_id=%s", (VILLAGE_ID,))
    await client.get(BASE)
    async with app.state.pool.connection() as conn:
        assert (
            await one(
                conn,
                "SELECT count(*) AS n FROM mayor_events WHERE repairs_event_id=%s",
                (event["id"],),
            )
        )["n"] == 1
        assert not await world.set_weather(conn, VILLAGE_ID, "clear", "Already clear")
    path = BASE + f"/events/{repair['id']}/complete"
    assert (
        await client.post(path, headers=OTHER, json={"user_ids": [str(OWNER)]})
    ).status_code == 403
    assert (await client.post(path, json={"user_ids": [str(OWNER)]})).status_code == 409
    for uid, *_ in SEED_USERS[:3]:
        for _ in range(2):
            assert (
                await client.post(
                    BASE + "/check-ins",
                    headers={"X-Demo-User": str(uid)},
                    json={
                        "kind": "status",
                        "body": "Helping repair",
                        "idempotency_key": str(uuid4()),
                    },
                )
            ).status_code == 200
    after = (await client.get(BASE)).json()
    assert after["world"]["weather"] == "clear"
    assert not any(e["penalty"] == "crater" for e in after["active_events"])
    async with app.state.pool.connection() as conn:
        assert (await one(conn, "SELECT status FROM mayor_events WHERE id=%s", (event["id"],)))[
            "status"
        ] == "failed"


def photo():
    output = io.BytesIO()
    Image.new("RGB", (64, 64), "orange").save(output, format="PNG")
    return ("synthetic.png", output.getvalue(), "image/png")


async def uploaded(client):
    response = await client.post(
        BASE + "/group-photo", files={"file": photo()}, data={"consent": "true"}
    )
    assert response.status_code == 200, response.text
    return response.json()["job_id"]


async def worker_done(app, job_id):
    crops = []
    for cid in ("a", "b"):
        key = f"villages/{VILLAGE_ID}/group/{job_id}/{cid}/face_512.png"
        path = app.state.settings.asset_dir / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(photo()[1])
        crops.append({"crop_id": cid, "face_url": "/api/assets/" + key, "box_xyxy": [0, 0, 8, 8]})
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE avatar_jobs SET status='done',result=%s WHERE id=%s",
            (Jsonb({"crops": crops}), job_id),
        )


async def test_group_upload_consent_access_and_worker_offline(api, outsider):
    client, app = api
    path = BASE + "/group-photo"
    for headers, code in [(OTHER, 403), (outsider, 403)]:
        assert (
            await client.post(
                path, headers=headers, files={"file": photo()}, data={"consent": "true"}
            )
        ).status_code == code
    assert (await client.post(path, files={"file": photo()})).status_code == 422
    job_id = await uploaded(client)
    assert await uploaded(client) == job_id
    status = (await client.get(path + "/" + job_id)).json()
    assert status["status"] == "queued" and status["crops"] == []
    assert (
        await client.post(path + "/" + job_id + "/claim", json={"crop_id": "a"})
    ).status_code == 409
    assert (await client.get(path + "/" + job_id, headers=outsider)).status_code == 403
    assert (await client.get(path + "/" + str(uuid4()))).status_code == 404
    async with app.state.pool.connection() as conn:
        job = await one(conn, "SELECT * FROM avatar_jobs WHERE id=%s", (job_id,))
        assert job["input"]["group_photo"] and not job["input"]["auto_enqueue_head"]
        assert (
            await client.get("/api/assets/" + job["input"]["asset_key"], headers=outsider)
        ).status_code == 403
        assert (
            await client.get("/api/assets/" + job["input"]["asset_key"], headers=OTHER)
        ).status_code == 200
    await worker_done(app, job_id)
    assert len((await client.get(path + "/" + job_id, headers=OTHER)).json()["crops"]) == 2


async def test_concurrent_claims_and_head_pipeline(api, outsider):
    client, app = api
    job_id = await uploaded(client)
    await worker_done(app, job_id)
    path = BASE + "/group-photo/" + job_id
    assert (
        await client.post(path + "/claim", headers=outsider, json={"crop_id": "a"})
    ).status_code == 403
    responses = await asyncio.gather(
        client.post(path + "/claim", json={"crop_id": "a"}),
        client.post(path + "/claim", headers=OTHER, json={"crop_id": "a"}),
    )
    assert sorted(r.status_code for r in responses) == [200, 409]
    winner = next(r.json() for r in responses if r.status_code == 200)
    headers = {"X-Demo-User": winner["user_id"]}
    assert (
        await client.post(path + "/claim", headers=headers, json={"crop_id": "a"})
    ).json() == winner
    assert (
        await client.post(path + "/claim", headers=headers, json={"crop_id": "b"})
    ).status_code == 409
    status = (await client.get(path)).json()
    assert status["crops"][0]["claimed_by"] == winner["user_id"]
    async with app.state.pool.connection() as conn:
        head = await one(conn, "SELECT * FROM avatar_jobs WHERE id=%s", (winner["job_id"],))
        # Bridge claim job (docs/cv/cv005.md section 2).
        assert head["stage"] == "segment" and head["status"] == "queued"
        assert head["input"]["group_job_id"] == job_id and head["input"]["crop_id"] == "a"
        assert (await one(conn, "SELECT count(*) AS n FROM group_photo_claims"))["n"] == 1


async def test_worker_result_rejects_private_keys_and_old_bridge(api):
    client, app = api
    job_id = await uploaded(client)
    path = BASE + "/group-photo/" + job_id
    for result in (
        {"crop_count": 2},
        {"crops": [{"crop_id": "a", "face_asset_key": f"uploads/{OWNER}/secret.png"}]},
    ):
        async with app.state.pool.connection() as conn:
            await conn.execute(
                "UPDATE avatar_jobs SET status='done',result=%s WHERE id=%s",
                (Jsonb(result), job_id),
            )
        assert (await client.get(path)).status_code == 409
        assert (await client.post(path + "/claim", json={"crop_id": "a"})).status_code == 409


async def test_demo_level_four_replay_and_repair(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await story(conn, reset=True, asset_dir=app.state.settings.asset_dir)
        assert not await story(conn, asset_dir=app.state.settings.asset_dir)
    village = (await client.get(BASE)).json()
    assert village["world"]["level"] == 4
    assert village["world"]["upcoming"][0]["building"] == "ferris_wheel"
    repair = next(e for e in village["active_events"] if e["repairs_event_id"])
    assert (
        await client.post(
            BASE + f"/events/{repair['id']}/complete", json={"user_ids": [str(OWNER)]}
        )
    ).status_code == 200
    assert (await client.get(BASE)).json()["world"]["weather"] == "clear"
