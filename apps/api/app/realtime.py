"""Authenticated village WebSocket: authoritative intents, snapshots and deltas."""
import asyncio
import json
import math
import time
from contextlib import suppress
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ConfigDict

from app.auth import current_user, require_member
from app.db import one

router = APIRouter()


def committed_event(queue, cursor):
    """Drain committed states without observing an in-flight room transaction."""
    reset = queue.get(None)
    states = [s for key, s in queue.items() if key is not None]
    queue.clear()
    end = max([cursor, *[s['seq'] for s in states]])
    if reset:
        members = {s['user_id']: s for s in reset['avatars']}
        for state in states:
            old = members.get(state['user_id'])
            if old is not None and state['seq'] > old['seq']:
                members[state['user_id']] = state
        return dict(reset, avatars=list(members.values()), world_seq=max(end, reset['world_seq']))
    return dict(type='world_delta', from_seq=cursor, world_seq=end,
                server_time=time.time(), avatars=states)


class Movement(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    x: float
    z: float
    heading: float
    moving: bool
    running: bool
    emote: Literal["wave", "cheer", "spin"] | None = None
    activity: Literal["cafe", "attraction"] | None = None


@router.websocket('/villages/{vid}/live')
async def live(ws: WebSocket, vid: UUID):
    await ws.accept()
    uid = None
    try:
        raw = await asyncio.wait_for(ws.receive_text(), 10)
        if len(raw) > 16384:
            raise ValueError('Auth too large')
        auth = json.loads(raw)
        if not isinstance(auth, dict):
            raise ValueError('Invalid auth')
        if any(value is not None and not isinstance(value, str)
               for value in (auth.get('Authorization'), auth.get('X-Demo-User'))):
            raise ValueError('Invalid credentials')
        async with ws.app.state.pool.connection() as conn:
            user = await current_user(Request({**ws.scope, 'type': 'http'}), conn,
                                      auth.get('Authorization'), auth.get('X-Demo-User'))
            await require_member(conn, vid, user['id'])
        uid = str(user['id'])
        await world_live(ws, vid, uid)
    except WebSocketDisconnect:
        pass
    except TimeoutError:
        with suppress(RuntimeError):
            await ws.close(code=1013, reason='Live transport timed out')
    except (HTTPException, ValueError, TypeError, KeyError):
        with suppress(RuntimeError):
            await ws.close(code=1008, reason='Invalid movement or village access denied')


async def world_live(ws, vid, uid):
    from app.overworld import World, WorldRoom
    app = ws.app
    async with app.state.world_rooms_lock:
        room = app.state.world_rooms.get(str(vid))
        if room is None:
            async with app.state.pool.connection() as conn:
                await conn.execute('INSERT INTO village_overworld(village_id) VALUES (%s) ON CONFLICT DO NOTHING', (vid,))
                row = await one(conn, 'SELECT * FROM village_overworld WHERE village_id=%s', (vid,))
                room = WorldRoom(app.state.pool, vid, World(0, [], row['world_seq']))
                await room.refresh(conn)
                room.world.avatars.update({u:s for u,s in row['avatars'].items() if u in room.world.members})
            app.state.world_rooms[str(vid)] = room
    queue, wake, send_lock = {}, asyncio.Event(), asyncio.Lock()
    token = object()
    tasks = []
    async def send(data):
        async with send_lock:
            await asyncio.wait_for(ws.send_json(data), 5)
    try:
        async with room.lock:
            room.clients[token] = (queue, wake)
            snapshot = room.snapshot()
            if room.task is None or room.task.done():
                room.task = asyncio.create_task(room.run())
        await send(snapshot)
        cursor = snapshot['world_seq']

        async def forward():
            nonlocal cursor
            while True:
                await wake.wait()
                # Queues contain committed, immutable states only. Draining has no
                # await and needs no room lock (which may be waiting on the DB).
                # Flush immediately: the existing 10 Hz per-user ingress limit
                # remains intact; fan-out adds no 50 ms coalescing delay.
                wake.clear()
                if not queue: continue
                states = [s for key, s in queue.items() if key is not None]
                event = committed_event(queue, cursor)
                cursor = event['world_seq']
                await send(event)
                room.record_fanout(states)

        async def receive():
            nonlocal cursor
            window, count = time.monotonic(), 0
            while True:
                raw = await ws.receive_text()
                now = time.monotonic()
                if now-window >= 1: window, count = now, 0
                count += 1
                if len(raw) > 2048 or count > 40: raise ValueError('Intent flood')
                data = json.loads(raw)
                if isinstance(data, dict) and "type" not in data and "x" in data:
                    movement = Movement.model_validate(data)
                    data = dict(type="intent", request_id=f"legacy:{time.time_ns()}", action="move", **movement.model_dump(exclude={"emote"}))
                if not isinstance(data, dict): raise ValueError('Invalid intent')
                if data.get('type') == 'ping':
                    stamp = data.get('client_time')
                    if type(stamp) not in (int, float) or not math.isfinite(stamp): raise ValueError('Invalid clock sample')
                    await send(dict(type='pong', client_time=stamp, server_time=time.time()))
                    continue
                if data.get('type') == 'resync':
                    async with room.lock:
                        snapshot = room.snapshot(); queue.clear(); cursor = snapshot['world_seq']
                    await send(snapshot)
                    continue
                try:
                    async with app.state.pool.connection() as conn:
                        await require_member(conn, vid, uid)
                    result = await room.intent(uid, data, received_at=now)
                except ValueError as exc:
                    result = dict(type='intent_result', request_id=str(data.get('request_id',''))[:96], ok=False, error=str(exc)[:160])
                await send(result)

        async def membership():
            while True:
                await asyncio.sleep(30)
                async with app.state.pool.connection() as conn:
                    await require_member(conn, vid, uid)

        tasks = [asyncio.create_task(fn()) for fn in (forward, receive, membership)]
        done, _ = await asyncio.wait([*tasks, room.task], return_when=asyncio.FIRST_COMPLETED)
        for task in done: task.result()
    finally:
        for task in tasks: task.cancel()
        for task in tasks:
            with suppress(asyncio.CancelledError, Exception): await task
        async with room.lock:
            room.clients.pop(token, None)
            if not room.clients and room.task:
                room.task.cancel()
                with suppress(asyncio.CancelledError, Exception): await room.task
                room.task = None
