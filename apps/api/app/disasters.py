"""Recoverable, serialized world rules with bounded public repair plans."""

import random
from datetime import datetime, timedelta

from fastapi import HTTPException
from psycopg.types.json import Jsonb

from app.db import many, one

KINDS = {"scorch": 3, "outbreak": 2, "blackout": 3, "blight": 2}
COPY = {
    "scorch": (
        "Meteor scorch! The pet shelter is closed for repairs. Bring a broom, not a spaceship."
    ),
    "outbreak": (
        "The shelter pets are visiting the vet. Repair within 48 hours to keep "
        "your pets from wandering off."
    ),
    "blackout": "Storm blackout. The festival is off until the lights are back.",
    "blight": (
        "Garden blight! The bugs have overstayed their welcome. Gardening and its bonus are paused."
    ),
}


def choose(last, rng=random):
    keys = [key for key in KINDS if key != last]
    return rng.choices(keys, weights=[KINDS[key] for key in keys], k=1)[0]


async def lock(conn, vid):
    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
    await conn.execute(
        "INSERT INTO village_world(village_id) VALUES (%s) ON CONFLICT DO NOTHING", (vid,)
    )
    return await one(conn, "SELECT * FROM village_world WHERE village_id=%s", (vid,))


async def news(conn, vid, kind, text, event_id):
    from app.domain import activity

    await activity(conn, vid, None, kind, {"text": "[AI Mayor] " + text, "event_id": str(event_id)})
    row = await one(
        conn,
        (
            "SELECT id,content FROM village_gazettes WHERE village_id=%s AND "
            "edition_date=(now() AT TIME ZONE 'UTC')::date FOR UPDATE"
        ),
        (vid,),
    )
    if row:
        content = row["content"]
        content["stories"] = content.get("stories", [])[:4] + [
            {"text": text, "source": "mayor_events", "source_ids": [str(event_id)], "user_id": None}
        ]
        await conn.execute(
            "UPDATE village_gazettes SET content=%s WHERE id=%s", (Jsonb(content), row["id"])
        )


async def start(conn, vid, event, kind=None, settings=None):
    row = await lock(conn, vid)
    if row["disaster"]:
        raise HTTPException(409, "Repair the current disaster first")
    if kind is not None and (kind not in KINDS or kind == row["last_disaster"]):
        raise HTTPException(409, "Choose a different disaster from the previous one")
    kind = kind or choose(row["last_disaster"])
    count = (
        await one(conn, "SELECT count(*) AS n FROM village_members WHERE village_id=%s", (vid,))
    )["n"]
    # check_ins.created_at defaults to PostgreSQL's transaction timestamp.
    # Use that same clock, including when this transaction also adds a check-in.
    now = (await one(conn, "SELECT now() AS now"))["now"]
    people = max(1, min(3, count))
    from app.repair_plans import choose_plan
    recent = (await one(conn, "SELECT count(*) AS n FROM check_ins WHERE village_id=%s "
                        "AND created_at >= now() - interval '7 days'", (vid,)))["n"]
    plan = await choose_plan(kind, recent, settings)

    repair = await one(
        conn,
        """INSERT INTO mayor_events(village_id,kind,title,body,repairs_event_id,model)
        VALUES (%s,'challenge',%s,%s,%s,'world-disasters-v1') RETURNING id""",
        (
            vid,
            "Repair: " + kind.title(),
            f"[AI Mayor] {COPY[kind]} Complete the repair tasks with verified photo updates. Late repairs still count.",
            event,
        ),
    )
    await conn.execute(
        (
            "UPDATE mayor_events SET penalty=(SELECT penalty FROM mayor_events WHERE "
            "id=%s) WHERE id=%s"
        ),
        (event, repair["id"]),
    )
    value = dict(
        repair_plan=plan,
        kind=kind,
        title=kind.title(),
        body=COPY[kind],
        started_at=now.isoformat(),
        deadline=(now + timedelta(hours=48)).isoformat(),
        repair_event_id=str(repair["id"]),
        target_checkins=people * 2,
        target_people=people,
        checkins=0,
        people=0,
        closed_building="pet_shelter" if kind == "scorch" else None,
        pets_away=False,
    )
    await conn.execute(
        "UPDATE village_world SET disaster=%s,last_disaster=%s WHERE village_id=%s",
        (Jsonb(value), kind, vid),
    )
    from app.domain import activity
    await activity(conn, vid, None, "agent_decision", {
        "agent": "mayor", "action": "repair_plan", "reason": plan["reasoning"],
        "model": plan["model"], "repair_plan": plan,
    })
    await news(conn, vid, "disaster_started", COPY[kind], repair["id"])
    return value


async def finish(conn, vid):
    row = await lock(conn, vid)
    d = row["disaster"]
    if not d:
        return False
    await conn.execute(
        "UPDATE mayor_events SET status='completed' WHERE id=%s", (d["repair_event_id"],)
    )
    await conn.execute("UPDATE inventory SET away=false WHERE village_id=%s AND away", (vid,))
    await conn.execute("UPDATE custom_items SET away=false WHERE village_id=%s AND away", (vid,))
    await conn.execute(
        "UPDATE village_world SET disaster=NULL,rebuilt_at=now() WHERE village_id=%s", (vid,)
    )
    await news(
        conn,
        vid,
        "disaster_repaired",
        ("Rebuilt! The village is open, the garden is growing, and every wandering pet is home."),
        d["repair_event_id"],
    )
    return True


async def sync(conn, vid):
    row = await lock(conn, vid)
    await conn.execute(
        """UPDATE mayor_events SET status='failed' WHERE village_id=%s
        AND status='active' AND ends_at<=now() AND kind IN ('challenge','random_event')
        AND repairs_event_id IS NULL""",
        (vid,),
    )
    d = row["disaster"]
    if d:
        now = (await one(conn, "SELECT now() AS now"))["now"]
        progress = await one(
            conn,
            """SELECT count(*) AS checkins,count(DISTINCT c.user_id) AS people
            FROM check_ins c JOIN village_members m
            ON m.village_id=c.village_id AND m.user_id=c.user_id
            WHERE c.village_id=%s AND c.created_at>=%s""",
            (vid, max(datetime.fromisoformat(d["started_at"]), now - timedelta(hours=48))),
        )
        d.update(progress)
        complete = d["checkins"] >= d["target_checkins"] and d["people"] >= d["target_people"]
        if d.get("repair_plan"):
            counts = await many(conn, """SELECT c.repair_task,count(DISTINCT c.evidence_asset_id) AS n
                FROM check_ins c JOIN village_members m ON m.village_id=c.village_id AND m.user_id=c.user_id
                WHERE c.village_id=%s AND c.repair_event_id=%s AND c.evidence_asset_id IS NOT NULL
                AND (SELECT r.verdict FROM evidence_reviews r WHERE r.check_in_id=c.id
                     ORDER BY r.created_at DESC,r.id DESC LIMIT 1)='verified'
                GROUP BY c.repair_task""", (vid, d["repair_event_id"]))
            by_kind = {r["repair_task"]: r["n"] for r in counts}
            for task in d["repair_plan"]["tasks"]:
                task["progress"] = min(task["target"], by_kind.get(task["kind"], 0))
            complete = all(t["progress"] >= t["target"] for t in d["repair_plan"]["tasks"])
        if complete:
            await finish(conn, vid)
            return
        if (
            d["kind"] == "outbreak"
            and not d["pets_away"]
            and now >= datetime.fromisoformat(d["deadline"])
        ):
            await conn.execute(
                """UPDATE inventory i SET away=true FROM catalog_items c
                WHERE i.item_id=c.id AND i.village_id=%s AND i.equipped AND c.slot='pet'""",
                (vid,),
            )
            await conn.execute(
                "UPDATE custom_items SET away=true WHERE village_id=%s AND equipped AND slot='pet'",
                (vid,),
            )
            d["pets_away"] = True
            await news(
                conn,
                vid,
                "pets_away",
                (
                    "Our pets wandered off! A Revival potion or the shared repair brings them"
                    " home. Nothing is lost."
                ),
                d["repair_event_id"],
            )
        await conn.execute(
            "UPDATE village_world SET disaster=%s WHERE village_id=%s", (Jsonb(d), vid)
        )
        return
    failed = await one(
        conn,
        """SELECT e.id FROM mayor_events e WHERE e.village_id=%s AND e.status='failed'
        AND e.kind IN ('challenge','random_event') AND e.repairs_event_id IS NULL
        AND NOT EXISTS(SELECT 1 FROM mayor_events r WHERE r.repairs_event_id=e.id)
        ORDER BY e.created_at,e.id LIMIT 1""",
        (vid,),
    )
    if failed:
        await start(conn, vid, failed["id"])


async def revive(conn, vid, uid):
    from app.domain import coin_award, coin_balance

    await sync(conn, vid)
    pets = await many(
        conn,
        "SELECT item_id FROM inventory WHERE village_id=%s AND user_id=%s AND away",
        (vid, uid),
    )
    custom = await many(
        conn, "SELECT id FROM custom_items WHERE village_id=%s AND owner=%s AND away", (vid, uid)
    )
    if pets or custom:
        if await coin_balance(conn, vid, uid) < 30:
            raise HTTPException(409, "Insufficient coins")
        d = (await lock(conn, vid))["disaster"]
        await coin_award(
            conn, vid, uid, -30, "Revival potion", f"revive:{d['repair_event_id']}:{uid}"
        )
        await conn.execute(
            "UPDATE inventory SET away=false WHERE village_id=%s AND user_id=%s AND away",
            (vid, uid),
        )
        await conn.execute(
            "UPDATE custom_items SET away=false WHERE village_id=%s AND owner=%s AND away",
            (vid, uid),
        )
    return {
        "balance": await coin_balance(conn, vid, uid),
        "inventory": await many(
            conn,
            "SELECT item_id,equipped,away FROM inventory WHERE village_id=%s AND user_id=%s",
            (vid, uid),
        ),
    }
