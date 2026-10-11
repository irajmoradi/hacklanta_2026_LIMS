"""Wave 5 acceptance with fresh identities; queued work stays in a private DB."""
import asyncio
import io

from PIL import Image
from psycopg.types.json import Jsonb
import pytest

from app import world


def photo():
    stream = io.BytesIO()
    Image.new("RGB", (64, 64), "orange").save(stream, "PNG")
    return ("synthetic.png", stream.getvalue(), "image/png")


async def test_growth_and_weather_rules(qa_api):
    client, app, ids, base = qa_api
    vid = base.rsplit("/", 1)[1]
    assert (await client.get(base)).json()["world"]["level"] == 1
    async with app.state.pool.connection() as conn:
        for delta, key in [(2500, "earned"), (-100, "spent")]:
            await conn.execute("INSERT INTO xp_ledger(village_id,user_id,delta,reason,source_key) "
                               "VALUES (%s,%s,%s,'mayor_event',%s)", (vid, ids[0], delta, key))
    responses = await asyncio.gather(*(client.get(base) for _ in range(4)))
    for response in responses:
        state = response.json()["world"]
        assert (state["xp"], state["level"], state["next_level_xp"]) == (2500, 4, 5000)
        assert state["unlocked"] == ["garden", "festival_lights", "pet_shelter"]
    async with app.state.pool.connection() as conn:
        for kind in ["building_unlocked", "agent_decision"]:
            row = await (await conn.execute("SELECT count(*) AS n FROM activity_events WHERE village_id=%s AND type=%s", (vid, kind))).fetchone()
            assert row["n"] == 3
        for value, reason in [("snow", "QA"), ("rain", " ")]:
            with pytest.raises(ValueError):
                await world.set_weather(conn, vid, value, reason)
        assert await world.set_weather(conn, vid, "rain", "QA rain")
        assert not await world.set_weather(conn, vid, "rain", "Same weather")
        assert not await world.set_weather(conn, vid, "festival_night", "Rate limited")
        await conn.execute("UPDATE village_world SET weather_changed_at=now()-interval '3 hours' WHERE village_id=%s", (vid,))
        assert await world.set_weather(conn, vid, "festival_night", "QA night")
    assert (await client.get(base)).json()["world"]["weather"] == "festival_night"
    assert (await client.get(base, headers={"X-Demo-User": ids[3]})).status_code == 403


async def test_group_photo_consent_crops_claims_and_private_assets(qa_api):
    client, app, ids, base = qa_api
    vid = base.rsplit("/", 1)[1]
    path = base + "/group-photo"
    outsider = {"X-Demo-User": ids[3]}
    peer = {"X-Demo-User": ids[1]}
    for headers in [peer, outsider]:
        assert (await client.post(path, headers=headers, files={"file": photo()}, data={"consent": "true"})).status_code == 403
    assert (await client.post(path, files={"file": photo()})).status_code == 422
    upload = await client.post(path, files={"file": photo()}, data={"consent": "true"})
    assert upload.status_code == 200
    job = upload.json()["job_id"]
    assert (await client.post(path, files={"file": photo()}, data={"consent": "true"})).json()["job_id"] == job
    path += "/" + job
    assert (await client.post(path + "/claim", json={"crop_id": "a"})).status_code == 409
    crops = []
    for cid in ["a", "b"]:
        key = f"villages/{vid}/group/{job}/{cid}/face_512.png"
        target = app.state.settings.asset_dir / key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(photo()[1])
        crops.append({"crop_id": cid, "face_asset_key": key, "box_xyxy": [0, 0, 64, 64]})
        assert (await client.get("/api/assets/" + key, headers=peer)).status_code == 200
        assert (await client.get("/api/assets/" + key, headers=outsider)).status_code == 403
        assert (await client.get("/api/assets/" + key, headers={"X-Demo-User": ""})).status_code == 401
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE avatar_jobs SET status='done',result=%s WHERE id=%s", (Jsonb({"crops": crops}), job))
    listing = await client.get(path, headers=peer)
    assert listing.status_code == 200
    assert [c["bbox"] for c in listing.json()["crops"]] == [[0, 0, 64, 64]] * 2
    assert (await client.get(path, headers=outsider)).status_code == 403
    assert (await client.post(path + "/claim", json={"crop_id": "a"}, headers=outsider)).status_code == 403
    assert (await client.post(path + "/claim", json={"crop_id": "missing"})).status_code == 404
    results = await asyncio.gather(client.post(path + "/claim", json={"crop_id": "a"}), client.post(path + "/claim", json={"crop_id": "a"}, headers=peer))
    assert sorted(r.status_code for r in results) == [200, 409]
    winner = next(r.json() for r in results if r.status_code == 200)
    headers = {"X-Demo-User": winner["user_id"]}
    assert (await client.post(path + "/claim", json={"crop_id": "a"}, headers=headers)).json() == winner
    assert (await client.post(path + "/claim", json={"crop_id": "b"}, headers=headers)).status_code == 409
    assert (await client.get(path)).json()["crops"][0]["claimed_by"] == winner["user_id"]
    async with app.state.pool.connection() as conn:
        row = await (await conn.execute("SELECT * FROM avatar_jobs WHERE id=%s", (winner["job_id"],))).fetchone()
        assert row["stage"] == "segment" and row["status"] == "queued" and row["attempts"] == 0
        assert row["input"] == {"group_job_id": job, "crop_id": "a", "village_id": vid, "user_id": winner["user_id"], "consent": True}
        assert (await (await conn.execute("SELECT count(*) AS n FROM group_photo_claims")).fetchone())["n"] == 1
        await conn.execute("UPDATE avatar_jobs SET status='failed' WHERE id=%s", (winner["job_id"],))
