"""GPU worker routing (MODAL-001): local RTX 5090 worker first, Modal (transport mode) when it is down.

Local worker: shares data/assets with the API (paths/keys). Modal: can't see our disk, so inputs are uploaded as
multipart bytes and artifacts come back base64-encoded; we write them exactly where the local worker would have.
Selection: GPU_PREFER=local (default) -> local if its /health answers within 2 s, else GPU_FALLBACK_URL.
GPU_WORKER_URL="" -> Modal-only. Nothing configured -> None: features degrade (no video), the app keeps working.
GPU_PREFER=modal -> Modal if configured (testing). Never logs keys or payloads.
"""

import asyncio
import base64
from pathlib import Path

import httpx

from app.assets import asset_path

LOCAL_HEALTH_TIMEOUT = 2
MODAL_TIMEOUT = 600  # includes a cold start (container + model load)


def local_base(settings):
    return settings.gpu_worker_url.rstrip("/").removesuffix("/health")


def modal_configured(settings):
    return bool(settings.gpu_fallback_url and settings.gpu_fallback_key)


def modal_headers(settings):
    return {"X-GPU-Key": settings.gpu_fallback_key}


async def local_healthy(settings):
    try:
        async with asyncio.timeout(LOCAL_HEALTH_TIMEOUT), httpx.AsyncClient(timeout=LOCAL_HEALTH_TIMEOUT) as client:
            response = await client.get(local_base(settings) + "/health")
            response.raise_for_status()
        return True
    except (httpx.HTTPError, TimeoutError):
        return False


async def pick(settings):
    """-> "local" | "modal" | None (no GPU available)."""
    if settings.gpu_prefer == "modal" and modal_configured(settings):
        return "modal"
    # MODAL-002: GPU_WORKER_URL="" = Modal-only (never probes a local GPU); with no Modal either -> None (offline)
    if local_base(settings) and await local_healthy(settings):
        return "local"
    return "modal" if modal_configured(settings) else None


async def talk_video_modal(settings, user_id, audio_key, max_seconds=15):
    """Render on Modal; write <audio stem>.mp4 next to the audio. Returns (video_key, job_meta)."""
    audio = asset_path(settings, audio_key)
    udir = settings.asset_dir / "avatars" / str(user_id)
    face = udir / "face_512.png"
    if not face.is_file():
        raise ValueError("No LAM face for this user")
    prep = udir / "head" / "talk_prep.pt"
    files = {"audio": (audio.name, audio.read_bytes(), "application/octet-stream"),
             "face": ("face_512.png", face.read_bytes(), "image/png")}
    if prep.is_file():
        files["prep"] = ("talk_prep.pt", prep.read_bytes(), "application/octet-stream")
    # Modal answers requests > ~150 s with 303 + a polling token: follow it (POST -> GET) to collect the result.
    async with httpx.AsyncClient(timeout=MODAL_TIMEOUT, follow_redirects=True) as client:
        response = await client.post(settings.gpu_fallback_url + "/avatar/talk_video", headers=modal_headers(settings),
                                     data={"user_id": str(user_id), "max_seconds": str(max_seconds)}, files=files)
        response.raise_for_status()
        job = response.json()
    if job.get("status") != "ready" or not job.get("video_b64"):
        raise ValueError("Modal video job failed")
    out = audio.with_suffix(".mp4")
    out.write_bytes(base64.b64decode(job["video_b64"]))
    if job.get("prep_b64") and not prep.is_file():
        prep.parent.mkdir(parents=True, exist_ok=True)
        prep.write_bytes(base64.b64decode(job["prep_b64"]))  # next Modal/local call skips FLAME tracking
    key = out.resolve().relative_to(Path(settings.asset_dir).resolve()).as_posix()
    meta = {k: job.get(k) for k in ("cold", "model_load_s", "gpu_seconds", "gateway_s", "est_usd_total")}
    return key, meta
