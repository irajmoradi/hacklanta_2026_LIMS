"""Isolated HTTP + Bun integration run. No real providers or shared village writes."""

import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402
import psycopg  # noqa: E402
from psycopg import sql  # noqa: E402
from psycopg.conninfo import conninfo_to_dict, make_conninfo  # noqa: E402

from app.config import ROOT, Settings  # noqa: E402
from app.domain import VILLAGE_ID  # noqa: E402
from scripts.migrate import apply_additions  # noqa: E402
from scripts.seed import seed  # noqa: E402


def main():
    settings = Settings.from_env()
    dsn = make_conninfo(
        os.getenv("VILLAGE_TEST_DATABASE_URL") or settings.database_url, connect_timeout=5
    )
    if not os.getenv("VILLAGE_TEST_DATABASE_URL"):
        dsn = make_conninfo(dsn, dbname="village_test")
    if conninfo_to_dict(dsn).get("dbname") != "village_test":
        raise RuntimeError("Simulation requires village_test database")
    with psycopg.connect(make_conninfo(dsn, dbname="postgres"), autocommit=True) as conn:
        if not conn.execute("SELECT 1 FROM pg_database WHERE datname='village_test'").fetchone():
            conn.execute("CREATE DATABASE village_test")
    schema = "api006_sim_" + uuid4().hex
    isolated = make_conninfo(dsn, options=f"-csearch_path={schema},public")
    uid, oid = uuid4(), uuid4()
    process = None
    with psycopg.connect(dsn) as conn:
        conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    try:
        with psycopg.connect(isolated) as conn:
            conn.execute((ROOT / "packages/contracts/schema.sql").read_text(encoding="utf-8"))
            apply_additions(conn)
            apply_additions(conn)
            seed(conn)
            conn.execute(
                "INSERT INTO users(id,auth_issuer,auth_subject,"
                "display_name,phone_e164,agent_msgs_ok)"
                " VALUES (%s,'simulation',%s,'Simulation Friend','+15555550101',true)",
                (uid, str(uid)),
            )
            conn.execute(
                "INSERT INTO village_members(village_id,user_id,house_slot) VALUES (%s,%s,9)",
                (VILLAGE_ID, uid),
            )
            conn.execute(
                "INSERT INTO mayor_outbox(id,village_id,user_id,phone_e164,text)"
                " VALUES (%s,%s,%s,'+15555550101','[AI Mayor] Simulation outbox')",
                (oid, VILLAGE_ID, uid),
            )
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        env = {
            **os.environ,
            "DATABASE_URL": isolated,
            "SERVICE_KEY": "local-simulation-only",
            "MAYOR_SCHEDULER": "0",
            "DEMO_AUTH": "1",
            "GOOGLE_API_KEY": "",
            "OPENROUTER_API_KEY": "",
            "ELEVENLABS_API_KEY": "",
            "UVICORN_LOOP": "app.runtime:selector_loop",
            "VILLAGE_API_URL": f"http://127.0.0.1:{port}/api",
        }
        api_dir = Path(__file__).resolve().parents[1]
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            cwd=api_dir,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        with httpx.Client(timeout=2) as client:
            for _ in range(80):
                if process.poll() is not None:
                    raise RuntimeError("Temporary server exited")
                try:
                    if client.get(f"http://127.0.0.1:{port}/openapi.json").is_success:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(0.25)
            else:
                raise RuntimeError("Server startup timeout")
        result = subprocess.run(
            [shutil.which("bun") or "bun", "scripts/simulate.ts", "--client"],
            cwd=ROOT / "apps/imessage",
            env=env,
            timeout=45,
        )
        if result.returncode:
            raise RuntimeError("Bun simulation failed")
        with psycopg.connect(isolated) as conn:
            assert (
                conn.execute("SELECT count(*) FROM check_ins WHERE user_id=%s", (uid,)).fetchone()[
                    0
                ]
                == 1
            )
            assert (
                conn.execute(
                    "SELECT sum(delta) FROM xp_ledger WHERE user_id=%s", (uid,)
                ).fetchone()[0]
                == 10
            )
            assert (
                conn.execute("SELECT status FROM mayor_outbox WHERE id=%s", (oid,)).fetchone()[0]
                == "sent"
            )
            assert conn.execute("SELECT count(*) FROM inbound_messages").fetchone()[0] == 1
        print(f"Simulation PASS: port={port}; check-ins=1; XP=10; outbox=sent; durable receipt=1")
    finally:
        if process:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        with psycopg.connect(dsn) as conn:
            conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Simulation failed ({type(exc).__name__}); no credentials logged.")
        sys.exit(1)
