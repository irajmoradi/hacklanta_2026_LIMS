"""Playful face recognition after login; never an authentication or liveness gate."""

import math
from datetime import timedelta
from functools import wraps

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.routing import APIRoute
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from app import domain
from app.auth import current_user
from app.db import connection, one

router = APIRouter()
MAX_SELFIE_BYTES = 8 * 1024 * 1024
UNAVAILABLE = "The village face check is taking a break. Please try again shortly."


class MemorySelfieParser(MultiPartParser):
    # The stream is bounded below this value, so no upload can roll onto disk.
    spool_max_size = MAX_SELFIE_BYTES + 65537


async def read_selfie(request):
    if request.headers.get("content-type", "").split(";", 1)[0].strip() != "multipart/form-data":
        raise HTTPException(415, "Please send a multipart selfie upload.")

    async def bounded_stream():
        size = 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > MAX_SELFIE_BYTES + 65536:
                raise HTTPException(413, "Please use a selfie smaller than 8 MiB.")
            yield chunk

    try:
        form = await MemorySelfieParser(
            request.headers, bounded_stream(), max_files=1, max_fields=4, max_part_size=65536
        ).parse()
    except MultiPartException:
        raise HTTPException(422, "Please send one valid multipart selfie file.") from None
    try:
        file = form.get("file")
        if not isinstance(file, UploadFile):
            raise HTTPException(422, "Please choose a selfie.")
        if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise HTTPException(415, "Please use a JPEG, PNG, or WebP selfie.")
        content = await file.read(MAX_SELFIE_BYTES + 1)
        if not content:
            raise HTTPException(422, "Please choose a selfie.")
        if len(content) > MAX_SELFIE_BYTES:
            raise HTTPException(413, "Please use a selfie smaller than 8 MiB.")
        return content, file.content_type
    finally:
        await form.close()


def extend(base_router):
    """Preserve the existing /me projection and dependencies at registration time."""
    combined = APIRouter()
    for route in base_router.routes:
        if isinstance(route, APIRoute) and route.path == "/me":
            if route.methods & {"GET", "PATCH"}:
                combined.add_api_route(
                    route.path, with_face_status(route.endpoint), methods=list(route.methods)
                )
                continue
        combined.routes.append(route)
    return combined


def with_face_status(endpoint):
    @wraps(endpoint)
    async def projected(*args, **kwargs):
        result = await endpoint(*args, **kwargs)
        row = await one(
            kwargs["conn"],
            """SELECT CASE WHEN face_verified_at > now() - interval '5 minutes'
            THEN face_verified_at END AS face_verified_at FROM users WHERE id=%s""",
            (kwargs["user"]["id"],),
        )
        result["user"]["face_verified_at"] = row["face_verified_at"]
        return result

    return projected


async def reserve_attempt(conn, uid):
    # Commit the authenticated user's reservation before worker I/O. Reuse the
    # request connection so concurrent requests cannot exhaust the pool waiting
    # for a second connection. Badge/flag writes happen in a subsequent transaction.
    await conn.execute(
        "INSERT INTO face_auth_limits(user_id) VALUES (%s) ON CONFLICT DO NOTHING", (uid,)
    )
    row = await one(
        conn, "SELECT attempts FROM face_auth_limits WHERE user_id=%s FOR UPDATE", (uid,)
    )
    now = (await one(conn, "SELECT clock_timestamp() AS now"))["now"]
    attempts = [at for at in row["attempts"] if at > now - timedelta(minutes=1)]
    if len(attempts) >= 5:
        retry = max(1, math.ceil((attempts[0] + timedelta(minutes=1) - now).total_seconds()))
        raise HTTPException(
            429,
            "Five face checks per minute. Please wait before trying again.",
            headers={"Retry-After": str(retry)},
        )
    await conn.execute(
        "UPDATE face_auth_limits SET attempts=%s WHERE user_id=%s", (attempts + [now], uid)
    )
    await conn.commit()


async def worker(request, action, **kwargs):
    # Existing config accepts either a base URL or the health-check URL.
    base = request.app.state.settings.gpu_worker_url.rstrip("/").removesuffix("/health")
    from app.security import charge

    charge(request.app.state.settings, "gpu")
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            response = await client.post(f"{base}/face/{action}", **kwargs)
    except httpx.HTTPError:
        raise HTTPException(503, UNAVAILABLE) from None
    if response.status_code == 404:
        raise HTTPException(404, "Upload an avatar photo before using the village face check.")
    if response.status_code == 422:
        raise HTTPException(422, "No usable face found. Please try a clear photo of your face.")
    if not response.is_success:
        raise HTTPException(503, UNAVAILABLE)
    try:
        data = response.json()
    except ValueError:
        raise HTTPException(503, UNAVAILABLE) from None
    fields = ("match", "face_found") if action == "verify" else ("enrolled", "face_found")
    if not isinstance(data, dict) or any(type(data.get(k)) is not bool for k in fields):
        raise HTTPException(503, UNAVAILABLE)
    return {key: data[key] for key in fields}


async def recognize(conn, uid):
    await conn.execute("UPDATE users SET face_verified_at=clock_timestamp() WHERE id=%s", (uid,))
    membership = await one(
        conn,
        """SELECT village_id FROM village_members WHERE user_id=%s
        ORDER BY joined_at,village_id LIMIT 1 FOR UPDATE""",
        (uid,),
    )
    if membership:
        # Zero XP is intentional: this playful badge should not affect competition scores.
        await domain.award(
            conn,
            membership["village_id"],
            uid,
            0,
            "Recognized by the village",
            f"face-recognized:{uid}",
        )


@router.post(
    "/auth/face-verify",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["file"],
                        "properties": {"file": {"type": "string", "format": "binary"}},
                    }
                }
            },
        }
    },
)
async def verify(
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    await reserve_attempt(conn, user["id"])
    content, content_type = await read_selfie(request)
    result = await worker(
        request,
        "verify",
        data={"user_id": str(user["id"]), "threshold": "0.40"},
        files={"file": ("selfie", content, content_type)},
    )
    # Fail closed even if a faulty worker reports match=true without a face.
    result["match"] = result["match"] and result["face_found"]
    if result["match"]:
        await recognize(conn, user["id"])
    return result


@router.post("/auth/face-enroll")
async def enroll(
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    await reserve_attempt(conn, user["id"])
    result = await worker(request, "enroll", json={"user_id": str(user["id"])})
    if result["enrolled"]:
        await conn.execute("UPDATE users SET face_verified_at=NULL WHERE id=%s", (user["id"],))
    return result
