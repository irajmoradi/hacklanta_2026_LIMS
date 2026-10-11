"""Read-only, bounded health reporter. Always exits zero; never calls a model."""
import argparse
import concurrent.futures
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def load_environment():
    value = os.getenv("VILLAGE_ENV_FILE", str(ROOT / ".env"))
    if os.name == "nt" and re.match(r"^/[a-zA-Z]/", value):
        value = value[1] + ":" + value[2:]
    try:
        from dotenv import load_dotenv
        load_dotenv(Path(value), override=False)
    except ImportError:
        pass  # Export DATABASE_URL directly if python-dotenv is unavailable.


def probe(url, health=False):
    start = time.perf_counter()
    result = {"status": "down", "latency_ms": None}
    try:
        with urllib.request.urlopen(url, timeout=4) as response:
            result["status"] = "up"
            if health:
                data = json.load(response)
                result["status"] = "up" if data.get("ok") else "down"
                if "build" in data:
                    result["build"] = data["build"]
    except Exception as exc:
        result["error"] = type(exc).__name__  # Never emit URLs or credentials.
    result["latency_ms"] = round((time.perf_counter() - start) * 1000, 1)
    return result


def database():
    start = time.perf_counter()
    result = {"status": "down", "latency_ms": None, "counts": None}
    try:
        import psycopg
        from psycopg.conninfo import conninfo_to_dict
        params = conninfo_to_dict(os.environ["DATABASE_URL"])
        if os.name == "nt" and params.get("host") == "localhost":
            params.setdefault("hostaddr", "127.0.0.1")
        params.update(connect_timeout=4, options="-c statement_timeout=4000 -c default_transaction_read_only=on")
        with psycopg.connect(**params) as conn:
            conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            conn.execute("SELECT 1")
            result["status"] = "up"
            queries = {
                "users": "SELECT count(*) FROM users",
                "check_ins_last_24h": "SELECT count(*) FROM check_ins WHERE created_at >= now() - interval '24 hours'",
                "activity_events_last_1h": "SELECT count(*) FROM activity_events WHERE created_at >= now() - interval '1 hour'",
                "mayor_outbox_pending": "SELECT count(*) FROM mayor_outbox WHERE status='pending'",
            }
            counts = {}
            for key, sql in queries.items():
                try:
                    with conn.transaction():
                        counts[key] = conn.execute(sql).fetchone()[0]
                except Exception as exc:
                    counts[key] = None
                    result.setdefault("count_errors", {})[key] = type(exc).__name__
            try:
                with conn.transaction():
                    rows = conn.execute("SELECT status,count(*) FROM avatar_jobs GROUP BY status ORDER BY status").fetchall()
                    counts["avatar_jobs_by_status"] = {**dict.fromkeys(["queued", "running", "done", "failed"], 0), **dict(rows)}
            except Exception as exc:
                counts["avatar_jobs_by_status"] = None
                result.setdefault("count_errors", {})["avatar_jobs_by_status"] = type(exc).__name__
            result["counts"] = counts
    except Exception as exc:
        result["error"] = type(exc).__name__
    result["latency_ms"] = round((time.perf_counter() - start) * 1000, 1)
    return result


def report():
    load_environment()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            "api": pool.submit(probe, os.getenv("QA_API_URL", "http://127.0.0.1:8010/api") + "/health", True),
            "web": pool.submit(probe, os.getenv("QA_WEB_URL", "http://127.0.0.1:4173")),
            "gpu_worker": pool.submit(probe, os.getenv("QA_GPU_HEALTH_URL", "http://127.0.0.1:8100/health"), True),
            "db": pool.submit(database),
        }
        services = {key: value.result() for key, value in futures.items()}
    try:
        git = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--verify", "refs/heads/main"], capture_output=True, text=True, timeout=4)
        head = git.stdout.strip() if git.returncode == 0 else None
    except Exception:
        head = None
    return {"services": services, "api_build": services["api"].get("build"), "main_head": head}


def summary(data):
    services = " ".join(f"{key}={value['status']}({value['latency_ms']}ms)" for key, value in data.get("services", {}).items())
    return f"{services} build={data.get('api_build')} main={data.get('main_head')} counts={json.dumps(data.get('services', {}).get('db', {}).get('counts'), sort_keys=True, separators=(',', ':'))}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--format", choices=["json", "text", "both"], default="both")
    args = parser.parse_args()
    try:
        data = report()
    except Exception as exc:
        data = {"services": {}, "error": type(exc).__name__, "api_build": None, "main_head": None}
    if args.format in {"json", "both"}:
        print(json.dumps(data, sort_keys=True))
    if args.format in {"text", "both"}:
        print(summary(data))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
