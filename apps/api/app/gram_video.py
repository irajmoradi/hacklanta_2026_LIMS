"""Best-effort talking clips; delivery never waits beyond the persisted deadline."""

import asyncio
import logging
import os
import time
from pathlib import Path

import httpx
from fastapi import HTTPException

from app import gpu_client
from app.assets import asset_path
from app.db import one

VIDEO_TIMEOUT = 120
# Modal (scale-to-zero L4) cold start: gateway ~30 s + LAM load + render = 140-210 s, longer than the 120 s the gram
# was given at creation. When a render is routed to Modal we extend the persisted deadline (gram + its pending outbox
# row) so delivery waits for the video instead of dropping it.
MODAL_WAIT_S = int(os.getenv("GRAM_VIDEO_MODAL_WAIT_S", "300"))
log = logging.getLogger("village.gram_video")


async def extend_deadline(pool, gram_id, seconds):
    async with pool.connection() as conn:
        await conn.execute(
            """UPDATE villagergrams SET video_pending_until=GREATEST(video_pending_until,
            clock_timestamp()+make_interval(secs=>%s)) WHERE id=%s AND video_pending_until IS NOT NULL""",
            (seconds, gram_id),
        )
        await conn.execute(
            """UPDATE mayor_outbox SET video_pending_until=GREATEST(video_pending_until,
            clock_timestamp()+make_interval(secs=>%s)) WHERE villagergram_id=%s AND status='pending'
            AND video_pending_until IS NOT NULL""",
            (seconds, gram_id),
        )


def worker_base(settings):
    return settings.gpu_worker_url.rstrip("/").removesuffix("/health")


async def reachable(settings):
    """A GPU can render: the local worker answers, or the Modal fallback is configured (MODAL-001)."""
    if gpu_client.modal_configured(settings):
        return True
    try:
        async with asyncio.timeout(2), httpx.AsyncClient(timeout=2) as client:
            response = await client.get(worker_base(settings) + "/health")
            response.raise_for_status()
        return True
    except (httpx.HTTPError, TimeoutError):
        return False


def shared_path(path):
    """The GPU runs in WSL; both processes use the same asset volume."""
    value = Path(path).resolve().as_posix()
    if os.name == "nt" and len(value) > 2 and value[1] == ":":
        return "/mnt/" + value[0].lower() + value[2:]
    return value


def video_key(settings, raw, audio_key):
    # Accept only an existing MP4 next to this gram's audio, never arbitrary worker paths.
    if not isinstance(raw, str):
        raise ValueError("Missing video path")
    if os.name == "nt" and raw.startswith("/mnt/") and len(raw) > 7:
        raw = raw[5] + ":" + raw[6:]
    path = Path(raw).resolve()
    audio = asset_path(settings, audio_key)
    if path.parent != audio.parent or path.suffix.lower() != ".mp4":
        raise ValueError("Video must be an MP4 beside the gram audio")
    key = path.relative_to(settings.asset_dir.resolve()).as_posix()
    asset_path(settings, key)
    return key


async def render(pool, settings, gram_id, speaker_id, audio_key):
    key = None
    route = None
    t0 = time.monotonic()
    outcome = "error"
    try:
        route = await gpu_client.pick(settings)
        if route is None:
            outcome = "no_gpu"
            return  # Finally releases delivery to the existing voice + portrait fallback.
        if route == "modal":
            await extend_deadline(pool, gram_id, MODAL_WAIT_S)
            key, _meta = await asyncio.wait_for(
                gpu_client.talk_video_modal(settings, speaker_id, audio_key), gpu_client.MODAL_TIMEOUT)
            key = video_key(settings, str(settings.asset_dir / key), audio_key)
            outcome = "rendered"
            return
        async with (
            asyncio.timeout(VIDEO_TIMEOUT),
            httpx.AsyncClient(timeout=VIDEO_TIMEOUT) as client,
        ):
            response = await client.post(
                worker_base(settings) + "/avatar/talk_video?wait=true",
                json={
                    "user_id": str(speaker_id),
                    "audio_path": audio_key,  # key under data/assets (workers/gpu/TALK_VIDEO.md)
                    "max_seconds": 15,
                },
            )
            response.raise_for_status()
            result = response.json()
            if not isinstance(result, dict):
                raise ValueError("Invalid video response")
            # ?wait=true returns the finished job; the render result is nested under "result".
            job = result.get("result") if isinstance(result.get("result"), dict) else result
            if result.get("status") == "failed":
                raise ValueError("Video job failed")
            raw = job.get("video_path") or (
                str(settings.asset_dir / job["video_key"]) if isinstance(job.get("video_key"), str) else None
            )
            key = video_key(settings, raw, audio_key)
            outcome = "rendered"
    except (httpx.HTTPError, TimeoutError, ValueError, OSError, HTTPException) as e:
        outcome = f"failed:{type(e).__name__}"  # class only: no provider payloads or paths in logs
    finally:
        async with pool.connection() as conn:
            row = await one(
                conn,
                """UPDATE villagergrams SET video_key=
                CASE WHEN video_pending_until>now() THEN %s ELSE NULL END,
                video_pending_until=NULL WHERE id=%s RETURNING video_key""",
                (key, gram_id),
            )
            if row:
                await conn.execute(
                    """UPDATE mayor_outbox SET video_key=%s,
                    video_pending_until=NULL WHERE villagergram_id=%s AND status='pending'
                    AND video_pending_until>now()""",
                    (row["video_key"], gram_id),
                )
            if outcome == "rendered" and not (row and row["video_key"]):
                outcome = "late"  # rendered after the deadline: delivered without video
        (log.info if outcome == "rendered" else log.warning)(
            "gram video %s route=%s outcome=%s %.1fs", gram_id, route, outcome, time.monotonic() - t0)
