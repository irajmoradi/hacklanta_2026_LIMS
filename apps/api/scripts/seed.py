"""Deterministic, additive seed; does not reset progress or call paid providers."""

import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402
from psycopg.types.json import Jsonb  # noqa: E402

from app.catalog_registry import sync_catalog  # noqa: E402
from app.config import Settings  # noqa: E402
from app.domain import SEED_USERS, VILLAGE_ID  # noqa: E402


def seed(conn):
    conn.execute("SELECT pg_advisory_xact_lock(1337001)")
    conn.execute(
        """INSERT INTO villages (id,name,seed,invite_code)
        VALUES (%s,'Hacklanta Crew',1337,'HACKLANTA') ON CONFLICT (id) DO NOTHING""",
        (VILLAGE_ID,),
    )
    sync_catalog(conn)
    today = datetime.now(UTC).date()
    week = today - timedelta(days=today.weekday())
    for slot, (uid, name, _) in enumerate(SEED_USERS):
        conn.execute(
            """INSERT INTO users (id,auth_issuer,auth_subject,display_name)
            VALUES (%s,'demo',%s,%s) ON CONFLICT (id) DO NOTHING""",
            (uid, str(uid), name),
        )
        conn.execute(
            """INSERT INTO village_members (village_id,user_id,role,house_slot)
            VALUES (%s,%s,%s,%s) ON CONFLICT (village_id,user_id) DO NOTHING""",
            (VILLAGE_ID, uid, "owner" if slot == 0 else "member", slot),
        )
        inserted = conn.execute(
            """INSERT INTO xp_ledger
            (village_id,user_id,delta,reason,source_key) VALUES (%s,%s,%s,'weekly_win',%s)
            ON CONFLICT (source_key) DO NOTHING RETURNING id""",
            (VILLAGE_ID, uid, 300 - slot * 35, f"seed:welcome:{uid}"),
        ).fetchone()
        if inserted:
            conn.execute(
                """INSERT INTO activity_events (village_id,user_id,type,payload)
                VALUES (%s,%s,'xp',%s)""",
                (VILLAGE_ID, uid, Jsonb({"delta": 300 - slot * 35, "reason": "weekly_win"})),
            )
        # Seed once per user, even when the command is rerun in a subsequent week.
        marker = f"seed:checkin:{uid}"
        if not conn.execute(
            "SELECT 1 FROM check_ins WHERE idempotency_key=%s", (marker,)
        ).fetchone():
            goal = conn.execute(
                """INSERT INTO goals (village_id,user_id,week_start,title)
                VALUES (%s,%s,%s,%s) ON CONFLICT (village_id,user_id,week_start)
                DO UPDATE SET title=goals.title RETURNING id""",
                (
                    VILLAGE_ID,
                    uid,
                    week,
                    [
                        "Ship the village",
                        "Finish onboarding",
                        "Style our houses",
                        "Walk every day",
                        "Keep the demo running",
                    ][slot],
                ),
            ).fetchone()
            body = f"{name} is making progress. One small step closer!"
            conn.execute(
                """INSERT INTO check_ins
                (village_id,user_id,kind,body,goal_id,idempotency_key)
                VALUES (%s,%s,'progress',%s,%s,%s)""",
                (VILLAGE_ID, uid, body, goal[0], marker),
            )
            for kind, payload in [
                ("goal_set", {"title": "Weekly demo goal"}),
                ("checkin", {"body": body, "kind": "progress"}),
            ]:
                conn.execute(
                    """INSERT INTO activity_events (village_id,user_id,type,payload)
                    VALUES (%s,%s,%s,%s)""",
                    (VILLAGE_ID, uid, kind, Jsonb(payload)),
                )
    event = conn.execute(
        """INSERT INTO mayor_events
        (id,village_id,kind,title,body,reward_xp,ends_at,model)
        VALUES ('13370000-0000-4000-8000-000000000100',%s,'challenge',
        'Touch Grass Together','[AI Mayor] Everyone post one tiny win this week.',
        100,now()+interval '7 days','seed') ON CONFLICT (id) DO NOTHING RETURNING id""",
        (VILLAGE_ID,),
    ).fetchone()
    if event:
        conn.execute(
            """INSERT INTO activity_events (village_id,type,payload)
            VALUES (%s,'mayor_event',%s)""",
            (VILLAGE_ID, Jsonb({"title": "Touch Grass Together", "event_id": str(event[0])})),
        )


if __name__ == "__main__":
    try:
        with psycopg.connect(Settings.from_env().database_url, connect_timeout=5) as conn:
            seed(conn)
    except Exception as exc:
        print(f"Seed failed ({type(exc).__name__}); run migration first.")
        sys.exit(1)
    print(f"Hacklanta Crew: {VILLAGE_ID} (invite HACKLANTA)")
    for uid, name, _ in SEED_USERS:
        print(f"{name}: {uid}")
