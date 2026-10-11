"""Server-owned, transaction-local cosmetic awards. Never spend XP or auto-equip."""

from datetime import timedelta

from app.catalog import runtime_catalog
from app.db import many, one


async def grant(conn, vid, uid, rule):
    registry = await runtime_catalog(conn)
    granted = []
    for item in registry.entries.values():
        if item.get("source") != f"earned:{rule}" or "earn_only" not in item.get("tags", []):
            continue
        row = await one(
            conn,
            """INSERT INTO inventory(village_id,user_id,item_id,equipped)
            VALUES (%s,%s,%s,false) ON CONFLICT DO NOTHING RETURNING item_id""",
            (vid, uid, item["id"]),
        )
        if row:
            granted.append(item["id"])
    return granted


def checkin_rules(days, today):
    """UTC calendar week and consecutive days; duplicates never count twice."""
    days = set(days)
    start = today - timedelta(days=today.weekday())
    rules = []
    if today.weekday() == 6 and all(start + timedelta(days=i) in days for i in range(7)):
        rules.append("perfect_week")
    if all(today - timedelta(days=i) in days for i in range(28)):
        rules.append("streak_28")
    return rules


async def checkins(conn, vid, uid, today):
    rows = await many(
        conn,
        """SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date AS day
        FROM check_ins WHERE village_id=%s AND user_id=%s
        AND (created_at AT TIME ZONE 'UTC')::date BETWEEN %s AND %s""",
        (vid, uid, today - timedelta(days=27), today),
    )
    for rule in checkin_rules([row["day"] for row in rows], today):
        await grant(conn, vid, uid, rule)
