# Village GPU worker on Modal (MODAL-001 / R-100)

A scale-to-zero **L4** copy of the GPU worker for when the home RTX 5090 is off. The 5090 stays primary and default.

| | |
|---|---|
| App | `village-gpu`. Gateway URL: `https://irajjmoradi--village-gpu-web.modal.run` |
| GPU classes | `SamWorker` (SAM 3: segment, group segment, photo item outfit, object cutout), `LamWorker` (LAM: talk_video + head bake with OAC export via FBX SDK + headless Blender 4.0.2), `ExprWorker` (Audio2Expression only: voice_expr), `HyWorker` (Hunyuan3D-2mini + Paint-Turbo: stylized body head, 3D photo objects) |
| Limits | L4, `min_containers=0`, `scaledown_window=120 s`, `max_containers=1` per class, `timeout=600 s` |
| Weights | Modal Volume `village-weights` (uploaded from the local WSL caches): `/lam/model_zoo`, `/lam/assets/...`, `/a2e/pretrained_models`, `/torch/hub` (DINOv2), `/hf/hub/models--facebook--sam3` |
| Auth | Modal Secret `village-gpu-key` (`GPU_KEY`). Callers send `X-GPU-Key`. Local copy: `data/run/gpu_fallback.key` (gitignored) |
| Transport | Inputs are uploaded as multipart bytes. Artifacts come back base64 in the job JSON (`video_b64`, `files{}`). The caller writes them where the local worker would have |

**Every bridge stage now runs on Modal (MODAL-002):** segment (member, group, claimed crop needs no GPU), LAM head bake (+ OpenAvatarChat
zip), stylized body (Hunyuan3D head GLB), voice_expr, photo items (outfit + 3D object), and talk_video (API).
Gemini stylize stays on the **caller** (bridge), with the same caches (`data/cache/stylize/<face_sha>-<prompt>.png`,
`data/cache/stylize_object/photo-<sha(photo+noun+version)>.png`), so no Gemini key is stored on Modal. Modal only meshes.
Not on Modal: `/face/verify` and `/face/enroll` (CV-007 face login, CPU-only). The API's `auth_face.py` still calls `GPU_WORKER_URL`, so
in Modal-only mode face login answers "unavailable". Porting it needs a gateway endpoint plus an `auth_face.py` change (API scope).
Volume note: the paint UNet is loaded from `diffusion_pytorch_model.bin` (7.3 GB). The `.safetensors` copy is unused.

## Modal-only mode (MODAL-002)
- `GPU_WORKER_URL=` (empty) **or** `GPU_PREFER=modal`: the API and bridge never probe the 5090 and send every GPU job to Modal.
- Nothing configured (`GPU_WORKER_URL=` empty and no `GPU_FALLBACK_URL`): the app still works. Videos are skipped, avatar jobs
  stay queued (fixture avatars stay), and nothing crashes.

## Bridge placement (the API is moving to the VM)
The bridge must run **next to the API**: it writes artifacts into the API's `ASSET_DIR` and reads/writes `avatar_jobs` in its
`DATABASE_URL`. So when the API moves to the Vultr VM, run the bridge there (no GPU needed). Stop the PC bridge at the same time,
so only one bridge claims jobs. Two bridges would also work, because claims use `FOR UPDATE SKIP LOCKED`, but the PC one could
write files to the wrong disk.
```bash
# on the VM, from the repo checkout (e.g. /opt/village), with the repo-root .env present:
bash workers/modal/run_bridge.sh                      # foreground (uv run, deps: psycopg, httpx, python-dotenv, pillow)
sudo cp workers/modal/village-bridge.service /etc/systemd/system/ && sudo systemctl daemon-reload   && sudo systemctl enable --now village-bridge      # adjust User=/WorkingDirectory= in the unit first
journalctl -u village-bridge -f
```
The bridge needs, from `.env`: `DATABASE_URL`, `GPU_FALLBACK_URL`, the key (`GPU_FALLBACK_KEY`, or copy `data/run/gpu_fallback.key`),
and `GOOGLE_API_KEY` (Gemini stylize for new faces and objects; cache hits make no call).

## Budget guard ($30 total)
`budget_guard.sh [threshold]` stops the app when metered spend this cycle reaches the threshold (default $25). On the VM it uses `modal`
from PATH (`uv tool install modal==1.6.1 && modal token set ...`); on the PC it uses the WSL wrapper. Cron line for the VM:
```
*/30 * * * * cd /opt/village && bash workers/modal/budget_guard.sh 25 >> data/logs/modal_budget.log 2>&1
```

## Deploy / redeploy / stop (from the repo root, Git Bash → WSL; uses ~/.modal.toml profile irajjmoradi, nothing copied)
```bash
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 bash /mnt/c/Users/mourn/Downloads/hacklanta/workers/modal/wsl_modal.sh deploy workers/modal/app.py
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 bash .../workers/modal/wsl_modal.sh app stop -y village-gpu        # stop everything
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 bash .../workers/modal/wsl_modal.sh app list                       # status
MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 bash .../workers/modal/budget_guard.sh 25                           # stop if spend > $25
```
The first build takes ~8 min (pytorch3d, the Gaussian rasterizer and simple-knn are compiled for sm_86/sm_89). Code-only redeploys take ~15 s.
Re-upload weights: `wsl_modal.sh volume put -f village-weights <local dir> <remote dir>` (the volume uploads at ~1 Gbit/s).

## Env vars (API `apps/api` and bridge `workers/gpu/bridge.py` read the repo-root `.env`)
```
# Modal-only (the 5090 cutover):
GPU_WORKER_URL=
GPU_FALLBACK_URL=https://irajjmoradi--village-gpu-web.modal.run
# GPU_FALLBACK_KEY=...      optional; otherwise read from data/run/gpu_fallback.key (GPU_FALLBACK_KEY_FILE overrides the path)
# GPU_PREFER=modal          testing only: always use Modal. Default "local": Modal only when the 5090's /health fails within 2 s
```
GPU_WORKER_URL keeps pointing at the 5090 (unchanged).

## Measured (2026-10-10, L4 at $0.80/h; est = GPU seconds × rate + gateway CPU)
| call | cold | warm |
|---|---|---|
| talk_video (Iraj gram, 2.2 s audio) | 170 s wall, 57 s model load, **~$0.034** | 12.3 s wall, 8.9 s GPU, **~$0.002** |
| photo item outfit (SAM 3) | 38 s wall, 26 s model load, **~$0.007** | 4.4 s wall, 1.0 s GPU, **~$0.0002** |
| gateway /health cold | ~36 s (CPU container start) | <1 s |
| **MODAL-002** LAM head bake + OAC zip (Blender/FBX) | 180 s wall (LAM load 19 s + tracking/render warm-up), **~$0.038** | 52 s wall, **~$0.011** |
| body: stylized head mesh (Hunyuan mini + paint) | 195 s wall (container load 149 s), **~$0.04** | 28 s wall, **~$0.006** |
| 3D photo object (SAM 3 cutout + Hunyuan mesh, cached prop) | 60 s (cutout cold + mesh warm), ~$0.011; +~150 s if Hunyuan is cold | ~30 s |
| voice_expr (Audio2Expression only) | 44 s wall (13 s load), ~$0.009 | a few s |
| group segment (5 crops) | 55 s wall, ~$0.010 | ~3 s |

The output is identical to the 5090 (`data/demo/modal_vs_local_talk.png`). Idle cost is $0, because everything scales to zero after 120 s.
Worst case if hammered: 2 GPU classes × $0.80/h = $1.60/h, so $30 lasts ~19 h of continuous GPU.
Metered spend so far: **$1.06** after MODAL-002 (all builds plus tests, covered by credits). `wsl_modal.sh billing summary` shows the live total.
