import math
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException
from psycopg.types.json import Jsonb

from app.auth import require_member
from app.catalog import runtime_catalog
from app.db import many, one

VILLAGE_ID = UUID("13370000-0000-4000-8000-000000000000")
SEED_USERS = [
    (UUID(f"13370000-0000-4000-8000-{n:012d}"), name, shirt)
    for n, name, shirt in [
        (1, "Iraj", "#6c5ce7"),
        (2, "Lance", "#0984e3"),
        (3, "Stefanny", "#e84393"),
        (4, "Maya", "#00b894"),
        (5, "Mario", "#fdcb6e"),
    ]
]
GOAL_FIELDS = "id,user_id,week_start,title,detail,status,completed_at"
CHECKIN_FIELDS = """id,created_at,user_id,kind,body,goal_id,stretch_tier,evidence_asset_id,
repair_task,repair_event_id,
(SELECT jsonb_build_object('verdict',r.verdict,'confidence',r.confidence,'reason',r.reason)
 FROM evidence_reviews r WHERE r.check_in_id=check_ins.id
 ORDER BY r.created_at DESC,r.id DESC LIMIT 1) AS review"""
EVENT_FIELDS = (
    "id,kind,title,body,reward_xp,penalty,status,ends_at,model,created_at,repairs_event_id"
)


def monday():
    today = datetime.now(UTC).date()
    return today - timedelta(days=today.weekday())


async def activity(conn, vid, uid, kind, payload=None):
    return await one(
        conn,
        """INSERT INTO activity_events (village_id,user_id,type,payload)
        VALUES (%s,%s,%s,%s) RETURNING id,created_at""",
        (vid, uid, kind, Jsonb(payload or {})),
    )


async def user_activity(conn, uid, kind, payload):
    memberships = await many(
        conn, "SELECT village_id FROM village_members WHERE user_id=%s", (uid,)
    )
    for row in memberships:
        await activity(conn, row["village_id"], uid, kind, payload)


async def award(conn, vid, uid, delta, reason, source_key):
    if delta < 0:
        raise ValueError("XP is progress only; use coin_award for spending")
    # Caller holds the member row lock: purchases and awards cannot race the balance.
    inserted = await one(
        conn,
        """INSERT INTO xp_ledger (village_id,user_id,delta,reason,source_key)
        VALUES (%s,%s,%s,%s,%s) ON CONFLICT (source_key) DO NOTHING RETURNING id""",
        (vid, uid, delta, reason, source_key),
    )
    if inserted:
        await activity(conn, vid, uid, "xp", {"delta": delta, "reason": reason})
        after = await balance(conn, vid, uid)
        level = math.floor(math.sqrt(max(0, after) / 50)) + 1
        before_level = math.floor(math.sqrt(max(0, after - delta) / 50)) + 1
        if level > before_level:
            await activity(conn, vid, uid, "level_up", {"level": level})
        return delta
    return 0


async def balance(conn, vid, uid):
    return (
        await one(
            conn,
            """SELECT COALESCE(sum(delta),0)::int AS balance FROM xp_ledger
        WHERE village_id=%s AND user_id=%s AND delta>0""",
            (vid, uid),
        )
    )["balance"]


async def coin_award(conn, vid, uid, delta, reason, source_key):
    """Caller locks the member before balance checks; source keys make retries safe."""
    inserted = await one(
        conn,
        """INSERT INTO coin_ledger(village_id,user_id,delta,reason,source_key)
        VALUES (%s,%s,%s,%s,%s) ON CONFLICT(source_key) DO NOTHING RETURNING id""",
        (vid, uid, delta, reason, source_key),
    )
    return delta if inserted else 0


async def coin_balance(conn, vid, uid):
    return (
        await one(
            conn,
            """SELECT COALESCE(sum(delta),0)::int AS balance FROM coin_ledger
        WHERE village_id=%s AND user_id=%s""",
            (vid, uid),
        )
    )["balance"]


def preset(uid):
    shirt = next((color for user, _, color in SEED_USERS if user == uid), "#6c5ce7")
    return {
        "schema_version": 1,
        "user_id": str(uid),
        "revision": 0,
        "body": {
            "kind": "preset",
            "preset_id": "preset_default",
            "colors": {
                "hair": "#352b27",
                "shirt": shirt,
                "pants": "#34495e",
                "shoes": "#252525",
                "skin": "#c99573",
            },
        },
        "portrait": {"kind": "initials", "placeholder": True},
        "generation": {"segment": "none", "head": "none", "body": "none"},
    }


async def avatar(conn, uid):
    row = await one(
        conn,
        """SELECT manifest FROM avatar_assets WHERE user_id=%s
        ORDER BY revision DESC LIMIT 1""",
        (uid,),
    )
    if row:
        manifest = row["manifest"]
        user = await one(conn, "SELECT portrait_placeholder FROM users WHERE id=%s", (uid,))
        manifest.setdefault("portrait", {}).setdefault("placeholder", user["portrait_placeholder"])
        return manifest
    manifest = preset(uid)
    jobs = await many(
        conn,
        """SELECT DISTINCT ON (stage) stage,status FROM avatar_jobs
        WHERE user_id=%s ORDER BY stage,created_at DESC""",
        (uid,),
    )
    for job in jobs:
        if job["stage"] in manifest["generation"]:
            manifest["generation"][job["stage"]] = (
                "ready" if job["status"] == "done" else job["status"]
            )
    return manifest


async def villager(conn, vid, uid):
    rows = await villagers(conn, vid, uid)
    if not rows:
        raise HTTPException(404, "Villager not found")
    return rows[0]


async def villagers(conn, vid, uid=None, *, registry=None):
    """Seven reads regardless of village size; no cache survives this request."""
    rows = await many(
        conn,
        """SELECT m.user_id,u.display_name,u.idle_activity,u.portrait_placeholder,
        m.house_slot,m.house_level,m.house_style,m.house_colors,m.house_variant,m.house_materials,
        (SELECT COALESCE(sum(delta),0)::int FROM xp_ledger x
         WHERE x.village_id=m.village_id AND x.user_id=m.user_id AND x.delta>0) AS xp,
        (SELECT COALESCE(sum(delta),0)::int FROM xp_ledger x WHERE x.village_id=m.village_id AND x.user_id=m.user_id AND x.reason='treasury_devnet') AS treasury_xp,
        (SELECT COALESCE(sum(delta),0)::int FROM coin_ledger c
         WHERE c.village_id=m.village_id AND c.user_id=m.user_id) AS coins,
        (SELECT body FROM check_ins c WHERE c.village_id=m.village_id AND c.user_id=m.user_id
         AND ltrim(c.body) NOT ILIKE 'QA-%%'
         ORDER BY created_at DESC LIMIT 1) AS status_line,
        (SELECT manifest FROM avatar_assets a WHERE a.user_id=m.user_id
         ORDER BY revision DESC LIMIT 1) AS manifest,
        EXISTS(SELECT 1 FROM auditor_penalties p JOIN weekly_audits w ON w.id=p.week_id
         WHERE w.village_id=m.village_id AND p.user_id=m.user_id AND p.expires_at>now()) AS pet_sad,
        crown.id AS crown_week,crown.winner_id
        FROM village_members m JOIN users u ON u.id=m.user_id
        LEFT JOIN LATERAL (SELECT id,winner_id FROM weekly_audits w
         WHERE w.village_id=m.village_id AND status='finalized'
         ORDER BY week_start DESC LIMIT 1) crown ON true
        WHERE m.village_id=%s AND (%s::uuid IS NULL OR m.user_id=%s)
        ORDER BY m.house_slot""",
        (vid, uid, uid),
    )
    if not rows:
        return []
    ids = [row["user_id"] for row in rows]

    async def grouped(query, params):
        result = {key: [] for key in ids}
        for row in await many(conn, query, params):
            result[row.pop("user_id")].append(row)
        return result

    inventory = await grouped(
        """SELECT i.user_id,i.item_id,c.slot,c.asset_key,i.acquired_at,i.colors FROM inventory i
        JOIN catalog_items c ON c.id=i.item_id
        WHERE i.village_id=%s AND i.user_id=ANY(%s) AND i.equipped AND NOT i.away
        ORDER BY i.item_id""",
        (vid, ids),
    )
    custom = await grouped(
        """SELECT owner AS user_id,id::text AS item_id,slot,glb_url AS asset_key,kind,tint,
        pattern_url,glb_url,preview,created_at AS acquired_at,true AS custom,
        CASE WHEN kind='object' THEN 'house_decoration' END AS placement
        FROM custom_items WHERE village_id=%s AND owner=ANY(%s) AND equipped AND NOT away
        ORDER BY id""",
        (vid, ids),
    )
    days = await grouped(
        """SELECT DISTINCT user_id,(created_at AT TIME ZONE 'UTC')::date AS day
        FROM check_ins WHERE village_id=%s AND user_id=ANY(%s) ORDER BY day DESC""",
        (vid, ids),
    )
    badges = await grouped(
        """SELECT b.user_id,w.week_start FROM weekly_badges b
        JOIN weekly_audits w ON w.id=b.week_id WHERE w.village_id=%s AND b.user_id=ANY(%s)
        ORDER BY w.week_start DESC""",
        (vid, ids),
    )
    jobs = await grouped(
        """SELECT DISTINCT ON (user_id,stage) user_id,stage,status FROM avatar_jobs
        WHERE user_id=ANY(%s) ORDER BY user_id,stage,created_at DESC""",
        (ids,),
    )
    registry = registry or await runtime_catalog(conn)
    today = datetime.now(UTC).date()
    for row in rows:
        key = row["user_id"]
        items = inventory[key]
        for item in items:
            entry = registry.entries.get(item["item_id"], {})
            item.update(
                {
                    k: entry[k]
                    for k in ("name", "description", "source", "rarity", "tint")
                    if k in entry
                }
            )
        items.extend(custom[key])
        equipped = [item["item_id"] for item in items]
        cursor = today if days[key] and days[key][0]["day"] == today else today - timedelta(days=1)
        streak = 0
        for day in days[key]:
            if day["day"] != cursor:
                break
            streak += 1
            cursor -= timedelta(days=1)
        manifest = row.pop("manifest")
        placeholder = row.pop("portrait_placeholder")
        if manifest is not None:
            manifest.setdefault("portrait", {}).setdefault("placeholder", placeholder)
        else:
            manifest = preset(key)
            for job in jobs[key]:
                if job["stage"] in manifest["generation"]:
                    manifest["generation"][job["stage"]] = (
                        "ready" if job["status"] == "done" else job["status"]
                    )
        crown_week, winner = row.pop("crown_week"), row.pop("winner_id")
        row.update(
            level=math.isqrt(max(0, row["xp"]) // 50) + 1,
            streak_days=streak,
            avatar=manifest,
            equipped=items,
            equipped_ids=equipped,
            has_crown=winner == key if crown_week else "hat_crown" in equipped,
            star_badges=[{"week_start": b["week_start"], "kind": "star"} for b in badges[key]],
        )
    return rows


def checkin_result(row):
    result = dict(row)
    key = result.pop("evidence_asset_id", None)
    result["evidence_url"] = f"/api/assets/{key}" if key else None
    return result


async def check_in(conn, vid, uid, data):
    from app.disasters import sync

    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
    await sync(conn, vid)
    await require_member(conn, vid, uid, lock=True)
    # Global durable key and conflict wait protect all writers, including other members.
    cid = uuid4()
    reserved = await one(
        conn,
        """INSERT INTO check_in_keys (idempotency_key,check_in_id) VALUES (%s,%s)
        ON CONFLICT DO NOTHING RETURNING check_in_id""",
        (data.idempotency_key, cid),
    )
    if not reserved:
        prior = await one(
            conn,
            f"""SELECT {CHECKIN_FIELDS} FROM check_ins
            WHERE id=(SELECT check_in_id FROM check_in_keys WHERE idempotency_key=%s)
            AND village_id=%s AND user_id=%s""",
            (data.idempotency_key, vid, uid),
        )
        if not prior:
            raise HTTPException(409, "Idempotency key belongs to another check-in")
        return {"check_in": checkin_result(prior), "xp_awarded": 0}
    # Preserve keys created before v2 deployment.
    prior = await one(
        conn,
        f"""SELECT {CHECKIN_FIELDS} FROM check_ins
        WHERE idempotency_key=%s ORDER BY created_at LIMIT 1""",
        (data.idempotency_key,),
    )
    if prior:
        owner = await one(
            conn,
            "SELECT 1 FROM check_ins WHERE id=%s AND village_id=%s AND user_id=%s",
            (prior["id"], vid, uid),
        )
        if not owner:
            raise HTTPException(409, "Idempotency key belongs to another check-in")
        await conn.execute(
            "UPDATE check_in_keys SET check_in_id=%s WHERE idempotency_key=%s",
            (prior["id"], data.idempotency_key),
        )
        return {"check_in": checkin_result(prior), "xp_awarded": 0}
    repair_event_id = None
    if data.repair_task:
        world_row = await one(conn, "SELECT disaster FROM village_world WHERE village_id=%s", (vid,))
        disaster = world_row["disaster"] if world_row else None
        tasks = disaster.get("repair_plan", {}).get("tasks", []) if disaster else []
        if not data.evidence_asset_id or data.repair_task not in {t["kind"] for t in tasks}:
            raise HTTPException(422, "Choose an active repair task and attach a photo")
        repair_event_id = disaster["repair_event_id"]
    if data.evidence_asset_id:
        uploaded = await one(
            conn,
            """SELECT 1 FROM activity_events WHERE village_id=%s
            AND user_id=%s AND type='evidence_uploaded'
            AND payload->>'evidence_asset_id'=%s""",
            (vid, uid, data.evidence_asset_id),
        )
        if not uploaded:
            raise HTTPException(422, "Evidence must be uploaded by this villager in this village")
    if data.goal_id and not await one(
        conn,
        """SELECT id FROM goals
        WHERE id=%s AND village_id=%s AND user_id=%s""",
        (data.goal_id, vid, uid),
    ):
        raise HTTPException(422, "Goal must belong to this villager and village")
    if data.stretch_tier is not None and data.kind != "progress":
        raise HTTPException(422, "Stretch tiers require goal progress")
    if data.kind == "progress" and not data.goal_id:
        # Older clients omit goal_id. Resolve the current goal to keep its lock/tier rules.
        current = await one(
            conn, "SELECT id FROM goals WHERE village_id=%s AND user_id=%s AND week_start=%s",
            (vid, uid, monday()),
        )
        if current:
            data = data.model_copy(update={"goal_id": current["id"]})
        elif data.stretch_tier is not None:
            raise HTTPException(422, "Stretch progress requires a goal")
    if data.kind == "progress" and data.goal_id:
        from app.goal_stretch import editable, invalidate
        goal = await editable(conn, vid, data.goal_id)
        if goal["status"] == "stretch":
            if not await one(
                conn, "SELECT 1 FROM goal_stretches "
                "WHERE goal_id=%s AND tier=%s AND status='active'",
                (data.goal_id, data.stretch_tier),
            ):
                raise HTTPException(422, "Choose the current stretch tier")
        elif goal["status"] != "active" or data.stretch_tier is not None:
            raise HTTPException(422, "Goal is complete; go beyond to share more progress")
        await invalidate(conn, data.goal_id)
    row = await one(
        conn,
        f"""INSERT INTO check_ins
        (id,village_id,user_id,kind,body,goal_id,idempotency_key,evidence_asset_id,
         stretch_tier,repair_task,repair_event_id)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING {CHECKIN_FIELDS}""",
        (
            cid,
            vid,
            uid,
            data.kind,
            data.body,
            data.goal_id,
            data.idempotency_key,
            data.evidence_asset_id,
            data.stretch_tier,
            data.repair_task,
            repair_event_id,
        ),
    )
    source = (
        f"status:{vid}:{uid}:{row['created_at'].astimezone(UTC).date()}"
        if data.kind == "status"
        else f"checkin:{vid}:{uid}:{data.idempotency_key}"
    )
    xp = 0
    if data.kind == "status" or not data.evidence_asset_id:
        xp = await award(conn, vid, uid, 10 if data.kind == "status" else 25, "checkin", source)
    if data.kind == "status":
        gardener = await one(
            conn,
            (
                "SELECT 1 FROM users u JOIN village_unlocks l ON l.village_id=%s AND "
                "l.building='garden' LEFT JOIN village_world w ON "
                "w.village_id=l.village_id WHERE u.id=%s AND u.idle_activity='gardening' "
                "AND COALESCE(w.disaster->>'kind','')<>'blight'"
            ),
            (vid, uid),
        )
        if gardener:
            xp += await award(conn, vid, uid, 5, "garden", "garden:" + source)
    await activity(
        conn,
        vid,
        uid,
        "checkin",
        {"kind": data.kind, "body": data.body, "check_in_id": str(row["id"]),
         "has_evidence": bool(data.evidence_asset_id)},
    )
    from app.rewards import checkins

    await checkins(conn, vid, uid, row["created_at"].astimezone(UTC).date())
    await sync(conn, vid)
    return {"check_in": checkin_result(row), "xp_awarded": xp}


async def set_goal(conn, vid, uid, data):
    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
    finalized = await one(
        conn,
        """SELECT 1 FROM weekly_audits
        WHERE village_id=%s AND week_start=%s AND status='finalized'""",
        (vid, monday()),
    )
    if finalized:
        raise HTTPException(409, "This week's goals are finalized")
    await require_member(conn, vid, uid, lock=True)
    week = monday()
    if await one(
        conn, "SELECT 1 FROM goals g JOIN goal_stretches s ON s.goal_id=g.id "
        "WHERE g.village_id=%s AND g.user_id=%s AND g.week_start=%s", (vid, uid, week)
    ):
        raise HTTPException(409, "Your base goal is complete; extend it with stretch tiers")
    # A new title is a new goal: it must not inherit an earlier (e.g. seeded) completion.
    row = await one(
        conn,
        f"""INSERT INTO goals (village_id,user_id,week_start,title,detail)
        VALUES (%s,%s,%s,%s,%s) ON CONFLICT (village_id,user_id,week_start)
        DO UPDATE SET title=EXCLUDED.title,detail=EXCLUDED.detail,
        status=CASE WHEN goals.title IS DISTINCT FROM EXCLUDED.title
          THEN 'active' ELSE goals.status END,
        completed_at=CASE WHEN goals.title IS DISTINCT FROM EXCLUDED.title
          THEN NULL ELSE goals.completed_at END
        RETURNING {GOAL_FIELDS}""",
        (vid, uid, week, data.title, data.detail),
    )
    await award(conn, vid, uid, 20, "goal_set", f"goal:{vid}:{uid}:{week}")
    # Editing a goal invalidates earlier human and AI grades of its old contents.
    await conn.execute("DELETE FROM weekly_grades WHERE goal_id=%s", (row["id"],))
    await conn.execute("DELETE FROM weekly_suggestions WHERE goal_id=%s", (row["id"],))
    await activity(conn, vid, uid, "goal_set", {"title": data.title, "goal_id": str(row["id"])})
    return row


async def purchase(conn, vid, uid, item_id):
    if item_id == "revival_potion":
        from app.disasters import revive

        await require_member(conn, vid, uid)
        return await revive(conn, vid, uid)
    if item_id == "photo_token":
        from app.photo_items import buy_token

        await buy_token(vid, user={"id": uid}, conn=conn)
        return {
            "balance": await coin_balance(conn, vid, uid),
            "inventory": await many(
                conn,
                "SELECT item_id,equipped FROM inventory WHERE village_id=%s AND user_id=%s "
                "ORDER BY item_id",
                (vid, uid),
            ),
        }

    await require_member(conn, vid, uid)
    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
    await require_member(conn, vid, uid, lock=True)
    item = await one(conn, "SELECT * FROM catalog_items WHERE id=%s", (item_id,))
    if not item:
        raise HTTPException(404, "Item not found")
    owned = {
        row["item_id"]
        for row in await many(
            conn,
            """SELECT item_id FROM inventory
        WHERE village_id=%s AND user_id=%s""",
            (vid, uid),
        )
    }
    if item_id in owned:
        raise HTTPException(409, "Already owned")
    from app.disasters import sync

    await sync(conn, vid)
    active = (await one(conn, "SELECT disaster FROM village_world WHERE village_id=%s", (vid,)))[
        "disaster"
    ]
    if item["slot"] == "pet" and active and active.get("closed_building") == "pet_shelter":
        raise HTTPException(409, "Pet shelter: Closed for repairs")
    registry = await check_requirements(conn, vid, uid, item)
    if registry.entries.get(item_id, {}).get("source", "shop") != "shop":
        raise HTTPException(409, "Earn-only or event item: complete its unlock requirement")
    if (
        item["kind"] == "farm_animal"
        and sum(registry.entries.get(key, {}).get("kind") == "farm_animal" for key in owned) >= 6
    ):
        raise HTTPException(409, "Your paddock is full (6 animals)")
    current = await coin_balance(conn, vid, uid)
    if current < item["price_coins"]:
        raise HTTPException(409, "Insufficient coins")
    await clear_slot(conn, vid, uid, item["slot"])
    await conn.execute(
        """INSERT INTO inventory (village_id,user_id,item_id,equipped)
        VALUES (%s,%s,%s,%s)""",
        (vid, uid, item_id, item["kind"] != "consumable"),
    )
    await coin_award(
        conn,
        vid,
        uid,
        -item["price_coins"],
        "purchase",
        # Inventory + the member lock reject concurrent/retried owned purchases.
        # A new acquisition after demo inventory reset needs a fresh debit source.
        f"purchase:{vid}:{uid}:{item_id}:{uuid4()}",
    )
    entry = registry.entries.get(item_id, {})
    house_level = item_id.removeprefix("house_lv")
    if entry.get("kind") == "house" and house_level.isdecimal():
        await conn.execute(
            """UPDATE village_members SET house_level=GREATEST(house_level,%s)
            WHERE village_id=%s AND user_id=%s""",
            (int(house_level), vid, uid),
        )
    await activity(conn, vid, uid, "purchase", {"item_id": item_id, "name": item["name"]})
    return {
        "balance": current - item["price_coins"],
        "inventory": await many(
            conn,
            """SELECT item_id,equipped FROM inventory WHERE village_id=%s AND user_id=%s
        ORDER BY item_id""",
            (vid, uid),
        ),
    }


async def check_requirements(conn, vid, uid, item):
    from app import world

    registry = await runtime_catalog(conn)
    if item["id"] in registry.entries:
        owned = {
            row["item_id"]
            for row in await many(
                conn,
                "SELECT item_id FROM inventory WHERE village_id=%s AND user_id=%s",
                (vid, uid),
            )
        }
        village_world = await world.state(conn, vid)
        # Earned building unlocks are durable, including legacy grants made before
        # XP progression. They satisfy a redundant level gate on their dependents.
        # An independent/higher level requirement still uses current village XP.
        effective_level = max(
            [village_world["level"]]
            + [
                registry.entries[key].get("unlock", {}).get("village_level", 1)
                for key in registry.resolve_requires(item["id"])
                if key in village_world["unlocked"] and registry.entries[key]["kind"] == "building"
            ]
        )
        missing = registry.missing_requirements(
            item["id"],
            owned=owned,
            unlocked=village_world["unlocked"],
            village_level=effective_level,
        )
        if missing:
            raise HTTPException(409, "Requires " + ", ".join(missing))
        return registry

    # Preserve additive sync's external/legacy items and their existing gates.
    if item["requires"] and not await one(
        conn,
        "SELECT 1 FROM inventory WHERE village_id=%s AND user_id=%s AND item_id=%s",
        (vid, uid, item["requires"]),
    ):
        raise HTTPException(409, f"Requires {item['requires']}")
    if item["requires_building"]:
        village_world = await world.state(conn, vid)
        if item["requires_building"] not in village_world["unlocked"]:
            raise HTTPException(409, f"Requires building {item['requires_building']}")

    return registry


async def clear_slot(conn, vid, uid, slot):
    if slot in ("consumable", "farm_animal"):
        return
    await conn.execute(
        "UPDATE custom_items SET equipped=false WHERE village_id=%s AND owner=%s "
        "AND slot=%s AND equipped",
        (vid, uid, slot),
    )
    await conn.execute(
        "UPDATE inventory SET equipped=false WHERE village_id=%s AND user_id=%s "
        "AND slot=%s AND equipped",
        (vid, uid, slot),
    )


async def equip(conn, vid, uid, item_id, *, enabled=True):
    # Same lock order as purchase/world keeps concurrent equip and buy serialized.
    await require_member(conn, vid, uid)
    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
    await require_member(conn, vid, uid, lock=True)
    custom = await one(
        conn,
        "SELECT * FROM custom_items WHERE village_id=%s AND owner=%s AND id::text=%s",
        (vid, uid, item_id),
    )
    if custom:
        if enabled:
            await clear_slot(conn, vid, uid, custom["slot"])
        await conn.execute(
            "UPDATE custom_items SET equipped=%s WHERE id=%s", (enabled, custom["id"])
        )
        result = await villager(conn, vid, uid)
        return {key: result[key] for key in ("equipped", "equipped_ids")}
    item = await one(
        conn,
        "SELECT c.* FROM inventory i JOIN catalog_items c ON c.id=i.item_id "
        "WHERE i.village_id=%s AND i.user_id=%s AND i.item_id=%s",
        (vid, uid, item_id),
    )
    if not item:
        raise HTTPException(404, "Owned item not found")
    if item["kind"] == "consumable":
        raise HTTPException(422, "Consumables are used from the shop, not equipped")
    if not enabled and item_id == "house_paddock":
        raise HTTPException(409, "The paddock is a permanent house add-on")
    if enabled:
        await check_requirements(conn, vid, uid, item)
        await clear_slot(conn, vid, uid, item["slot"])
    await conn.execute(
        "UPDATE inventory SET equipped=%s WHERE village_id=%s AND user_id=%s AND item_id=%s",
        (enabled, vid, uid, item_id),
    )
    result = await villager(conn, vid, uid)
    return {key: result[key] for key in ("equipped", "equipped_ids")}


def feed_text(row):
    name, data, kind = row.get("display_name") or "Mayor", row["payload"], row["type"]
    if kind in {"villagergram", "friend_voice"}:
        return data.get("text", "Villager-gram queued")
    if kind in {"disaster_started", "disaster_repaired", "pets_away"}:
        return data.get("text", "The village is rebuilding.")
    if kind == "debug":
        return "\U0001f41e debug: " + data.get("text", "")
    if kind == "checkin":
        return f"{name} checked in: {data.get('body', '')}"
    if kind == "goal_set":
        return f"{name} set a weekly goal: {data.get('title', '')}"
    if kind == "reading_completed":
        return f"{name} finished reading {data.get('title', '')}"
    if kind == "stretch_completed":
        title = data.get("title", "").removeprefix("Went above & beyond: ")
        return f"{name} went above & beyond: {title} (+10 XP / coins)"
    if kind == "goal_completed":
        return f"{name} completed a goal: {data.get('title', '')}"
    if kind == "level_up":
        return f"{name} reached level {data.get('level')}!"
    if kind == "competition_won":
        return f"{name} won {data.get('title', 'a competition')}!"
    if kind == "badge_earned":
        return f"{name} earned {data.get('title', 'a badge')}!"
    if kind == "xp":
        return (
            f"{name} {'earned' if data.get('delta', 0) >= 0 else 'spent'} "
            f"{abs(data.get('delta', 0))} XP ({data.get('reason', '')})."
        )
    if kind == "hall_item_added":
        label = str(data.get("name", "photo object"))
        floor = int(data.get("floor", 0)) + 1
        return f"{name} added {label} to the Community Hall (floor {floor})."
    if kind == "purchase":
        return f"{name} bought {data.get('name', data.get('item_id', 'an item'))}."
    if kind in {"mayor_event", "mayor_message"}:
        return f"[AI Mayor] {data.get('title') or data.get('text', '')}"
    if kind == "agent_decision":
        agent = str(data.get("agent") or "mayor").replace("_", " ").capitalize()
        action = str(data.get("action") or "reviewed village activity").replace("_", " ")
        reason = str(data.get("reason") or "").strip()
        target = f" for {row['display_name']}" if row.get("display_name") else ""
        summary = f"[AI {agent}] {action}{target}"
        return f"{summary}: {reason}" if reason else f"{summary}."
    labels = {
        "village_created": "founded the village",
        "village_joined": "joined the village",
        "evidence_uploaded": "shared evidence",
        "avatar_queued": "queued an avatar photo",
        "voice_line": "created an AI voice line",
        "outbox_sent": "received a Mayor text",
    }
    return f"{name} {labels.get(kind, kind.replace('_', ' '))}."
