"""Wave-7 live checks: dedicated identities, no provider/worker/chain requests."""
import concurrent.futures
import json
import os
import subprocess
import sys
from uuid import uuid4

import httpx
import psycopg
from psycopg.types.json import Jsonb

from run_live import ROOT, Settings, cleanup

API = "http://127.0.0.1:8010/api"


def main():
    settings = Settings.from_env()
    users = [str(uuid4()) for _ in range(3)]
    jobs = []
    failures = []
    with psycopg.connect(settings.database_url) as conn:
        for n, uid in enumerate(users):
            conn.execute("INSERT INTO users(id,auth_issuer,auth_subject,display_name,agent_msgs_ok) "
                         "VALUES(%s,'qa002',%s,%s,false)", (uid, uid, f"QA4 Friend {n}"))
    client = httpx.Client(base_url=API, headers={"X-Demo-User": users[0]}, timeout=20)

    def request(method, path, status=200, **kw):
        response = client.request(method, path, **kw)
        assert response.status_code == status, f"{method} {path}: expected {status}, got {response.status_code}"
        return response.json()

    def check(label, fn):
        try:
            fn()
            print(f"PASS {label}", flush=True)
        except Exception as exc:
            failures.append(label)
            print(f"FAIL {label}: {type(exc).__name__}: {exc}", flush=True)

    try:
        v = request("POST", "/villages", json={"name": "QA-002 wave7 " + uuid4().hex[:8]})["village"]
        vid = v["id"]
        base = "/villages/" + vid
        peer = {"X-Demo-User": users[1]}
        outsider = {"X-Demo-User": users[2]}
        request("POST", "/villages/join", headers=peer, json={"invite_code": v["invite_code"]})

        def social():
            for kind in ("message", "poke", "cheer"):
                row = request("POST", base + "/messages", 201,
                              json={"to_user_id": users[1], "text": "QA4 " + kind, "kind": kind})
                request("POST", base + f"/messages/{row['id']}/read", 404)
                first = request("POST", base + f"/messages/{row['id']}/read", headers=peer)
                assert request("POST", base + f"/messages/{row['id']}/read", headers=peer)["read_at"] == first["read_at"]
            assert len(request("GET", base + "/messages", headers=peer)["messages"]) == 3
            assert request("GET", base + "/messages")["messages"] == []
            request("GET", base + "/messages", 403, headers=outsider)
            with psycopg.connect(settings.database_url) as conn:
                assert conn.execute("SELECT count(*) FROM mayor_outbox WHERE village_id=%s", (vid,)).fetchone()[0] == 0
                kinds = [r[0] for r in conn.execute("SELECT type FROM activity_events WHERE village_id=%s AND type IN ('message','poke','cheer')", (vid,))]
                assert sorted(kinds) == ["cheer", "poke"]
        check("messages privacy, read retry, poke/cheer feed, zero relay", social)

        def presence():
            request("POST", base + "/presence/heartbeat", json={"x": 2, "z": 3, "activity": "QA4"})
            request("GET", base + "/presence/stream", 403, headers=outsider)
            with client.stream("GET", base + "/presence/stream") as response:
                assert response.status_code == 200
                assert response.headers["content-type"].startswith("text/event-stream")
                for line in response.iter_lines():
                    if line.startswith("data: "):
                        online = json.loads(line[6:])["online"]
                        assert any(p["user_id"] == users[0] and p["x"] == 2 for p in online)
                        break
                else:
                    raise AssertionError("SSE ended without presence data")
        check("live heartbeat and authenticated SSE", presence)

        def bribes():
            with psycopg.connect(settings.database_url) as conn:
                conn.execute("INSERT INTO xp_ledger(village_id,user_id,delta,reason,source_key) VALUES(%s,%s,100,'test','qa4-funding')", (vid, users[0]))
            def buy(_):
                return client.post(base + "/mayor/bribe", json={"xp": 70, "wish": "game night"})
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(buy, range(2)))
            assert sorted(r.status_code for r in responses) == [201, 409]
            assert next(r.json() for r in responses if r.status_code == 201)["balance"] == 30
            with psycopg.connect(settings.database_url) as conn:
                assert conn.execute("SELECT count(*),sum(delta) FROM xp_ledger WHERE village_id=%s AND reason='mayor_bribe'", (vid,)).fetchone() == (1, -70)
        check("concurrent bribes debit once without overdraft", bribes)

        def photo():
            # No upload accepted: insert only terminal jobs, invisible to bridge claiming.
            for state in ("done", "failed"):
                jid = str(uuid4())
                jobs.append(jid)
                prefix = f"/api/assets/items/{users[0]}/{jid}/"
                source = "qa4-reward:" + jid
                with psycopg.connect(settings.database_url) as conn:
                    conn.execute("INSERT INTO xp_ledger(village_id,user_id,delta,reason,source_key) VALUES(%s,%s,1,'mayor_event',%s)", (vid, users[0], source))
                assert request("GET", base + "/items")["photo_item_tokens"] == 1
                with psycopg.connect(settings.database_url) as conn:
                    conn.execute("INSERT INTO avatar_jobs(id,user_id,stage,status,idem_key,input,result,error) VALUES(%s,%s,'segment',%s,%s,%s,%s,%s)",
                                 (jid, users[0], state, "qa4:" + jid,
                                  Jsonb({"kind": "object_from_photo", "consent": True}),
                                  Jsonb({"kind": "object_from_photo", "glb_url": prefix + "object.glb", "preview_png_url": prefix + "preview.png"}),
                                  "Synthetic failure" if state == "failed" else None))
                    conn.execute("INSERT INTO photo_item_jobs VALUES(%s,%s,%s)", (jid, vid, users[0]))
                    assert conn.execute("UPDATE photo_item_tokens SET consumed_at=now(),spent_job=%s WHERE village_id=%s AND user_id=%s AND source=%s AND consumed_at IS NULL", (jid, vid, users[0], "reward:" + source)).rowcount == 1
                path = base + "/items/jobs/" + jid
                row = request("GET", path)
                assert row["status"] == state
                if state == "done":
                    assert row["item"]["id"] == request("GET", path)["item"]["id"]
                else:
                    assert row["item"] is None and row["error"] == "Synthetic failure"
                request("GET", path, 404, headers=peer)
                request("GET", path, 403, headers=outsider)
            inventory = request("GET", base + "/items")
            assert inventory["photo_item_tokens"] == 0 and len(inventory["items"]) == 1
        check("terminal photo jobs, consumed tokens, materialization retry and privacy", photo)

        def editorial():
            with psycopg.connect(settings.database_url) as conn:
                for days in (0, 1):
                    conn.execute("INSERT INTO village_gazettes(village_id,edition_date,content,model) VALUES(%s,current_date-%s,%s,'qa4-synthetic')",
                                 (vid, days, Jsonb({"headline": f"QA4 edition {days}", "weather": "clear", "stories": [{"text": "QA4 small steps", "source": "check_ins", "user_id": users[0]}], "gossip": {"target_user_id": None, "style": "tea"}})))
                conn.execute("INSERT INTO mayor_memory(village_id,document) VALUES(%s,%s)", (vid, Jsonb({"weeks": [], "facts": [{"villager": users[0], "wins": 1, "checkins": 3}], "recent": []})))
            assert request("GET", base + "/gazette/latest")["content"]["headline"] == "QA4 edition 0"
            assert len(request("GET", base + "/gazette")) == 2
            assert request("GET", base + "/mayor/memory")["document"]["facts"][0]["wins"] == 1
            for path in ("/gazette/latest", "/gazette", "/mayor/memory"):
                request("GET", base + path, 403, headers=outsider)
        check("Gazette latest/archive and bounded memory live shapes", editorial)

        def pack():
            with psycopg.connect(settings.database_url) as conn:
                eid = conn.execute("INSERT INTO mayor_events(village_id,kind,title,body,template_id,ends_at) VALUES(%s,'challenge','QA4 game','Synthetic','game_night',now()+interval '1 hour') RETURNING id", (vid,)).fetchone()[0]
            world = request("GET", base)["world"]
            assert world["active_pack"]["id"] == "game_night"
            with psycopg.connect(settings.database_url) as conn:
                conn.execute("UPDATE mayor_events SET status='completed' WHERE id=%s", (eid,))
            assert request("GET", base)["world"]["active_pack"] is None
            styles = [r for r in request("GET", base + "/shop")["items"] if r["id"].startswith("voice_")]
            assert {r["id"] for r in styles} >= {"voice_pirate", "voice_hype_coach", "voice_shakespearean"}
        check("registry active pack completion and voice styles", pack)

        if "--browser" in sys.argv:
            result = subprocess.run(["node", "../apps/web/node_modules/@playwright/test/cli.js", "test", "--config", "playwright.wave4.config.ts", "--project=live"],
                                    cwd=ROOT / "tests", env={**os.environ, "QA_WAVE4": json.dumps({"village": v, "users": users})}, timeout=240)
            if result.returncode:
                failures.append("live browser")

        def erase():
            request("DELETE", "/me", 422, json={"confirm": "NO"})
            request("DELETE", "/me", json={"confirm": "DELETE"})
            request("GET", "/me", 401)
            with psycopg.connect(settings.database_url) as conn:
                assert conn.execute("SELECT count(*) FROM users WHERE id=%s", (users[0],)).fetchone()[0] == 0
                assert conn.execute("SELECT count(*) FROM avatar_jobs WHERE id=ANY(%s::uuid[])", (jobs,)).fetchone()[0] == 0
            assert request("GET", base, headers=peer)["id"] == vid
        check("delete-me erases only QA owner and preserves QA peer village", erase)
    finally:
        client.close()
        # Avatar jobs do not have a village FK; remove terminal fixtures explicitly.
        with psycopg.connect(settings.database_url) as conn:
            conn.execute("DELETE FROM avatar_jobs WHERE id=ANY(%s::uuid[]) AND user_id=ANY(%s::uuid[]) AND status IN ('done','failed')", (jobs, users))
        cleanup(settings.database_url, users)
    print(f"Wave 7: {len(failures)} failed checks; 0 Mayor/ElevenLabs/GPU/chain calls", flush=True)
    return bool(failures)


if __name__ == "__main__":
    raise SystemExit(main())
