"""Ephemeral process-local presence; SSE connections never hold a DB connection."""

import asyncio
import json
import time
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from app.auth import member
from app.db import many

router = APIRouter()
TTL = 30


class Heartbeat(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)
    x: float = Field(ge=-10000, le=10000)
    z: float = Field(ge=-10000, le=10000)
    activity: str = Field(default="idle", min_length=1, max_length=80)


class Presence:
    def __init__(self):
        self.entries = {}
        self.stream_groups = {}

    async def members(self, app, vid, group):
        # Concurrent listeners share a read, with at most half a second of cache.
        # Event-loop time avoids wall-clock changes; no connection survives a read.
        async with group["lock"]:
            now = asyncio.get_running_loop().time()
            if now >= group["expires"]:
                async with app.state.pool.connection() as conn:
                    rows = await many(
                        conn,
                        "SELECT user_id FROM village_members WHERE village_id=%s",
                        (vid,),
                    )
                group["allowed"] = {str(row["user_id"]) for row in rows}
                group["expires"] = asyncio.get_running_loop().time() + 0.5
            return group["allowed"]

    def snapshot(self, vid):
        now = time.monotonic()
        self.entries = {key: value for key, value in self.entries.items() if value[0] > now}
        return {
            "online": [
                value[1] for key, value in sorted(self.entries.items()) if key[0] == str(vid)
            ]
        }

    def heartbeat(self, vid, uid, data):
        self.snapshot(vid)
        self.entries[(str(vid), str(uid))] = (
            time.monotonic() + TTL,
            {"user_id": str(uid), **data.model_dump()},
        )
        return self.snapshot(vid)

    def remove(self, uid):
        self.entries = {key: value for key, value in self.entries.items() if key[1] != str(uid)}


def state(app):
    if not hasattr(app.state, "presence"):
        app.state.presence = Presence()
    return app.state.presence


@router.post("/villages/{vid}/presence/heartbeat")
async def heartbeat(vid: UUID, data: Heartbeat, request: Request, user=Depends(member)):
    return state(request.app).heartbeat(vid, user["id"], data)


async def events(app, vid, uid, disconnected):
    presence = state(app)
    key = str(vid)
    group = presence.stream_groups.setdefault(
        key, {"lock": asyncio.Lock(), "expires": 0, "listeners": 0}
    )
    group["listeners"] += 1
    try:
        while not await disconnected():
            allowed = await presence.members(app, vid, group)
            if str(uid) not in allowed:
                return
            payload = presence.snapshot(vid)
            payload["online"] = [p for p in payload["online"] if p["user_id"] in allowed]
            yield "event: presence\ndata: " + json.dumps(payload) + "\n\n"
            await asyncio.sleep(1)
    finally:
        group["listeners"] -= 1
        if not group["listeners"]:
            presence.stream_groups.pop(key, None)


@router.get("/villages/{vid}/presence/stream")
async def stream(vid: UUID, request: Request, user=Depends(member)):
    return StreamingResponse(
        events(request.app, vid, user["id"], request.is_disconnected),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
