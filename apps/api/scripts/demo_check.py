"""Read-only, one-screen pitch summary. Uses VILLAGE_ENV_FILE at runtime."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402
from psycopg.rows import dict_row  # noqa: E402

from app.config import Settings  # noqa: E402
from app.db import many, one  # noqa: E402
from app.domain import SEED_USERS, VILLAGE_ID, villager  # noqa: E402
from app.runtime import selector_loop  # noqa: E402


async def summary(conn):
    village = await one(conn, "SELECT name FROM villages WHERE id=%s", (VILLAGE_ID,))
    if not village:
        return "Hacklanta Crew is absent. Run scripts/demo_story.py."
    lines = [f"{village['name']} | {VILLAGE_ID} | invite HACKLANTA"]
    weeks = await many(
        conn,
        "SELECT w.*,u.display_name AS auditor,win.display_name AS winner "
        "FROM weekly_audits w LEFT JOIN users u ON u.id=w.auditor_id "
        "LEFT JOIN users win ON win.id=w.winner_id WHERE w.village_id=%s "
        "ORDER BY week_start DESC LIMIT 2",
        (VILLAGE_ID,),
    )
    for week in weeks:
        lines.append(
            f"Week {week['week_start']}: {week['status']}; auditor {week['auditor']} "
            f"(sits out); winner {week['winner'] or '-'}"
        )
    for uid, _, _ in SEED_USERS:
        member = await one(
            conn,
            "SELECT 1 FROM village_members WHERE village_id=%s AND user_id=%s",
            (VILLAGE_ID, uid),
        )
        if not member:
            continue
        v = await villager(conn, VILLAGE_ID, uid)
        data = await one(
            conn,
            "SELECT count(*) AS n FROM check_ins WHERE village_id=%s AND user_id=%s",
            (VILLAGE_ID, uid),
        )
        goal = await one(
            conn,
            "SELECT title FROM goals WHERE village_id=%s AND user_id=%s "
            "ORDER BY week_start DESC LIMIT 1",
            (VILLAGE_ID, uid),
        )
        extras = " CROWN" if v["has_crown"] else ""
        if "pet_dog" in v["equipped_ids"]:
            extras += " dog+backyard"
        lines.append(
            f"{v['display_name']:<8} XP {v['xp']:>3} | L{v['level']} | "
            f"streak {v['streak_days']} | {data['n']} check-ins{extras} | "
            f"{goal['title'] if goal else '-'}"
        )
    reviews = await many(
        conn,
        "SELECT r.verdict,count(*) AS n FROM evidence_reviews r "
        "JOIN check_ins c ON c.id=r.check_in_id WHERE c.village_id=%s "
        "GROUP BY r.verdict ORDER BY r.verdict",
        (VILLAGE_ID,),
    )
    lines.append(
        "Evidence reviews: " + (", ".join(f"{r['n']} {r['verdict']}" for r in reviews) or "none")
    )
    comps = await many(
        conn,
        "SELECT c.*, (SELECT count(*) FROM competition_entries e "
        "WHERE e.competition_id=c.id) AS entries, (SELECT count(*) FROM competition_entries e "
        "WHERE e.competition_id=c.id AND decision='confirmed') AS confirmed "
        "FROM competitions c WHERE village_id=%s ORDER BY title",
        (VILLAGE_ID,),
    )
    for c in comps:
        terms = (
            "friendly / no stakes"
            if c["friendly"]
            else (
                f"{c['entry_coins']} coins"
                if c["entry_coins"]
                else f"{c['entry_lamports'] / 1e9:g} SOL devnet"
            )
            + f" / {c['auditor_fee_bps'] / 100:g}% auditor fee"
        )
        lines.append(f"{c['title']}: {terms}; {c['entries']} entries, {c['confirmed']} confirmed")
    events = await many(
        conn,
        "SELECT title,status,penalty FROM mayor_events WHERE village_id=%s ORDER BY starts_at DESC",
        (VILLAGE_ID,),
    )
    lines.extend(
        f"Mayor: {e['status']} - {e['title']}" + (f" [{e['penalty']}]" if e["penalty"] else "")
        for e in events
    )
    log = await one(
        conn,
        "SELECT count(*) AS n FROM activity_events WHERE village_id=%s AND type='agent_decision'",
        (VILLAGE_ID,),
    )
    dev = await one(
        conn, "SELECT count(*) AS n FROM avatar_assets WHERE user_id=%s", (SEED_USERS[4][0],)
    )
    lines.append(f"Agent decisions: {log['n']} | Dev avatar revisions: {dev['n']} (preserved)")
    lines.append(
        "Offline scripted demo; model names are simulated provenance. No payments or messages sent."
    )
    return "\n".join(lines)


async def main():
    settings = Settings.from_env()
    async with await psycopg.AsyncConnection.connect(
        settings.database_url, row_factory=dict_row, connect_timeout=5
    ) as conn:
        await conn.execute("SET TRANSACTION READ ONLY")
        print(await summary(conn))


if __name__ == "__main__":
    try:
        with asyncio.Runner(loop_factory=selector_loop) as runner:
            runner.run(main())
    except Exception as exc:
        print(
            f"Demo check failed ({type(exc).__name__}); check connectivity/migrations.",
            file=sys.stderr,
        )
        sys.exit(1)
