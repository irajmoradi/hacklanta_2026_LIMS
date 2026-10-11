"""Safe deployed API-007 checks: fresh users, no uploads accepted or jobs queued."""
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import httpx
import psycopg

from run_live import Settings, cleanup


def main():
    settings = Settings.from_env()
    users = [str(uuid4()) for _ in range(3)]
    with psycopg.connect(settings.database_url) as conn:
        for uid in users:
            conn.execute("INSERT INTO users(id,auth_issuer,auth_subject,display_name,agent_msgs_ok) "
                         "VALUES(%s,'qa002',%s,'QA-003 auditor',false)", (uid, uid))
    try:
        with httpx.Client(base_url="http://127.0.0.1:8010", headers={"X-Demo-User": users[0]}, timeout=30) as client:
            paths = client.get("/openapi.json").json()["paths"]
            assert "/api/villages/{vid}/group-photo/{job_id}/claim" in paths
            print("Dedicated weather route present:", any("weather" in p for p in paths))
            response = client.post("/api/villages", json={"name": "QA-002 wave3 " + uuid4().hex[:8]})
            assert response.status_code == 200
            v = response.json()["village"]
            base = "/api/villages/" + v["id"]
            assert client.post("/api/villages/join", headers={"X-Demo-User": users[1]}, json={"invite_code": v["invite_code"]}).status_code == 200
            assert client.get(base, headers={"X-Demo-User": users[2]}).status_code == 403
            assert client.get(base).json()["world"]["level"] == 1
            with psycopg.connect(settings.database_url) as conn:
                conn.execute("INSERT INTO xp_ledger(village_id,user_id,delta,reason,source_key) VALUES(%s,%s,2500,'mayor_event','qa003-growth')", (v["id"], users[0]))
            with ThreadPoolExecutor(max_workers=4) as pool:
                states = list(pool.map(lambda _: client.get(base).json()["world"], range(4)))
            assert all(s["level"] == 4 and s["xp"] == 2500 and len(s["unlocked"]) == 3 for s in states)
            with psycopg.connect(settings.database_url) as conn:
                assert conn.execute("SELECT count(*) FROM village_unlocks WHERE village_id=%s", (v["id"],)).fetchone()[0] == 3
                assert conn.execute("SELECT count(*) FROM activity_events WHERE village_id=%s AND type='building_unlocked'", (v["id"],)).fetchone()[0] == 3
            # Invalid bytes deliberately fail closed even if consent checking regresses.
            file = {"file": ("invalid.png", b"QA-not-an-image", "image/png")}
            assert client.post(base + "/group-photo", files=file).status_code == 422
            for uid in users[1:]:
                assert client.post(base + "/group-photo", headers={"X-Demo-User": uid}, files=file, data={"consent": "true"}).status_code == 403
            with psycopg.connect(settings.database_url) as conn:
                assert conn.execute("SELECT count(*) FROM avatar_jobs WHERE user_id=ANY(%s::uuid[])", (users,)).fetchone()[0] == 0
            print("PASS: live growth/unlock concurrency, membership, upload consent/owner; zero avatar jobs")
    finally:
        cleanup(settings.database_url, users)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Wave3 live failed: {type(exc).__name__}; credentials suppressed")
        raise SystemExit(1)
