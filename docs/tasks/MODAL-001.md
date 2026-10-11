---
id: MODAL-001
owner: claude GPU subagent (CV-001 agent)
branch: cv/modal (worktree of your choice)
allowed_paths: [workers/gpu/**, workers/modal/**, apps/api/app/gpu_client*.py, apps/api/app/gram_video.py, apps/api/app/config.py, ops/**, docs/tasks/MODAL-001.md]
request: R-100 (owner, terminal 18:51) "help me get ~$30 of Modal working for the 5090 part"
---
# MODAL-001 — Run the GPU worker on Modal (cloud GPU), with the 5090 as primary

Goal: the village's GPU features (avatar bakes: SAM 3 → LAM head → Gemini stylize → Hunyuan3D head; Audio2Expression; /avatar/talk_video; photo
items) work when the owner's PC is off, by running the same worker API on **Modal** (token already configured in ~/.modal.toml, profile
`irajjmoradi`; Modal SDK via `python -m uv tool run modal ...` or a uv project in workers/modal). Budget: **$30 total**, so:
- GPU class: **L4 (24 GB)** by default (check that our peak VRAM fits; use A10G/L40S only if L4 can't). Scale to zero: `min_containers=0`,
  `scaledown_window≈120s`, `max_containers=1`, `timeout` per call ≤ 600 s. Log an estimated $/call.
- Weights: upload model weights once into a **Modal Volume** (`village-weights`) from the local caches (don't re-download from the internet
  if local copies exist; respect licenses); mount them read-only. Bake an image with the same pinned deps as workers/gpu envs (one image per env
  if needed, or one combined image if the envs are compatible).
- Expose the **same HTTP API** as workers/gpu (health, /avatar/body, /avatar/talk_video, segment, etc.) via `@modal.asgi_app()` with a shared-secret
  header (`X-GPU-Key`, from a Modal Secret + the API's env). Today the API and worker share a filesystem (paths under data/). For Modal, add a
  transport mode: requests upload the inputs (photo/audio bytes) and responses return the artifacts (or short-lived download URLs), which the
  API writes into its own data/assets exactly where the local worker would. Keep the local 5090 path unchanged and the default.
- API: `GPU_WORKER_URL` stays the 5090; add `GPU_FALLBACK_URL` (the Modal endpoint) + key. If the primary health check fails (≤2 s), route the job
  to Modal. Add a `GPU_PREFER=modal|local` switch for testing.
- Prove it: deploy, then run ONE talk_video for an existing consented head and ONE photo-item or segment job through Modal end to end (no new
  Gemini/ElevenLabs calls; reuse cached audio and stylize). Report cold-start time, warm time, and cost for each, plus `modal app list` and spend so far.
Never print or commit tokens/secrets. Final report: branch/commit, how to deploy/redeploy (`modal deploy ...`), the env vars to set, measured
cost, and how to stop it (`modal app stop`).
