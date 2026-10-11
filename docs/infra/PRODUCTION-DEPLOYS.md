# Production release updates

Run from the integrated checkout in Git Bash on the PC:

```bash
export VILLAGE_ENV_FILE=/c/Users/mourn/Downloads/hacklanta/.env
python ops/deploy/prod-deploy.py INTEGRATED_COMMIT_SHA
```

The integrator runs the first production deployment. The target commit must contain
DEPLOY-002 tooling. This is an updater for the already provisioned production VM,
not a first-install, data-cutover, or Caddy-management command. No preparatory stop
of API, bridge, web or iMessage is needed. `--host` and `--key` retain their existing
SSH overrides. Production should be healthy before starting an update.

## What the command does

1. Resolve the committed SHA, reject private/runtime files in its Git archive,
   upload source over SSH, and send the three public Auth0 build settings plus `VITE_AUTH0_ENABLED` on
   stdin (process flag, default `0`: Sign in hidden). The existing PC env is read at runtime; it is never transferred.
2. Take `/opt/village/prod-deploy.lock`, shared by the entire build/activation/prune
   transaction. A concurrent deployment waits. Move source into
   `/opt/village/prod-releases/<sha>` and build the web, API venv and iMessage
   dependencies while the old release continues serving. Frontend flags are
   `VITE_MOCK=0`, `VITE_DEMO_AUTH=1`, and the supplied `VITE_AUTH0_ENABLED`. Enable Sign in only with an owner-approved `VITE_AUTH0_ENABLED=1` rebuild; [seat claims](../auth/JUDGE_LOGIN.md) need migration 059 and private operator codes. The demo flag is hardcoded in `prod-build.sh`; an Auth0-only release needs an integrator-reviewed build-script change plus matching API configuration. Failed preparation removes its incomplete
   release; an existing release is never overwritten.
3. Run that new release's idempotent `apps/api/scripts/migrate.py` using a unique
   transient systemd unit as `village-prod`, with
   `EnvironmentFile=/etc/village/prod.env` and `VILLAGE_ENV_FILE=/dev/null`, just
   like original cutover step 7. The controller checks file metadata only; it does
   not read, copy or display this file or the DB password. Migration output is
   suppressed, including journal output, to avoid accidental credential disclosure.
   Migration runtime is bounded at 120 seconds; failure leaves current untouched.
4. Install persistent `deploy-stop-limits.conf` systemd drop-ins: five-second stop
   limits for API, bridge, web and iMessage, plus Uvicorn's three-second graceful
   shutdown limit for API. Reload systemd. These compatibility settings also apply
   to old releases during rollback and are retained after rollback. The committed
   API/bridge/iMessage unit files carry the same limits for future provisioning.
   The bridge and iMessage are not Uvicorn processes; only API gets the CLI flag.
5. Atomically replace `prod-current` with a same-directory symlink rename, then
   restart `village-prod-api`, `village-prod-bridge`, and `village-prod-web` together.
   Reset failed state/start-rate counters for those units before each intentional
   restart, so a failing candidate cannot prevent recovery through the burst limit.
   Bridge starts even if previously stopped, as required by this deployment flow;
   provider behavior remains controlled by the integrator's protected environment.
   iMessage is neither stopped nor restarted by deployment; its new stop limit
   applies to a later operator-managed restart. It keeps its existing process/code.
6. Retry readiness for up to 15 seconds: HTTP 200 and `ok=true, db=up` at
   `http://127.0.0.1:8082/api/health`, a real house WebSocket 101 with verified accept
   key through the same port, and every restarted unit active. The socket uses zero
   UUIDs and disconnects before sending auth, edits, presence or other writes.
7. On activation/readiness failure (also a caught interruption), atomically restore
   the previous symlink, restart and health-check again, and exit nonzero. On
   successful recovery the failed release is removed so the same SHA can be retried.
   If recovery fails, retain both releases, print `ROLLBACK FAILED`, and exit nonzero
   for integrator investigation. Never prune after failure.
8. On success, retain three releases: current, immediate previous, and the newest
   remaining release by successful activation time (directory mtime for legacy
   releases). Delete only direct SHA-named directories under `prod-releases`, never
   symlinks or unrelated files. Retention is count-based, not a backup mechanism.

No production DB provisioning, seeds, asset copies, unit enablement, Caddy config
edits or public Caddy reloads occur. Existing service definitions are preserved;
only the documented bounded-stop drop-ins are managed.

## Timing and compatibility

The command prints build/wait elapsed time, migration time, restart-to-healthy time,
remote total time and PC end-to-end time. Restart-to-healthy is a conservative
disruption window, not a measurement of every client's downtime. The successful
target is under 10 seconds; a slower healthy deployment prints a notice. A failed
deployment can take longer because readiness and rollback have their own budgets.
Existing WebSockets reconnect during restart. Forced shutdown at five seconds can
interrupt a long request or background operation.

Migrations run while old code is still serving. Every release must use additive,
backward-compatible migrations that also support the previous version after code
rollback. The deployment does not reverse schema changes, restore a database, or
undo writes. Destructive migrations require a separately planned maintenance/data
procedure. No automated seed or world-changing debug actions are used here.

SIGKILL, host failure or power loss cannot execute rollback handlers. Recover by
inspecting `readlink -f /opt/village/prod-current`, service health, and retained
release directories; do not delete a release referenced by a running process.
Do not run the legacy preparation tool concurrently; it used a different lock.

## Reproduce safe checks

Locally, `python ops/deploy/test_cutover.py` checks shell syntax and existing cutover
safety regressions. Upload `prod-release.py` and `rehearse_release.py` into one
temporary directory on the front VM and run as root:

```bash
python3 /tmp/<tool-directory>/rehearse_release.py
```

The rehearsal creates uniquely named `/opt/village/deploy002-*` roots and systemd
units, synthetic build/migration/HTTP/proxy/WebSocket fixtures, and a synthetic
mode-600 environment. It tests old-service continuity, bounded shutdown, failure
rollback, duplicate and retry behavior, concurrency and retention. It removes its
services, drop-ins, release trees and env afterward. It never opens the production
env, uses production DBs, restarts production units or changes Caddy.

For the real API probe and a held-open house socket during Uvicorn shutdown:

```bash
cd apps/api
../../ops/remote_run.sh --with-api python ../../ops/deploy/test_release_api.py
```

This uses the runner's disposable API and DB. See
[DEPLOY-002-REPORT.md](DEPLOY-002-REPORT.md) for commands, results and measured limits.
