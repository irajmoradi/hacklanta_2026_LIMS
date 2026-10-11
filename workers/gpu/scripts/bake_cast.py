"""Rebake villager avatars from a folder of photos, through the real API (consented upload) -> bridge -> GPU worker.

  python -m uv run --with httpx --with "psycopg[binary]" --with python-dotenv \
      workers/gpu/scripts/bake_cast.py --photos data/inputs/demo_cast [--users iraj,maya] [--lines lines.json]

Photos are `<name>.jpg|png|webp` where <name> is a seeded user (iraj, lance, stefanny, maya, dev) or a user UUID.
Only use photos people consented to (the upload sends consent=true on their behalf).

Per user: POST /api/avatars/{uid}/photo (X-Demo-User: uid). Then it waits until the manifest has
generation {segment, head, body} terminal. Idempotent: re-uploading the same bytes returns the existing job (no
GPU work); if that earlier chain predates a stage (e.g. no body stage yet), the missing head/body job is enqueued
directly (same idem keys as the bridge). Needs `ops/run_gpu.sh start` (worker + bridge) running.

--lines file.json: {"iraj": ["line 1", "line 2"], ...} -> POST /api/voice/lines (ElevenLabs, stock voices) after the
head is ready; the API enqueues voice_expr jobs, which we wait for. Lines whose exact text already exists for that
user are skipped (no repeat ElevenLabs spend).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path
from uuid import UUID

import httpx
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bridge  # noqa: E402  (settings(), latest_manifest, enqueue_body)

SEED = {name: f"13370000-0000-4000-8000-{n:012d}" for n, name in
        enumerate(["iraj", "lance", "stefanny", "maya", "dev"], start=1)}
EXTS = {".jpg", ".jpeg", ".png", ".webp"}
TERMINAL = {"ready", "failed"}


def resolve_user(name: str) -> str | None:
    if name.lower() in SEED:
        return SEED[name.lower()]
    try:
        return str(UUID(name))
    except ValueError:
        return None


def jobs_for(conn, uid, stage):
    return conn.execute("SELECT id,status,created_at,updated_at,error FROM avatar_jobs WHERE user_id=%s AND stage=%s "
                        "ORDER BY created_at DESC", (uid, stage)).fetchall()


def repair_chain(conn, uid: str) -> list[str]:
    """Enqueue missing head/body jobs for a user whose segment is done (e.g. chain predates CV-003)."""
    done = []
    m = bridge.latest_manifest(conn, uid)
    seg = jobs_for(conn, uid, "segment")
    if not seg or seg[0]["status"] != "done":
        return done
    sha_row = conn.execute("SELECT input->>'sha256' AS sha, id FROM avatar_jobs WHERE id=%s", (seg[0]["id"],)).fetchone()
    pending = lambda st: any(j["status"] in ("queued", "running") for j in jobs_for(conn, uid, st))  # noqa: E731
    with conn.transaction():
        if m.get("portrait", {}).get("kind") != "lam_head" and not pending("head"):
            idem = hashlib.sha256(f"{uid}:{sha_row['sha']}:head:lam20k:v1".encode()).hexdigest()
            r = conn.execute("""INSERT INTO avatar_jobs (user_id,stage,idem_key,input) VALUES (%s,'head',%s,%s)
                ON CONFLICT (idem_key) DO UPDATE SET status='queued', attempts=0, error=NULL
                WHERE avatar_jobs.status='failed' RETURNING id""",
                             (uid, idem, Jsonb({"face_asset_key": f"avatars/{uid}/face_512.png", "sha256": sha_row["sha"],
                                                "source_job": str(sha_row["id"]), "user_id": uid}))).fetchone()
            if r:
                done.append("head")
        elif not (m.get("body") or {}).get("head_glb_url") and not pending("body") and not pending("head"):
            fake_job = {"user_id": uid, "id": sha_row["id"], "input": {"sha256": sha_row["sha"]}}
            before = len(jobs_for(conn, uid, "body"))
            bridge.enqueue_body(conn, fake_job)
            if len(jobs_for(conn, uid, "body")) > before:
                done.append("body")
            else:  # same idem key already exists (failed earlier): requeue it
                r = conn.execute("""UPDATE avatar_jobs SET status='queued', attempts=0, error=NULL
                    WHERE user_id=%s AND stage='body' AND status='failed' RETURNING id""", (uid,)).fetchone()
                if r:
                    done.append("body(requeued)")
    if done:
        m["generation"] = {**m.get("generation", {}), **{s.split("(")[0]: "queued" for s in done}}
    return done


def wait_manifest(api, uid, timeout, min_rev: int = 0) -> dict:
    """Wait until segment/head/body are terminal in a manifest revision >= min_rev."""
    t0 = time.time()
    last = None
    while time.time() - t0 < timeout:
        m = api.get(f"/api/avatars/{uid}", headers={"X-Demo-User": uid}).json()
        g = m.get("generation", {})
        state = (g.get("segment"), g.get("head"), g.get("body"))
        if state != last:
            print(f"    {time.time() - t0:6.1f}s  segment={state[0]} head={state[1]} body={state[2]} rev={m.get('revision')}")
            last = state
        if (m.get("revision") or 0) >= min_rev and (all(s in TERMINAL for s in state) or state[0] == "failed"):
            return m
        time.sleep(3)
    return m


def stage_seconds(conn, uid, stage):
    j = jobs_for(conn, uid, stage)
    if not j or j[0]["status"] != "done":
        return None
    return round((j[0]["updated_at"] - j[0]["created_at"]).total_seconds(), 1)


def do_lines(api, conn, uid, lines, timeout) -> list[dict]:
    out = []
    for text in lines:
        row = conn.execute("SELECT id,job_id FROM voice_lines WHERE user_id=%s AND text=%s ORDER BY created_at DESC LIMIT 1",
                           (uid, text)).fetchone()
        if row:
            out.append({"line_id": str(row["id"]), "text": text, "new": False, "job_id": row["job_id"]})
            continue
        r = api.post("/api/voice/lines", headers={"X-Demo-User": uid}, json={"user_id": uid, "text": text})
        if r.status_code >= 400:
            out.append({"text": text, "error": f"{r.status_code} {r.text[:120]}"})
            continue
        j = r.json()
        out.append({"line_id": str(j["id"]), "text": text, "new": True, "job_id": j.get("job_id")})
    t0 = time.time()
    for o in out:
        if not o.get("job_id"):
            continue
        while time.time() - t0 < timeout:
            st = conn.execute("SELECT status,result FROM avatar_jobs WHERE id=%s", (o["job_id"],)).fetchone()
            if st and st["status"] in ("done", "failed"):
                o["expr"] = st["status"]
                o["expr_url"] = (st["result"] or {}).get("expr_url")
                break
            time.sleep(2)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--photos", required=True)
    ap.add_argument("--users", help="comma-separated subset of names/uuids")
    ap.add_argument("--api", default="http://localhost:8010")
    ap.add_argument("--timeout", type=float, default=900)
    ap.add_argument("--lines", help="json {name: [text,...]} to pre-generate voice lines")
    a = ap.parse_args()

    photos = {p.stem.lower(): p for p in sorted(Path(a.photos).iterdir()) if p.suffix.lower() in EXTS}
    wanted = [u.strip().lower() for u in a.users.split(",")] if a.users else list(photos)
    lines_cfg = json.loads(Path(a.lines).read_text()) if a.lines else {}
    db, asset_dir, worker = bridge.settings()
    try:
        httpx.get(f"{worker}/health", timeout=5).raise_for_status()
    except Exception:
        print(f"GPU worker not answering at {worker}: run `bash ops/run_gpu.sh start` first")
        return 2

    rows = []
    with httpx.Client(base_url=a.api, timeout=60) as api, \
            psycopg.connect(db, autocommit=True, row_factory=dict_row) as conn:
        # Phase 1: upload everything first, so the bridge batches stages (all segments, then heads, then bodies)
        # and each heavy model is loaded once instead of once per user.
        pending = []
        for name in wanted:
            uid = resolve_user(name)
            if not uid or name not in photos:
                print(f"skip {name}: no photo or unknown user")
                continue
            rev_before = api.get(f"/api/avatars/{uid}", headers={"X-Demo-User": uid}).json().get("revision") or 0
            with open(photos[name], "rb") as f:
                r = api.post(f"/api/avatars/{uid}/photo", headers={"X-Demo-User": uid},
                             data={"consent": "true"}, files={"file": (photos[name].name, f, "image/jpeg")})
            if r.status_code >= 400:
                rows.append({"user": name, "error": f"upload {r.status_code}: {r.text[:100]}"})
                continue
            job_id = r.json()["job_id"]
            seg = conn.execute("SELECT status FROM avatar_jobs WHERE id=%s", (job_id,)).fetchone()
            min_rev = rev_before + 1
            note = "new photo"
            if seg and seg["status"] == "done":
                fixed = repair_chain(conn, uid)
                note = f"same photo as before; enqueued missing: {', '.join(fixed) or 'nothing'}"
                if not fixed:
                    min_rev = 0  # already complete: nothing new will be written
            print(f"== {name} ({uid}) <- {photos[name].name}: job {job_id} ({note})")
            pending.append((name, uid, min_rev))
        t0 = time.time()
        # Phase 2: wait for each manifest to settle.
        for name, uid, min_rev in pending:
            print(f"-- waiting for {name}")
            m = wait_manifest(api, uid, a.timeout, min_rev)
            body = m.get("body") or {}
            rows.append({"user": name, "photo": photos[name].name, "rev": m.get("revision"),
                         "segment": m["generation"].get("segment"), "head": m["generation"].get("head"),
                         "body": m["generation"].get("body"),
                         "lam_head": m.get("portrait", {}).get("kind") == "lam_head",
                         "head_glb": bool(body.get("head_glb_url")),
                         "fallback": "card" if (body.get("head_card_url") and not body.get("head_glb_url")) else "",
                         "t_segment": stage_seconds(conn, uid, "segment"), "t_head": stage_seconds(conn, uid, "head"),
                         "t_body": stage_seconds(conn, uid, "body"), "wall": round(time.time() - t0, 1)})
        # Phase 3: voice lines (need the LAM head; the API only enqueues voice_expr for lam_head users).
        for row in rows:
            if row.get("user") in lines_cfg and row.get("lam_head"):
                row["lines"] = do_lines(api, conn, resolve_user(row["user"]), lines_cfg[row["user"]], a.timeout)

    print("\nuser      photo          rev seg    head   body   lam_head head_glb fallback  t_seg  t_head t_body  wall  lines(expr ok/total)")
    for r in rows:
        if "error" in r:
            print(f"{r['user']:<9} ERROR {r['error']}")
            continue
        ls = r.get("lines") or []
        lines_s = f"{sum(1 for l in ls if l.get('expr') == 'done')}/{len(ls)}" if ls else "-"
        print(f"{r['user']:<9} {r['photo']:<14} {r['rev']!s:<3} {r['segment']!s:<6} {r['head']!s:<6} {r['body']!s:<6} "
              f"{r['lam_head']!s:<8} {r['head_glb']!s:<8} {r['fallback'] or '-':<9} {r['t_segment']!s:<6} "
              f"{r['t_head']!s:<6} {r['t_body']!s:<6} {r['wall']!s:<5} {lines_s}")
    out = asset_dir.parent / "logs" / "bake_cast_last.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rows, indent=2, default=str))
    print(f"summary json: {out}")
    ok = all(r.get("lam_head") and r.get("head_glb") for r in rows if "error" not in r) and not any("error" in r for r in rows)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
