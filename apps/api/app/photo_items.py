"""Consent-gated CV-006 jobs and private custom inventory; no direct worker calls."""

import re
from functools import wraps
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.routing import APIRoute
from psycopg.types.json import Jsonb

from app import assets, domain
from app.auth import member, require_member
from app.catalog import runtime_catalog
from app.db import connection, many, one

router = APIRouter()


def register(application, base_router):
    """Extend the village projection at router registration, retaining its dependencies.

    world.py is integrator-owned. Re-register this one endpoint with the same
    signature rather than mutate that module or buffer unrelated HTTP/SSE responses.
    """
    combined = APIRouter()
    for route in base_router.routes:
        if (
            isinstance(route, APIRoute)
            and route.path == "/villages/{vid}"
            and "GET" in route.methods
        ):
            endpoint = route.endpoint

            @wraps(endpoint)
            async def village_with_pack(*args, **kwargs):
                from app.scheduler import project_event_pack

                result = await endpoint(*args, **kwargs)
                result["world"] = await project_event_pack(
                    kwargs["conn"], kwargs["vid"], result["world"]
                )
                return result

            combined.add_api_route(route.path, village_with_pack, methods=["GET"])
        else:
            combined.routes.append(route)
    application.include_router(combined, prefix="/api")
    application.include_router(router, prefix="/api")


async def materialize(conn, job):
    try:
        return await _materialize(conn, job)
    except HTTPException as exc:
        # Persist failure so the database refunds even if the browser closes.
        await conn.execute(
            "UPDATE avatar_jobs SET status='failed',error=%s WHERE id=%s", (exc.detail, job["id"])
        )
        job["status"], job["error"] = "failed", exc.detail
        return None


async def _materialize(conn, job):
    if job["status"] != "done":
        return None
    existing = await one(conn, "SELECT * FROM custom_items WHERE source_job=%s", (job["id"],))
    if existing:
        return existing
    data = job["result"] or {}
    if not isinstance(data, dict):
        raise HTTPException(502, "Worker returned invalid item data")
    outfit = job["input"]["kind"] == "outfit_from_photo"
    if data.get("kind") != job["input"]["kind"]:
        raise HTTPException(502, "Worker returned an invalid item kind")
    prefix = f"/api/assets/items/{job['user_id']}/{job['id']}/"

    def url(key):
        value = data.get(key)
        if not isinstance(value, str) or not value.startswith(prefix):
            raise HTTPException(502, "Worker returned an invalid item asset")
        tail = value[len(prefix) :]
        extension = "glb" if key == "glb_url" else "png"
        if not re.fullmatch(r"[A-Za-z0-9_-]+\." + extension, tail):
            raise HTTPException(502, "Worker returned an invalid item asset")
        return value

    tint = data.get("tint") if outfit else None
    if outfit and (
        data.get("slot") != job["input"]["slot"]
        or not isinstance(tint, dict)
        or any(
            not re.fullmatch(r"#[0-9a-fA-F]{6}", str(tint.get(k))) for k in ("primary", "secondary")
        )
    ):
        raise HTTPException(502, "Worker returned invalid outfit properties")
    return await one(
        conn,
        """INSERT INTO custom_items
        (village_id,owner,kind,slot,tint,pattern_url,glb_url,preview,source_job)
        VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(source_job)
        DO UPDATE SET source_job=EXCLUDED.source_job RETURNING *""",
        (
            job["village_id"],
            job["user_id"],
            "outfit" if outfit else "object",
            job["input"]["slot"] if outfit else "decoration",
            Jsonb(tint) if tint else None,
            url("pattern_png_url") if outfit else None,
            None if outfit else url("glb_url"),
            url("cutout_png_url" if outfit else "preview_png_url"),
            job["id"],
        ),
    )


@router.post("/villages/{vid}/items/from-photo", status_code=202)
async def from_photo(
    vid: UUID,
    request: Request,
    kind: Literal["outfit", "object"] = Form(...),
    consent: bool = Form(...),
    slot: Literal["torso", "head"] | None = Form(None),
    prompt: str | None = Form(None),
    file: UploadFile = File(...),
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    if not consent:
        raise HTTPException(422, "Photo processing consent is required")
    if (kind == "outfit" and slot is None) or (kind == "object" and slot is not None):
        raise HTTPException(422, "Outfits require a torso/head slot; objects have no outfit slot")
    if prompt is not None and not re.fullmatch(r"[A-Za-z][A-Za-z -]{0,39}", prompt):
        raise HTTPException(422, "Prompt must be a short noun phrase")
    uid = user["id"]
    await require_member(conn, vid, uid, lock=True)
    token = await one(
        conn,
        "SELECT id FROM photo_item_tokens WHERE village_id=%s AND user_id=%s "
        "AND consumed_at IS NULL ORDER BY id LIMIT 1 FOR UPDATE",
        (vid, uid),
    )
    if not token:
        raise HTTPException(
            409, "A photo token is required. Buy one in the shop or earn one from a Mayor event."
        )
    key, _ = await assets.save_image(request.app.state.settings, file, f"uploads/{uid}")
    jid = uuid4()
    data = {
        "kind": kind + "_from_photo",
        "photo_asset_key": key,
        "user_id": str(uid),
        "consent": True,
    }
    if slot:
        data["slot"] = slot
    if prompt:
        data["prompt"] = prompt
    from app.security import charge

    try:
        charge(request.app.state.settings, "gpu", count=2 if kind == "object" else 1)
    except HTTPException:
        (request.app.state.settings.asset_dir / key).unlink(missing_ok=True)
        raise
    await conn.execute(
        "INSERT INTO avatar_jobs(id,user_id,stage,idem_key,input) VALUES(%s,%s,'segment',%s,%s)",
        (jid, uid, f"photo-item:{jid}", Jsonb(data)),
    )
    await conn.execute("INSERT INTO photo_item_jobs VALUES(%s,%s,%s)", (jid, vid, uid))
    await conn.execute(
        "UPDATE photo_item_tokens SET consumed_at=now(),spent_job=%s WHERE id=%s",
        (jid, token["id"]),
    )
    return {"id": jid, "status": "queued", "item": None}


@router.get("/villages/{vid}/items/jobs/{jid}")
async def job_status(
    vid: UUID,
    jid: UUID,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    job = await one(
        conn,
        "SELECT j.*,p.village_id FROM avatar_jobs j JOIN photo_item_jobs p ON p.job_id=j.id "
        "WHERE j.id=%s AND p.village_id=%s AND p.user_id=%s",
        (jid, vid, user["id"]),
    )
    if not job:
        raise HTTPException(404, "Photo item job not found")
    item = await materialize(conn, job)
    return {
        "id": jid,
        "stage": job["stage"],
        "kind": job["input"]["kind"],
        "progress": (job["result"] or {}).get("stage"),
        "refunded": job["status"] == "failed",
        "status": job["status"],
        "error": "Photo item processing failed; try another photo." if job["error"] else None,
        "item": item,
    }


@router.get("/villages/{vid}/items")
async def inventory(vid: UUID, user=Depends(member), conn=Depends(connection, scope="function")):
    jobs = await many(
        conn,
        "SELECT j.*,p.village_id FROM avatar_jobs j JOIN photo_item_jobs p ON p.job_id=j.id "
        "WHERE p.village_id=%s AND p.user_id=%s AND j.status='done' "
        "AND NOT EXISTS(SELECT 1 FROM custom_items c WHERE c.source_job=j.id)",
        (vid, user["id"]),
    )
    for job in jobs:
        await materialize(conn, job)
    tokens = await one(
        conn,
        "SELECT count(*) AS n FROM photo_item_tokens WHERE village_id=%s AND user_id=%s "
        "AND consumed_at IS NULL",
        (vid, user["id"]),
    )
    return {
        "photo_item_tokens": tokens["n"],
        "items": await many(
            conn,
            "SELECT * FROM custom_items WHERE village_id=%s AND owner=%s ORDER BY created_at,id",
            (vid, user["id"]),
        ),
    }


@router.post("/villages/{vid}/items/token", status_code=201)
async def buy_token(vid: UUID, user=Depends(member), conn=Depends(connection, scope="function")):
    uid = user["id"]
    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
    await require_member(conn, vid, uid, lock=True)
    registry = await runtime_catalog(conn)
    entry = registry.entries.get("photo_token")
    item = await one(conn, "SELECT * FROM catalog_items WHERE id='photo_token'")
    if not entry or "shop" not in entry.get("tags", []) or not item:
        raise HTTPException(404, "Photo item tokens are not in the shop")
    await domain.check_requirements(conn, vid, uid, item)
    if await domain.coin_balance(conn, vid, uid) < item["price_coins"]:
        raise HTTPException(409, "Not enough coins")
    source = "photo-token:" + str(uuid4())
    await domain.coin_award(conn, vid, uid, -item["price_coins"], "purchase", source)
    return await one(
        conn,
        "INSERT INTO photo_item_tokens(village_id,user_id,source) VALUES(%s,%s,%s) RETURNING id",
        (vid, uid, source),
    )
