from uuid import uuid4

import pytest

from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID
from app.houses import floor_count

UID = SEED_USERS[0][0]
OTHER = SEED_USERS[1][0]
VID = str(VILLAGE_ID)
HALL = f"/api/houses/{VID}"
HOME = f"/api/houses/{UID}"


def edit(item="shared_fern", **kwargs):
    return dict(
        action="place_item",
        item_id=item,
        kind="plant_fern",
        x=0,
        z=0,
        floor=0,
        client_seq=1,
        **kwargs,
    )


async def post(client, path, data, actor=UID):
    return await client.post(
        path + "/edit", params={"vid": VID}, json=data, headers={"X-Demo-User": str(actor)}
    )


@pytest.mark.parametrize("level,count", [(1, 1), (2, 2), (3, 2), (4, 3), (5, 3)])
def test_floor_count(level, count):
    assert floor_count(level) == count


async def test_old_invites_never_authorize(api):
    client, app = api
    await client.get(HOME, params={"vid": VID})
    async with app.state.house_pool.connection() as conn:
        await conn.execute(
            "UPDATE house_rooms SET editors=ARRAY[%s]::uuid[] WHERE house_id=%s", (OTHER, UID)
        )
    headers = {"X-Demo-User": str(OTHER)}
    assert not (await client.get(HOME, params={"vid": VID}, headers=headers)).json()["can_edit"]
    assert (await post(client, HOME, edit(), OTHER)).status_code == 403


async def test_hall_creator_permissions_activity_and_duplicate(api, outsider):
    client, app = api
    assert (await client.get(HALL, params={"vid": VID}, headers=outsider)).status_code == 403
    for actor in (UID, OTHER):
        snap = (
            await client.get(HALL, params={"vid": VID}, headers={"X-Demo-User": str(actor)})
        ).json()
        assert snap["can_edit"] and snap["floors"] == 2
    added = await post(client, HALL, edit(), OTHER)
    assert added.status_code == 200, added.text
    assert added.json()["item"]["creator"] == str(OTHER)
    # A different regular member can move, but cannot remove the object.
    third = SEED_USERS[2][0]
    move = dict(action="move_item", item_id="shared_fern", x=1, z=0, client_seq=2)
    assert (await post(client, HALL, move, third)).status_code == 200
    stash = {**move, "action": "stash_item"}
    assert (await post(client, HALL, stash, third)).status_code == 403
    assert (await post(client, HALL, stash, OTHER)).status_code == 200
    assert (await post(client, HALL, edit(), OTHER)).status_code == 200
    assert (await post(client, HALL, stash, UID)).status_code == 200
    duplicate = {**edit("another_fern"), "floor": 1}
    assert (await post(client, HALL, duplicate, third)).status_code == 200
    async with app.state.pool.connection() as conn:
        row = await one(conn, "SELECT count(*) n FROM activity_events WHERE type='hall_item_added'")
        assert row["n"] == 2  # Moves/restores do not spam the village feed.


async def test_floors_collision_and_upgrade_authority(api):
    client, app = api
    assert (await post(client, HOME, {**edit(), "floor": 1})).status_code == 422
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "UPDATE village_members SET house_level=4 WHERE village_id=%s AND user_id=%s",
            (VILLAGE_ID, UID),
        )
    assert (await client.get(HOME, params={"vid": VID})).json()["floors"] == 3
    for floor in (1, 2):
        response = await post(client, HOME, {**edit(f"fern_{floor}"), "floor": floor})
        assert response.status_code == 200, response.text
    assert (await post(client, HOME, {**edit("collision"), "floor": 1})).status_code == 409
    assert (await post(client, HALL, {**edit(), "floor": 2})).status_code == 422
    history = (await client.get(HOME + "/history", params={"vid": VID})).json()
    assert {m["after_state"]["floor"] for m in history["moves"]} == {1, 2}


async def test_photo_object_ownership_and_rate_limit(api):
    client, app = api
    cid, jid = uuid4(), uuid4()
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO avatar_jobs(id,user_id,stage,idem_key,input) "
            "VALUES(%s,%s,'segment',%s,'{}')",
            (jid, OTHER, str(jid)),
        )
        await conn.execute(
            "INSERT INTO "
            "custom_items(id,village_id,owner,kind,slot,glb_url,preview,source_job) "
            "VALUES(%s,%s,%s,'object','decoration',%s,%s,%s)",
            (
                cid,
                VILLAGE_ID,
                OTHER,
                f"/api/assets/items/{OTHER}/{jid}/object.glb",
                f"/api/assets/items/{OTHER}/{jid}/preview.png",
                jid,
            ),
        )
    data = {**edit(), "kind": str(cid)}
    assert (await post(client, HALL, data)).status_code == 403
    result = await post(client, HALL, data, OTHER)
    assert result.status_code == 200, result.text
    assert result.json()["item"]["model_url"].endswith("object.glb")
    assert result.json()["item"]["creator_name"]
    assert (await post(client, HALL, {**edit("forged"), "kind": str(uuid4())})).status_code == 403
    async with app.state.house_pool.connection() as conn:
        await conn.execute(
            "INSERT INTO "
            "house_item_moves(house_id,item_id,user_id,x,z,rot,action,seq,after_state) "
            "SELECT %s,'rate',%s,0,0,0,'place_item',n,'{}' FROM generate_series(1,20) "
            "n",
            (VILLAGE_ID, OTHER),
        )
    assert (await post(client, HALL, edit("rate_limit"), OTHER)).status_code == 429
