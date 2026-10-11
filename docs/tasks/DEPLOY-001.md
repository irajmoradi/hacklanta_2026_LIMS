---
id: DEPLOY-001
owner: codex (gpt-6-astra, high)
branch: infra/DEPLOY-001
allowed_paths: [ops/deploy/**, docs/infra/**]
---
# DEPLOY-001 — Stage the full stack on the Vultr front VM (no cutover)

Today https://207-246-81-187.sslip.io is Caddy on `village-hackathon` (207.246.81.187, Ubuntu, ssh key ~/.ssh/village_vultr,
root) reverse-proxying :8080, which is an SSH reverse tunnel to the owner's PC. Goal: the app keeps working if that PC sleeps.
Build `ops/deploy/` scripts (idempotent, re-runnable) that on the VM:
1. install bun, uv/Python 3.12, ffmpeg; clone/rsync the repo at a given commit to /opt/village;
2. build apps/web and serve it + proxy /api to a local uvicorn (systemd units `village-api`, `village-web`);
3. read secrets ONLY from `/etc/village/env` (mode 600). Do NOT create, copy, print or commit that file — the integrator
   populates it. Provide `ops/deploy/env.example` listing required variable NAMES only;
4. DB: the API points at `DATABASE_URL` from that env file. For staging, run a scratch Postgres 17 + TimescaleDB in Docker on
   the VM, apply migrations, load fixtures. Do not touch the live DB or the Tiger service;
5. expose staging on a second Caddy site, e.g. `stage.207-246-81-187.sslip.io` (`*.sslip.io` works) — leave the existing
   site block and tunnel untouched;
6. `ops/deploy/cutover.md`: exact steps (dump live DB → restore on Tiger or VM, swap Caddy upstream, rollback). Do NOT run it;
   cutover needs owner approval.
GPU calls go to GPU_WORKER_URL / GPU_FALLBACK_URL from the env file; the app must work with the GPU offline. iMessage agent:
document only. No paid API calls during verification (mock mode). Verify with curl + a Playwright smoke run against the
staging URL (screenshot in docs/infra/). Final report per AGENTS.md, with real commands and exit codes.
