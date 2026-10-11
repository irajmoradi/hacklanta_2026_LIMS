# DEPLOY-001 staging verification

Date: 2026-10-10. Branch: `infra/DEPLOY-001`.
Deployed source: `ccb03c7f6744489244650e2542b34c51b35400a1`.
Milestones: `9b1bf01` initial scripts/runbook; `81ba2b8` apt-feed isolation;
`62a79ed` guarded launcher/tests; `c1084f1` Node 22/verification;
`fd8eb48` corrected internal Caddy Host matching and loopback binding;
`ccb03c7` blocked libpq environment redirects and expanded cutover commands;
`a216014` corrected the smoke test for the existing desktop badge/seat picker.
The final report/docs commit follows these; use `git log -1` for its hash.

## Outcome and blocker

Visit <https://stage.207-246-81-187.sslip.io> for the VM-hosted fixture village.
The static app and scratch database are staged. **Full-stack API activation is
blocked**: `/etc/village/env` does not exist. Task instruction 3 reserves that
file for the integrator and explicitly prohibits this worker creating/copying it.
It was not created, copied, printed, or modified. No local root secrets were
needed or transmitted. `/api/health` on staging returns 502, not a healthy API.
The frontend is intentionally built in mock mode; do not interpret it as an
API/database integration test. `village-api` is installed/enabled but inactive.

The existing live site still returns HTTP 200. Its Caddy site block is identical
byte-for-byte to the saved original, with exactly one appended staging import.
The original SSH reverse-tunnel listener on 127.0.0.1:8080 remains PID 4121.
No cutover, live mutations, live DB/Tiger access, iMessages, paid generation calls,
or Solana transactions were performed. The live site still depends on the PC
until an owner-approved cutover; only staging is independent of the PC.

## Installed state

- Releases: `/opt/village/releases/<sha>`, atomic `/opt/village/current` symlink.
- `village-web`: active, separate Caddy process bound to 127.0.0.1:8081.
- `village-api`: prepared for 127.0.0.1:8011, requires integrator env.
- `village-stage-db`: Docker restart policy `unless-stopped`, loopback 55432,
  named persistent volume; passwordless local trust, scratch data only.
- PostgreSQL 17.11, TimescaleDB 2.30.2; 27 migration ledger entries,
  one fixture village, five fixture users, unchanged after repeat deployment.
- Image digest:
  `timescale/timescaledb@sha256:b346edcdb51a1fd6020e3965e0bd1c9f3406fa6d5fbce1e28f4852587ef934e2`.
- Bun 1.3.11, uv 0.13.0, Node 22.23.3, Python 3.12.3, ffmpeg installed.
- Original system Caddy retained. No firewall, existing listener, or tunnel
  service changes. The new web and DB listeners are explicitly loopback-only.

## Commands and observed results

Commands are from the worktree root unless a directory is specified. Deployment
builds run on the target VM as required by the task; tests use the configured
shared runner. PowerShell may map an uncaptured failing native command to shell
exit 1; final commands explicitly capture/exit with `$LASTEXITCODE`.

| Command | Exit/result |
| --- | --- |
| `python ops/deploy/deploy.py 9b1bf01` | Initial attempt failed: remote apt exit 100 / local wrapper exit 1, existing third-party Caddy feed HTTP 402. Fixed by using only Ubuntu apt sources. |
| `python ops/deploy/deploy.py 81ba2b8` | 0 under initial script semantics, with explicit missing-env warning; web build, migration and seed completed. Node 18 engine warnings prompted Node 22 provisioning. |
| `python ops/deploy/deploy.py c1084f1` | Reached intentional blocked exit 3 (PowerShell surfaced 1); build/migration succeeded. Verification then exposed an empty HTTP 200 from Caddy Host mismatch, fixed in fd8eb48. |
| `python ops/deploy/deploy.py fd8eb484b43ac9298eaa270314a9bbc17bdf4eae` | 3, expected API-env blocker; all web/DB setup completed. Run twice with the same result to verify repeatability. |
| `python ops/deploy/deploy.py ccb03c7f6744489244650e2542b34c51b35400a1` | 3, same expected blocker; final launcher revision deployed and verification repeated. |
| VM build inside deployment: `bun install --frozen-lockfile; bun run build` | Both 0; TypeScript and Vite production build passed. Existing large-chunk warnings remain. |
| VM API setup: `uv sync --frozen --python /usr/bin/python3.12`, then `.venv/bin/python scripts/migrate.py` and `.venv/bin/python scripts/seed.py` with scratch-only runtime DSN | All 0, including repeat migration/seed. |
| From `apps/api`: `bash ../../ops/remote_run.sh python -m uv run python ../../ops/deploy/test_guard.py` | 0; two tests passed, including eight rejected DSNs and provider/scheduler suppression. No DB network access by these tests. |
| Same runner guard command after adding libpq env clearing | Waiting job explicitly cancelled with SIGTERM (143; controller shell 1) to release this worktree's browser queue; it had not executed the test. No other worker process was stopped. |
| `ssh -i ~/.ssh/village_vultr root@207.246.81.187 'cd /opt/village/current/apps/api && .venv/bin/python ../../ops/deploy/test_guard.py'` | 0; final two guard tests passed in 0.092s on the staging VM, including inherited PGHOSTADDR/PGSERVICE removal. This lightweight check uses no DB network I/O. |
| `ssh -i ~/.ssh/village_vultr root@207.246.81.187 'bash /opt/village/current/ops/deploy/verify.sh'` | 3, explicit env blocker; systemd unit validation, Caddy preservation, versions/counts, loopback listeners, stage/live HTTPS checks passed. Run again after repeat deployment with unchanged counts. |
| `curl.exe --fail --silent --show-error --output NUL --write-out 'stage HTTP %{http_code}\n' https://stage.207-246-81-187.sslip.io` | 0, HTTP 200; final browser test additionally verifies actual content. |
| Same curl command for `https://207-246-81-187.sslip.io` | 0, HTTP 200. Read-only root page request. |
| `bash -n ops/deploy/provision.sh ops/deploy/stage.sh ops/deploy/verify.sh` | 0. |
| `python -c "import ast,pathlib; [ast.parse(p.read_text()) for p in pathlib.Path('ops/deploy').glob('*.py')]"` | 0. |
| `git diff --check` | 0. |

From `apps/web`, `bash ../../ops/remote_run.sh bunx playwright test --config
../../ops/deploy/playwright.config.mjs`: initial run exit 1 after waiting for the
shared browser lock. It loaded the village but expected the mode badge to be
visible, whereas existing desktop CSS hides it. Corrected to assert its mock-mode
text and select the fixture seat before capturing the screenshot. The queued CLI
rerun was explicitly cancelled before execution (143; controller shell 1).

The external-URL smoke was moved to Bun's test harness using real Playwright
Chromium: `bash ../../ops/remote_run.sh bun test ../../ops/deploy/stage-smoke.test.ts`.
It creates no fixed web/API ports or shared DB and uses the wrapper's independent
Bun-test lane on the same remote runner. Its first run reached the fixture seat,
controls and canvas but exited 1 when screenshot capture exceeded 30 seconds on
software WebGL. The capture was adjusted to 1280x900, reduced motion and the
app's supported low-power quality path (hardwareConcurrency=2), with a 90-second
screenshot timeout. **Final run: exit 0, one test passed in 38.2 seconds**
(42.83 seconds including runner sync/cache). No uncaught page errors or browser
mutation requests were recorded. Screenshot:
`docs/infra/screenshots/deploy-stage.png` (1280x900, 315175 bytes), inspected with
the image viewer: village buildings, five fixture seats, navigation, controls,
and activity panels render; the seat-selection dialog is dismissed. The optional
serialized CLI configuration was updated to the same capture settings but was
not rerun separately after the successful Bun-hosted Playwright run.

## Files changed and teammate handoff

All changes are inside the task's allowed paths:

- `ops/deploy/deploy.py`, `provision.sh`, `stage.sh`: committed-source transfer,
  installation, scratch DB, build, migrations/fixtures, service activation and Caddy.
- `ops/deploy/api-start.py`, `test_guard.py`: scratch DSN guard and offline
  provider restrictions, with executable guard tests.
- `ops/deploy/village-api.service`, `village-web.service`, `web.Caddyfile`,
  `stage.Caddyfile`: unprivileged service and isolated routing configuration.
- `ops/deploy/env.example`: variable names only.
- `ops/deploy/verify.sh`, `playwright.config.mjs`, `stage.spec.mjs`,
  `stage-smoke.test.ts`: verification and port-free remote Playwright smoke.
- `ops/deploy/README.md`, `cutover.md`: operation, iMessage handoff and approved
  cutover/rollback instructions (not executed).
- This report and `docs/infra/screenshots/deploy-stage.png`: verification evidence.

Try the staging URL now. To enable the API, the integrator supplies root-owned
0600 `/etc/village/env` with DATABASE_URL targeting
`postgresql://postgres@127.0.0.1:55432/village_stage` and `DEMO_AUTH=1` for demo
identity access, then reruns `python ops/deploy/deploy.py <commit>` and the
health/village curl checks in the README. The API deliberately refuses all other
DB targets and suppresses paid providers. Its successful activation remains
unverified until that prerequisite is met. Do not reuse this mock/scratch
configuration as production without the documented owner-approved preparation.

Proposed contract changes: none. API-owner follow-up: the current API reads
GPU_WORKER_URL but has no GPU_FALLBACK_URL implementation anywhere in apps/api.
It is listed/documented for the integrator; implementing fallback is outside
allowed_paths. No API source or shared contracts were edited.
