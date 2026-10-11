"""Offline, transactional pitch fixture. Only --reset erases the fixed demo village.

Historical dates/assignments and synthetic provenance are fixture data; awards,
reviews, purchases, grading and competition decisions use the application's rules.
"""

import argparse
import asyncio
import sys
from datetime import UTC, datetime, time, timedelta
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402
from fastapi import BackgroundTasks  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
from psycopg import sql  # noqa: E402
from psycopg.rows import dict_row  # noqa: E402
from psycopg.types.json import Jsonb  # noqa: E402

from app import competitions, weekly, world  # noqa: E402
from app.auditor import store_review  # noqa: E402
from app.catalog import CATALOG_INSERT  # noqa: E402
from app.catalog_registry import load_catalog  # noqa: E402
from app.competition_models import CompetitionCreate, Entry, EntryDecision, Grade  # noqa: E402
from app.config import Settings  # noqa: E402
from app.db import one  # noqa: E402
from app.domain import SEED_USERS, VILLAGE_ID, activity, award, check_in, purchase, set_goal  # noqa: E402
from app.models import CheckInInput, EvidenceReview, SetGoal  # noqa: E402
from app.runtime import selector_loop  # noqa: E402

DEMO_DIR = Path(__file__).resolve().parents[1] / "demo"
ASSET_DIR = DEMO_DIR / "assets"
MARKER = "demo_story_v1"
UIDS = [u[0] for u in SEED_USERS]
GOALS = [
    "Ship the hackathon project",
    "Gym 4x",
    "Finish a painting series",
    "Study for an exam",
    "Run 15 miles",
]
POSTS = [
    [
        "The village loads! The mayor currently has more personality than my error messages.",
        "Fixed the login loop. I have now logged in enough times for all five of us.",
        "API and village finally talking. Unlike me before coffee.",
        "Demo rehearsal survived. One bug left and it knows I am looking.",
    ],
    [
        "Gym visit one. The warmup had a warmup.",
        "Leg day complete. Stairs are now a paid expansion.",
        "Third visit! Accidentally attached the old workout screenshot. Please clap cautiously.",
    ],
    [
        "Three tiny canvases sketched. Bought zero new paint. Personal growth.",
        "First sunset done. It was an orange rectangle for a worrying amount of time.",
        "Second canvas drying. The dog is banned from art direction.",
        "Third color study finished. Crown stays on even while washing brushes.",
        "Series nearly ready; naming it Things I Painted Instead of Sleeping.",
    ],
    [
        "Exam flashcards made. Half say remember this, which feels legally unhelpful.",
        "Practice exam: 82 percent! Sitting out the weekly prize while I audit you gremlins.",
    ],
    [
        "Three easy miles. Easy is a strong word chosen by the running app.",
        "Six miles total. Ran past the bakery twice for motivational reasons.",
        "Ten miles banked. Five to go; my shoes have requested a meeting.",
        "Twelve miles! Saving the last three for a victory lap after the demo.",
    ],
]


def post_times(now, count, slot):
    """Stay in the current UTC week, including Monday and midnight edge cases."""
    start = datetime.combine(now.date() - timedelta(days=now.weekday()), time(), UTC)
    # Dev skips a day; Maya has a shorter streak. Early-week posts share a day.
    offsets = [count - 1 - i for i in range(count)]
    if slot == 4:
        offsets = [5, 3, 1, 0]
    return [max(start, now - timedelta(days=d, seconds=count - i)) for i, d in enumerate(offsets)]


def make_evidence(root=ASSET_DIR):
    """Three deterministic Pillow mockups, visibly synthetic and containing no people."""
    keys = {}
    for name, heading, lines in [
        (
            "steps",
            "MOVE / WEEKLY ACTIVITY",
            ["12.0 miles / 15 mile goal", "Workout 03", "KEEP GOING"],
        ),
        ("canvas", "STUDIO / COLOR STUDIES", ["Sunset series", "Three canvases in progress"]),
        (
            "notes",
            "EXAM / WHITEBOARD",
            ["Practice score: 82%", "Recall -> explain -> repeat", "Next: chapters 4 + 5"],
        ),
    ]:
        key = f"evidence/{VILLAGE_ID}/demo-story/{name}.png"
        path = root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        img = Image.new("RGB", (720, 460), "#14243a")
        draw = ImageDraw.Draw(img)
        draw.text((32, 30), heading, fill="#8ce0c3", font_size=26)
        for i, line in enumerate(lines):
            draw.text((32, 95 + i * 42), line, fill="white", font_size=24)
        if name == "canvas":
            for i, color in enumerate(["#e5946b", "#cf6b86", "#8266aa"]):
                draw.rectangle((34 + i * 222, 220, 230 + i * 222, 365), fill=color)
                draw.ellipse((86 + i * 222, 235, 175 + i * 222, 324), fill="#f6d4a1")
        else:
            for i, height in enumerate([35, 70, 52, 90, 110, 125]):
                draw.rectangle((40 + i * 104, 370 - height, 106 + i * 104, 370), fill="#8ce0c3")
        draw.text(
            (32, 410), "SYNTHETIC DEMO EVIDENCE - no real person", fill="#ffd783", font_size=20
        )
        img.save(path, format="PNG")
        keys[name] = key
    return keys


async def stamp(conn, at):
    """Backdate only newly inserted rows in this transaction and this village."""
    for table in (
        "activity_events",
        "coin_ledger",
        "xp_ledger",
        "check_ins",
        "goals",
        "competitions",
    ):
        if table in {"activity_events", "check_ins"}:
            # Timescale cannot UPDATE a timestamp across chunk boundaries. Move
            # the row through the hypertable router, preserving every other field.
            await conn.execute(
                sql.SQL(
                    "WITH moved AS (DELETE FROM {} WHERE village_id=%s "
                    "AND created_at=transaction_timestamp() RETURNING *) "
                    "INSERT INTO {} SELECT (jsonb_populate_record(NULL::{}, "
                    "to_jsonb(moved)||jsonb_build_object('created_at',%s::timestamptz))).* "
                    "FROM moved"
                ).format(*[sql.Identifier(table)] * 3),
                (VILLAGE_ID, at),
            )
            continue
        await conn.execute(
            sql.SQL(
                "UPDATE {} SET created_at=%s WHERE village_id=%s "
                "AND created_at=transaction_timestamp()"
            ).format(sql.Identifier(table)),
            (at, VILLAGE_ID),
        )
    for table, column in (("evidence_reviews", "check_in_id"), ("check_in_keys", "check_in_id")):
        await conn.execute(
            sql.SQL(
                "UPDATE {} SET created_at=%s WHERE created_at=transaction_timestamp() "
                "AND {} IN (SELECT id FROM check_ins WHERE village_id=%s)"
            ).format(sql.Identifier(table), sql.Identifier(column)),
            (at, VILLAGE_ID),
        )


async def clear_demo(conn):
    # These hypertable references deliberately have no cascading FK in the schema.
    for table in ("evidence_reviews", "check_in_keys"):
        await conn.execute(
            sql.SQL(
                "DELETE FROM {} WHERE check_in_id IN (SELECT id FROM check_ins WHERE village_id=%s)"
            ).format(sql.Identifier(table)),
            (VILLAGE_ID,),
        )
    for table in ("check_ins", "activity_events"):
        await conn.execute(
            sql.SQL("DELETE FROM {} WHERE village_id=%s").format(sql.Identifier(table)),
            (VILLAGE_ID,),
        )
    # Cascades are village-scoped. Users, avatars, jobs, voices and catalog survive.
    await conn.execute("DELETE FROM villages WHERE id=%s", (VILLAGE_ID,))


async def story(conn, *, reset=False, asset_dir=ASSET_DIR):
    """Caller owns commit/rollback. Concurrent runs serialize; replay is a strict no-op."""
    await conn.execute("SELECT pg_advisory_xact_lock(1337001)")
    existing = await one(conn, "SELECT * FROM villages WHERE id=%s FOR UPDATE", (VILLAGE_ID,))
    if existing and existing["name"] != "Hacklanta Crew":
        raise ValueError("Demo UUID belongs to a differently named village; refusing reset")
    if reset:
        await clear_demo(conn)
    elif await one(
        conn, "SELECT 1 FROM activity_events WHERE village_id=%s AND type=%s", (VILLAGE_ID, MARKER)
    ):
        await upgrade_world(conn)
        await upgrade_cosmetics(conn)
        return False
    elif existing:
        raise ValueError("Existing legacy demo: use --reset to install the living story")

    now = datetime.now(UTC)
    start = now.date() - timedelta(days=now.weekday())
    previous = start - timedelta(days=7)
    last_sunday = datetime.combine(start, time(), UTC) - timedelta(hours=3)
    keys = make_evidence(asset_dir)
    await conn.execute(
        "INSERT INTO villages(id,name,seed,invite_code) "
        "VALUES(%s,'Hacklanta Crew',1337,'HACKLANTA')",
        (VILLAGE_ID,),
    )
    for item in load_catalog().legacy_rows():
        await conn.execute(CATALOG_INSERT, item)
    for slot, (uid, name, _) in enumerate(SEED_USERS):
        await conn.execute(
            "INSERT INTO users(id,auth_issuer,auth_subject,display_name) "
            "VALUES(%s,'demo',%s,%s) ON CONFLICT(id) DO NOTHING",
            (uid, str(uid), name),
        )
        await conn.execute(
            "INSERT INTO village_members(village_id,user_id,role,house_slot,joined_at) "
            "VALUES(%s,%s,%s,%s,%s)",
            (
                VILLAGE_ID,
                uid,
                "owner" if slot == 0 else "member",
                slot,
                last_sunday - timedelta(days=21),
            ),
        )
        await award(
            conn,
            VILLAGE_ID,
            uid,
            [360, 520, 820, 130, 245][slot],
            "demo_history",
            f"demo:history:{uid}",
        )
    await stamp(conn, last_sunday - timedelta(days=8))

    # Explicit historical assignment is necessary: public initialization is random/current-only.
    for day, auditor in ((previous, UIDS[4]), (start, UIDS[3])):
        week = await one(
            conn,
            "INSERT INTO weekly_audits(village_id,week_start,auditor_id) "
            "VALUES(%s,%s,%s) RETURNING id",
            (VILLAGE_ID, day, auditor),
        )
        await conn.execute("INSERT INTO weekly_assignments VALUES(%s,%s)", (week["id"], auditor))
        await activity(
            conn,
            VILLAGE_ID,
            auditor,
            "weekly_auditor_assigned",
            {"week_id": str(week["id"]), "auditor_id": str(auditor), "demo": True},
        )
        await stamp(conn, datetime.combine(day, time(), UTC))
    for slot, uid in enumerate(UIDS):
        old = await one(
            conn,
            "INSERT INTO goals(village_id,user_id,week_start,title,status) "
            "VALUES(%s,%s,%s,%s,%s) RETURNING id",
            (
                VILLAGE_ID,
                uid,
                previous,
                [
                    "Prototype the village",
                    "Gym 3x",
                    "Paint three sunset studies",
                    "Finish two practice exams",
                    "Run 10 miles",
                ][slot],
                "missed" if slot == 1 else "done",
            ),
        )
        await award(conn, VILLAGE_ID, uid, 20, "goal_set", f"goal:{VILLAGE_ID}:{uid}:{previous}")
        await activity(
            conn, VILLAGE_ID, uid, "goal_set", {"goal_id": str(old["id"]), "title": GOALS[slot]}
        )
        await stamp(conn, datetime.combine(previous, time(), UTC))
        if slot != 4:
            score = [4, 3, 5, 4][slot]
            await weekly.grade(
                VILLAGE_ID,
                previous,
                old["id"],
                Grade(
                    ambition=score,
                    evidence_quality=score,
                    progress=score,
                    completed=slot != 1,
                    rationale=[
                        "Working prototype demonstrated end to end.",
                        "Two of three sessions logged; good effort, short of the agreed target.",
                        "All three paintings finished; dated studies show ambitious color work.",
                        "Both practice exams completed with corrections explained.",
                    ][slot],
                ),
                user={"id": UIDS[4]},
                conn=conn,
            )
            await stamp(conn, last_sunday)
    await weekly.finalize(VILLAGE_ID, previous, user={"id": UIDS[4]}, conn=conn)
    await conn.execute(
        "UPDATE weekly_audits SET finalized_at=%s WHERE village_id=%s AND week_start=%s",
        (last_sunday, VILLAGE_ID, previous),
    )
    await stamp(conn, last_sunday)

    for slot, uid in enumerate(UIDS):
        goal = await set_goal(
            conn,
            VILLAGE_ID,
            uid,
            SetGoal(
                title=GOALS[slot],
                detail=(
                    "Personal progress only; Maya sits out the weekly prize as auditor."
                    if slot == 3
                    else "Small daily updates; attach evidence when there is something to show."
                ),
            ),
        )
        await stamp(conn, datetime.combine(start, time(), UTC))
        for index, (body, at) in enumerate(
            zip(POSTS[slot], post_times(now, len(POSTS[slot]), slot))
        ):
            evidence = keys[{0: "notes", 1: "steps", 2: "canvas", 3: "notes", 4: "steps"}[slot]]
            evidence = evidence if index == len(POSTS[slot]) - 1 else None
            if evidence:
                await activity(
                    conn, VILLAGE_ID, uid, "evidence_uploaded", {"evidence_asset_id": evidence}
                )
            result = await check_in(
                conn,
                VILLAGE_ID,
                uid,
                CheckInInput(
                    kind="progress",
                    body=body,
                    goal_id=goal["id"],
                    evidence_asset_id=evidence,
                    idempotency_key=f"demo:story:{start}:{uid}:{index}",
                ),
            )
            if evidence:
                row = await one(
                    conn, "SELECT * FROM check_ins WHERE id=%s", (result["check_in"]["id"],)
                )
                await store_review(
                    conn,
                    row,
                    EvidenceReview(
                        verdict="suspicious" if slot == 1 else "verified",
                        confidence=0.94,
                        reason=(
                            "That is the same workout screenshot as the first visit. "
                            "Even the battery is tired."
                            if slot == 1
                            else "Seeded demo verdict: mock image supports this progress update."
                        ),
                    ),
                    "demo-fixture/gemini-2.5-flash (not called)",
                )
            await stamp(conn, at)

    for uid, items in [
        (UIDS[1], ["house_backyard", "pet_dog"]),
        (UIDS[2], ["house_lv2", "decor_flowers"]),
        (UIDS[0], ["shirt_hoodie"]),
    ]:
        for item in items:
            await purchase(conn, VILLAGE_ID, uid, item)
    await stamp(conn, now - timedelta(seconds=1))
    await seed_competitions(conn, keys, asset_dir, now)
    await seed_events(conn, now, last_sunday)
    await seed_decisions(conn, now)
    await upgrade_world(conn)
    await upgrade_cosmetics(conn)
    await activity(conn, VILLAGE_ID, None, MARKER, {"week_start": str(start), "offline": True})
    return True


async def upgrade_world(conn):
    # Existing stories get the additive world state without resetting player progress.
    if await one(
        conn,
        "SELECT 1 FROM activity_events WHERE village_id=%s AND type='demo_world_v1'",
        (VILLAGE_ID,),
    ):
        return
    # Reuse the original demo aftermath as the repair; keep the failed event as history.
    failure = await one(
        conn,
        """SELECT id FROM mayor_events WHERE village_id=%s
        AND title='The great movie-night no-show' LIMIT 1""",
        (VILLAGE_ID,),
    )
    if failure:
        existing_repair = await one(
            conn, "SELECT id FROM mayor_events WHERE repairs_event_id=%s", (failure["id"],)
        )
        if existing_repair:
            # A world read may already have generated a repair for an older fixture.
            await conn.execute(
                """UPDATE mayor_events SET status='completed'
                WHERE village_id=%s AND title='Movie-night crater: repair pending'
                AND id<>%s""",
                (VILLAGE_ID, existing_repair["id"]),
            )
        else:
            await conn.execute(
                """UPDATE mayor_events SET repairs_event_id=%s
                WHERE village_id=%s AND title='Movie-night crater: repair pending'""",
                (failure["id"], VILLAGE_ID),
            )
    await world.state(conn, VILLAGE_ID)
    await activity(conn, VILLAGE_ID, None, "demo_world_v1")


async def seed_competitions(conn, keys, asset_dir, now):
    request = SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace(settings=SimpleNamespace(asset_dir=asset_dir), pool=None)
        )
    )
    for friendly in (True, False):
        row = await competitions.create(
            VILLAGE_ID,
            CompetitionCreate(
                title="Minecraft hours" if friendly else "Study streak",
                terms=(
                    "One entry per hour building our village. Bragging rights only; no stakes."
                    if friendly
                    else "One point per study session with notes. Maya audits and sits out. "
                    "10 in-game coins per entry; 5% auditor fee. Offline demo; no SOL payments."
                ),
                friendly=friendly,
                auditor_id=None if friendly else UIDS[3],
                entry_coins=0 if friendly else 10,
                auditor_fee_bps=0 if friendly else 500,
                deadline=None if friendly else now + timedelta(days=7),
            ),
            user={"id": UIDS[0]},
            conn=conn,
        )
        for index, uid in enumerate([UIDS[0], UIDS[4]]):
            await competitions.join(VILLAGE_ID, row["id"], user={"id": uid}, conn=conn)
            key = None if friendly else keys["notes"]
            if key:
                await activity(
                    conn, VILLAGE_ID, uid, "evidence_uploaded", {"evidence_asset_id": key}
                )
            # Deliberately never execute BackgroundTasks: fixture reviews are stored below.
            entry = await competitions.submit(
                VILLAGE_ID,
                row["id"],
                Entry(
                    body=(
                        "One hour building a bakery. The villagers deserve carbs."
                        if friendly
                        else "Completed a focused study session; whiteboard notes attached."
                    ),
                    evidence_asset_id=key,
                    idempotency_key=f"demo:entry:{friendly}:{uid}",
                ),
                request=request,
                background=BackgroundTasks(),
                user={"id": uid},
                conn=conn,
            )
            if not friendly:
                await conn.execute(
                    "UPDATE competition_entries SET review=%s WHERE id=%s",
                    (
                        Jsonb(
                            {
                                "verdict": "verified",
                                "confidence": 0.91,
                                "reason": "Seeded notes; human decision remains authoritative.",
                                "model": "demo-fixture/gemini-2.5-flash (not called)",
                            }
                        ),
                        entry["id"],
                    ),
                )
                if index == 0:
                    await competitions.decide(
                        VILLAGE_ID,
                        row["id"],
                        entry["id"],
                        EntryDecision(
                            decision="confirmed",
                            points=1,
                            reason="Maya checked the worked examples; session confirmed.",
                        ),
                        user={"id": UIDS[3]},
                        conn=conn,
                    )
            await conn.execute(
                "UPDATE competition_entries SET created_at=%s WHERE id=%s",
                (now - timedelta(hours=3 - index), entry["id"]),
            )
        await stamp(conn, now - timedelta(hours=4))


async def seed_events(conn, now, last_sunday):
    for kind, title, body, status, penalty, at, end, reward in [
        (
            "challenge",
            "Touch grass, bring a friend",
            "[AI Mayor / demo] Take a short walk together and post one tiny win. "
            "Bonus conversation topic: why does Lance's dog have a nicer yard than us?",
            "active",
            None,
            now - timedelta(hours=6),
            now + timedelta(days=2),
            75,
        ),
        (
            "recap",
            "Last week: paint, pace, and a prototype",
            "[AI Mayor / demo] Stefanny finished three paintings and earned "
            "the crown. Iraj shipped a prototype, Lance made two gym sessions, "
            "Maya conquered two practice exams, "
            "and Dev ran ten miles while auditing. This week Maya holds the clipboard.",
            "completed",
            None,
            last_sunday,
            last_sunday,
            0,
        ),
        (
            "random_event",
            "Movie-night crater: repair pending",
            "[AI Mayor / demo] Last week's movie-night no-show left this crater. "
            "It remains until our next group repair challenge; no new penalty or XP deduction.",
            "active",
            "crater",
            last_sunday,
            None,
            0,
        ),
        (
            "random_event",
            "The great movie-night no-show",
            "[AI Mayor / demo] Five people voted on a movie; zero pressed play. "
            "A small crater commemorates our scheduling skills. "
            "Recoverable with a future group challenge.",
            "failed",
            "crater",
            last_sunday - timedelta(days=2),
            last_sunday - timedelta(days=1),
            0,
        ),
    ]:
        row = await one(
            conn,
            "INSERT INTO mayor_events(village_id,kind,title,body,status,penalty,starts_at,ends_at,"
            "reward_xp,model,created_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (
                VILLAGE_ID,
                kind,
                title,
                body,
                status,
                penalty,
                at,
                end,
                reward,
                "demo-fixture/deepseek-v4-flash (not called)",
                at,
            ),
        )
        await activity(
            conn,
            VILLAGE_ID,
            None,
            "mayor_event",
            {
                "event_id": str(row["id"]),
                "title": title,
                "body": body,
                "kind": kind,
                "status": status,
                "penalty": penalty,
            },
        )
        await stamp(conn, at)


async def seed_decisions(conn, now):
    decisions = [
        (
            "mayor",
            "nudge",
            0,
            "Iraj has a nearly finished prototype; suggest one small demo rehearsal.",
        ),
        ("scheduler", "none", None, "Did nothing because everyone checked in recently."),
        (
            "auditor",
            "verified",
            2,
            "Canvas progress is consistent across the series; retain verified verdict.",
        ),
        (
            "mayor",
            "nudge",
            4,
            "Dev is three miles from the target; suggest an easy run with a friend.",
        ),
        (
            "scheduler",
            "none",
            None,
            "Did nothing because the active challenge is still within the six-hour cooldown.",
        ),
        (
            "auditor",
            "suspicious",
            1,
            "Repeated workout screenshot needs a fresh upload; hold progress XP.",
        ),
        (
            "mayor",
            "event",
            None,
            "A short shared walk fits the group's goals and leaves time for the hackathon.",
        ),
        ("scheduler", "throttled", None, "Hourly LLM budget reached; no provider request made."),
        (
            "mayor",
            "nudge",
            2,
            "Stefanny is close to finishing; celebrate consistency instead of adding pressure.",
        ),
        (
            "scheduler",
            "none",
            3,
            "Did nothing because Maya is studying and already checked in; respect quiet time.",
        ),
        (
            "auditor",
            "competition_entry_confirmed",
            0,
            "Maya confirmed the worked examples; study session earns one point.",
        ),
        (
            "scheduler",
            "none",
            None,
            "Did nothing because the daily message cap is reached; wait until tomorrow.",
        ),
    ]
    for index, (agent, action, slot, reason) in enumerate(decisions):
        uid = UIDS[slot] if slot is not None else None
        await activity(
            conn,
            VILLAGE_ID,
            uid,
            "agent_decision",
            {
                "agent": agent,
                "action": action,
                "reason": reason,
                "model": "demo-fixture/"
                + {
                    "mayor": "deepseek-v4-flash",
                    "auditor": "gemini-2.5-flash",
                    "scheduler": "rules-v4",
                }[agent]
                + " (not called)",
                "target_user_id": str(uid) if uid else None,
                "demo": True,
                "delivered": False,
            },
        )
        await stamp(conn, now - timedelta(hours=46 - index * 4))


async def main(reset):
    settings = Settings.from_env()
    async with await psycopg.AsyncConnection.connect(
        settings.database_url, row_factory=dict_row, connect_timeout=5
    ) as conn:
        changed = await story(conn, reset=reset)
    print(
        "Living story rebuilt."
        if changed
        else "Living story already installed; unchanged (use --reset to refresh dates)."
    )
    from scripts.demo_check import summary

    async with await psycopg.AsyncConnection.connect(
        settings.database_url, row_factory=dict_row, connect_timeout=5
    ) as conn:
        print(await summary(conn))
    print(f"Synthetic evidence ASSET_DIR: {ASSET_DIR}")


async def upgrade_cosmetics(conn):
    if await one(
        conn,
        "SELECT 1 FROM activity_events WHERE village_id=%s AND type='demo_cosmetics_v1'",
        (VILLAGE_ID,),
    ):
        return
    for item in load_catalog().legacy_rows():
        await conn.execute(CATALOG_INSERT, item)
    outfits = [
        (UIDS[0], ["glasses_round", "hat_headphones", "voice_hype_coach"]),
        (UIDS[1], ["hat_festival", "pet_dog"]),
        (UIDS[2], ["hat_crown", "scarf"]),
        (UIDS[3], ["jacket_denim"]),
        (UIDS[4], ["hat_cap"]),
    ]
    from app.domain import equip

    for uid, items in outfits:
        for item in items:
            await conn.execute(
                "INSERT INTO inventory(village_id,user_id,item_id) VALUES(%s,%s,%s) "
                "ON CONFLICT DO NOTHING",
                (VILLAGE_ID, uid, item),
            )
            await equip(conn, VILLAGE_ID, uid, item)
    await activity(
        conn,
        VILLAGE_ID,
        None,
        "demo_cosmetics_v1",
        {"source": "offline fixture gifts; Stefanny crown earned by prior weekly win"},
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Rebuild ONLY Hacklanta Crew; preserve users and avatars",
    )
    args = parser.parse_args()
    try:
        with asyncio.Runner(loop_factory=selector_loop) as runner:
            runner.run(main(args.reset))
    except Exception as exc:
        # Never echo connection strings, provider settings or raw DB exception details.
        print(
            f"Demo story failed ({type(exc).__name__}). Check migrations/connectivity; "
            "use --reset for a legacy demo. Seeding commits only on success.",
            file=sys.stderr,
        )
        sys.exit(1)
