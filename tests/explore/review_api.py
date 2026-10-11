"""Read-only REVIEW-001 route inventory. Run with the API venv Python.

Loads DATABASE_URL at runtime; never records credentials or response bodies.
DB transaction is explicitly READ ONLY. Internal outbox is probed without a
service key because a service-authenticated GET would claim real messages.
"""
import json
import os
from pathlib import Path
import re
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from dotenv import load_dotenv
import psycopg
from psycopg.conninfo import conninfo_to_dict, make_conninfo

OUT = Path(__file__).parent / "artifacts"
OUT.mkdir(exist_ok=True)
env_path = os.environ.get("VILLAGE_ENV_FILE", "/c/Users/mourn/Downloads/hacklanta/.env")
if os.name == "nt" and re.match(r"^/[a-zA-Z]/", env_path):
    env_path = env_path[1] + ":" + env_path[2:]
load_dotenv(env_path)
dsn = os.environ["DATABASE_URL"]
if os.name == "nt" and conninfo_to_dict(dsn).get("host") == "localhost":
    dsn = make_conninfo(dsn, hostaddr="127.0.0.1")
VID = "13370000-0000-4000-8000-000000000000"
UID = "13370000-0000-4000-8000-000000000001"
MISSING = "00000000-0000-4000-8000-000000000099"

def request(path, user=None, stream=False):
    start = time.perf_counter()
    try:
        response = urlopen(Request("http://127.0.0.1:8010" + path,
            headers={"X-Demo-User": user} if user else {}), timeout=12)
    except HTTPError as exc:
        response = exc
    with response:
        # SSE is intentionally closed after headers, not mistaken for a timeout.
        raw = b"" if stream else response.read()
        elapsed = round((time.perf_counter() - start) * 1000)
        try:
            body = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            body = None
        return response.status, elapsed, body

with psycopg.connect(dsn, options="-c default_transaction_read_only=on", connect_timeout=8) as conn:
    outsider = conn.execute("""SELECT id FROM users u WHERE NOT EXISTS
        (SELECT 1 FROM village_members m WHERE m.user_id=u.id AND m.village_id=%s)
        ORDER BY id LIMIT 1""", (VID,)).fetchone()
    verified_nonmember = outsider is not None
    outsider = str(outsider[0]) if outsider else MISSING
    if not verified_nonmember:
        print("COVERAGE LIMIT: no existing non-member; unknown-user probes test authentication only.")
    refs = {}
    for label, sql, args in [
        ("job_id", "SELECT id FROM avatar_jobs WHERE user_id=%s ORDER BY created_at DESC LIMIT 1", (UID,)),
        ("line_id", "SELECT id FROM voice_lines WHERE user_id=%s ORDER BY created_at DESC LIMIT 1", (UID,)),
        ("review", "SELECT id FROM check_ins WHERE village_id=%s AND evidence_asset_id IS NOT NULL LIMIT 1", (VID,)),
        ("key", "SELECT evidence_asset_id FROM check_ins WHERE village_id=%s AND evidence_asset_id IS NOT NULL LIMIT 1", (VID,)),
        ("competition", "SELECT id FROM competitions WHERE village_id=%s LIMIT 1", (VID,)),
        ("group", "SELECT job_id FROM group_photos WHERE village_id=%s LIMIT 1", (VID,)),
        ("jid", "SELECT job_id FROM photo_item_jobs WHERE village_id=%s LIMIT 1", (VID,)),
    ]:
        row = conn.execute(sql, args).fetchone()
        refs[label] = str(row[0]) if row else MISSING

spec = request("/openapi.json")[2]
week = request(f"/api/villages/{VID}/weekly/current", UID)[2]["week_start"]
rows = []
for template, methods in spec["paths"].items():
    if "get" not in methods:
        continue
    values = {"vid": VID, "uid": UID, "week_start": week, **refs,
              "cid": refs["review"] if "check-ins" in template else refs["competition"],
              "job_id": refs["group"] if "group-photo" in template else refs["job_id"]}
    path = re.sub(r"\{([^}]+)\}", lambda m: values[m[1]], template)
    for role, actor in [("member", UID), ("nonmember" if verified_nonmember else "unknown", outsider)]:
        status, ms, body = request(path, actor, template.endswith("/presence/stream"))
        rows.append({"route": template, "role": role, "status": status, "ms": ms,
                     "missing_fixture": MISSING in path,
                     "detail": body.get("detail") if isinstance(body, dict) and status >= 400 else None,
                     "response_keys": sorted(body) if isinstance(body, dict) and status < 400 else None})
        print(f"{role:9} {status} {ms:5}ms {template}", flush=True)
result = {"get_routes": sum("get" in v for v in spec["paths"].values()),
          "nonmember_verified_by_readonly_db": verified_nonmember, "rows": rows}
(OUT / "api-results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
assert not any(r["status"] >= 500 for r in rows), "GET route returned 5xx; see api-results.json"
