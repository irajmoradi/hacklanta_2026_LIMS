"""Durable village growth and recoverable cosmetic penalties; no provider calls."""

from datetime import UTC, datetime

from app.catalog import runtime_catalog
from app.catalog_registry import load_catalog
from app.db import many, one
from app.domain import activity

WEATHER = {"clear", "rain", "fog", "festival_night"}


def progression(xp):
    return load_catalog().progression(xp)


async def announce(conn, vid, action, reason):
    await activity(
        conn,
        vid,
        None,
        "agent_decision",
        {"agent": "mayor", "action": action, "reason": reason, "model": "world-rules-v1"},
    )


async def sync_penalties(conn, vid):
    from app.disasters import sync

    await sync(conn, vid)


async def state(conn, vid, *, registry=None):
    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
    await conn.execute(
        "INSERT INTO village_world(village_id) VALUES (%s) ON CONFLICT DO NOTHING", (vid,)
    )
    xp = (
        await one(
            conn,
            """SELECT COALESCE(sum(x.delta),0)::bigint AS xp FROM xp_ledger x
        JOIN village_members m ON m.village_id=x.village_id AND m.user_id=x.user_id
        WHERE x.village_id=%s AND x.delta>0 AND x.reason<>'treasury_devnet'""",
            (vid,),
        )
    )["xp"]
    registry = registry or await runtime_catalog(conn)
    level, next_xp = registry.progression(xp)
    buildings = registry.unlocked_buildings(len(registry.levels))
    for building in registry.unlocked_buildings(level):
        inserted = await one(
            conn,
            """INSERT INTO village_unlocks(village_id,building)
            VALUES (%s,%s) ON CONFLICT DO NOTHING RETURNING building""",
            (vid, building),
        )
        if inserted:
            await activity(
                conn, vid, None, "building_unlocked", {"building": building, "level": level}
            )
            await announce(
                conn,
                vid,
                "building_unlocked",
                f"[AI Mayor] The village unlocked {building.replace('_', ' ')}!",
            )
    await sync_penalties(conn, vid)
    unlocked = {
        r["building"]
        for r in await many(
            conn, "SELECT building FROM village_unlocks WHERE village_id=%s", (vid,)
        )
    }
    weather = (await one(conn, "SELECT weather FROM village_world WHERE village_id=%s", (vid,)))[
        "weather"
    ]
    pending = await one(
        conn,
        """SELECT 1 FROM mayor_events WHERE village_id=%s
        AND repairs_event_id IS NOT NULL AND status<>'completed' LIMIT 1""",
        (vid,),
    )
    row = await one(
        conn, "SELECT disaster,rebuilt_at FROM village_world WHERE village_id=%s", (vid,)
    )
    disaster = row["disaster"]
    blackout = disaster and disaster["kind"] == "blackout"
    hour = datetime.now(UTC).hour
    return {
        "level": level,
        "xp": xp,
        "next_level_xp": next_xp,
        "unlocked": [b for b in buildings if b in unlocked],
        "upcoming": [
            {"building": b, "level": row["level"], "xp": row["xp"]}
            for row in registry.levels
            for b in row["buildings"]
            if b not in unlocked
        ],
        "disaster": disaster,
        "rebuilt_at": row["rebuilt_at"],
        "gardening_available": not (disaster and disaster["kind"] == "blight"),
        "garden_xp_bonus": 5
        if "garden" in unlocked and not (disaster and disaster["kind"] == "blight")
        else 0,
        "weather": "rain"
        if blackout
        else "fog"
        if pending and not disaster and weather != "festival_night"
        else weather,
        "time_of_day": "night" if blackout else "day" if 6 <= hour < 18 else "night",
    }


async def set_weather(conn, vid, weather, reason):
    if weather not in WEATHER or not reason.strip():
        raise ValueError("Invalid weather or empty reason")
    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
    await conn.execute(
        "INSERT INTO village_world(village_id) VALUES (%s) ON CONFLICT DO NOTHING", (vid,)
    )
    d = (await one(conn, "SELECT disaster FROM village_world WHERE village_id=%s", (vid,)))[
        "disaster"
    ]
    if weather == "festival_night" and d and d["kind"] == "blackout":
        return False
    changed = await one(
        conn,
        """UPDATE village_world SET weather=%s,weather_changed_at=now()
        WHERE village_id=%s AND weather<>%s AND (weather_changed_at IS NULL
        OR weather_changed_at<=now()-interval '3 hours') RETURNING village_id""",
        (weather, vid, weather),
    )
    if changed:
        await announce(conn, vid, "weather", f"{weather}: {reason}")
    return bool(changed)
