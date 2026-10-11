# Village GPU worker (CV-001)

SAM 3 segmentation, LAM-20K talking head, and LAM Audio2Expression. Runs locally on an RTX 5090
(Blackwell, sm_120) inside WSL2 Ubuntu-24.04. Everything here was run and measured on 2026-10-10.

| Stage | Script | Env | Status |
|---|---|---|---|
| 1. SAM 3 segmentation | `segment.py` | `vcv-sam3` (py3.12, torch 2.8.0+cu128) | **works** |
| 2. LAM head + OpenAvatarChat export | `head.py` | `vcv-lam` (py3.10, torch 2.7.1+cu128, conda CUDA 12.8 toolkit) | **works**, including the export zip |
| 3. Audio2Expression | `expr.py` | `vcv-a2e` (py3.10, torch 2.7.1+cu128) | **works** |
| 4. Worker service :8100 | `server.py` + `worker_child.py` | gateway in `vcv-sam3`, one child per env | **works** (smoke test passes) |

## Layout (nothing heavy is in git)
- `~/village-cv/repos/{sam3,LAM,LAM_Audio2Expression,ext/*}`: upstream code, LAM weights, and assets (LAM uses repo-relative paths)
- `~/village-cv/hf_cache`: HF cache (SAM 3 checkpoint)
- `~/village-cv/software/blender-4.0.2-linux-x64`: portable Blender for the export step
- `~/miniconda3/envs/vcv-{sam3,lam,a2e}`: conda envs (3 GB, 15 GB, 7 GB)
- Outputs: `$VILLAGE_DATA_DIR/assets/avatars/<id>/`. The default is `/mnt/c/Users/mourn/Downloads/hacklanta/data`, set in `scripts/env.sh`.
- Model logs from the server: `$VILLAGE_DATA_DIR/logs/gpu_worker_<kind>.log`

Upstream commits: sam3 `0570b3a`, LAM `3395736`, LAM_Audio2Expression `02a703c`.

## Setup (WSL, no sudo needed)
Run these from Git Bash on Windows, or call the `.sh` files directly inside WSL:
```bash
S=/mnt/c/Users/mourn/Downloads/hl-cv/workers/gpu/scripts
wsl -d Ubuntu-24.04 bash $S/setup_sam3.sh      # env + sam3 (SAM 3 ckpt auto-downloads on first run; needs HF_TOKEN)
wsl -d Ubuntu-24.04 bash $S/clone_lam.sh       # LAM + LAM_Audio2Expression repos
wsl -d Ubuntu-24.04 bash $S/setup_lam.sh       # conda cuda-toolkit 12.8, torch cu128, pytorch3d / diff-gaussian-rasterization / simple-knn / nvdiffrast for sm_120 (~5 min)
wsl -d Ubuntu-24.04 bash $S/download_lam.sh    # LAM-assets, LAM-20K weights, sample_oac export template
wsl -d Ubuntu-24.04 bash $S/setup_a2e.sh       # env + LAM_audio2exp weights
wsl -d Ubuntu-24.04 bash $S/setup_export.sh    # portable Blender 4.0.2 + FBX SDK wheel (cp310) into vcv-lam
```
(In Git Bash, prefix with `MSYS_NO_PATHCONV=1` and use `wsl.exe`.) `HF_TOKEN` is read from the repo-root `.env`
at runtime by `scripts/env.sh` and is never printed.

Gotchas these scripts already handle:
- No system nvcc. `cuda-toolkit` 12.8.1 comes from the `nvidia/label/cuda-12.8.1` conda channel. Extensions are built with
  `TORCH_CUDA_ARCH_LIST=12.0`, `CUDA_HOME=$CONDA_PREFIX`, and `CPATH=$CONDA_PREFIX/targets/x86_64-linux/include`.
- nvdiffrast (ShenhanQian backface-culling fork) JIT-compiles on first use. It needs the same `CPATH`/`LIBRARY_PATH` at
  runtime (`run_head.sh` and `server.py` set them), and the result is cached in `~/.cache/torch_extensions`.
- The conda nvcc activate hook breaks under `set -u`, so the scripts use `set -eo pipefail`.
- `chumpy` must be installed with `--no-build-isolation`. `sam3` needs `setuptools<81` for `pkg_resources`.
- torch ≥2.6 defaults to `torch.load(weights_only=True)`, which breaks LAM's TorchScript VGGHead checkpoint, so
  `head.py` sets `TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=1`. These are the official LAM HF assets.
- LAM's `FlameTrackingSingleImage` parses `sys.argv`, and parts of LAM change cwd. `head.py` passes explicit args,
  re-`chdir`s, and calls Blender with absolute script paths. Upstream silently produced no `skin.glb` here, because Blender
  exits 0 even when its script is missing; `head.py` now checks that every export file exists.
- xformers is not installed. DINOv2 falls back to plain attention, which works fine at this size.

## Run the worker
```bash
# start (foreground; Ctrl-C stops it and its model children)
wsl -d Ubuntu-24.04 bash /mnt/c/Users/mourn/Downloads/hl-cv/workers/gpu/scripts/run_server.sh
# from another shell, end-to-end test (segment -> head -> expr -> segment again -> bad input -> fetch zip)
wsl -d Ubuntu-24.04 bash /mnt/c/Users/mourn/Downloads/hl-cv/workers/gpu/scripts/smoke_test.sh \
    /mnt/c/Users/mourn/Downloads/hacklanta/data/inputs/sample_cc0/palm_beach_man.jpg smoke_user
# stop
wsl -d Ubuntu-24.04 bash /mnt/c/Users/mourn/Downloads/hl-cv/workers/gpu/scripts/stop_server.sh
```
It listens on `0.0.0.0:8100`, and Windows reaches it at `http://localhost:8100` through WSL2 localhost forwarding (verified).

### API
| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/health` | none | `{ok, build, gpu:{name,mem_used_mb,mem_total_mb}, loaded, envs, queue_depth, running}` |
| POST | `/segment` | JSON `{user_id, image_url \| image_path}` or multipart `user_id`, `file` | `{job_id, status}` |
| POST | `/segment/select` | `{user_id, crop_id}` | copies that crop's `full_body.png`, `face_512.png`, `traits.json` to the user root, returns colors and URLs |
| POST | `/avatar/head` | `{user_id, face_url? \| face_path?, motion?, export?=true}` (defaults to the user's `face_512.png`) | `{job_id, status}` |
| POST | `/voice/expr` | JSON `{user_id, line_id, wav_url \| wav_path}` or multipart `user_id`, `line_id`, `file` (any format; ffmpeg converts it to 16 kHz mono) | `{job_id, status}` |
| GET | `/jobs/{id}` | none | `{id, stage, user_id, status: queued\|running\|ready\|failed, progress, result, error, created_at, started_at, finished_at}` |
| GET | `/files/<path>` | none | static files under `data/assets/` |

Every POST also accepts `?wait=true`, which blocks and returns the finished job object.
`image_url`/`wav_url` may be `http(s)://…` or `/files/…`. `*_path` must be a file under `VILLAGE_DATA_DIR`. IDs must match `[A-Za-z0-9_-]{1,64}`.

Results:
- `segment`: `crops[] {crop_id, score, area_frac, colors{hair,shirt,pants,shoes,skin}, face_found, full_body_url, face_url, traits_url}`
  plus `selected_crop_id`. By default the largest person is auto-selected into the user root, and you can change it with `/segment/select`.
- `head`: `head_package_url` (`/files/avatars/<uid>/head/avatar.zip`), `head_package_dir_url`, `offset_ply_url`,
  `preview_url` (an mp4 driven by LAM's sample FLAME motion), `timing_s`, `peak_vram_gb`, `export{ok,error?}`.
- `expr`: `expr_url` (`/files/avatars/<uid>/voice/<line_id>/line_expr.json`), `n_frames`, `fps` (30), `audio_s`.

Scheduling: one serial queue handles one GPU job at a time. Each model runs as a lazy child process in its own env.
SAM 3 and LAM are mutually exclusive, so starting one terminates the other. A2E stays resident (0.55 GB).

### Output formats
- `traits.json`: `{schema_version, colors{hair,shirt,pants,shoes,skin: "#rrggbb"}, parts{face|hair|shirt|pants|shoes: {color,score,area_frac}|null}, person{score,area_frac,box_xyxy}, face_crop{source,native_px,box_xyxy}}`.
  A part that isn't found falls back to a neutral default color. `skin` is the median color of the face mask.
- `head/avatar.zip` → `avatar/{skin.glb, offset.ply, animation.glb, vertex_order.json}`. This is the OpenAvatarChat /
  [LAM_WebRender](https://github.com/aigc3d/LAM_WebRender) package layout, the same one `app_lam.py --blender_path` produces.
- `line_expr.json` is A2E's native format: `{names[52 ARKit], metadata{fps,frame_count,blendshape_names}, frames[{weights[52], time, rotation}]}`.
  The frontend should step through `frames` using `audio.currentTime`.

## Measured performance (RTX 5090, WSL2, outputs written to /mnt/c)
| Stage | Cold (incl. model load) | Warm | Peak VRAM (torch alloc) |
|---|---|---|---|
| SAM 3 load | 13–42 s (first run includes HF download) | none | none |
| SAM 3: 1 person + 5 part prompts + writes | none | **1.4–2.0 s** (the `person` pass alone is 0.23–0.33 s) | **5.5 GB** |
| SAM 3: group photo, 5 people kept of 9 candidates | none | 5.4 s | 6.6 GB |
| LAM load (model, FLAME tracker, TF face detector) | 10–22 s | none | none |
| LAM head job (tracking + infer + 150 rendered frames + mp4 + Blender export) | 57 s (first job; nvdiffrast JIT and warmups) | **20–21 s** | **4.7 GB** |
| ↳ FLAME tracking (VHAP fit) | 33 s | 9.4–13.5 s | |
| ↳ LAM inference + render of 150 frames | 16 s | 1.3 s | |
| ↳ OAC export (FBX SDK + 2× Blender) | | 2.7–5.2 s | |
| A2E load | 1.3–1.5 s | none | none |
| A2E: 8.0 s of speech → 240 frames | 11 s (first call; wav2vec warmup) | **0.06 s** (1.2 s through the server, including ffmpeg) | **0.55 GB** |

With the server holding SAM 3 + A2E, or LAM + A2E, `nvidia-smi` shows about 10.6–11.2 GB used, against a 3.9 GB desktop baseline.

## Checkpoints (sha256)
- `facebook/sam3` `sam3.pt` (snapshot `3c879f3`): `9999e2341ceef5e136daa386eecb55cb414446a00ac2b55eb2dfd2f7c3cf8c9e`
- `3DAIGC/LAM-20K` `model.safetensors` (step_045500): `f527e6e78fd9743aad95cb15b221b864d8b6d356c1d174c0ffad5d74b9a95925`
- `3DAIGC/LAM_audio2exp` `lam_audio2exp_streaming.tar`: `38084d471966381f2e52d9f59e5654c9b8cde6fa36d4c6f18fc02cbaf593d157`
- DINOv2 `dinov2_vitl14_reg4_pretrain.pth` (auto-downloaded by LAM): `36e4deffbaef061a2576705b0c36f93621e2ae20bf6274694821b0b492551b51`
- Also downloaded: `3DAIGC/LAM-assets` (FLAME, tracking models, sample motions), `facebook/wav2vec2-base-960h` (A2E encoder), and
  `sample_oac.tar` (FBX template + animation.glb) and the FBX SDK wheel from LAM's OSS bucket.

## Known limits / not done
- The head preview is driven by LAM's bundled sample motion (`Look_In_My_Eyes`), not by our A2E output. Real lip-sync
  happens in the browser renderer, which applies `line_expr.json` to `avatar.zip`.
- The LAM_WebRender / OpenAvatarChat JS renderer was not integrated or tested in a browser here; that belongs to the web lane.
- `spleeter` vocal extraction is off (`ex_vol=False`). This is fine for clean TTS audio but noisy for music.
- The job store is in memory, so a server restart loses job history. Output files persist.
- SAM 3 part prompts sometimes miss shoes or pants on small or occluded people. Those parts get default colors, and `parts.<x>` is null.

## Job bridge (CV-002): API `avatar_jobs` → worker → `avatar_assets`
`bridge.py` runs on **Windows**, where the Postgres container is published on 127.0.0.1:5433. It reads `DATABASE_URL` from the repo-root `.env`
and talks to the worker at `GPU_WORKER_BASE` (default `http://localhost:8100`). Inputs go to the worker as multipart uploads,
and outputs land in `data/assets/avatars/<uid>/…`, which the API serves as `/api/assets/avatars/<uid>/…` (gated to village peers).
```powershell
# 1) start the worker (WSL), 2) run the bridge loop (Windows, repo root or worktree)
python -m uv run --with "psycopg[binary]" --with httpx --with python-dotenv workers/gpu/bridge.py           # poll forever
python -m uv run --with "psycopg[binary]" --with httpx --with python-dotenv workers/gpu/bridge.py --once    # drain the queue, then exit (exits 3 if the worker is down)
python -m uv run ... workers/gpu/bridge.py expr-line --user <uuid> --audio-key voice/<uuid>/<line>.mp3     # A2E for one voice line
```
- **segment** (created by `POST /api/avatars/{uid}/photo`): calls the worker's `/segment` and writes a manifest revision:
  `body.colors` from traits (hair, shirt, pants, shoes, skin), `portrait {kind:"photo", asset_url:/api/assets/avatars/<uid>/face_512.png}`,
  and `generation {segment: ready, head: queued}`. It then enqueues a **head** job (`idem_key = sha256(uid:photo_sha:head:lam20k:v1)`).
- **head**: calls the worker's `/avatar/head` and writes a revision with `portrait {kind:"lam_head", asset_url, head_package_url:/api/assets/avatars/<uid>/head/avatar.zip}`
  and `generation.head = ready`. It also inserts an `activity_events` `avatar_ready` row for each village the user belongs to.
- **voice_expr**: `{audio_key, line_id}` → `result.expr_url = /api/assets/avatars/<uid>/voice/<line_id>/line_expr.json`.
- Jobs are claimed with `UPDATE … WHERE id=(SELECT … FOR UPDATE SKIP LOCKED)` and a 5-minute lease, with at most 3 attempts. An expired lease is reclaimed.
  The manifest write, follow-up job, activity row and `status='done'` all happen in a single transaction, so a retry never double-writes.
  If the worker is unreachable, the job is requeued without counting an attempt. Bad input (for example, no person found) fails the job with a short message
  and writes a revision with `generation.<stage>="failed"`. Other errors are retried.

Measured on 2026-10-10 (Dev, CC0 doorway photo resized to 2048 px): upload → segment done in **18.6 s**
(including the 13.7 s SAM 3 cold load) → head done in **40.4 s** (including the 10.2 s LAM load). That's **59.7 s end to end** from a cold worker,
and roughly 1 s + 21 s warm. voice_expr for a 6 s ElevenLabs line took 7.1 s cold (1.0 s of inference).

## Stylized villager head (CV-003): `body` stage
Pipeline: `face_512.png` → **Gemini** (`gemini-2.5-flash-image` through the Vertex express key, with one fixed chibi low-poly prompt; `stylize.py`)
→ `stylized_head.png` → background removal (rembg) → **Hunyuan3D-2mini-Turbo** shape (FlashVDM, 5 steps, octree 256)
→ cleanup + quadric decimation to **5,000 tris** → **Hunyuan3D-Paint-v2-0-Turbo** texture (CPU-offloaded; texture capped at 1024 px)
→ normalize into **villager_base `Head`-bone space** (`headmesh.py`) → `avatars/<uid>/body/head.glb` (~0.7 MB).
- Space: the joint is at model (0, 1.13, 0). The head occupies y −0.03…0.73, centered on x, z≈0.02, face toward +Z. In the web app, hide the preset nodes
  `head`, `hair_cap`, `eye`, `eye.001` and `nose`, then `HeadBone.add(headGltf.scene)`. See `render/head_preview.html` for the 15-line reference.
- Fallback: if the 3D generator fails, `stylized_head_rgba.png` (background removed) serves as a billboard card (`head_card_url`).
- Gemini calls are cached by face sha256 (`body/stylize.json`), so retries or re-runs don't spend calls. Every call is logged to `data/logs/gemini_image_calls.jsonl`.
- **TRELLIS.2 is blocked:** its image conditioner `facebook/dinov3-vitl16-pretrain-lvd1689m` is gated behind manual approval, and our HF token gets 403
  (as does `briaai/RMBG-2.0`). The owner could request access on HF to try it later. Hunyuan3D-2 is ungated (Tencent Hunyuan 3D 2.0 Community License: not
  licensed in the EU, UK or South Korea; attribution required).
- Env: `scripts/setup_hy3d.sh` → `vcv-hy3d` (torch 2.7.1+cu128). custom_rasterizer and mesh_processor are built for sm_120 with vcv-lam's conda
  CUDA 12.8 toolkit. Pins: `transformers==4.51.3`, `diffusers==0.33.1`, `huggingface_hub<1.0` (newer transformers renamed the Dinov2 attention
  keys and the checkpoint fails to load). hy3dgen's pymeshlab post-processors fail ("Unknown format for load: ply"), so they're replaced with trimesh and fast_simplification.

Measured (RTX 5090): model load ~89–106 s (first time, from the WSL HF cache). Warm per head: rembg 0.5–1.7 s, shape 4–9 s,
decimate 1–2.5 s, paint 8–23 s, **total 14–33 s**. Peak VRAM **4.6 GB** (shape) / **4.4 GB** (paint, offloaded). Gemini 7.5–8.3 s per call.
Full API chain with every stage cold (models evict each other, so one heavy model is on the GPU at a time): segment 21 s → LAM head 58 s → body 123 s.

## Supervised services: `ops/run_gpu.sh`
`ops/run_gpu.sh start|stop|restart|status|logs`, run from Git Bash. It starts the WSL worker and the Windows bridge, each under a restart loop
(5 s backoff), writes PIDs to `data/run/` and logs to `data/logs/{gpu_worker,bridge}.log`. `start` is idempotent: it won't double-start, and it leaves
a worker that's already answering on :8100 alone. `stop` stops both supervisors and the WSL worker with its model children, and kills any leftover bridge.py.
