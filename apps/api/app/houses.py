"""Transactional house reducers; NOTIFY is delivered only after commit."""

import asyncio
import json
import math
import time
from contextlib import suppress
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from psycopg import sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.auth import current_user, require_member
from app.db import connection, many, one
from app.domain import activity
from app.realtime import Movement

router = APIRouter()
CATALOG = {
    r["id"]: r
    for r in json.loads(
        (Path(__file__).resolve().parents[3] / "packages/catalog/furniture.json").read_text()
    )
}


class Edit(BaseModel):
    action: Literal["move_item", "rotate_item", "place_item", "stash_item"]
    item_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,80}$")
    kind: str | None = Field(default=None, max_length=80)
    floor: int = Field(default=0, ge=0, le=2)
    x: float = Field(default=0, ge=-4, le=4, allow_inf_nan=False)
    z: float = Field(default=0, ge=-4, le=4, allow_inf_nan=False)
    rot: float = Field(default=0, allow_inf_nan=False)
    client_seq: int = Field(ge=0)


class Position(Movement):
    # Same movement payload as town, with room bounds and a floor extension.
    model_config = ConfigDict(extra="ignore", strict=True, allow_inf_nan=False)
    type: Literal["movement"]
    x: float = Field(ge=-3.75, le=3.75, allow_inf_nan=False)
    z: float = Field(ge=-3.75, le=3.75, allow_inf_nan=False)
    heading: float = Field(ge=-math.pi, le=math.pi, allow_inf_nan=False)
    moving: bool = Field(strict=True)
    floor: int = Field(ge=0, le=2, strict=True)


def bounds(item):
    c = CATALOG.get(item["kind"], {"width": 1, "depth": 1, "shape": "object"})
    r = math.radians(item["rot"])
    return (abs(math.cos(r)) * c["width"] + abs(math.sin(r)) * c["depth"]) / 2, (
        abs(math.sin(r)) * c["width"] + abs(math.cos(r)) * c["depth"]
    ) / 2


def validate_position(item, items):
    c = CATALOG.get(item["kind"], {"width": 1, "depth": 1, "shape": "object"})
    item["x"] = math.floor(item["x"] * 4 + 0.5) / 4
    item["z"] = math.floor(item["z"] * 4 + 0.5) / 4
    item["rot"] = (math.floor(item["rot"] / 15 + 0.5) * 15) % 360
    if c["shape"] == "wall":
        if abs(item["x"]) > abs(item["z"]):
            item["x"] = 3.75 if item["x"] > 0 else -3.75
            item["rot"] = 90 if item["x"] > 0 else 270
        else:
            item["z"] = 3.75 if item["z"] > 0 else -3.75
            item["rot"] = 0 if item["z"] < 0 else 180
    w, d = bounds(item)
    if abs(item["x"]) + w > 4.001 or abs(item["z"]) + d > 4.001:
        raise HTTPException(409, "Keep furniture inside the room")
    for other in items:
        if (
            other["item_id"] == item["item_id"]
            or other["stashed"]
            or other.get("floor", 0) != item.get("floor", 0)
        ):
            continue
        shape = CATALOG.get(other["kind"], {"shape": "object"})["shape"]

        # Rugs and ceiling fixtures occupy different vertical layers.
        def layer(s):
            return s if s in ("rug", "wall", "disco") else "floor"

        if layer(shape) != layer(c["shape"]):
            continue
        ow, od = bounds(other)
        if (
            abs(item["x"] - other["x"]) < w + ow - 0.001
            and abs(item["z"] - other["z"]) < d + od - 0.001
        ):
            raise HTTPException(409, "Furniture overlaps another item")
    return item


def channel(uid):
    return "house_" + UUID(str(uid)).hex


async def access(conn, uid, vid, actor):
    if uid != vid:
        await require_member(conn, vid, uid)
    await require_member(conn, vid, actor)


async def context(conn, uid, vid, actor):
    manager = await require_member(conn, vid, actor)
    member = manager if uid == vid or uid == actor else await require_member(conn, vid, uid)
    custom = await many(
        conn,
        "SELECT c.id,c.owner,c.glb_url,c.preview,u.display_name FROM custom_items c "
        "JOIN users u ON u.id=c.owner WHERE c.village_id=%s AND c.kind='object'",
        (vid,),
    )
    return dict(
        hall=uid == vid,
        floors=2 if uid == vid else floor_count(member["house_level"]),
        manager=manager["role"] == "owner",
        custom={str(c["id"]): c for c in custom},
    )


def floor_count(level):
    return 1 if level < 2 else 2 if level < 4 else 3


async def addition_activity(conn, vid, actor, event):
    if event.get("added"):
        await activity(
            conn,
            vid,
            actor,
            "hall_item_added",
            {
                "name": CATALOG.get(event["item"]["kind"], {}).get("name", "photo object"),
                "kind": event["item"]["kind"],
                "floor": event["item"]["floor"],
                "item_id": event["item"]["item_id"],
            },
        )


async def initialize(conn, uid, hall=False):
    row = await one(
        conn,
        "INSERT INTO house_rooms(house_id) VALUES(%s) ON CONFLICT DO NOTHING RETURNING house_id",
        (uid,),
    )
    if row and not hall:
        for kind, x, z in [
            ("sofa", -2, -2),
            ("coffee_table", -2, 0),
            ("bed", 2, -2),
            ("plant_fern", 3, 2),
            ("rug_round", -2, 0),
        ]:
            await conn.execute(
                "INSERT INTO house_items(house_id,item_id,kind,x,z,creator) "
                "VALUES(%s,%s,%s,%s,%s,%s)",
                (uid, kind, kind, x, z, uid),
            )


async def snapshot(conn, uid, actor, hall=False, floors=1, manager=False, custom=None):
    # Caller locks the room: seq and items describe the same committed revision.
    await initialize(conn, uid, hall)
    room = await one(conn, "SELECT * FROM house_rooms WHERE house_id=%s FOR UPDATE", (uid,))
    return dict(
        type="snapshot",
        seq=room["seq"],
        items=await many(
            conn, "SELECT * FROM house_items WHERE house_id=%s ORDER BY item_id", (uid,)
        ),
        can_edit=hall or actor == uid,
        floors=floors,
        hall=hall,
        can_remove_any=manager if hall else actor == uid,
        custom_items=jsonable_encoder([c for c in (custom or {}).values() if c["owner"] == actor]),
    )


async def reduce(conn, uid, actor, edit, owned, client_id=None, **options):
    # Pipeline BEGIN with the first locked read, saving a Cloud round trip.
    async with conn.pipeline():
        return await _reduce(conn, uid, actor, edit, owned, client_id, **options)


async def _reduce(
    conn, uid, actor, edit, owned, client_id, hall=False, floors=1, manager=False, custom=None
):
    room = await one(conn, "SELECT * FROM house_rooms WHERE house_id=%s FOR UPDATE", (uid,))
    if not room:
        await initialize(conn, uid, hall)
        room = await one(conn, "SELECT * FROM house_rooms WHERE house_id=%s FOR UPDATE", (uid,))
    if actor != uid and not hall:
        raise HTTPException(403, "Only the house owner can edit")
    if edit.floor >= floors:
        raise HTTPException(422, "This floor is not available")
    rate = await one(
        conn,
        "SELECT count(*) FILTER (WHERE time>clock_timestamp()-interval '1 second') AS "
        "burst, count(*) FILTER (WHERE action='place_item') AS additions FROM "
        "house_item_moves WHERE house_id=%s AND user_id=%s AND "
        "time>clock_timestamp()-interval '1 minute'",
        (uid, actor),
    )
    if rate["burst"] >= 30 or (edit.action == "place_item" and rate["additions"] >= 20):
        raise HTTPException(429, "Please slow down your edits")
    items = await many(conn, "SELECT * FROM house_items WHERE house_id=%s", (uid,))
    old = next((r for r in items if r["item_id"] == edit.item_id), None)
    kind = old["kind"] if old else edit.kind or edit.item_id
    source = (custom or {}).get(kind)
    if not old or (old["stashed"] and edit.action == "place_item"):
        if source:
            if source["owner"] != actor:
                raise HTTPException(403, "Only your own photo objects can be placed")
        elif kind not in CATALOG or (CATALOG[kind]["price"] and kind not in owned):
            raise HTTPException(403, "Buy this furniture before placing it")
    if hall and old and edit.action == "stash_item" and old["creator"] != actor and not manager:
        raise HTTPException(403, "Only the creator or village owner can remove this item")
    if not old and len(items) >= 256:
        raise HTTPException(409, "The room inventory is full")
    if edit.action != "place_item" and (not old or old["stashed"]):
        raise HTTPException(409, "Place the item first")
    item = dict(
        old
        or dict(
            item_id=edit.item_id,
            kind=kind,
            x=0,
            z=0,
            rot=0,
            stashed=False,
            creator=str(actor),
            model_url=source["glb_url"] if source else None,
            creator_name=source["display_name"] if source else None,
        )
    )
    item["floor"] = edit.floor
    item = jsonable_encoder(item)
    if edit.action == "stash_item":
        item["stashed"] = True
    else:
        item.update(
            x=edit.x if edit.action != "rotate_item" else item["x"],
            z=edit.z if edit.action != "rotate_item" else item["z"],
            rot=edit.rot,
            stashed=False,
        )
        validate_position(item, items)
    seq = room["seq"] + 1
    item.update(seq=seq, house_id=str(uid))
    async with conn.pipeline():
        await conn.execute("UPDATE house_rooms SET seq=%s WHERE house_id=%s", (seq, uid))
        await conn.execute(
            """INSERT INTO house_items(house_id,item_id,kind,x,z,rot,stashed,seq,
            floor,creator,model_url,creator_name)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(house_id,item_id) DO UPDATE
            SET x=EXCLUDED.x,z=EXCLUDED.z,rot=EXCLUDED.rot,
            stashed=EXCLUDED.stashed,seq=EXCLUDED.seq,floor=EXCLUDED.floor""",
            (
                uid,
                edit.item_id,
                kind,
                item["x"],
                item["z"],
                item["rot"],
                item["stashed"],
                seq,
                item["floor"],
                item["creator"],
                item.get("model_url"),
                item.get("creator_name"),
            ),
        )
        await conn.execute(
            """INSERT INTO house_item_moves(house_id,item_id,
            user_id,x,z,rot,action,seq,before_state,after_state)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                uid,
                edit.item_id,
                actor,
                item["x"],
                item["z"],
                item["rot"],
                edit.action,
                seq,
                Jsonb(jsonable_encoder(old)),
                Jsonb(item),
            ),
        )
        event = dict(
            added=hall and not old,
            type="delta",
            seq=seq,
            item=item,
            user_id=str(actor),
            client_seq=edit.client_seq,
            client_id=str(client_id) if client_id else None,
        )
        await conn.execute("SELECT pg_notify(%s,%s)", (channel(uid), json.dumps(event)))
    return event


async def owned_items(conn, uid):
    return {
        r["kind"]
        for r in await many(
            conn, "SELECT kind FROM house_furniture_inventory WHERE house_id=%s", (uid,)
        )
    }


@router.get("/houses/{uid}")
async def get_house(
    uid: UUID,
    vid: UUID,
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    options = await context(conn, uid, vid, user["id"])
    async with request.app.state.house_pool.connection() as tiger:
        data = await snapshot(tiger, uid, user["id"], **options)
    return {
        **data,
        "catalog": list(CATALOG.values()),
        "owned": sorted(await owned_items(conn, user["id"])),
    }


@router.post("/houses/{uid}/edit")
async def edit_house(
    uid: UUID,
    vid: UUID,
    data: Edit,
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    options = await context(conn, uid, vid, user["id"])
    async with request.app.state.house_pool.connection() as tiger:
        event = await reduce(
            tiger, uid, user["id"], data, await owned_items(conn, user["id"]), **options
        )
    await addition_activity(conn, vid, user["id"], event)
    return event


class Invite(BaseModel):
    user_id: UUID
    enabled: bool


@router.post("/houses/{uid}/editors")
async def editors(
    uid: UUID,
    vid: UUID,
    data: Invite,
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    await access(conn, uid, vid, user["id"])
    raise HTTPException(410, "Co-decoration invites have been retired; visit the Community Hall")


class Buy(BaseModel):
    kind: str


@router.post("/houses/{uid}/buy")
async def buy(
    uid: UUID,
    vid: UUID,
    data: Buy,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    await access(conn, uid, vid, user["id"])
    if (uid != vid and uid != user["id"]) or data.kind not in CATALOG:
        raise HTTPException(403, "Owner and valid furniture required")
    uid = user["id"]
    await require_member(conn, vid, uid, lock=True)
    await one(conn, "SELECT id FROM users WHERE id=%s FOR UPDATE", (uid,))
    if data.kind in await owned_items(conn, uid):
        return {"ok": True}
    balance = await one(
        conn,
        "SELECT coalesce(sum(delta),0) AS coins FROM coin_ledger WHERE village_id=%s AND "
        "user_id=%s",
        (vid, uid),
    )
    price = CATALOG[data.kind]["price"]
    if balance["coins"] < price:
        raise HTTPException(409, "Not enough coins")
    await conn.execute(
        "INSERT INTO coin_ledger(village_id,user_id,delta,reason,source_key) "
        "VALUES(%s,%s,%s,%s,%s)",
        (vid, uid, -price, "house_furniture", f"house:{uid}:{data.kind}"),
    )
    await conn.execute("INSERT INTO house_furniture_inventory VALUES(%s,%s)", (uid, data.kind))
    return {"ok": True}


@router.get("/houses/{uid}/history")
async def history(
    uid: UUID,
    vid: UUID,
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    await access(conn, uid, vid, user["id"])
    async with request.app.state.house_pool.connection() as tiger:
        await initialize(tiger, uid, uid == vid)
        await one(tiger, "SELECT house_id FROM house_rooms WHERE house_id=%s FOR UPDATE", (uid,))
        timestamp = await one(tiger, "SELECT clock_timestamp() AS as_of")
        return {
            "as_of": timestamp["as_of"],
            "items": await many(tiger, "SELECT * FROM house_items WHERE house_id=%s", (uid,)),
            "moves": await many(
                tiger,
                "SELECT * FROM house_item_moves WHERE house_id=%s AND time >= "
                "now()-interval '10 minutes' ORDER BY seq DESC",
                (uid,),
            ),
        }


@router.get("/villages/{vid}/busy-houses")
async def busy(
    vid: UUID,
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    await require_member(conn, vid, user["id"])
    ids = [
        r["user_id"]
        for r in await many(conn, "SELECT user_id FROM village_members WHERE village_id=%s", (vid,))
    ]
    async with request.app.state.house_pool.connection() as tiger:
        aggregate = await one(tiger, "SELECT to_regclass('house_activity_hourly') AS name")
        if aggregate["name"]:
            return await many(
                tiger,
                "SELECT house_id,sum(moves)::bigint AS moves FROM house_activity_hourly "
                "WHERE house_id=ANY(%s) AND hour>=date_trunc('hour',now()) "
                "GROUP BY house_id ORDER BY moves DESC LIMIT 5",
                (ids,),
            )
        # Plain test schemas may have only the table migrations applied.
        return await many(
            tiger,
            "SELECT house_id,count(*) AS moves FROM house_item_moves WHERE "
            "house_id=ANY(%s) AND time>=date_trunc('hour',now()) GROUP BY house_id "
            "ORDER BY moves DESC LIMIT 5",
            (ids,),
        )


async def presence_event(conn, uid):
    await conn.execute("DELETE FROM house_presence WHERE house_id=%s AND expires_at<now()", (uid,))
    people = await many(
        conn,
        "SELECT DISTINCT user_id,display_name AS name FROM house_presence WHERE house_id=%s",
        (uid,),
    )
    event = {"type": "presence_list", "people": jsonable_encoder(people)}
    await conn.execute("SELECT pg_notify(%s,%s)", (channel(uid), json.dumps(event)))
    return event


@router.websocket("/houses/{uid}/live")
async def live(ws: WebSocket, uid: UUID, vid: UUID):
    await ws.accept()
    sender = None
    listener = None
    actor = None
    session_id = uuid4()
    lock = asyncio.Lock()

    async def send(data):
        async with lock:
            await ws.send_json(jsonable_encoder(data))

    try:
        auth = await asyncio.wait_for(ws.receive_json(), 10)
        if not isinstance(auth, dict):
            raise ValueError("Invalid auth")
        async with ws.app.state.pool.connection() as conn:
            user = await current_user(
                Request({**ws.scope, "type": "http"}),
                conn,
                auth.get("Authorization"),
                auth.get("X-Demo-User"),
            )
            actor = user["id"]
            options = await context(conn, uid, vid, actor)
        settings = ws.app.state.settings
        listener = await psycopg.AsyncConnection.connect(
            settings.tiger_database_url or settings.database_url,
            autocommit=True,
            row_factory=dict_row,
        )
        await listener.execute(sql.SQL("LISTEN {}").format(sql.Identifier(channel(uid))))
        async with ws.app.state.house_pool.connection() as conn:
            snap = await snapshot(conn, uid, actor, **options)
        await send({**snap, "client_id": str(session_id)})

        async def forward():
            async for notice in listener.notifies():
                data = json.loads(notice.payload)
                if data.get("type") == "delta" and data["seq"] <= snap["seq"]:
                    continue
                await send(data)

        sender = asyncio.create_task(forward())
        async with ws.app.state.house_pool.connection() as conn:
            await conn.execute(
                "INSERT INTO house_presence VALUES(%s,%s,%s,%s,now()+interval '60 seconds')",
                (uid, session_id, actor, user["display_name"]),
            )
            await presence_event(conn, uid)
        last_position = 0.0
        last_seq = -1
        while True:
            data = await asyncio.wait_for(ws.receive_json(), 65)
            if not isinstance(data, dict):
                raise ValueError("Invalid message")
            if data.get("type") == "ping":
                async with ws.app.state.pool.connection() as conn:
                    await access(conn, uid, vid, actor)
                async with ws.app.state.house_pool.connection() as conn:
                    await conn.execute(
                        "UPDATE house_presence SET expires_at=now()+interval '60 seconds' "
                        "WHERE session_id=%s",
                        (session_id,),
                    )
                    await presence_event(conn, uid)
                await send({"type": "pong"})
                continue
            if data.get("type") == "movement":
                try:
                    position = Position.model_validate(data)
                    if position.floor >= options["floors"]:
                        raise ValueError("Unavailable floor")
                except (ValidationError, ValueError):
                    await send({"type": "movement_rejected", "detail": "Invalid position"})
                    continue
                now = time.monotonic()
                if now - last_position < 0.1:
                    continue
                last_position = now
                # Ephemeral NOTIFY only: no room revision or durable movement writes.
                event = {**position.model_dump(), "user_id": str(actor),
                         "name": user["display_name"], "client_id": str(session_id)}
                async with ws.app.state.house_pool.connection() as conn:
                    await conn.execute("SELECT pg_notify(%s,%s)", (channel(uid), json.dumps(event)))
                continue
            try:
                edit = Edit.model_validate(data)
                if edit.client_seq <= last_seq:
                    raise HTTPException(409, "Client sequence must increase")
                last_seq = edit.client_seq
                async with ws.app.state.pool.connection() as conn:
                    options = await context(conn, uid, vid, actor)
                    owned = await owned_items(conn, actor)
                async with ws.app.state.house_pool.connection() as conn:
                    event = await reduce(conn, uid, actor, edit, owned, session_id, **options)
                async with ws.app.state.pool.connection() as conn:
                    await addition_activity(conn, vid, actor, event)
                await send({**event, "type": "ack"})
            except (HTTPException, ValidationError) as exc:
                if isinstance(exc, HTTPException) and exc.detail == "Village membership required":
                    raise
                async with ws.app.state.house_pool.connection() as conn:
                    snap_now = await snapshot(conn, uid, actor, **options)
                await send(
                    {
                        "type": "rejected",
                        "client_seq": data.get("client_seq"),
                        "detail": exc.detail if isinstance(exc, HTTPException) else "Invalid edit",
                        "snapshot": snap_now,
                    }
                )
    except (WebSocketDisconnect, TimeoutError):
        pass
    except HTTPException:
        await ws.close(code=1008, reason="House access denied")
    except (ValueError, TypeError):
        await ws.close(code=1008, reason="Invalid message")
    finally:
        if sender:
            sender.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await sender
        if listener:
            with suppress(Exception):
                async with ws.app.state.house_pool.connection() as conn:
                    await conn.execute(
                        "DELETE FROM house_presence WHERE session_id=%s", (session_id,)
                    )
                    await presence_event(conn, uid)
            await listener.close()
