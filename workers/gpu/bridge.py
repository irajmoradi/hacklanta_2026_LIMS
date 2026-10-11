"""Job bridge: Postgres `avatar_jobs` -> GPU worker (:8100) -> `avatar_assets` manifest revisions.

Runs on Windows (where the DB is published on 127.0.0.1:5433) with the worker reachable at
GPU_WORKER_BASE (default http://localhost:8100, WSL2 localhost forwarding). Inputs are sent to the worker
as multipart uploads, so no path mapping between Windows and WSL is needed; the worker writes outputs to
<repo>/data/assets/avatars/<user_id>/..., which the API serves as /api/assets/avatars/<user_id>/... .

  python -m uv run --with "psycopg[binary]" --with httpx --with python-dotenv workers/gpu/bridge.py          # loop
  ... bridge.py --once                       # process at most one job, then exit
  ... bridge.py expr-line --user <uuid> --audio-key voice/<uuid>/<line>.mp3   # one-off voice_expr job

Stages handled:
  segment    input {photo_asset_key|asset_key, sha256}  -> manifest rev (body.colors, portrait photo,
                                                            generation.segment=ready, head=queued) + enqueue head
  head       input {face_asset_key, sha256}             -> manifest rev (portrait lam_head + head_package_url,
                                                            generation.head=ready) + activity avatar_ready
  body       input {face_asset_key, sha256}             -> manifest rev body {kind:preset, preset_id:villager_base,
                                                            colors, head_glb_url?, head_card_url?}, generation.body=ready
                                                            (head chains -> body automatically)
  voice_expr input {audio_key, line_id}                 -> result {expr_url}; no manifest change
Claiming: UPDATE ... WHERE id=(SELECT ... FOR UPDATE SKIP LOCKED), 5-minute lease, max 3 attempts.
The manifest insert, follow-up job insert, activity row and job->done happen in ONE transaction, so a
crash/retry never double-writes; worker calls themselves are idempotent (same output paths).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
import time
import uuid
from pathlib import Path

import httpx
import psycopg
from dotenv import load_dotenv
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[2]
log = logging.getLogger("bridge")

STAGES = ("segment", "head", "body", "voice_expr")
LEASE = "5 minutes"
MAX_ATTEMPTS = 3
WORKER_TIMEOUT = {"segment": 300, "head": 900, "body": 900, "voice_expr": 300}
DEFAULT_COLORS = {"hair": "#352b27", "shirt": "#6c5ce7", "pants": "#34495e", "shoes": "#252525", "skin": "#c99573"}
HEX = re.compile(r"^#[0-9a-f]{6}$")


class JobError(Exception):
    """Failure with a user-safe message (the API masks job errors anyway)."""


def settings():
    env_file = Path(os.environ.get("VILLAGE_ENV_FILE", ROOT / ".env"))
    if not env_file.exists():  # running from a worktree: fall back to the main checkout's .env
        env_file = Path(os.environ.get("VILLAGE_REPO", r"C:\Users\mourn\Downloads\hacklanta")) / ".env"
    load_dotenv(env_file, override=False)
    db = os.environ["DATABASE_URL"]
    if os.name == "nt":  # same IPv6 black-hole workaround as apps/api/app/config.py
        p = conninfo_to_dict(db)
        if p.get("host") == "localhost" and not p.get("hostaddr"):
            db = make_conninfo(db, hostaddr="127.0.0.1")
    asset_dir = Path(os.environ.get("ASSET_DIR") or (env_file.parent / "data" / "assets"))
    raw = os.environ.get("GPU_WORKER_BASE")
    if raw is None:
        raw = os.environ.get("GPU_WORKER_URL", "http://localhost:8100")
    worker = raw.strip().rstrip("/").removesuffix("/health")  # "" = no local GPU (Modal-only or offline)
    return db, asset_dir.resolve(), worker


# ---------------------------------------------------------------- MODAL-001: cloud fallback (transport mode)
def modal_cfg() -> dict:
    """GPU_FALLBACK_URL (+ GPU_FALLBACK_KEY or the gitignored key file) and GPU_PREFER=local|modal."""
    key = os.environ.get("GPU_FALLBACK_KEY", "")
    if not key:
        kf = Path(os.environ.get("GPU_FALLBACK_KEY_FILE", ROOT.parent / "hacklanta" / "data" / "run" / "gpu_fallback.key"))
        for cand in (kf, ROOT / "data" / "run" / "gpu_fallback.key"):
            if cand.is_file():
                key = cand.read_text(encoding="utf-8").strip()
                break
    return {"url": os.environ.get("GPU_FALLBACK_URL", "").rstrip("/"), "key": key,
            "prefer": "modal" if os.environ.get("GPU_PREFER", "local").lower() == "modal" else "local"}


def use_modal(worker: str) -> bool:
    cfg = modal_cfg()
    if not (cfg["url"] and cfg["key"]):
        return False
    if cfg["prefer"] == "modal" or not worker:  # MODAL-002: Modal-only mode never touches a local GPU
        return True
    try:
        return not httpx.get(f"{worker}/health", timeout=2).is_success
    except httpx.HTTPError:
        return True


def modal_call(path: str, data: dict, files: dict) -> dict:
    cfg = modal_cfg()
    try:
        # follow_redirects: Modal turns long requests into 303 + polling token
        r = httpx.post(cfg["url"] + path, headers={"X-GPU-Key": cfg["key"]}, data=data, files=files, timeout=900,
                       follow_redirects=True)
    except httpx.HTTPError as e:
        raise ConnectionError(f"Modal GPU unreachable: {type(e).__name__}") from e
    if r.status_code == 401:
        raise ConnectionError("Modal GPU rejected the key")
    if r.status_code >= 400:
        raise JobError(f"Modal worker rejected input ({r.status_code})")
    job = r.json()
    if job.get("status") != "ready":
        # Provider errors may echo request headers, including X-GPU-Key.
        log.warning("modal job failed")
        raise JobError(f"{path.strip('/')} failed on the Modal GPU")
    log.info("modal %s: cold=%s gpu_s=%s est_usd=%s", path, job.get("cold"), job.get("gpu_seconds"), job.get("est_usd_total"))
    return job


def write_artifacts(files_b64: dict, dst: Path) -> list[str]:
    """Write transport-mode artifacts under dst (relative paths only; refuses anything escaping dst)."""
    import base64
    dst = dst.resolve()
    written = []
    for rel, b64 in (files_b64 or {}).items():
        p = (dst / rel).resolve()
        if dst not in p.parents or "\\" in rel or rel.startswith("/"):
            raise JobError("bad artifact path from Modal")
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(base64.b64decode(b64))
        written.append(rel)
    return written


def _sha(path: Path, extra: bytes = b"") -> str:
    return hashlib.sha256(path.read_bytes() + extra).hexdigest()


def _no_new_gemini():
    if os.environ.get("NO_NEW_GEMINI") == "1":
        raise JobError("stylize cache miss and NO_NEW_GEMINI=1")


def bridge_stylize_head(asset_dir: Path, uid: str, face: Path) -> dict:
    """Same cache contract as workers/gpu/body.py (face sha + prompt version), run on the bridge so the Gemini key
    never has to live on Modal. Writes avatars/<uid>/body/stylized_head.png (+ stylize.json)."""
    import shutil
    from stylize import PROMPT_VERSION, stylize
    bdir = asset_dir / "avatars" / uid / "body"
    bdir.mkdir(parents=True, exist_ok=True)
    face_sha = _sha(face)
    styl, meta_p = bdir / "stylized_head.png", bdir / "stylize.json"
    meta = json.loads(meta_p.read_text()) if meta_p.is_file() else {}
    cached = asset_dir.parent / "cache" / "stylize" / f"{face_sha}-{PROMPT_VERSION}.png"
    if styl.is_file() and meta.get("face_sha256") == face_sha and meta.get("prompt_version") == PROMPT_VERSION:
        return {**meta, "cached": True}
    if cached.is_file():
        shutil.copy(cached, styl)
        info = {"face_sha256": face_sha, "prompt_version": PROMPT_VERSION, "model": "cache", "seconds": 0.0,
                "cached": True}
    else:
        _no_new_gemini()
        tr = asset_dir / "avatars" / uid / "traits.json"
        st = stylize(face, styl, json.loads(tr.read_text()) if tr.is_file() else None)
        cached.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(styl, cached)
        info = {"face_sha256": face_sha, "prompt_version": PROMPT_VERSION, "model": st["model"],
                "seconds": st["seconds"], "cached": False}
    meta_p.write_text(json.dumps(info, indent=2))
    return info


def bridge_stylize_object(asset_dir: Path, photo: Path, prompt: str, cutout_white: Path, out: Path) -> bool:
    """Object prop stylize cached by the ORIGINAL photo bytes + noun + prompt version (GPU-independent).
    Returns True on a cache hit."""
    import shutil
    from stylize import OBJECT_PROMPT, OBJECT_PROMPT_VERSION, stylize
    key = _sha(photo, (prompt or "").encode() + b"|" + OBJECT_PROMPT_VERSION.encode())
    cached = asset_dir.parent / "cache" / "stylize_object" / f"photo-{key}.png"
    if cached.is_file():
        shutil.copy(cached, out)
        return True
    _no_new_gemini()
    stylize(cutout_white, out, None, prompt=OBJECT_PROMPT)
    cached.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(out, cached)
    return False


def asset_url(key: str) -> str:
    return f"/api/assets/{key}"


def safe_key_path(asset_dir: Path, key: str) -> Path:
    if not key or "\\" in key or ":" in key or any(p in {".", "..", ""} for p in key.split("/")):
        raise JobError("invalid asset key")
    p = (asset_dir / key).resolve()
    if not p.is_relative_to(asset_dir) or not p.is_file():
        raise JobError("input asset missing")
    return p


# ----------------------------------------------------------------------------- DB helpers
def claim(conn, stages=STAGES):
    with conn.transaction():
        return conn.execute(
            f"""UPDATE avatar_jobs SET status='running', lease_until=now()+interval '{LEASE}',
                   attempts=attempts+1, updated_at=now()
            WHERE id=(SELECT id FROM avatar_jobs
                      WHERE stage = ANY(%s) AND attempts < %s
                        AND (status='queued' OR (status='running' AND lease_until < now()))
                      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
            RETURNING *""",
            (list(stages), MAX_ATTEMPTS),
        ).fetchone()


def latest_manifest(conn, uid) -> dict:
    row = conn.execute("SELECT manifest FROM avatar_assets WHERE user_id=%s ORDER BY revision DESC LIMIT 1",
                       (uid,)).fetchone()
    if row:
        return row["manifest"]
    return {"schema_version": 1, "user_id": str(uid), "revision": 0,
            "body": {"kind": "preset", "preset_id": "preset_default", "colors": dict(DEFAULT_COLORS)},
            "portrait": {"kind": "initials"},
            "generation": {"segment": "none", "head": "none", "body": "none"}}


def write_revision(conn, uid, manifest: dict) -> int:
    conn.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (uid,))  # serialize revisions per user
    rev = conn.execute("SELECT COALESCE(max(revision),0)+1 AS r FROM avatar_assets WHERE user_id=%s",
                       (uid,)).fetchone()["r"]
    manifest = {**manifest, "schema_version": 1, "user_id": str(uid), "revision": rev}
    conn.execute("INSERT INTO avatar_assets (user_id,revision,manifest) VALUES (%s,%s,%s)",
                 (uid, rev, Jsonb(manifest)))
    return rev


def user_activity(conn, uid, kind, payload):
    for m in conn.execute("SELECT village_id FROM village_members WHERE user_id=%s", (uid,)).fetchall():
        conn.execute("INSERT INTO activity_events (village_id,user_id,type,payload) VALUES (%s,%s,%s,%s)",
                     (m["village_id"], uid, kind, Jsonb(payload)))


def finish(conn, job, result: dict):
    conn.execute("""UPDATE avatar_jobs SET status='done', result=%s, error=NULL, lease_until=NULL,
                    updated_at=now() WHERE id=%s""", (Jsonb(result), job["id"]))


def fail(conn, job, msg: str, retry: bool):
    status = "queued" if retry and job["attempts"] < MAX_ATTEMPTS else "failed"
    with conn.transaction():
        conn.execute("""UPDATE avatar_jobs SET status=%s, error=%s, lease_until=NULL, updated_at=now()
                        WHERE id=%s""", (status, msg[:500], job["id"]))
        if (status == "failed" and job["stage"] in ("segment", "head", "body") and not job["input"].get("group_photo")
                and job["input"].get("kind") not in ITEM_KINDS):
            m = latest_manifest(conn, job["user_id"])
            if m.get("generation", {}).get(job["stage"]) == "ready":
                return status  # an earlier result for this stage is still valid; don't downgrade the manifest
            m["generation"] = {**m.get("generation", {}), job["stage"]: "failed"}
            if job["stage"] == "head":  # LAM failing must not block the village villager
                m["generation"]["body"] = "queued"
                enqueue_body(conn, job)
            write_revision(conn, job["user_id"], m)
    return status


# ----------------------------------------------------------------------------- worker calls
def worker_call(worker: str, path: str, stage: str, **kw) -> dict:
    try:
        r = httpx.post(f"{worker}{path}", params={"wait": "true"}, timeout=WORKER_TIMEOUT[stage], **kw)
    except httpx.HTTPError as e:
        raise ConnectionError(f"GPU worker unreachable: {type(e).__name__}") from e
    if r.status_code >= 400:
        raise JobError(f"worker rejected input ({r.status_code})")
    job = r.json()
    if job.get("status") != "ready":
        log.warning("worker job failed: %s", (job.get("error") or "")[:2000])
        raise JobError(f"{stage} failed on the GPU worker")
    return job["result"]


CROP_RE = re.compile(r"^person_[0-9]{1,3}$")


def _member_segment_done(conn, job, colors: dict, sha: str, extra: dict) -> dict:
    """Shared tail of a member segment: manifest revision (colors + photo portrait) + enqueue LAM head."""
    uid = str(job["user_id"])
    face_key = f"avatars/{uid}/face_512.png"
    with conn.transaction():
        m = latest_manifest(conn, job["user_id"])
        body = m.get("body") or {"kind": "preset", "preset_id": "preset_default"}
        m["body"] = {**body, "colors": {**DEFAULT_COLORS, **body.get("colors", {}), **colors}}
        if m.get("portrait", {}).get("kind") != "lam_head":
            m["portrait"] = {"kind": "photo", "asset_url": asset_url(face_key)}
        head_idem = hashlib.sha256(f"{uid}:{sha}:head:lam20k:v1".encode()).hexdigest()
        head = conn.execute(
            """INSERT INTO avatar_jobs (user_id,stage,idem_key,input) VALUES (%s,'head',%s,%s)
            ON CONFLICT (idem_key) DO UPDATE SET idem_key=EXCLUDED.idem_key RETURNING id,status""",
            (job["user_id"], head_idem, Jsonb({"face_asset_key": face_key, "sha256": sha,
                                               "source_job": str(job["id"]), "user_id": uid}))).fetchone()
        # Re-segmenting the same photo (e.g. re-deriving colors) reuses the finished head job: keep "ready".
        head_state = "ready" if head["status"] == "done" else "queued"
        m["generation"] = {**m.get("generation", {}), "segment": "ready", "head": head_state}
        rev = write_revision(conn, job["user_id"], m)
        result = {"manifest_revision": rev, "colors": colors, "face_url": asset_url(face_key),
                  "head_job_id": str(head["id"]), **extra}
        finish(conn, job, result)
    return result


def _clean_colors(c: dict) -> dict:
    return {k: v.lower() for k, v in (c or {}).items() if isinstance(v, str) and HEX.match(v.lower())}


def do_segment(conn, job, asset_dir: Path, worker: str) -> dict:
    inp = job["input"]
    if inp.get("kind") in ITEM_KINDS:
        return do_item(conn, job, asset_dir, worker)
    if inp.get("group_photo"):
        return do_group_segment(conn, job, asset_dir, worker)
    if inp.get("group_job_id"):
        return do_claimed_crop(conn, job, asset_dir)
    uid = str(job["user_id"])
    photo = safe_key_path(asset_dir, inp.get("photo_asset_key") or inp.get("asset_key"))
    if use_modal(worker):
        res = modal_segment(uid, photo, asset_dir)
    else:
        with open(photo, "rb") as f:
            res = worker_call(worker, "/segment", "segment", data={"user_id": uid},
                              files={"file": (photo.name, f, "application/octet-stream")})
    if not res.get("crops"):
        raise JobError("no person found in the photo")
    sel = next(c for c in res["crops"] if c["crop_id"] == res["selected_crop_id"])
    if not (asset_dir / f"avatars/{uid}/face_512.png").is_file():
        raise JobError("segmentation produced no face crop")
    sha = inp.get("sha256") or hashlib.sha256(photo.read_bytes()).hexdigest()
    return _member_segment_done(conn, job, _clean_colors(sel["colors"]), sha,
                                {"crop_count": len(res["crops"]), "selected_crop_id": sel["crop_id"],
                                 "timing_s": res.get("timing_s")})


ITEM_KINDS = {"outfit_from_photo": "outfit", "object_from_photo": "object"}
NOUN_RE = re.compile(r"^[A-Za-z][A-Za-z -]{0,39}$")


def do_item(conn, job, asset_dir: Path, worker: str) -> dict:
    """CV-006: photo -> wearable (outfit_from_photo) or 3D decoration (object_from_photo).
    Outputs under items/<user_id>/<job_id>/; never touches the avatar manifest."""
    inp = job["input"]
    uid = str(job["user_id"])
    kind = inp["kind"]
    slot = inp.get("slot") or "torso"
    if kind == "outfit_from_photo" and slot not in ("torso", "head"):
        raise JobError("slot must be torso or head")
    prompt = (inp.get("prompt") or "").strip()
    if prompt and not NOUN_RE.match(prompt):
        raise JobError("prompt must be a short noun phrase")
    photo = safe_key_path(asset_dir, inp.get("photo_asset_key") or inp.get("asset_key"))
    if kind == "object_from_photo":  # SAM 3 + Gemini + Hunyuan3D with two cold loads can exceed the 5 min lease
        conn.execute("UPDATE avatar_jobs SET lease_until=now()+interval '25 minutes' WHERE id=%s", (job["id"],))
    data = {"owner": uid, "item_job_id": str(job["id"]), "slot": slot}
    if prompt:
        data["prompt"] = prompt
    if use_modal(worker):
        if kind == "object_from_photo":  # MODAL-002: SAM 3 cutout -> bridge stylize (cache) -> Hunyuan mesh
            base = f"items/{uid}/{job['id']}"
            idir = asset_dir / base
            cj = modal_call("/item/object_cutout", data,
                            {"file": (photo.name, photo.read_bytes(), "application/octet-stream")})
            write_artifacts(cj.get("files"), idir)
            cres = cj["result"]
            hit = bridge_stylize_object(asset_dir, photo, prompt, idir / "cutout_white.png", idir / "stylized.png")
            mj = modal_call("/mesh", {"mode": "object", "max_faces": "3000"},
                            {"file": ("stylized.png", (idir / "stylized.png").read_bytes(), "image/png")})
            write_artifacts(mj.get("files"), idir)
            info = mj["result"]
            if not (idir / "object.glb").is_file():
                raise JobError("object mesh missing")
            result = {"kind": kind, "glb_url": asset_url(f"{base}/object.glb"),
                      "preview_png_url": asset_url(f"{base}/stylized.png"), "cutout_png_url": asset_url(f"{base}/cutout.png"),
                      "faces": info.get("faces"), "bounds": info.get("bounds"), "size_m": 0.6,
                      "prompt_used": cres.get("prompt_used"), "object_score": cres.get("object_score"),
                      "gemini_cached": hit, "gpu": "modal",
                      "timing_s": {"cutout": cj.get("gateway_s"), "mesh": mj.get("gateway_s")},
                      "modal": {"cutout_usd": cj.get("est_usd_total"), "mesh_usd": mj.get("est_usd_total"),
                                "cold": [cj.get("cold"), mj.get("cold")]}}
            with conn.transaction():
                finish(conn, job, result)
            return result
        with open(photo, "rb") as f:
            mj = modal_call("/item/outfit", data, {"file": (photo.name, f.read(), "application/octet-stream")})
        base = f"items/{uid}/{job['id']}"
        write_artifacts(mj.get("files"), asset_dir / base)
        res = mj["result"]
        result = {"kind": kind, "slot": res["slot"], "tint": res["tint"], "tint_share": res.get("tint_share"),
                  "pattern_png_url": asset_url(f"{base}/pattern.png"), "cutout_png_url": asset_url(f"{base}/cutout.png"),
                  "prompt_used": res.get("prompt_used"), "garment_score": res.get("garment_score"),
                  "timing_s": res.get("timing_s"), "gpu": "modal",
                  "modal": {k: mj.get(k) for k in ("cold", "gpu_seconds", "est_usd_total")}}
        with conn.transaction():
            finish(conn, job, result)
        return result
    with open(photo, "rb") as f:
        try:
            r = httpx.post(f"{worker}/item/{ITEM_KINDS[kind]}", params={"wait": "true"}, data=data,
                           files={"file": (photo.name, f, "application/octet-stream")}, timeout=1500)
        except httpx.HTTPError as e:
            raise ConnectionError(f"GPU worker unreachable: {type(e).__name__}") from e
    if r.status_code >= 400:
        raise JobError(f"worker rejected input ({r.status_code})")
    wj = r.json()
    if wj.get("status") != "ready":
        err = (wj.get("error") or "")
        log.warning("item job failed: %s", err[:2000])
        raise JobError("no garment found in the photo" if "garment found" in err else
                       "no object found in the photo" if "object found" in err else f"{kind} failed on the GPU worker")
    res = wj["result"]
    api = lambda u: u.replace("/files/", "/api/assets/", 1) if isinstance(u, str) else u  # noqa: E731
    if kind == "outfit_from_photo":
        result = {"kind": kind, "slot": res["slot"], "tint": res["tint"], "tint_share": res.get("tint_share"),
                  "pattern_png_url": api(res["pattern_png_url"]), "cutout_png_url": api(res["cutout_png_url"]),
                  "prompt_used": res.get("prompt_used"), "garment_score": res.get("garment_score"),
                  "timing_s": res.get("timing_s")}
    else:
        result = {"kind": kind, "glb_url": api(res["glb_url"]), "preview_png_url": api(res["preview_png_url"]),
                  "cutout_png_url": api(res["cutout_png_url"]), "faces": res.get("faces"), "bounds": res.get("bounds"),
                  "size_m": 0.6, "prompt_used": res.get("prompt_used"), "object_score": res.get("object_score"),
                  "gemini_cached": res.get("gemini_cached"), "timing_s": res.get("timing_s")}
    with conn.transaction():
        finish(conn, job, result)
    return result


def modal_segment(uid: str, photo: Path, asset_dir: Path) -> dict:
    """Member segment on Modal: write segment/ tree + copy the largest crop to the user root (like the worker)."""
    import shutil
    with open(photo, "rb") as f:
        mj = modal_call("/segment", {"user_id": uid}, {"file": (photo.name, f.read(), "application/octet-stream")})
    seg_dir = asset_dir / "avatars" / uid / "segment"
    if seg_dir.exists():
        shutil.rmtree(seg_dir)
    write_artifacts(mj.get("files"), seg_dir)
    res = mj["result"]
    if res.get("crops"):
        sel = max(res["crops"], key=lambda c: c.get("area_frac") or 0)
        res["selected_crop_id"] = sel["crop_id"]
        src = seg_dir / sel["crop_id"]
        for f in ("full_body.png", "face_512.png", "traits.json"):
            if (src / f).is_file():
                shutil.copy(src / f, asset_dir / "avatars" / uid / f)
    res["gpu"] = "modal"
    return res


def do_group_segment(conn, job, asset_dir: Path, worker: str) -> dict:
    """Group photo: write every crop under villages/<vid>/group/<job_id>/; no manifest, no head jobs."""
    inp = job["input"]
    vid = str(inp.get("village_id") or "")
    try:
        uuid.UUID(vid)
    except ValueError:
        raise JobError("group photo job without a valid village_id")
    photo = safe_key_path(asset_dir, inp.get("photo_asset_key") or inp.get("asset_key"))
    if use_modal(worker):
        mj = modal_call("/segment/group", {"village_id": vid, "group_job_id": str(job["id"])},
                        {"file": (photo.name, photo.read_bytes(), "application/octet-stream")})
        write_artifacts(mj.get("files"), asset_dir / "villages" / vid / "group" / str(job["id"]))
        res = mj["result"]
    else:
        with open(photo, "rb") as f:
            res = worker_call(worker, "/segment/group", "segment",
                              data={"village_id": vid, "group_job_id": str(job["id"])},
                              files={"file": (photo.name, f, "application/octet-stream")})
    if not res.get("crops"):
        raise JobError("no person found in the photo")
    base = f"villages/{vid}/group/{job['id']}"
    crops = []
    for c in res["crops"]:
        cid = c["crop_id"]
        crops.append({"crop_id": cid, "score": c.get("score"), "area_frac": c.get("area_frac"),
                      "box_xyxy": c.get("box_xyxy"), "face_found": c.get("face_found"),
                      "colors": _clean_colors(c.get("colors")),
                      "full_body_url": asset_url(f"{base}/{cid}/full_body.png"),
                      "face_url": asset_url(f"{base}/{cid}/face_512.png"),
                      "traits_url": asset_url(f"{base}/{cid}/traits.json")})
    missing = [c["crop_id"] for c in crops if not (asset_dir / base / c["crop_id"] / "face_512.png").is_file()]
    if missing:
        raise JobError("group crops missing on disk")
    result = {"group_photo": True, "village_id": vid, "image_size": res.get("image_size"),
              "crop_count": len(crops), "crops": crops, "timing_s": res.get("timing_s")}
    with conn.transaction():
        finish(conn, job, result)
    return result


def do_claimed_crop(conn, job, asset_dir: Path) -> dict:
    """Member claimed a crop from a done group job: copy it into avatars/<uid>/ (no re-segmentation)."""
    import shutil
    inp = job["input"]
    uid = str(job["user_id"])
    gid, cid, vid = str(inp.get("group_job_id")), str(inp.get("crop_id") or ""), str(inp.get("village_id") or "")
    if not CROP_RE.match(cid):
        raise JobError("crop not found in group job")
    try:
        uuid.UUID(gid)
    except ValueError:
        raise JobError("group job not found or not done")
    g = conn.execute("SELECT status,input,result FROM avatar_jobs WHERE id=%s AND stage='segment'", (gid,)).fetchone()
    if not g or g["status"] != "done" or not (g["result"] or {}).get("group_photo"):
        raise JobError("group job not found or not done")
    if vid and str(g["input"].get("village_id")) != vid:
        raise JobError("group job belongs to another village")
    crop = next((c for c in g["result"].get("crops", []) if c["crop_id"] == cid), None)
    src = asset_dir / "villages" / str(g["input"]["village_id"]) / "group" / gid / cid
    if crop is None or not (src / "face_512.png").is_file():
        raise JobError("crop not found in group job")
    dst = asset_dir / "avatars" / uid
    dst.mkdir(parents=True, exist_ok=True)
    for f in ("full_body.png", "face_512.png", "traits.json"):
        if (src / f).is_file():
            shutil.copy(src / f, dst / f)
    sha = hashlib.sha256((dst / "face_512.png").read_bytes()).hexdigest()
    traits = json.loads((dst / "traits.json").read_text()) if (dst / "traits.json").is_file() else {}
    colors = _clean_colors(traits.get("colors") or crop.get("colors"))
    return _member_segment_done(conn, job, colors, sha,
                                {"from_group_job": gid, "crop_id": cid, "selected_crop_id": cid})


def do_head(conn, job, asset_dir: Path, worker: str) -> dict:
    uid = str(job["user_id"])
    face = safe_key_path(asset_dir, job["input"].get("face_asset_key") or f"avatars/{uid}/face_512.png")
    if use_modal(worker):  # MODAL-002: LAM bake + OAC export (Blender/FBX) on Modal
        import shutil
        mj = modal_call("/avatar/head", {"user_id": uid}, {"file": ("face_512.png", face.read_bytes(), "image/png")})
        hdir = asset_dir / "avatars" / uid / "head"
        if hdir.exists():
            shutil.rmtree(hdir)
        write_artifacts(mj.get("files"), hdir)
        res = {**mj["result"], "gpu": "modal"}
    else:
        with open(face, "rb") as f:
            res = worker_call(worker, "/avatar/head", "head", data={"user_id": uid},
                              files={"file": ("face_512.png", f, "image/png")})
    if not res.get("export", {}).get("ok"):
        raise JobError("head export failed")
    pkg_key = f"avatars/{uid}/head/avatar.zip"
    if not (asset_dir / pkg_key).is_file():
        raise JobError("head package missing")
    face_key = f"avatars/{uid}/face_512.png"
    with conn.transaction():
        m = latest_manifest(conn, job["user_id"])
        m["portrait"] = {"kind": "lam_head", "asset_url": asset_url(face_key), "head_package_url": asset_url(pkg_key)}
        m["generation"] = {**m.get("generation", {}), "segment": "ready", "head": "ready", "body": "queued"}
        rev = write_revision(conn, job["user_id"], m)
        enqueue_body(conn, job)
        user_activity(conn, job["user_id"], "avatar_ready",
                      {"job_id": str(job["id"]), "revision": rev, "portrait": "lam_head"})
        result = {"manifest_revision": rev, "head_package_url": asset_url(pkg_key),
                  "preview_url": asset_url(f"avatars/{uid}/head/preview.mp4"),
                  "timing_s": res.get("timing_s"), "peak_vram_gb": res.get("peak_vram_gb")}
        finish(conn, job, result)
    return result


def enqueue_body(conn, job):
    """Chain head -> body (stylized villager head). Idempotent via idem_key."""
    uid = str(job["user_id"])
    sha = job["input"].get("sha256") or "nosha"
    idem = hashlib.sha256(f"{uid}:{sha}:body:gemini+hy3d2mini:v1".encode()).hexdigest()
    conn.execute(
        """INSERT INTO avatar_jobs (user_id,stage,idem_key,input) VALUES (%s,'body',%s,%s)
        ON CONFLICT (idem_key) DO NOTHING""",
        (job["user_id"], idem, Jsonb({"face_asset_key": f"avatars/{uid}/face_512.png", "sha256": sha,
                                       "source_job": str(job["id"]), "user_id": uid})))


def do_body(conn, job, asset_dir: Path, worker: str) -> dict:
    uid = str(job["user_id"])
    face = safe_key_path(asset_dir, job["input"].get("face_asset_key") or f"avatars/{uid}/face_512.png")
    if use_modal(worker):  # MODAL-002: stylize here (cache + Gemini key stay off Modal), mesh on Modal
        sinfo = bridge_stylize_head(asset_dir, uid, face)
        bdir = asset_dir / "avatars" / uid / "body"
        mj = modal_call("/avatar/body", {"user_id": uid},
                        {"stylized": ("stylized_head.png", (bdir / "stylized_head.png").read_bytes(), "image/png")})
        write_artifacts(mj.get("files"), bdir)
        info = mj["result"]
        res = {"head_glb": str(bdir / "head.glb") if (bdir / "head.glb").is_file() else None,
               "faces": info.get("faces"), "stylize": sinfo, "timing_s": info.get("timing_s"), "gpu": "modal"}
        (bdir / "body.json").write_text(json.dumps(
            {"schema_version": 1, "preset_id": "villager_base", "head_glb": res["head_glb"],
             "head_card": str(bdir / "stylized_head_rgba.png"), "stylize": sinfo, "faces": info.get("faces"),
             "gpu": "modal"}, indent=2))
    else:
        with open(face, "rb") as f:
            res = worker_call(worker, "/avatar/body", "body", data={"user_id": uid},
                              files={"file": ("face_512.png", f, "image/png")})
    glb_key = f"avatars/{uid}/body/head.glb"
    card_key = f"avatars/{uid}/body/stylized_head_rgba.png"
    has_glb = bool(res.get("head_glb")) and (asset_dir / glb_key).is_file()
    has_card = (asset_dir / card_key).is_file()
    if not has_glb and not has_card:
        raise JobError("stylized head generation failed")
    with conn.transaction():
        m = latest_manifest(conn, job["user_id"])
        colors = (m.get("body") or {}).get("colors") or dict(DEFAULT_COLORS)
        body = {"kind": "preset", "preset_id": "villager_base", "colors": colors}
        if has_glb:
            body["head_glb_url"] = asset_url(glb_key)
        if has_card:
            body["head_card_url"] = asset_url(card_key)
        m["body"] = body
        m["generation"] = {**m.get("generation", {}), "body": "ready"}
        rev = write_revision(conn, job["user_id"], m)
        user_activity(conn, job["user_id"], "avatar_ready",
                      {"job_id": str(job["id"]), "revision": rev, "body": "stylized_head" if has_glb else "head_card"})
        result = {"manifest_revision": rev, "head_glb_url": body.get("head_glb_url"),
                  "head_card_url": body.get("head_card_url"), "fallback": res.get("fallback"),
                  "gemini_cached": (res.get("stylize") or {}).get("cached"), "timing_s": res.get("timing_s")}
        finish(conn, job, result)
    return result


def do_voice_expr(conn, job, asset_dir: Path, worker: str) -> dict:
    uid = str(job["user_id"])
    inp = job["input"]
    audio = safe_key_path(asset_dir, inp["audio_key"])
    line_id = str(inp.get("line_id") or audio.stem)
    if not re.match(r"^[A-Za-z0-9_-]{1,64}$", line_id):
        raise JobError("bad line id")
    if use_modal(worker):
        mj = modal_call("/voice/expr", {"user_id": uid, "line_id": line_id},
                        {"file": (audio.name, audio.read_bytes(), "application/octet-stream")})
        write_artifacts(mj.get("files"), asset_dir / "avatars" / uid / "voice" / line_id)
        res = mj["result"]
    else:
        with open(audio, "rb") as f:
            res = worker_call(worker, "/voice/expr", "voice_expr", data={"user_id": uid, "line_id": line_id},
                              files={"file": (audio.name, f, "application/octet-stream")})
    key = f"avatars/{uid}/voice/{line_id}/line_expr.json"
    with conn.transaction():
        result = {"expr_url": asset_url(key), "audio_url": asset_url(inp["audio_key"]),
                  "n_frames": res.get("n_frames"), "fps": res.get("fps"), "timing_s": res.get("timing_s")}
        finish(conn, job, result)
    return result


HANDLERS = {"segment": do_segment, "head": do_head, "body": do_body, "voice_expr": do_voice_expr}


def process_one(conn, asset_dir, worker):
    """True = processed a job, False = queue empty, None = worker unreachable (job requeued)."""
    job = claim(conn)
    if not job:
        return False
    t0 = time.time()
    log.info("claimed %s job %s for %s (attempt %s)", job["stage"], job["id"], job["user_id"], job["attempts"])
    try:
        res = HANDLERS[job["stage"]](conn, job, asset_dir, worker)
        log.info("done %s %s in %.1fs: %s", job["stage"], job["id"], time.time() - t0, json.dumps(res)[:400])
    except ConnectionError as e:  # worker down: put it back, don't burn the job
        conn.execute("UPDATE avatar_jobs SET status='queued', attempts=attempts-1, lease_until=NULL WHERE id=%s",
                     (job["id"],))
        log.warning("%s; job %s requeued", e, job["id"])
        return None
    except JobError as e:
        log.warning("job %s -> %s: %s", job["id"], fail(conn, job, str(e), retry=False), e)
    except Exception as e:  # unexpected: retry up to MAX_ATTEMPTS
        log.exception("job %s crashed", job["id"])
        fail(conn, job, f"internal error: {type(e).__name__}", retry=True)
    return True


def enqueue_expr(conn, uid: str, audio_key: str) -> str:
    line_id = Path(audio_key).stem
    idem = hashlib.sha256(f"{uid}:{audio_key}:voice_expr:a2e:v1".encode()).hexdigest()
    with conn.transaction():
        row = conn.execute(
            """INSERT INTO avatar_jobs (user_id,stage,idem_key,input) VALUES (%s,'voice_expr',%s,%s)
            ON CONFLICT (idem_key) DO UPDATE SET idem_key=EXCLUDED.idem_key RETURNING id,status""",
            (uid, idem, Jsonb({"audio_key": audio_key, "line_id": line_id, "user_id": uid}))).fetchone()
    return str(row["id"])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", nargs="?", default="run", choices=["run", "expr-line"])
    ap.add_argument("--once", action="store_true", help="exit when the queue is empty")
    ap.add_argument("--poll", type=float, default=2.0)
    ap.add_argument("--user")
    ap.add_argument("--audio-key")
    a = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    db, asset_dir, worker = settings()
    with psycopg.connect(db, autocommit=True, row_factory=dict_row) as conn:
        if a.cmd == "expr-line":
            uuid.UUID(a.user)
            log.info("queued voice_expr job %s", enqueue_expr(conn, a.user, a.audio_key))
            a.once = True
        log.info("bridge up: assets=%s worker=%s", asset_dir, worker)
        while True:
            worked = process_one(conn, asset_dir, worker)
            if worked is None:  # GPU worker down: back off (or stop in --once mode)
                if a.once:
                    return 3
                time.sleep(10)
            elif not worked:
                if a.once:
                    return 0
                time.sleep(a.poll)


if __name__ == "__main__":
    sys.exit(main())
