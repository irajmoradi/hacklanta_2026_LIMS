"""Run a live suite with fresh identities and transactional, verified DB cleanup.

Usage: apps/api/.venv/Scripts/python tests/run_live.py integration|e2e
The external env file is read at runtime. No credentials or user snapshots are saved.
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api"))
import psycopg
from app.config import Settings


def cleanup(dsn, users):
    with psycopg.connect(dsn) as conn:
        villages = [r[0] for r in conn.execute(
            "SELECT DISTINCT v.id FROM villages v JOIN village_members m ON m.village_id=v.id "
            "WHERE m.user_id=ANY(%s::uuid[])", (users,))]
        for vid in villages:
            name = conn.execute("SELECT name FROM villages WHERE id=%s", (vid,)).fetchone()[0]
            assert name.startswith("QA-002 "), "Refusing cleanup of an unrelated village"
            assert not conn.execute(
                "SELECT 1 FROM village_members WHERE village_id=%s AND NOT(user_id=ANY(%s::uuid[]))",
                (vid, users)).fetchone(), "Refusing cleanup with unrelated members"
        # These tables have no cascading village FK; delete before their source rows.
        for table in ("evidence_reviews", "check_in_keys"):
            conn.execute(f"DELETE FROM {table} WHERE check_in_id IN "
                         "(SELECT id FROM check_ins WHERE village_id=ANY(%s::uuid[]))", (villages,))
        for table in ("check_ins", "activity_events"):
            conn.execute(f"DELETE FROM {table} WHERE village_id=ANY(%s::uuid[])", (villages,))
        conn.execute("DELETE FROM villages WHERE id=ANY(%s::uuid[])", (villages,))
        conn.execute("DELETE FROM users WHERE id=ANY(%s::uuid[]) AND auth_issuer='qa002'", (users,))
        for table, column, ids in (("users", "id", users), ("villages", "id", villages),
                                   ("check_ins", "village_id", villages),
                                   ("activity_events", "village_id", villages)):
            assert conn.execute(f"SELECT count(*) FROM {table} WHERE {column}=ANY(%s::uuid[])",
                                (ids,)).fetchone()[0] == 0
    print(f"Cleanup verified: {len(users)} users, {len(villages)} villages; hypertables empty for run IDs.", flush=True)


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("integration", "e2e"):
        raise SystemExit("Expected integration or e2e")
    settings = Settings.from_env()
    users = [str(uuid4()) for _ in range(5)]
    with psycopg.connect(settings.database_url) as conn:
        for n, uid in enumerate(users):
            conn.execute("INSERT INTO users(id,auth_issuer,auth_subject,display_name,agent_msgs_ok) "
                         "VALUES(%s,'qa002',%s,%s,false)", (uid, uid, f"QA·Friend{n + 1}"))
    try:
        env = {**os.environ, "QA_USERS": ",".join(users), "QA_ALLOW_MAYOR": "0"}
        return subprocess.run([shutil.which("bun") or "bun", "run", sys.argv[1]],
                              cwd=ROOT / "tests", env=env, timeout=600).returncode
    finally:
        cleanup(settings.database_url, users)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"QA live runner failed: {type(exc).__name__}; credentials suppressed", file=sys.stderr)
        raise SystemExit(1)
