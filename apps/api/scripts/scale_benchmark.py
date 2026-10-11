"""SCALE-001: synthetic data and hot-route measurements in a disposable Postgres DB.

Run via remote_run.sh python -m uv run python scripts/scale_benchmark.py before.
Never uses the configured database itself: only the maintenance database to create
an exclusively owned scale001_<random> database, removed in finally.
"""

# ruff: noqa: E402

import asyncio
import json
import math
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from time import perf_counter
from uuid import NAMESPACE_URL, uuid4, uuid5

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo
from psycopg.types.json import Jsonb

from app import catalog
from app.catalog_registry import sync_catalog
from app.config import Settings
from app.domain import monday, preset
from app.main import create_app
from app.presence import Heartbeat, state
from scripts.migrate import migrate


def identity(label):
    return uuid5(NAMESPACE_URL, "village:scale001:" + label)


def seed_scale(conn, size):
    """Only accepts our random scratch database; no reset/delete of existing data."""
    if not conn.execute("SELECT current_database()").fetchone()[0].startswith("scale001_"):
        raise RuntimeError("SCALE-001 seed requires its own scale001_ scratch database")
    vid = identity(f"village:{size}")
    conn.execute(
        "INSERT INTO villages(id,name,seed,invite_code) VALUES(%s,%s,24109,%s)",
        (vid, f"Synthetic village {size}", f"SCALE001-{size}"),
    )
    sync_catalog(conn)
    items = conn.execute(
        "SELECT id FROM catalog_items WHERE slot='head' ORDER BY id LIMIT 3"
    ).fetchall()
    assert len(items) == 3, "The scale fixture requires three catalog hats"
    users = [identity(f"{size}:user:{i}") for i in range(size)]
    for i, uid in enumerate(users):
        conn.execute(
            "INSERT INTO users(id,auth_issuer,auth_subject,display_name,idle_activity) VALUES(%s,'scale001',%s,%s,%s)",
            (
                uid,
                str(uid),
                f"Villager {i + 1:03}",
                ["home", "studying", "gardening", "reading", "working_out"][i % 5],
            ),
        )
        manifest = preset(uid)
        manifest["body"]["colors"]["shirt"] = [
            "#d88354",
            "#759fbc",
            "#b38cbe",
            "#e4b457",
            "#80a789",
        ][i % 5]
        manifest["body"]["colors"]["skin"] = [
            "#bc855e",
            "#dfad87",
            "#ca906c",
            "#965f44",
            "#b68058",
        ][i % 5]
        conn.execute(
            "INSERT INTO avatar_assets(user_id,revision,manifest) VALUES(%s,0,%s)",
            (uid, Jsonb(manifest)),
        )
        conn.execute(
            "INSERT INTO village_members(village_id,user_id,role,house_slot,house_level) VALUES(%s,%s,%s,%s,%s)",
            (vid, uid, "owner" if i == 0 else "member", i, 1 + i % 3),
        )
        conn.execute(
            "INSERT INTO xp_ledger(village_id,user_id,delta,reason,source_key) VALUES(%s,%s,%s,'weekly_win',%s)",
            (vid, uid, 100 + i * 5, f"scale001:{uid}"),
        )
        if items:
            conn.execute(
                "INSERT INTO inventory(village_id,user_id,item_id,equipped) VALUES(%s,%s,%s,true)",
                (vid, uid, items[i % len(items)][0]),
            )
        for w in range(4):
            gid = identity(f"{size}:{i}:goal:{w}")
            conn.execute(
                "INSERT INTO goals(id,village_id,user_id,week_start,title,status) VALUES(%s,%s,%s,%s,%s,%s)",
                (
                    gid,
                    vid,
                    uid,
                    monday() - timedelta(weeks=w),
                    ["Walk daily", "Read a book", "Build a project", "Practice music"][i % 4],
                    "active" if w == 0 else "done",
                ),
            )
            for d in range(7):
                cid = identity(f"{size}:{i}:check:{w}:{d}")
                when = datetime.now(UTC) - timedelta(days=w * 7 + d, minutes=i)
                body = f"Synthetic progress {w * 7 + d + 1}: session completed."
                conn.execute(
                    "INSERT INTO check_ins(id,village_id,user_id,kind,body,goal_id,idempotency_key,created_at) VALUES(%s,%s,%s,'progress',%s,%s,%s,%s)",
                    (cid, vid, uid, body, gid, str(cid), when),
                )
                conn.execute(
                    "INSERT INTO activity_events(village_id,user_id,type,payload,created_at) VALUES(%s,%s,'checkin',%s,%s)",
                    (
                        vid,
                        uid,
                        Jsonb({"body": body, "kind": "progress", "check_in_id": str(cid)}),
                        when,
                    ),
                )
    for i in range(4):
        cid = identity(f"{size}:competition:{i}")
        conn.execute(
            "INSERT INTO competitions(id,village_id,creator_id,title,terms,friendly) VALUES(%s,%s,%s,%s,'Synthetic progress only',true)",
            (cid, vid, users[0], f"Challenge {i + 1}"),
        )
        for uid in users:
            conn.execute(
                "INSERT INTO competition_participants(competition_id,user_id,entry_lamports_intent) VALUES(%s,%s,0)",
                (cid, uid),
            )
            conn.execute(
                "INSERT INTO competition_entries(competition_id,user_id,body,idempotency_key) VALUES(%s,%s,'Synthetic entry','seed')",
                (cid, uid),
            )
    conn.execute(
        "INSERT INTO village_gazettes(village_id,content,model) VALUES(%s,%s,'seed')",
        (
            vid,
            Jsonb(
                {
                    "headline": "Synthetic village grows",
                    "stories": [],
                    "gossip": {
                        "target_user_id": None,
                        "text": "A quiet synthetic day.",
                    },
                }
            ),
        ),
    )
    return vid, users


async def measure(dsn, villages, label):
    if label == "before":
        # The reference mode revalidates each read, as the original runtime did.
        catalog._validated_snapshot = catalog._validated_snapshot.__wrapped__
    app = create_app(
        Settings(database_url=dsn, demo_auth=True, mayor_scheduler=False, mayor_voice=False)
    )
    results = {}
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://scratch"
        ) as client:
            for size, (vid, users) in villages.items():
                base = f"/api/villages/{vid}"
                headers = {"X-Demo-User": str(users[0])}
                for uid in users:
                    state(app).heartbeat(vid, uid, Heartbeat(x=0, z=0))
                routes = {
                    "village": base,
                    "feed": base + "/feed",
                    "week_review": base + "/weekly/current",
                    "profile": base + f"/users/{users[-1]}",
                    "presence": base + "/presence/heartbeat",
                    "gazette": base + "/gazette/latest",
                    "competitions": base + "/competitions",
                }
                result = {}
                for name, url in routes.items():
                    times = []
                    for sample in range(33):
                        started = perf_counter()
                        response = await (
                            client.post(url, headers=headers, json={"x": 0, "z": 0})
                            if name == "presence"
                            else client.get(url, headers=headers)
                        )
                        response.raise_for_status()
                        if sample >= 3:
                            times.append((perf_counter() - started) * 1000)
                    times.sort()
                    result[name] = {
                        "p50_ms": round(times[len(times) // 2], 2),
                        "p95_ms": round(times[math.ceil(len(times) * 0.95) - 1], 2),
                        "bytes": len(response.content),
                    }
                    if name == "village":
                        assert len(response.json()["villagers"]) == size
                        assert all(
                            person["equipped_ids"] for person in response.json()["villagers"]
                        )
                        Path(f"artifacts/scale001/village-{size}.json").write_text(response.text)
                    elif name == "week_review":
                        assert len(response.json()["goals"]) == size
                    elif name == "feed":
                        assert len(response.json()) == 50
                results[size] = result
                print(size, json.dumps(result), flush=True)
    Path(f"artifacts/scale001/api-{label}.json").write_text(json.dumps(results, indent=2))


def main():
    label = sys.argv[1] if len(sys.argv) > 1 else "after"
    if label not in {"before", "after"}:
        raise SystemExit("label must be before or after")
    Path("artifacts/scale001").mkdir(parents=True, exist_ok=True)
    raw = Settings.from_env().database_url
    maintenance = make_conninfo(raw, dbname="postgres", connect_timeout=5)
    name = "scale001_" + uuid4().hex
    with psycopg.connect(maintenance, autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    dsn = make_conninfo(raw, dbname=name, connect_timeout=5)
    try:
        migrate(dsn)
        with psycopg.connect(dsn) as conn:
            if label == "before":
                # Reproduce the pre-SCALE schema even after the new migration exists.
                for index in (
                    "check_ins_member_recent",
                    "check_ins_evidence_lookup",
                    "activity_events_village_recent",
                    "xp_ledger_member_positive",
                ):
                    conn.execute(sql.SQL("DROP INDEX IF EXISTS {}").format(sql.Identifier(index)))
            villages = {size: seed_scale(conn, size) for size in (5, 25, 100)}
        with psycopg.connect(dsn, autocommit=True) as conn:
            conn.execute("ANALYZE")
        asyncio.run(measure(dsn, villages, label))
    finally:
        with psycopg.connect(maintenance, autocommit=True) as conn:
            conn.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))


if __name__ == "__main__":
    main()
