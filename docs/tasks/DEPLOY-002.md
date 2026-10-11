---
id: DEPLOY-002
owner: codex (gpt-6-astra, medium)
branch: infra/DEPLOY-002
allowed_paths: [ops/deploy/**, docs/infra/**]
---
# DEPLOY-002 — Near-zero-downtime production deploys

Production now runs on the front VM (D-039; see `ops/deploy/cutover.md`). Today `ops/deploy/prod-deploy.py <sha>` refuses to
run while `village-prod-api` is up ("Stop village-prod-api before replacing the production release"). So every update stops
the API for the whole web build (~2 min of "Reconnecting…" for teammates and judges).
Change the flow so that:
1. The new release is uploaded and fully built (API venv + web build) into `/opt/village/prod-releases/<sha>` **while the
   current release keeps serving**.
2. Then, in one short step, migrations run (idempotent, using the protected env exactly as cutover.md step 7 does), the
   `prod-current` symlink swaps atomically, and `village-prod-api`, `village-prod-bridge` and `village-prod-web` restart.
   Target: under 10 s without the API.
3. Health check after restart (`/api/health` via :8082, plus the house WebSocket upgrade). On failure, swap the symlink back,
   restart, and exit nonzero.
4. Keep the last 3 releases and prune older ones.
5. One command from Git Bash on the PC: `python ops/deploy/prod-deploy.py <sha>` does all of it and prints the timing.
Never read, print or copy `/etc/village/prod.env` or the DB password. Don't change Caddy. Test it against the STAGING
services or a scratch systemd unit pair on the VM, not by restarting production. The integrator runs the first real deploy.
Update `ops/deploy/cutover.md` and `docs/infra/` with the new procedure. Final report per AGENTS.md.

**Addendum (integrator, 21:16):** a real deploy hung because `systemctl stop village-prod-api` stayed in "deactivating"
for minutes (open WebSocket clients keep uvicorn's graceful shutdown waiting), which took the site down (502). Add
`TimeoutStopSec=5` (and uvicorn `--timeout-graceful-shutdown 3`) to the prod API/bridge/iMessage units, and make
`prod-prepare.sh` stop requiring iMessage and the bridge to be stopped while building.
