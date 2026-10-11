"""Stage 4 — Village GPU worker service (FastAPI, :8100).

Gateway process (runs in the `vcv-sam3` env, never touches CUDA itself). Each model runs in its own
conda env as a long-lived child process (worker_child.py), started lazily on first use. One serial job
queue => one GPU job at a time. Heavy models (segment=SAM 3, head=LAM) are mutually exclusive: starting
one stops the other; expr (Audio2Expression, ~0.5 GB) stays resident once loaded.

Endpoints
  GET  /health
  POST /segment        JSON {user_id, image_url | image_path} or multipart (user_id, file)   -> {job_id}
  POST /segment/group  multipart (village_id, group_job_id, file) -> {job_id}; all crops -> villages/<vid>/group/<gid>/
  POST /item/outfit|object  multipart (owner, item_job_id, file, slot?, prompt?) -> {job_id}; outputs items/<owner>/<id>/
  POST /face/enroll    JSON {user_id} -> face embedding from avatars/<uid>/face_512.png (CPU, sync)
  POST /face/verify    multipart (user_id, file) -> {match, score, threshold, face_found} (CPU, sync)
  POST /segment/select JSON {user_id, crop_id}  copy a crop's full_body/face_512/traits to the user root
  POST /avatar/head    JSON {user_id, face_url | face_path?, motion?, export?}               -> {job_id}
  POST /avatar/body    JSON {user_id, face_url | face_path?} or multipart (user_id, file)  -> {job_id}
                       Gemini-stylized chibi head -> Hunyuan3D head.glb for the villager_base preset body
  POST /avatar/talk_video JSON {user_id, audio_path|audio_url, max_seconds<=15} -> MP4 next to the audio (TALK_VIDEO.md)
  POST /voice/expr     JSON {user_id, line_id, wav_url | wav_path} or multipart (user_id, line_id, file)
  GET  /jobs/{id}      {id, stage, status: queued|running|ready|failed, progress, result, error, ...}
  GET  /files/...      static files under $VILLAGE_DATA_DIR/assets (e.g. /files/avatars/u1/face_512.png)
All POSTs accept ?wait=true to block until the job finishes and return the job object.

Outputs: $VILLAGE_DATA_DIR/assets/avatars/{user_id}/
  segment/ (segment.json, person_i/...)   full_body.png  face_512.png  traits.json   (selected crop)
  head/    (avatar.zip, avatar/{skin.glb,offset.ply,animation.glb,vertex_order.json}, offset.ply, preview.mp4, head.json)
  voice/{line_id}/line_expr.json (+ .meta.json)
  body/    (stylized_head.png, stylized_head_rgba.png, head.glb, head.json, body.json)
"""
from __future__ import annotations

import json
import os
import queue
import re
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.request
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.staticfiles import StaticFiles

WORKER_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("VILLAGE_DATA_DIR", WORKER_DIR.parents[1] / "data")).resolve()
ASSETS = DATA_DIR / "assets"
AVATARS = ASSETS / "avatars"
CONDA_ENVS = Path(os.environ.get("CONDA_ENVS", Path.home() / "miniconda3/envs"))
ENV_FOR = {"segment": "vcv-sam3", "head": "vcv-lam", "expr": "vcv-a2e", "body": "vcv-hy3d"}
HEAVY = {"segment", "head", "body"}
JOB_TIMEOUT = {"talk": 1500, "segment": 300, "head": 900, "expr": 300, "body": 900}  # includes first-time model load
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
MAX_UPLOAD = 25 * 1024 * 1024
BUILD = "cv-talk-video"

AVATARS.mkdir(parents=True, exist_ok=True)
app = FastAPI(title="Village GPU worker")
app.mount("/files", StaticFiles(directory=str(ASSETS)), name="files")


# ----------------------------------------------------------------------------- child processes
class Child:
    def __init__(self, kind: str):
        self.kind = kind
        prefix = CONDA_ENVS / ENV_FOR[kind]
        env = dict(os.environ)
        env["PATH"] = f"{prefix / 'bin'}:{env.get('PATH', '')}"
        env["PYTHONUNBUFFERED"] = "1"
        if kind == "head":  # nvdiffrast JIT-compiles on first use (cached in ~/.cache/torch_extensions)
            tgt = prefix / "targets/x86_64-linux"
            env.update(CUDA_HOME=str(prefix), TORCH_CUDA_ARCH_LIST="12.0",
                       CPATH=f"{tgt / 'include'}:{env.get('CPATH', '')}",
                       LIBRARY_PATH=f"{tgt / 'lib'}:{prefix / 'lib'}:{env.get('LIBRARY_PATH', '')}")
        log_dir = DATA_DIR / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        self.log = open(log_dir / f"gpu_worker_{kind}.log", "a")
        self.proc = subprocess.Popen([str(prefix / "bin/python"), str(WORKER_DIR / "worker_child.py"), kind],
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=self.log,
                                     text=True, bufsize=1, env=env, cwd=str(WORKER_DIR))
        hello = self.proc.stdout.readline()
        if not hello:
            raise RuntimeError(f"{kind} child failed to start; see {log_dir}/gpu_worker_{kind}.log")
        self.loaded = False

    def call(self, req: dict, timeout: float) -> dict:
        self.proc.stdin.write(json.dumps(req) + "\n")
        self.proc.stdin.flush()
        out: list = []
        t = threading.Thread(target=lambda: out.append(self.proc.stdout.readline()), daemon=True)
        t.start()
        t.join(timeout)
        if t.is_alive() or not out or not out[0]:
            self.stop()
            raise RuntimeError(f"{self.kind} child timed out or died (see logs/gpu_worker_{self.kind}.log)")
        self.loaded = True
        resp = json.loads(out[0])
        if not resp.get("ok"):
            raise RuntimeError(resp.get("error", "unknown error") + "\n" + resp.get("trace", "")[-1500:])
        return resp["result"]

    def alive(self) -> bool:
        return self.proc.poll() is None

    def stop(self):
        if self.alive():
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self.log.close()


CHILDREN: dict[str, Child] = {}


def get_child(kind: str) -> Child:
    if kind in HEAVY:  # one heavy model on the GPU at a time
        for other in list(CHILDREN):
            if other in HEAVY and other != kind:
                CHILDREN.pop(other).stop()
    c = CHILDREN.get(kind)
    if c is None or not c.alive():
        c = CHILDREN[kind] = Child(kind)
    return c


# ----------------------------------------------------------------------------- job queue
JOBS: dict[str, dict] = {}
Q: "queue.Queue[str]" = queue.Queue()


def new_job(stage: str, user_id: str, payload: dict) -> dict:
    jid = uuid.uuid4().hex[:12]
    job = {"id": jid, "stage": stage, "user_id": user_id, "status": "queued", "progress": 0.0,
           "result": None, "error": None, "created_at": time.time(), "started_at": None, "finished_at": None,
           "_payload": payload}
    JOBS[jid] = job
    Q.put(jid)
    return job


def public(job: dict) -> dict:
    return {k: v for k, v in job.items() if not k.startswith("_")}


def rel_url(p: str | Path) -> str:
    return "/files/" + Path(p).resolve().relative_to(ASSETS).as_posix()


def run_segment(job: dict) -> dict:
    p = job["_payload"]
    if p.get("group"):  # group photo: every crop under villages/<vid>/group/<job_id>/, no auto-select
        seg_dir = ASSETS / "villages" / p["village_id"] / "group" / p["group_job_id"]
    else:
        seg_dir = AVATARS / job["user_id"] / "segment"
    if seg_dir.exists():
        shutil.rmtree(seg_dir)
    res = get_child("segment").call({"image": p["image"], "out": str(seg_dir)}, JOB_TIMEOUT["segment"])
    for c in res["crops"]:
        d = Path(c["dir"])
        c["full_body_url"] = rel_url(d / "full_body.png")
        c["face_url"] = rel_url(d / "face_512.png")
        c["traits_url"] = rel_url(d / "traits.json")
    if p.get("group"):
        res["selected_crop_id"] = None
        return res
    selected = None
    if res["crops"]:  # default selection: the largest person (selfie / single-person photo case)
        selected = max(res["crops"], key=lambda c: c["area_frac"])["crop_id"]
        select_crop(job["user_id"], selected)
    res["selected_crop_id"] = selected
    return res


def select_crop(user_id: str, crop_id: str) -> dict:
    if not ID_RE.match(crop_id):
        raise HTTPException(400, "bad crop_id")
    udir = AVATARS / user_id
    src = udir / "segment" / crop_id
    if not src.is_dir():
        raise HTTPException(404, f"no crop {crop_id} for {user_id}")
    for f in ("full_body.png", "face_512.png", "traits.json"):
        shutil.copy(src / f, udir / f)
    traits = json.loads((udir / "traits.json").read_text())
    return {"user_id": user_id, "crop_id": crop_id, "colors": traits["colors"],
            "full_body_url": rel_url(udir / "full_body.png"), "face_url": rel_url(udir / "face_512.png"),
            "traits_url": rel_url(udir / "traits.json")}


def run_head(job: dict) -> dict:
    p = job["_payload"]
    hdir = AVATARS / job["user_id"] / "head"
    res = get_child("head").call({"face": p["face"], "out": str(hdir), "motion": p.get("motion"),
                                  "export": p.get("export", True)}, JOB_TIMEOUT["head"])
    res["head_package_url"] = rel_url(res["export"]["zip"]) if res["export"].get("ok") else None
    res["head_package_dir_url"] = rel_url(res["export"]["dir"]) if res["export"].get("ok") else None
    res["offset_ply_url"] = rel_url(hdir / "offset.ply")
    res["preview_url"] = rel_url(hdir / "preview.mp4") if (hdir / "preview.mp4").exists() else None
    res["export"].pop("trace", None)
    return res


def run_expr(job: dict) -> dict:
    p = job["_payload"]
    out = AVATARS / job["user_id"] / "voice" / p["line_id"] / "line_expr.json"
    res = get_child("expr").call({"wav": p["wav"], "out": str(out)}, JOB_TIMEOUT["expr"])
    res["expr_url"] = rel_url(out)
    return res


def run_body(job: dict) -> dict:
    p = job["_payload"]
    udir = AVATARS / job["user_id"]
    bdir = udir / "body"
    traits = udir / "traits.json"
    res = get_child("body").call({"face": p["face"], "out": str(bdir),
                                  "traits": str(traits) if traits.is_file() else None}, JOB_TIMEOUT["body"])
    res["head_glb_url"] = rel_url(res["head_glb"]) if res.get("head_glb") else None
    res["head_card_url"] = rel_url(res["head_card"]) if res.get("head_card") else None
    res["stylized_url"] = rel_url(res["stylized"])
    return res


def run_item(job: dict) -> dict:
    """CV-006: outfit_from_photo (SAM 3 only) / object_from_photo (SAM 3 cutout -> Gemini -> Hunyuan3D)."""
    p = job["_payload"]
    out = ASSETS / "items" / p["owner"] / p["item_job_id"]
    out.mkdir(parents=True, exist_ok=True)
    if p["kind"] == "outfit_from_photo":
        r = get_child("segment").call({"op": "outfit", "image": p["image"], "out": str(out), "slot": p.get("slot"),
                                       "prompt": p.get("prompt")}, JOB_TIMEOUT["segment"])
        return {**r, "pattern_png_url": rel_url(r["pattern_png"]), "cutout_png_url": rel_url(r["cutout_png"])}
    t0 = time.time()
    c = get_child("segment").call({"op": "object_cutout", "image": p["image"], "out": str(out),
                                   "prompt": p.get("prompt")}, JOB_TIMEOUT["segment"])
    o = get_child("body").call({"op": "object", "image": c["cutout_white_png"], "out": str(out)}, JOB_TIMEOUT["body"])
    return {"kind": "object_from_photo", "prompt_used": c["prompt_used"], "object_score": c["object_score"],
            "glb_url": rel_url(o["glb"]), "preview_png_url": rel_url(o["stylized"]),
            "cutout_png_url": rel_url(c["cutout_png"]), "faces": o["faces"], "bounds": o["bounds"],
            "gemini_cached": o["stylize"]["cached"], "peak_vram_gb": o["peak_vram_gb"],
            "timing_s": {"cutout": c["timing_s"]["cutout"], **o["timing_s"], "job_total": round(time.time() - t0, 2)}}


def _probe_seconds(path: str) -> float:
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    try:
        return float(p.stdout.strip())
    except ValueError:
        return 0.0


def run_talk(job: dict) -> dict:
    """Talking-head MP4: audio -> Audio2Expression -> LAM Gaussian head (offline render) -> H.264/AAC next to the audio."""
    p = job["_payload"]
    uid, audio, out = job["user_id"], p["audio"], Path(p["out"])
    face = AVATARS / uid / "face_512.png"
    if not face.is_file():
        raise RuntimeError("no LAM face for this user (run /segment + /avatar/head first)")
    if (not p.get("force") and out.is_file() and out.stat().st_mtime >= Path(audio).stat().st_mtime
            and out.stat().st_size > 0):
        secs = _probe_seconds(str(out))
        return {"video_path": str(out), "video_key": _key(out), "video_url": rel_url(out), "seconds": round(secs, 3),
                "fps": 25, "size": [512, 512], "bytes": out.stat().st_size, "cached": True, "timing_s": {"total": 0.0}}
    t0 = time.time()
    tmp = Path(tempfile.mkdtemp(prefix="talk_"))
    wav = tmp / "a16k.wav"
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", audio, "-t", str(p["max_seconds"]),
                        "-ac", "1", "-ar", "16000", str(wav)], capture_output=True, text=True)
    if r.returncode != 0 or not wav.is_file():
        raise RuntimeError("could not decode audio")
    ej = tmp / "expr.json"
    get_child("expr").call({"wav": str(wav), "out": str(ej)}, JOB_TIMEOUT["expr"])
    t_expr = round(time.time() - t0, 2)
    if "expr" in CHILDREN and os.environ.get("TALK_KEEP_EXPR") != "1":  # RAM is tight: one model process at a time
        CHILDREN.pop("expr").stop()
    res = get_child("head").call({"op": "talk", "face": str(face), "expr_json": str(ej), "audio": str(audio),
                                  "out": str(out), "max_seconds": p["max_seconds"]}, JOB_TIMEOUT["talk"])
    shutil.rmtree(tmp, ignore_errors=True)
    res["timing_s"] = {"expr": t_expr, **res.get("timing_s", {}), "job_total": round(time.time() - t0, 2)}
    res.update(video_key=_key(out), video_url=rel_url(out), cached=False)
    return res


def _key(path: Path) -> str:
    return Path(path).resolve().relative_to(ASSETS).as_posix()


RUNNERS = {"talk": run_talk, "item": run_item, "segment": run_segment, "head": run_head, "expr": run_expr, "body": run_body}


def worker_loop():
    while True:
        jid = Q.get()
        job = JOBS[jid]
        job["status"], job["started_at"], job["progress"] = "running", time.time(), 0.1
        try:
            job["result"] = RUNNERS[job["stage"]](job)
            job["status"], job["progress"] = "ready", 1.0
        except Exception as e:
            job["status"], job["error"] = "failed", f"{type(e).__name__}: {e}"[:4000]
        finally:
            job["finished_at"] = time.time()
            for f in job["_payload"].get("_cleanup", []):
                try:
                    os.remove(f)
                except OSError:
                    pass


threading.Thread(target=worker_loop, daemon=True).start()


# ----------------------------------------------------------------------------- input helpers
def check_id(v: Optional[str], name: str) -> str:
    if not v or not ID_RE.match(v):
        raise HTTPException(400, f"{name} must match {ID_RE.pattern}")
    return v


def resolve_input(url: Optional[str], path: Optional[str], suffix: str, cleanup: list) -> str:
    """http(s) URL -> downloaded temp file; local path must live under DATA_DIR."""
    if url:
        if url.startswith("/files/"):
            path = str(ASSETS / url[len("/files/"):])
        elif url.startswith(("http://", "https://")):
            fd, tmp = tempfile.mkstemp(suffix=suffix)
            os.close(fd)
            req = urllib.request.Request(url, headers={"User-Agent": "village-gpu-worker"})
            with urllib.request.urlopen(req, timeout=30) as r, open(tmp, "wb") as f:
                data = r.read(MAX_UPLOAD + 1)
                if len(data) > MAX_UPLOAD:
                    raise HTTPException(413, "input too large")
                f.write(data)
            cleanup.append(tmp)
            return tmp
        else:
            raise HTTPException(400, "url must be http(s) or /files/...")
    if path:
        rp = Path(path).resolve()
        if DATA_DIR not in rp.parents or not rp.is_file():
            raise HTTPException(400, f"path must be an existing file under {DATA_DIR}")
        return str(rp)
    raise HTTPException(400, "no input given")


async def save_upload(f: UploadFile, suffix: str, cleanup: list) -> str:
    data = await f.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "upload too large")
    fd, tmp = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as out:
        out.write(data)
    cleanup.append(tmp)
    return tmp


def to_wav16k(src: str, cleanup: list) -> str:
    fd, dst = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    cleanup.append(dst)
    p = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-ac", "1", "-ar", "16000", dst],
                       capture_output=True, text=True)
    if p.returncode != 0:
        raise HTTPException(400, f"could not decode audio: {p.stderr[-300:]}")
    return dst


async def body_or_form(request: Request) -> tuple[dict, Optional[UploadFile]]:
    ct = request.headers.get("content-type", "")
    if ct.startswith("multipart/form-data"):
        form = await request.form()
        upload = form.get("file")
        return {k: v for k, v in form.items() if k != "file"}, upload
    try:
        return await request.json(), None
    except Exception:
        raise HTTPException(400, "send JSON or multipart/form-data")


async def maybe_wait(job: dict, wait: bool) -> dict:
    if wait:
        import asyncio
        while job["status"] in ("queued", "running"):
            await asyncio.sleep(0.2)
        return public(job)
    return {"job_id": job["id"], "status": job["status"]}


# ----------------------------------------------------------------------------- routes
@app.get("/health")
def health():
    gpu = None
    try:
        q = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.used,memory.total",
                            "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=5)
        name, used, total = [s.strip() for s in q.stdout.strip().split(",")]
        gpu = {"name": name, "mem_used_mb": int(used), "mem_total_mb": int(total)}
    except Exception:
        pass
    return {"ok": True, "build": BUILD, "gpu": gpu, "data_dir": str(DATA_DIR),
            "loaded": {k: c.alive() for k, c in CHILDREN.items()},
            "envs": {k: (CONDA_ENVS / v / "bin/python").exists() for k, v in ENV_FOR.items()},
            "queue_depth": Q.qsize(),
            "running": [j["id"] for j in JOBS.values() if j["status"] == "running"]}


@app.post("/segment")
async def segment(request: Request, wait: bool = False):
    body, upload = await body_or_form(request)
    uid = check_id(body.get("user_id"), "user_id")
    cleanup: list = []
    if upload is not None:
        image = await save_upload(upload, Path(upload.filename or "x.jpg").suffix or ".jpg", cleanup)
    else:
        image = resolve_input(body.get("image_url"), body.get("image_path"), ".jpg", cleanup)
    job = new_job("segment", uid, {"image": image, "_cleanup": cleanup})
    return await maybe_wait(job, wait)


@app.post("/segment/group")
async def segment_group(request: Request, wait: bool = False):
    """Group photo: multipart (village_id, group_job_id, file) or JSON {village_id, group_job_id, image_url|image_path}.
    Writes every person crop to assets/villages/<village_id>/group/<group_job_id>/<crop_id>/."""
    body, upload = await body_or_form(request)
    vid = check_id(body.get("village_id"), "village_id")
    gid = check_id(body.get("group_job_id"), "group_job_id")
    cleanup: list = []
    if upload is not None:
        image = await save_upload(upload, Path(upload.filename or "x.jpg").suffix or ".jpg", cleanup)
    else:
        image = resolve_input(body.get("image_url"), body.get("image_path"), ".jpg", cleanup)
    job = new_job("segment", f"group:{vid}", {"image": image, "group": True, "village_id": vid,
                                               "group_job_id": gid, "_cleanup": cleanup})
    return await maybe_wait(job, wait)


@app.post("/item/{kind}")
async def item(kind: str, request: Request, wait: bool = False):
    """multipart (owner, item_job_id, file, slot?, prompt?) or JSON {..., image_url|image_path}.
    kind: outfit (slot torso|head) | object. Outputs under assets/items/<owner>/<item_job_id>/."""
    kinds = {"outfit": "outfit_from_photo", "object": "object_from_photo"}
    if kind not in kinds:
        raise HTTPException(404, "kind must be outfit|object")
    body, upload = await body_or_form(request)
    owner = check_id(body.get("owner"), "owner")
    jid = check_id(body.get("item_job_id"), "item_job_id")
    slot = body.get("slot") or "torso"
    if kind == "outfit" and slot not in ("torso", "head"):
        raise HTTPException(400, "slot must be torso|head")
    prompt = (body.get("prompt") or "").strip()[:40] or None
    if prompt and not re.match(r"^[A-Za-z][A-Za-z -]{0,39}$", prompt):
        raise HTTPException(400, "prompt must be a short noun phrase")
    cleanup: list = []
    if upload is not None:
        image = await save_upload(upload, Path(upload.filename or "x.jpg").suffix or ".jpg", cleanup)
    else:
        image = resolve_input(body.get("image_url"), body.get("image_path"), ".jpg", cleanup)
    job = new_job("item", owner, {"kind": kinds[kind], "image": image, "owner": owner, "item_job_id": jid,
                                  "slot": slot, "prompt": prompt, "_cleanup": cleanup})
    return await maybe_wait(job, wait)


_FACE = None
_FACE_LOCK = threading.Lock()


def face_id():
    """CPU-only (OpenCV YuNet + SFace) in the gateway process: no GPU child, never co-resident with Hunyuan."""
    global _FACE
    if _FACE is None:
        from face import FaceID
        _FACE = FaceID()
    return _FACE


@app.post("/face/enroll")
async def face_enroll(request: Request):
    """JSON {user_id}: embedding from assets/avatars/<user_id>/face_512.png -> face_embedding.npy (+ .json)."""
    body = await request.json()
    uid = check_id(body.get("user_id"), "user_id")
    try:
        with _FACE_LOCK:
            return face_id().enroll(AVATARS / uid)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.post("/face/verify")
async def face_verify(user_id: str = Form(...), file: UploadFile = File(...), threshold: Optional[float] = Form(None)):
    """multipart (user_id, file[, threshold]) -> {match, score, threshold, face_found, ...}. Synchronous, ~tens of ms."""
    uid = check_id(user_id, "user_id")
    cleanup: list = []
    selfie = await save_upload(file, Path(file.filename or "x.jpg").suffix or ".jpg", cleanup)
    try:
        with _FACE_LOCK:
            kw = {"threshold": float(threshold)} if threshold is not None else {}
            return face_id().verify(AVATARS / uid, selfie, **kw)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))
    finally:
        for f in cleanup:
            try:
                os.remove(f)
            except OSError:
                pass


@app.post("/segment/select")
async def segment_select(request: Request):
    body = await request.json()
    return select_crop(check_id(body.get("user_id"), "user_id"), body.get("crop_id", ""))


@app.post("/avatar/head")
async def avatar_head(request: Request, wait: bool = False):
    body, upload = await body_or_form(request)
    uid = check_id(body.get("user_id"), "user_id")
    cleanup: list = []
    if upload is not None:
        face = await save_upload(upload, ".png", cleanup)
    elif body.get("face_url") or body.get("face_path"):
        face = resolve_input(body.get("face_url"), body.get("face_path"), ".png", cleanup)
    else:
        face = str(AVATARS / uid / "face_512.png")
        if not Path(face).is_file():
            raise HTTPException(400, f"no face given and {face} missing (run /segment first)")
    export = body.get("export", True)
    if isinstance(export, str):
        export = export.lower() not in ("0", "false", "no")
    job = new_job("head", uid, {"face": face, "motion": body.get("motion"), "export": bool(export),
                                "_cleanup": cleanup})
    return await maybe_wait(job, wait)


@app.post("/avatar/body")
async def avatar_body(request: Request, wait: bool = False):
    body, upload = await body_or_form(request)
    uid = check_id(body.get("user_id"), "user_id")
    cleanup: list = []
    if upload is not None:
        face = await save_upload(upload, ".png", cleanup)
    elif body.get("face_url") or body.get("face_path"):
        face = resolve_input(body.get("face_url"), body.get("face_path"), ".png", cleanup)
    else:
        face = str(AVATARS / uid / "face_512.png")
        if not Path(face).is_file():
            raise HTTPException(400, f"no face given and {face} missing (run /segment first)")
    job = new_job("body", uid, {"face": face, "_cleanup": cleanup})
    return await maybe_wait(job, wait)


def _resolve_talk_audio(body: dict) -> tuple[str, Path]:
    """-> (audio path on disk, output mp4 path). Audio must live under the data dir (or be fetched from http)."""
    url, path = body.get("audio_url"), body.get("audio_path")
    src = None
    if url:
        for pre in ("/api/assets/", "/files/"):
            if url.startswith(pre):
                src = ASSETS / url[len(pre):]
        if src is None and url.startswith(("http://", "https://")):
            cleanup: list = []
            tmp = resolve_input(url, None, Path(url.split("?")[0]).suffix or ".mp3", cleanup)
            dst = AVATARS / check_id(body.get("user_id"), "user_id") / "talk"
            dst.mkdir(parents=True, exist_ok=True)
            src = dst / (uuid.uuid4().hex[:12] + Path(tmp).suffix)
            shutil.move(tmp, src)
    elif path:
        p = str(path)
        m = re.match(r"^([A-Za-z]):[\/](.*)$", p)  # Windows path from the API host -> WSL mount
        if m:
            p = f"/mnt/{m.group(1).lower()}/" + m.group(2).replace("\\", "/")
        src = Path(p) if p.startswith("/") else ASSETS / p
    if src is None:
        raise HTTPException(400, "give audio_path (key under data/assets or absolute under the data dir) or audio_url")
    src = src.resolve()
    if DATA_DIR not in src.parents or not src.is_file():
        raise HTTPException(400, "audio not found")
    return str(src), src.with_suffix(".mp4")


@app.post("/avatar/talk_video")
async def avatar_talk_video(request: Request, wait: bool = False):
    """JSON {user_id, audio_path|audio_url, max_seconds?<=15} -> MP4 (H.264+AAC, 512x512, 25 fps) of the user's LAM
    Gaussian head speaking the audio, saved next to the audio as <same stem>.mp4. Contract: workers/gpu/TALK_VIDEO.md"""
    body = await request.json()
    uid = check_id(body.get("user_id"), "user_id")
    audio, out = _resolve_talk_audio(body)
    try:
        max_s = float(body.get("max_seconds") or 15)
    except (TypeError, ValueError):
        raise HTTPException(400, "max_seconds must be a number")
    max_s = max(1.0, min(15.0, max_s))
    job = new_job("talk", uid, {"audio": audio, "out": str(out), "max_seconds": max_s, "force": bool(body.get("force"))})
    return await maybe_wait(job, wait)


@app.post("/voice/expr")
async def voice_expr(request: Request, wait: bool = False):
    body, upload = await body_or_form(request)
    uid = check_id(body.get("user_id"), "user_id")
    line_id = check_id(body.get("line_id"), "line_id")
    cleanup: list = []
    if upload is not None:
        src = await save_upload(upload, Path(upload.filename or "x.wav").suffix or ".wav", cleanup)
    else:
        src = resolve_input(body.get("wav_url"), body.get("wav_path"), ".wav", cleanup)
    wav = to_wav16k(src, cleanup)
    job = new_job("expr", uid, {"wav": wav, "line_id": line_id, "_cleanup": cleanup})
    return await maybe_wait(job, wait)


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "unknown job")
    return public(job)


@app.on_event("shutdown")
def _shutdown():
    for c in CHILDREN.values():
        c.stop()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.environ.get("HOST", "0.0.0.0"), port=int(os.environ.get("PORT", "8100")))
