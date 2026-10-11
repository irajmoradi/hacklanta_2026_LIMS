"""Cached, best-effort chorus clips. Polling never generates speech or video."""

import asyncio
import json
import time
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field

from app import gpu_client, gram_video, voice
from app.assets import asset_path
from app.auth import current_user, require_member, require_peer
from app.db import connection, many, one
from app.heads import Say, say
from app.security import LimitExceeded

router = APIRouter()

_tasks = set()


def clip_state(settings, audio_key):
    path = asset_path(settings, audio_key).with_suffix(".chorus.json")
    try:
        value = json.loads(path.read_text())
        if value.get("video_key"):
            asset_path(settings, value["video_key"])
            return {"status": "ready", "video_url": "/api/assets/" + value["video_key"]}
        if time.time() - path.stat().st_mtime < 180:
            return {"status": value["status"], "video_url": None}
    except (OSError, ValueError, KeyError, HTTPException):
        pass
    return {"status": "unavailable", "video_url": None}


async def render(settings, uid, audio_key, marker):
    value = {"status": "unavailable"}
    try:
        route = await gpu_client.pick(settings)
        if route is None:
            return
        if route == "modal":  # Modal-only prod has no local worker URL (GPU_WORKER_URL="").
            raw, _meta = await asyncio.wait_for(
                gpu_client.talk_video_modal(settings, uid, audio_key), gpu_client.MODAL_TIMEOUT)
            key = gram_video.video_key(settings, str(settings.asset_dir / raw), audio_key)
            value = {"status": "ready", "video_key": key}
            return
        async with httpx.AsyncClient(timeout=120) as client, asyncio.timeout(120):
            response = await client.post(
                gram_video.worker_base(settings) + "/avatar/talk_video?wait=true",
                json={"user_id": str(uid), "audio_path": audio_key, "max_seconds": 15},
            )
            response.raise_for_status()
            result = response.json()
            job = result.get("result") or result
            raw = job.get("video_path") or str(settings.asset_dir / job["video_key"])
            key = gram_video.video_key(settings, raw, audio_key)
            value = {"status": "ready", "video_key": key}
    except (httpx.HTTPError, TimeoutError, ValueError, KeyError, TypeError, OSError, HTTPException):
        pass
    finally:
        temporary = marker.with_suffix(".tmp")
        temporary.write_text(json.dumps(value))
        temporary.replace(marker)


def queue_clip(settings, uid, audio_key):
    state = clip_state(settings, audio_key)
    marker = asset_path(settings, audio_key).with_suffix(".chorus.json")
    # Exclusive creation deduplicates concurrent API processes. Stale work can be retried
    # only by a fresh explicit POST, never by polling.
    if (
        marker.exists()
        and time.time() - marker.stat().st_mtime >= 180
        and state["status"] != "ready"
    ):
        marker.unlink(missing_ok=True)
    try:
        with marker.open("x") as file:
            json.dump({"status": "pending"}, file)
    except FileExistsError:
        return state
    from app.security import charge

    try:
        charge(settings, "gpu")
    except HTTPException:
        marker.unlink(missing_ok=True)
        raise
    task = asyncio.create_task(render(settings, uid, audio_key, marker))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"status": "pending", "video_url": None}


class Chorus(Say):
    village_id: UUID | None = None
    member_ids: list[UUID] | None = Field(default=None, min_length=1, max_length=50)


@router.post("/heads/chorus")
async def chorus(
    data: Chorus,
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    if data.village_id:
        await require_member(conn, data.village_id, user["id"])
    people = await many(
        conn,
        """SELECT DISTINCT u.id FROM users u
        JOIN village_members m ON m.user_id=u.id
        JOIN village_members a ON a.village_id=m.village_id
        WHERE a.user_id=%s AND (%s::uuid IS NULL OR m.village_id=%s)
        AND (u.id=%s OR u.allow_voice_by_friends) ORDER BY u.id""",
        (user["id"], data.village_id, data.village_id, user["id"]),
    )
    members = []
    line = Say(text=data.text, preset_id=data.preset_id)
    for person in people:
        if data.member_ids is not None and person["id"] not in data.member_ids:
            continue
        try:
            result = await say(person["id"], line, request, user, conn)
            line = Say(text=result["text"])  # One surprise for the entire chorus.
            audio_key = result["audio_url"].removeprefix("/api/assets/")
            members.append(
                {
                    **result,
                    "user_id": person["id"],
                    **queue_clip(request.app.state.settings, person["id"], audio_key),
                }
            )
        except HTTPException as error:
            if isinstance(error, LimitExceeded):
                raise
            await conn.rollback()
            members.append(
                {
                    "user_id": person["id"],
                    "audio_url": None,
                    "video_url": None,
                    "status": "error",
                    "error": error.detail,
                    "code": error.status_code,
                }
            )
            if data.preset_id == "surprise" and line.preset_id == "surprise":
                break  # Do not repeat failed paid surprise calls for every member.
    return {"members": members}


@router.get("/heads/chorus/{line_id}")
async def poll(
    line_id: UUID,
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    result = await voice.get_line(conn, line_id)
    uid = result["user_id"]
    await require_peer(conn, user["id"], uid)
    speaker = await one(conn, "SELECT allow_voice_by_friends FROM users WHERE id=%s", (uid,))
    if uid != user["id"] and not speaker["allow_voice_by_friends"]:
        raise HTTPException(403, "Voice permission was revoked")
    return {
        **result,
        **clip_state(request.app.state.settings, result["audio_url"].removeprefix("/api/assets/")),
    }
