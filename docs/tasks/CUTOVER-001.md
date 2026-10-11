---
id: CUTOVER-001
owner: codex (gpt-6-astra, high)
branch: infra/CUTOVER-001
allowed_paths: [ops/deploy/**, docs/infra/**]
---
# CUTOVER-001 — Prepare the production stack on the front VM (owner approved cutover; secrets step is integrator-only)

Owner decision (R-118): move everything off the home PC onto the Vultr front VM `village-hackathon` (207.246.81.187, root,
~/.ssh/village_vultr); GPU becomes Modal-only (separate agent). Follow and extend `ops/deploy/cutover.md` (DEPLOY-001).
Prepare everything EXCEPT the secrets and the live data copy, which the integrator performs:
1. **Production services, separate from staging:** `village-prod-api` (uvicorn on 127.0.0.1:8012, unprivileged user,
   reads `/etc/village/prod.env` — do NOT create/print/copy that file; provide `ops/deploy/prod.env.example` with variable
   NAMES only, including everything apps/api and apps/imessage read: grep the code) and `village-prod-web` (static build of
   apps/web with VITE_MOCK=0 + production auth config, served on 127.0.0.1:8082, `/api` + WebSocket upgrade proxied to 8012;
   Caddy does WS natively). Add `village-prod-imessage` (bun, apps/imessage, `PHOTON_SEND_ENABLED` from env; DISABLED/not
   started by default) and an optional `village-prod-bridge` unit for workers/gpu/bridge.py if it can run CPU-only calling
   Modal (coordinate: check workers/modal/README.md on main).
2. **Production DB on the VM:** Postgres 17 + TimescaleDB container `village-prod-db`, loopback only, a persistent volume,
   creds via a root-only file generated on the VM (never echoed, never committed). Must match the local extension versions
   (local is Postgres 17 + TimescaleDB in Docker `village-db`; query versions with `docker exec`, not credentials). Create an
   EMPTY db. Provide `ops/deploy/db_cutover.sh` that dumps the local `village-db` (via `docker exec ... pg_dump -Fc`, using the
   container's own env), streams it over ssh, and restores with timescaledb_pre/post_restore, then prints row counts for key
   tables on both sides. Write it; do NOT run it against the live DB. DO rehearse it end to end against a SCRATCH local DB
   copy (e.g. create `village_rehearsal` from a fixture seed on local Docker) → a scratch db on the VM, then drop it.
3. **Assets:** `ops/deploy/sync_assets.sh` (rsync data/assets → VM ASSET_DIR, idempotent, preserves paths). Rehearse with a
   tiny test dir, not the real assets.
4. **Caddy switch:** `ops/deploy/switch.sh` (backup Caddyfile timestamped, swap the live site to `reverse_proxy 127.0.0.1:8082`
   for everything incl. `/api/houses/*/live` — today that path goes to :8090 (a home tunnel) — validate, reload) and
   `rollback.sh` (restore the backup). Write them; do NOT run against the live site.
5. **Verify script:** `ops/deploy/verify_prod.sh` — health, auth, a village read, WebSocket open, asset fetch, against
   127.0.0.1:8082 on the VM.
Do not touch the live site, the existing tunnels on the VM (:8080, :8090) or the staging services. No paid calls.
Final report per AGENTS.md: exact ordered runbook for the integrator, with the commands to run (no secrets), how long the
write-freeze takes, and rollback.
