import asyncio
import hashlib
import secrets
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime
from uuid import UUID

import httpx
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from psycopg.types.json import Jsonb

from app import (
    account,
    claims,
    auditor,
    barks,
    bribes,
    competitions,
    domain,
    goal_stretch,
    group_photo,
    mayor,
    presence,
    reactions,
    reading,
    realtime,
    scheduler,
    social,
    solana,
    voice,
    weekly,
    world,
)
from app.assets import asset_path, save_image
from app.assets_cache import AssetGZipMiddleware, cached_asset
from app.auth import current_user, member, require_member, require_peer, service_auth
from app.config import Settings
from app.db import connection, make_pool, many, one
from app.models import (
    CheckInInput,
    CreateVillage,
    EventCompletion,
    EvidenceReview,
    Failed,
    GoalStatus,
    Inbound,
    JoinVillage,
    Nudge,
    Prayer,
    ProfilePatch,
    Purchase,
    ReviewOverride,
    Sent,
    SetGoal,
    VoiceInput,
)
from app.read_cache import ReadCacheMiddleware
from app.repair_plans import LabRepairInput


def create_app(settings=None):
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(application):
        application.state.pool = make_pool(settings)
        await application.state.pool.open(wait=True)
        from app.overworld import load_rooms
        application.state.world_rooms = await load_rooms(application.state.pool)
        application.state.world_rooms_lock = asyncio.Lock()
        from dataclasses import replace

        application.state.house_pool = (
            make_pool(replace(settings, database_url=settings.tiger_database_url))
            if settings.tiger_database_url
            else application.state.pool
        )
        if settings.tiger_database_url:
            await application.state.house_pool.open(wait=True)
        task = (
            asyncio.create_task(scheduler.run(application.state.pool, settings))
            if settings.mayor_scheduler
            else None
        )
        try:
            yield
        finally:
            for room in application.state.world_rooms.values():
                if room.task:
                    room.task.cancel()
                    with suppress(asyncio.CancelledError, Exception):
                        await room.task
            if task:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
            if settings.tiger_database_url:
                await application.state.house_pool.close()
            await application.state.pool.close()

    application = FastAPI(title="Village API", version="4.0.0", lifespan=lifespan)
    from app.security import SecurityMiddleware

    application.add_middleware(ReadCacheMiddleware)
    application.add_middleware(AssetGZipMiddleware)
    application.add_middleware(SecurityMiddleware, settings=settings)
    application.state.settings = settings
    from fastapi.exceptions import RequestValidationError
    from fastapi.responses import JSONResponse

    @application.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        return JSONResponse(status_code=422, content={"detail": "Invalid request fields"})

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "X-Demo-User", "Content-Type", "If-None-Match"],
        expose_headers=["ETag"],
    )
    from app import houses

    application.include_router(houses.router, prefix="/api")
    from app import auth_face, item_colors, photo_items

    photo_items.register(application, auth_face.extend(router))
    application.include_router(auth_face.router, prefix="/api")
    application.include_router(item_colors.router, prefix="/api")
    application.include_router(reading.router, prefix="/api")
    application.include_router(goal_stretch.router, prefix="/api")
    application.include_router(weekly.router, prefix="/api")
    application.include_router(competitions.router, prefix="/api")
    application.include_router(solana.router, prefix="/api")
    application.include_router(group_photo.router, prefix="/api")
    from app import demo, memory, newspaper

    application.include_router(demo.router, prefix="/api")

    application.include_router(memory.router, prefix="/api")
    application.include_router(newspaper.router, prefix="/api")
    application.include_router(social.router, prefix="/api")
    application.include_router(bribes.router, prefix="/api")
    application.include_router(presence.router, prefix="/api")
    application.include_router(realtime.router, prefix="/api")
    application.include_router(reactions.router, prefix="/api")
    application.include_router(account.router, prefix="/api")
    application.include_router(claims.router, prefix="/api")
    from app import chorus, heads, villagergrams

    application.include_router(villagergrams.router, prefix="/api")
    application.include_router(heads.router, prefix="/api")
    application.include_router(chorus.router, prefix="/api")
    return application


router = APIRouter()


@router.get("/health")
async def health(request: Request):
    db_ok = False
    try:
        async with request.app.state.pool.connection() as conn:
            db_ok = bool(await one(conn, "SELECT 1 AS ok"))
    except Exception:
        pass
    gpu = "down"
    try:
        async with httpx.AsyncClient(timeout=1) as client:
            response = await client.get(request.app.state.settings.gpu_worker_url)
            if response.is_success:
                gpu = "up"
    except httpx.HTTPError:
        pass
    return {
        "ok": db_ok,
        "db": "up" if db_ok else "down",
        "gpu_worker": gpu,
        "build": request.app.state.settings.build,
    }


async def has_equipped_pet(conn, uid):
    row = await one(
        conn,
        """SELECT EXISTS (
        SELECT 1 FROM inventory i JOIN catalog_items c ON c.id=i.item_id
        WHERE i.user_id=%s AND i.equipped AND NOT i.away AND c.slot='pet'
        UNION ALL SELECT 1 FROM custom_items WHERE owner=%s AND equipped AND NOT away AND slot='pet'
    ) AS equipped""",
        (uid, uid),
    )
    return row["equipped"]


@router.get("/me")
async def me(user=Depends(current_user), conn=Depends(connection, scope="function")):
    villages = await many(
        conn,
        """SELECT v.id,v.name,m.role,m.joined_at,EXISTS(SELECT 1 FROM weekly_audits w
        WHERE w.village_id=v.id AND w.week_start=%s AND w.auditor_id=m.user_id)
        AS is_auditor_this_week FROM villages v JOIN village_members m
        ON m.village_id=v.id WHERE m.user_id=%s ORDER BY m.joined_at,v.id""",
        (domain.monday(), user["id"]),
    )
    public = {
        key: user[key]
        for key in (
            "id",
            "display_name",
            "idle_activity",
            "phone_e164",
            "roast_ok",
            "agent_msgs_ok",
            "allow_voice_by_friends",
            "receive_villagergrams",
            "voice_id",
            "voice_consent",
            "voice_consent_at",
            "voice_consent_version",
        )
    }
    public["has_equipped_pet"] = await has_equipped_pet(conn, user["id"])
    return {"user": public, "villages": villages}


@router.patch("/me")
async def patch_me(
    data: ProfilePatch, user=Depends(current_user), conn=Depends(connection, scope="function")
):
    from psycopg import sql

    fields = data.model_dump(exclude_unset=True)
    if fields.get("idle_activity") == "gardening":
        blocked = await one(
            conn,
            (
                "SELECT 1 FROM village_world w JOIN village_members m ON "
                "m.village_id=w.village_id WHERE m.user_id=%s AND "
                "w.disaster->>'kind'='blight' LIMIT 1"
            ),
            (user["id"],),
        )
        if blocked:
            raise HTTPException(409, "Gardening is unavailable until the blight is repaired")
    if fields.get("idle_activity") == "walk_pet" and not await has_equipped_pet(conn, user["id"]):
        raise HTTPException(422, "Equip a pet before choosing Walking Pet.")
    vid = fields.pop("village_id", None)
    house = {
        key: fields.pop(key)
        for key in ("house_style", "house_colors", "house_variant", "house_materials")
        if key in fields
    }
    if house:
        if vid is None:
            raise HTTPException(422, "village_id is required for house settings")
        await require_member(conn, vid, user["id"])
        await conn.execute(
            sql.SQL("UPDATE village_members SET {} WHERE village_id=%s AND user_id=%s").format(
                sql.SQL(",").join(sql.SQL("{}=%s").format(sql.Identifier(k)) for k in house)
            ),
            (*(Jsonb(v) if isinstance(v, dict) else v for v in house.values()), vid, user["id"]),
        )
    if fields:
        user = await one(
            conn,
            sql.SQL("UPDATE users SET {} WHERE id=%s RETURNING *").format(
                sql.SQL(",").join(sql.SQL("{}=%s").format(sql.Identifier(k)) for k in fields)
            ),
            (*fields.values(), user["id"]),
        )
    await conn.execute(
        """UPDATE mayor_outbox o SET status='failed',claimed_until=NULL
        WHERE o.kind='villagergram' AND o.status IN ('pending','claimed') AND (
          (o.user_id=%s AND (NOT %s OR o.phone_e164 IS DISTINCT FROM %s)) OR
          (NOT %s AND EXISTS (SELECT 1 FROM villagergrams g WHERE g.id=o.villagergram_id
          AND g.speaker_id=%s)))""",
        (
            user["id"],
            user["receive_villagergrams"],
            user["phone_e164"],
            user["allow_voice_by_friends"],
            user["id"],
        ),
    )
    return await me(user, conn)


@router.post("/me/voice")
async def clone_voice(
    request: Request,
    files: list[UploadFile] = File(...),
    consent: bool = Form(False),
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    return await voice.clone(conn, request.app.state.settings, user, files, consent)


@router.delete("/me/voice")
async def delete_voice(
    request: Request, user=Depends(current_user), conn=Depends(connection, scope="function")
):
    return await voice.delete_clone(conn, request.app.state.settings, user)


@router.post("/villages")
async def create_village(
    data: CreateVillage, user=Depends(current_user), conn=Depends(connection, scope="function")
):
    village = await one(
        conn,
        """INSERT INTO villages (name,seed,invite_code)
        VALUES (%s,%s,%s) RETURNING *""",
        (data.name, secrets.randbelow(2**31), secrets.token_hex(8).upper()),
    )
    await conn.execute(
        """INSERT INTO village_members (village_id,user_id,role,house_slot)
        VALUES (%s,%s,'owner',0)""",
        (village["id"], user["id"]),
    )
    await domain.activity(conn, village["id"], user["id"], "village_created", {"name": data.name})
    return {"village": village}


@router.post("/villages/join")
async def join_village(
    data: JoinVillage, user=Depends(current_user), conn=Depends(connection, scope="function")
):
    # Village lock makes house-slot assignment safe when multiple friends join together.
    village = await one(
        conn, "SELECT * FROM villages WHERE invite_code=%s FOR UPDATE", (data.invite_code.upper(),)
    )
    if not village:
        raise HTTPException(404, "Invite not found")
    joined = await one(
        conn,
        """SELECT 1 FROM village_members WHERE village_id=%s AND user_id=%s""",
        (village["id"], user["id"]),
    )
    if not joined:
        slot = (
            await one(
                conn,
                """SELECT COALESCE(max(house_slot),-1)+1 AS slot
            FROM village_members WHERE village_id=%s""",
                (village["id"],),
            )
        )["slot"]
        await conn.execute(
            """INSERT INTO village_members (village_id,user_id,house_slot)
            VALUES (%s,%s,%s)""",
            (village["id"], user["id"], slot),
        )
        await domain.activity(conn, village["id"], user["id"], "village_joined")
    return {"village": village}


@router.get("/villages/{vid}")
async def get_village(vid: UUID, user=Depends(member), conn=Depends(connection, scope="function")):
    village = await one(conn, "SELECT id,name,seed FROM villages WHERE id=%s", (vid,))
    roles = await one(
        conn,
        """SELECT (SELECT role FROM village_members WHERE village_id=%s AND user_id=%s) AS my_role,
        (SELECT user_id FROM village_members WHERE village_id=%s AND role='owner'
         ORDER BY joined_at LIMIT 1) AS owner_user_id""",
        (vid, user["id"], vid),
    )
    village["my_role"] = roles["my_role"]
    village["owner_user_id"] = roles["owner_user_id"]
    registry = await domain.runtime_catalog(conn)
    village["world"] = await world.state(conn, vid, registry=registry)
    village["villagers"] = await domain.villagers(conn, vid, registry=registry)
    village["active_events"] = await many(
        conn,
        f"""SELECT {domain.EVENT_FIELDS} FROM mayor_events
        WHERE village_id=%s AND status='active' AND (ends_at IS NULL OR ends_at>now())
        ORDER BY created_at DESC""",
        (vid,),
    )
    return village


@router.get("/villages/{vid}/feed")
async def feed(
    vid: UUID,
    limit: int = Query(50, ge=1, le=200),
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    rows = await many(
        conn,
        """SELECT e.id,e.created_at,e.user_id,e.type,e.payload,u.display_name,
        EXISTS (SELECT 1 FROM check_ins c WHERE c.village_id=e.village_id
          AND c.id::text=e.payload->>'check_in_id' AND c.evidence_asset_id IS NOT NULL)
          AS has_evidence
        FROM activity_events e LEFT JOIN users u ON u.id=e.user_id WHERE e.village_id=%s
        AND ltrim(COALESCE(e.payload->>'body','')) NOT ILIKE 'QA-%%'
        AND ltrim(COALESCE(e.payload->>'text','')) NOT ILIKE 'QA-%%'
        AND ltrim(COALESCE(e.payload->>'status_line','')) NOT ILIKE 'QA-%%'
        -- Scheduler no-op ticks (~20/hour) would push every real event out of the window (R-181).
        AND NOT (e.type='agent_decision' AND COALESCE(e.payload->>'action','')='none')
        ORDER BY e.created_at DESC,e.id DESC LIMIT %s""",
        (vid, limit),
    )
    result = []
    for row in rows:
        text = domain.feed_text(row)
        if row.pop("has_evidence", False):
            row["payload"]["has_evidence"] = True
        row.pop("display_name", None)
        # Delivery metadata, including phone numbers, is for the service endpoint only.
        row["payload"] = {k: v for k, v in row["payload"].items() if k != "delivery"}
        result.append(dict(row, text=text))
    return await reactions.attach(conn, vid, user["id"], result, "activity")


@router.get("/villages/{vid}/users/{uid}")
async def profile(
    vid: UUID, uid: UUID, user=Depends(member), conn=Depends(connection, scope="function")
):
    result = await domain.villager(conn, vid, uid)
    goals = await many(
        conn,
        f"""SELECT {domain.GOAL_FIELDS} FROM goals
        WHERE village_id=%s AND user_id=%s ORDER BY week_start DESC""",
        (vid, uid),
    )
    await goal_stretch.attach(conn, goals)
    await reactions.attach(conn, vid, user["id"], goals, "goal")
    current = next((g for g in goals if g["week_start"] == domain.monday()), None)
    check_ins = await many(
        conn,
        f"""SELECT {domain.CHECKIN_FIELDS} FROM check_ins
        WHERE village_id=%s AND user_id=%s AND ltrim(body) NOT ILIKE 'QA-%%'
        ORDER BY created_at DESC LIMIT 100""",
        (vid, uid),
    )
    return {
        "villager": result,
        "goal": current,
        "past_goals": [g for g in goals if g != current],
        "check_ins": [domain.checkin_result(row) for row in check_ins],
    }


@router.post("/villages/{vid}/goals")
async def goals(
    vid: UUID, data: SetGoal, user=Depends(member), conn=Depends(connection, scope="function")
):
    return await domain.set_goal(conn, vid, user["id"], data)


@router.post("/villages/{vid}/check-ins")
async def check_ins(
    vid: UUID,
    data: CheckInInput,
    request: Request,
    background: BackgroundTasks,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    if data.evidence_asset_id:
        asset_path(request.app.state.settings, data.evidence_asset_id)
    result = await domain.check_in(conn, vid, user["id"], data)
    if data.evidence_asset_id and result["check_in"].get("review") is None:
        from app.security import charge

        if getattr(request.app.state.settings, "google_api_key", ""):
            charge(request.app.state.settings, "llm", consume=False)
        background.add_task(
            auditor.review_check_in,
            request.app.state.pool,
            request.app.state.settings,
            result["check_in"]["id"],
        )
    return result


@router.post("/villages/{vid}/evidence")
async def evidence(
    vid: UUID,
    request: Request,
    file: UploadFile = File(...),
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    settings = request.app.state.settings
    key, _ = await save_image(settings, file, f"evidence/{vid}/{user['id']}")
    try:
        await domain.activity(
            conn, vid, user["id"], "evidence_uploaded", {"evidence_asset_id": key}
        )
    except Exception:
        (settings.asset_dir / key).unlink(missing_ok=True)
        raise
    return {"evidence_asset_id": key}


@router.get("/villages/{vid}/shop")
async def shop(vid: UUID, user=Depends(member), conn=Depends(connection, scope="function")):
    await world.state(conn, vid)
    items = await many(
        conn,
        """SELECT c.id,c.kind,c.name,c.price_coins,c.asset_key,c.slot,c.voice_style,
        COALESCE(c.requires_building,c.requires) AS requires,
        c.requires AS requires_item,c.requires_building,
        i.acquired_at,COALESCE(i.away,false) AS away,
        COALESCE(i.colors, '{}'::jsonb) AS colors, (i.item_id IS NOT NULL) AS owned
        FROM catalog_items c LEFT JOIN inventory i
        ON i.item_id=c.id AND i.village_id=%s AND i.user_id=%s ORDER BY c.price_coins,c.id""",
        (vid, user["id"]),
    )
    from app.catalog import runtime_catalog

    registry = await runtime_catalog(conn)
    for item in items:
        entry = registry.entries.get(item["id"], {})
        item.update(
            {key: entry[key] for key in ("description", "source", "rarity", "tint") if key in entry}
        )
    return {"items": items, "balance": await domain.coin_balance(conn, vid, user["id"])}


@router.post("/villages/{vid}/shop/buy")
async def buy(
    vid: UUID, data: Purchase, user=Depends(member), conn=Depends(connection, scope="function")
):
    return await domain.purchase(conn, vid, user["id"], data.item_id)


@router.post("/villages/{vid}/inventory/equip")
async def equip_item(
    vid: UUID, data: Purchase, user=Depends(member), conn=Depends(connection, scope="function")
):
    return await domain.equip(conn, vid, user["id"], data.item_id)


@router.post("/villages/{vid}/inventory/unequip")
async def unequip_item(
    vid: UUID, data: Purchase, user=Depends(member), conn=Depends(connection, scope="function")
):
    return await domain.equip(conn, vid, user["id"], data.item_id, enabled=False)


async def make_event(request, conn, vid, user, mode, text=""):
    adapter = mayor.Mayor(request.app.state.settings)
    proposal = await adapter.event(mode, await mayor.context_for(conn, vid), text)
    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
    result = await mayor.insert_event(conn, vid, user["id"], proposal, adapter.last_source)
    await scheduler.log_decision(conn, vid, mode, "Explicit member request", adapter.last_source)
    return result


@router.post("/villages/{vid}/mayor/pray")
async def pray(
    vid: UUID,
    data: Prayer,
    request: Request,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    return await make_event(request, conn, vid, user, "pray", data.text)


@router.post("/villages/{vid}/mayor/recap")
async def recap(
    vid: UUID,
    request: Request,
    narration: bool = Query(False, alias="voice"),
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    result = await make_event(request, conn, vid, user, "recap")
    if narration:
        line = await voice.create_line(
            conn,
            request.app.state.settings,
            user,
            result["body"],
            stock=True,
            expr_user=user,
            require_head=True,
        )
        result.update(
            audio_url=line["audio_url"],
            expr_url=line["expr_url"],
            job_id=line["job_id"],
            line_id=line["id"],
        )
    return result


@router.post("/villages/{vid}/mayor/nudge")
async def nudge(
    vid: UUID,
    data: Nudge,
    request: Request,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    await require_member(conn, vid, data.target_user_id)
    result, source = await scheduler.send_nudge(
        conn, request.app.state.settings, vid, data.target_user_id
    )
    await scheduler.log_decision(
        conn,
        vid,
        "nudge" if result else "none",
        "Explicit member request" if result else source,
        source if result else "server",
        data.target_user_id,
    )
    return result or {"text": "[AI Mayor] " + source, "audio_url": None}


@router.post("/villages/{vid}/scene-voice/{kind}")
async def scene_voice(
    vid: UUID,
    kind: str,
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    await require_member(conn, vid, user["id"])
    from app.budget import village_context

    village_context.set(vid)
    return await voice.scene_greeting(conn, request.app.state.settings, user, kind)


@router.post("/voice/lines")
async def voice_lines(
    data: VoiceInput,
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    await require_peer(conn, user["id"], data.user_id)
    target = await one(conn, "SELECT * FROM users WHERE id=%s FOR UPDATE", (data.user_id,))
    if not target:
        raise HTTPException(404, "User not found")
    if target["id"] != user["id"] and not target["allow_voice_by_friends"]:
        raise HTTPException(403, "Speaker has not allowed friends to use their avatar/voice")
    text = data.text
    vid = data.village_id
    if vid is None:
        shared = await many(
            conn,
            "SELECT a.village_id FROM village_members a JOIN village_members b "
            "ON a.village_id=b.village_id WHERE a.user_id=%s AND b.user_id=%s "
            "ORDER BY a.village_id LIMIT 2",
            (user["id"], target["id"]),
        )
        if len(shared) == 1:
            vid = shared[0]["village_id"]
    if vid:
        await require_member(conn, vid, user["id"])
        await require_member(conn, vid, target["id"])
        from app.budget import village_context
        from app.styles import equipped_style, rewrite_line

        village_context.set(vid)
        style = await equipped_style(conn, vid, target["id"])
        text = await rewrite_line(request.app.state.settings, style, text)
    result = await voice.create_line(conn, request.app.state.settings, target, text)
    if target["id"] != user["id"]:
        await domain.user_activity(
            conn,
            target["id"],
            "friend_voice",
            {
                "text": f"{user['display_name']} made your villager say: {text}",
                "sender_id": str(user["id"]),
                "line_id": str(result["id"]),
            },
        )
    return result


@router.get("/voice/lines/{line_id}")
async def get_voice_line(
    line_id: UUID, user=Depends(current_user), conn=Depends(connection, scope="function")
):
    line = await voice.get_line(conn, line_id)
    await require_peer(conn, user["id"], line.pop("user_id"))
    return line


@router.get("/avatars/{uid}")
async def get_avatar(
    uid: UUID, user=Depends(current_user), conn=Depends(connection, scope="function")
):
    await require_peer(conn, user["id"], uid)
    if not await one(conn, "SELECT 1 FROM users WHERE id=%s", (uid,)):
        raise HTTPException(404, "User not found")
    return await domain.avatar(conn, uid)


@router.post("/avatars/{uid}/photo")
async def upload_photo(
    uid: UUID,
    request: Request,
    file: UploadFile = File(...),
    consent: bool = Form(False),
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    if uid != user["id"]:
        raise HTTPException(403, "Only upload your own photo")
    if not consent:
        raise HTTPException(422, "Photo processing consent required")
    # Serialize duplicate uploads for this user, without holding unrelated village locks.
    await conn.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (uid,))
    settings = request.app.state.settings
    key, digest = await save_image(settings, file, f"uploads/{uid}")
    idem = hashlib.sha256(f"{uid}:{digest}:segment:sam3:v1".encode()).hexdigest()
    existing = await one(conn, "SELECT id FROM avatar_jobs WHERE idem_key=%s", (idem,))
    if existing:
        (settings.asset_dir / key).unlink(missing_ok=True)
        return {"job_id": existing["id"]}
    try:
        from app.security import charge

        charge(settings, "gpu", count=3)  # segment -> head -> body
        job = await one(
            conn,
            """INSERT INTO avatar_jobs (user_id,stage,idem_key,input)
            VALUES (%s,'segment',%s,%s) RETURNING id""",
            (
                uid,
                idem,
                Jsonb(
                    {
                        "asset_key": key,
                        "photo_asset_key": key,
                        "portrait_placeholder": user["portrait_placeholder"],
                        "consent": True,
                        "sha256": digest,
                        "user_id": str(uid),
                    }
                ),
            ),
        )
        await domain.user_activity(conn, uid, "avatar_queued", {"job_id": str(job["id"])})
    except Exception:
        (settings.asset_dir / key).unlink(missing_ok=True)
        raise
    return {"job_id": job["id"]}


@router.get("/jobs/{job_id}")
async def job_status(
    job_id: UUID, user=Depends(current_user), conn=Depends(connection, scope="function")
):
    job = await one(
        conn, "SELECT id,user_id,stage,status,error FROM avatar_jobs WHERE id=%s", (job_id,)
    )
    if not job:
        raise HTTPException(404, "Job not found")
    if job.pop("user_id") != user["id"]:
        raise HTTPException(403, "Only the owner can inspect a job")
    # Worker error strings can contain private paths/provider details.
    if job["error"]:
        job["error"] = "Avatar processing failed; try another photo."
    return job


@router.get("/villages/{vid}/barks")
async def bark_manifest(
    vid: UUID, request: Request, user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    users = await many(
        conn, "SELECT u.* FROM users u JOIN village_members m ON m.user_id=u.id "
        "WHERE m.village_id=%s", (vid,),
    )
    return {str(u["id"]): barks.manifest(request.app.state.settings, u) for u in users}


@router.get("/barks/{uid}/{line}")
async def bark_audio(
    uid: UUID, line: str, request: Request, user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    await require_peer(conn, user["id"], uid)
    speaker = await one(conn, "SELECT * FROM users WHERE id=%s", (uid,))
    if (line not in barks.SUBSET or not speaker
            or not speaker["voice_consent"] or not speaker["voice_id"]):
        raise HTTPException(404, "Bark unavailable")
    path = asset_path(request.app.state.settings, barks.cache_key(speaker["voice_id"], line))
    return FileResponse(
        path, media_type="audio/mpeg", headers={"Cache-Control": "private, no-store"},
    )


@router.api_route("/assets/{key:path}", methods=["GET", "HEAD"])
async def get_asset(
    key: str,
    request: Request,
    user=Depends(current_user),
    conn=Depends(connection, scope="function"),
):
    path = asset_path(request.app.state.settings, key)
    parts = key.split("/")
    try:
        if len(parts) >= 4 and parts[0] == "group-photos":
            await require_member(conn, UUID(parts[1]), user["id"])
            await group_photo.job_for(conn, UUID(parts[1]), UUID(parts[2]))
        elif len(parts) >= 3 and parts[0] == "villages":
            # Group-photo crops: villages/<vid>/group/<job>/ (docs/cv/cv005.md).
            await require_member(conn, UUID(parts[1]), user["id"])
        elif len(parts) >= 3 and parts[0] == "evidence":
            await require_member(conn, UUID(parts[1]), user["id"])
        elif len(parts) >= 3 and parts[0] == "uploads":
            if UUID(parts[1]) != user["id"]:
                raise HTTPException(403, "Private upload")
        elif len(parts) >= 3 and parts[0] in {"voice", "avatars", "items"}:
            await require_peer(conn, user["id"], UUID(parts[1]))
            if parts[0] == "voice" and path.suffix == ".mp4" and UUID(parts[1]) != user["id"]:
                speaker = await one(
                    conn, "SELECT allow_voice_by_friends FROM users WHERE id=%s", (UUID(parts[1]),)
                )
                if not speaker or not speaker["allow_voice_by_friends"]:
                    raise HTTPException(403, "Voice permission was revoked")
        else:
            # Workers may choose keys independently: allow exact manifest references only.
            manifests = await many(
                conn,
                """SELECT DISTINCT a.manifest FROM avatar_assets a
                WHERE a.user_id=%s OR EXISTS (SELECT 1 FROM village_members x
                JOIN village_members y USING (village_id) WHERE x.user_id=%s
                AND y.user_id=a.user_id)""",
                (user["id"], user["id"]),
            )
            if not any(manifest_has_asset(m["manifest"], key) for m in manifests):
                raise HTTPException(403, "Asset access denied")
    except ValueError:
        raise HTTPException(404, "Asset not found") from None
    return cached_asset(path, request)


def manifest_has_asset(value, key):
    if isinstance(value, dict):
        return any(manifest_has_asset(v, key) for v in value.values())
    if isinstance(value, list):
        return any(manifest_has_asset(v, key) for v in value)
    return value == f"/api/assets/{key}"


@router.post("/internal/inbound", dependencies=[Depends(service_auth)])
async def inbound(
    data: Inbound,
    request: Request,
    background: BackgroundTasks,
    conn=Depends(connection, scope="function"),
):
    from app.auth import attribute_phone
    from app.inbound import handle

    await attribute_phone(conn, data.phone_e164)
    result = await handle(data, request, conn, background)
    from app.security import charge

    if data.text.strip().upper() == "STOP":
        # Exhausted reply allowance must never roll back an opt-out.
        await conn.commit()
    charge(request.app.state.settings, "photon")
    return result


@router.post("/internal/inbound/evidence", dependencies=[Depends(service_auth)])
async def inbound_evidence(
    request: Request,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    phone_e164: str = Form(..., pattern=r"^\+[1-9]\d{6,14}$"),
    caption: str = Form("", max_length=4000),
    message_id: str | None = Form(None, min_length=1, max_length=480),
    conn=Depends(connection, scope="function"),
):
    from app.auth import attribute_phone
    from app.inbound_evidence import upload

    await attribute_phone(conn, phone_e164)
    result = await upload(phone_e164, caption, message_id, file, request, background, conn)
    from app.security import charge

    charge(request.app.state.settings, "photon")
    return result


@router.get("/internal/assets/{key:path}", dependencies=[Depends(service_auth)])
async def internal_asset(key: str, request: Request):
    return FileResponse(
        asset_path(request.app.state.settings, key),
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/internal/outbox", dependencies=[Depends(service_auth)])
async def outbox(
    request: Request,
    limit: int = Query(100, ge=1, le=100),
    conn=Depends(connection, scope="function"),
):
    rows = await many(
        conn,
        """WITH candidates AS (
        SELECT o.id FROM mayor_outbox o JOIN users u ON u.id=o.user_id
        JOIN village_members m ON m.user_id=o.user_id AND m.village_id=o.village_id
        WHERE (o.status='pending' OR (o.status='claimed' AND o.claimed_until<=now()))
        AND (o.video_pending_until IS NULL OR o.video_pending_until<=now())
        AND u.phone_e164=o.phone_e164
        AND ((o.kind<>'villagergram' AND u.agent_msgs_ok) OR
          (o.kind='villagergram' AND u.receive_villagergrams AND EXISTS (
            SELECT 1 FROM villagergrams g JOIN users s ON s.id=g.speaker_id
            JOIN village_members sm ON sm.user_id=s.id AND sm.village_id=g.village_id
            JOIN village_members fm ON fm.user_id=g.sender_id AND fm.village_id=g.village_id
            WHERE g.id=o.villagergram_id AND s.allow_voice_by_friends)))
        ORDER BY o.created_at,o.id LIMIT %s FOR UPDATE OF o SKIP LOCKED)
        UPDATE mayor_outbox o SET status='claimed',claimed_until=now()+interval '2 minutes'
        FROM candidates c WHERE o.id=c.id
        RETURNING o.id,o.user_id,o.phone_e164,o.text,o.audio_key,o.image_key,o.video_key,o.kind""",
        (limit,),
    )
    from app.security import LimitExceeded, charge

    admitted = []
    denied = None
    for row in rows:
        try:
            # Spectrum sends text, audio, and either video or image separately.
            units = 1 + bool(row["audio_key"]) + bool(row["video_key"] or row["image_key"])
            charge(request.app.state.settings, "photon", seat=row["user_id"], count=units)
            admitted.append(row)
        except LimitExceeded as exc:
            denied = exc
            await conn.execute(
                "UPDATE mayor_outbox SET status='pending',claimed_until=NULL WHERE id=%s",
                (row["id"],),
            )
    if denied and not admitted:
        raise denied
    rows = admitted
    return [
        {
            "id": r["id"],
            "phone_e164": r["phone_e164"],
            "text": r["text"],
            "kind": r["kind"],
            "image_url": f"/api/internal/assets/{r['image_key']}" if r["image_key"] else None,
            "audio_url": f"/api/internal/assets/{r['audio_key']}" if r["audio_key"] else None,
            "video_url": f"/api/internal/assets/{r['video_key']}" if r["video_key"] else None,
        }
        for r in rows
    ]


@router.post("/internal/outbox/{message_id}/sent", dependencies=[Depends(service_auth)])
async def mark_sent(
    message_id: UUID, data: Sent = Sent(), conn=Depends(connection, scope="function")
):
    row = await one(conn, "SELECT * FROM mayor_outbox WHERE id=%s FOR UPDATE", (message_id,))
    if not row:
        raise HTTPException(404, "Outbox message not found")
    if row["status"] == "sent":
        return {"ok": True}
    if row["status"] != "claimed":
        raise HTTPException(409, "Message must be claimed before acknowledgement")
    await conn.execute(
        """UPDATE mayor_outbox SET status='sent',sent_at=now(),claimed_until=NULL,
        provider_msg_id=%s WHERE id=%s""",
        (data.provider_msg_id, message_id),
    )
    await domain.activity(
        conn, row["village_id"], row["user_id"], "outbox_sent", {"message_id": str(message_id)}
    )
    return {"ok": True}


@router.post("/internal/outbox/{message_id}/failed", dependencies=[Depends(service_auth)])
async def mark_failed(message_id: UUID, data: Failed, conn=Depends(connection, scope="function")):
    row = await one(conn, "SELECT * FROM mayor_outbox WHERE id=%s FOR UPDATE", (message_id,))
    if not row:
        raise HTTPException(404, "Outbox message not found")
    if row["status"] in {"sent", "failed"}:
        return {"ok": True}
    if row["status"] != "claimed":
        raise HTTPException(409, "Message must be claimed before acknowledgement")
    await conn.execute(
        "UPDATE mayor_outbox SET status='failed',claimed_until=NULL WHERE id=%s", (message_id,)
    )
    # Provider error strings can contain secrets; deliberately do not persist raw error text.
    await domain.activity(
        conn,
        row["village_id"],
        row["user_id"],
        "outbox_failed",
        {"message_id": str(message_id), "reason": "Delivery provider reported failure"},
    )
    return {"ok": True}


async def checkin_row(conn, vid, cid):
    row = await one(conn, "SELECT * FROM check_ins WHERE village_id=%s AND id=%s", (vid, cid))
    if not row:
        raise HTTPException(404, "Check-in not found")
    return row


async def require_owner(conn, vid, uid):
    membership = await require_member(conn, vid, uid)
    if membership["role"] != "owner":
        raise HTTPException(403, "Village owner required")


@router.get("/villages/{vid}/check-ins/{cid}/review")
async def get_review(
    vid: UUID, cid: UUID, user=Depends(member), conn=Depends(connection, scope="function")
):
    await checkin_row(conn, vid, cid)
    return await one(
        conn,
        """SELECT verdict,confidence,reason,model FROM evidence_reviews
        WHERE check_in_id=%s ORDER BY created_at DESC,id DESC LIMIT 1""",
        (cid,),
    )


@router.post("/villages/{vid}/check-ins/{cid}/review/override")
async def override_review(
    vid: UUID,
    cid: UUID,
    data: ReviewOverride,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    await require_owner(conn, vid, user["id"])
    row = await checkin_row(conn, vid, cid)
    if not row["evidence_asset_id"]:
        raise HTTPException(409, "Check-in has no evidence")
    result = EvidenceReview(verdict="verified", confidence=1, reason=data.reason)
    xp = await auditor.store_review(conn, row, result, "owner:" + str(user["id"]))
    return {"review": result.model_dump(), "xp_awarded": xp}


@router.post("/villages/{vid}/goals/{gid}/status")
async def goal_status(
    vid: UUID,
    gid: UUID,
    data: GoalStatus,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    goal = await goal_stretch.editable(conn, vid, gid)
    if await one(conn, "SELECT 1 FROM goal_stretches WHERE goal_id=%s", (gid,)):
        raise HTTPException(409, "Update the current stretch tier instead")
    if not goal:
        raise HTTPException(404, "Goal not found")
    if goal["user_id"] != user["id"]:
        await require_owner(conn, vid, user["id"])
    if data.status == "done" and goal["status"] != "done":
        await domain.activity(
            conn,
            vid,
            goal["user_id"],
            "goal_completed",
            {"goal_id": str(gid), "title": goal["title"]},
        )
    return await one(
        conn,
        f"""UPDATE goals SET status=%s,completed_at=CASE
        WHEN %s='done' THEN COALESCE(completed_at,now()) ELSE NULL END
        WHERE id=%s RETURNING {domain.GOAL_FIELDS}""",
        (data.status, data.status, gid),
    )


@router.post("/villages/{vid}/events/{eid}/complete")
async def complete_event(
    vid: UUID,
    eid: UUID,
    data: EventCompletion,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    await require_owner(conn, vid, user["id"])
    await world.state(conn, vid)
    event = await one(
        conn, "SELECT * FROM mayor_events WHERE village_id=%s AND id=%s FOR UPDATE", (vid, eid)
    )
    if not event:
        raise HTTPException(404, "Event not found")
    if event["status"] in {"failed", "expired"} or (
        event["status"] == "active" and event["ends_at"] and event["ends_at"] <= datetime.now(UTC)
    ):
        raise HTTPException(409, "Event cannot be completed")
    active = (await one(conn, "SELECT disaster FROM village_world WHERE village_id=%s", (vid,)))[
        "disaster"
    ]
    if active and active["repair_event_id"] == str(eid):
        raise HTTPException(409, "This repair completes automatically through shared check-ins")
    awarded = 0
    for uid in sorted(set(data.user_ids)):
        await require_member(conn, vid, uid, lock=True)
        awarded += await domain.award(
            conn, vid, uid, event["reward_xp"], "mayor_event", f"event:{eid}:{uid}"
        )
        if event["reward_xp"] > 0:
            from app.rewards import grant

            await grant(conn, vid, uid, "mayor_event")
            if event["template_id"] == "game_night":
                await grant(conn, vid, uid, "festival_vip")
    await conn.execute("UPDATE mayor_events SET status='completed' WHERE id=%s", (eid,))
    if event["repairs_event_id"] and event["status"] != "completed":
        await domain.activity(
            conn,
            vid,
            user["id"],
            "penalty_repaired",
            {"event_id": str(event["repairs_event_id"]), "repair_event_id": str(eid)},
        )
        await world.announce(
            conn, vid, "repair", "The event penalty is repaired; its fog has lifted."
        )
    await world.state(conn, vid)
    return {"event_id": eid, "status": "completed", "xp_awarded": awarded}


@router.get("/villages/{vid}/agent-log")
async def agent_log(
    vid: UUID,
    limit: int = Query(50, ge=1, le=200),
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    rows = await many(
        conn,
        """SELECT created_at,payload FROM activity_events WHERE village_id=%s
        AND type IN ('agent_decision','evidence_reviewed')
        ORDER BY created_at DESC,id DESC LIMIT %s""",
        (vid, limit),
    )
    return [
        {
            "created_at": r["created_at"],
            **({"repair_plan": r["payload"]["repair_plan"]} if "repair_plan" in r["payload"] else {}),
            **{
                k: r["payload"].get(k)
                for k in ("agent", "action", "target_user_id", "reason", "model")
            },
        }
        for r in rows
    ]


@router.post("/lab/repair-plan")
async def lab_repair_plan(data: LabRepairInput, request: Request):
    """Explicit sandbox generation. No pool, auth lookup, history or world writes."""
    import json
    from fastapi.responses import StreamingResponse
    from app.repair_plans import choose_plan
    from app.mayor import MODEL

    async def stream():
        def event(value):
            return json.dumps(value) + "\n"
        yield event({'status': 'Reading the example group’s recent activity.', 'model': MODEL})
        yield event({'status': 'Considering repair options for this disaster.'})
        plan = await choose_plan(data.kind, 4, request.app.state.settings, stateless=True)
        yield event({'status': 'Repair tasks selected.', 'plan': plan})

    return StreamingResponse(stream(), media_type='application/x-ndjson',
                             headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})


app = create_app()
