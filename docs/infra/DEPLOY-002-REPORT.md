# DEPLOY-002 completion report

Branch: `infra/DEPLOY-002`. Implementation milestone: `50ba5dc` (online build,
atomic activation, rollback and initial scratch rehearsal). Follow-up commit on
this branch contains interruption hardening, real-API regression checks and these
runbooks; use `git log -2 --oneline` for its final commit ID.

Production was not deployed or restarted by this worker. No production environment
or DB password was read, printed or copied. No Caddy configuration was changed.
The integrator's concurrently added task addendum was read and implemented, but
`docs/tasks/DEPLOY-002.md` was not edited or staged by this worker.

## Changes

- `ops/deploy/prod-deploy.py`: committed-source upload, compatible-tooling guard,
  temporary upload cleanup, propagated exit status and PC elapsed time.
- `ops/deploy/prod-prepare.sh`: compatibility entrypoint for the new controller;
  no requirement to stop API, bridge or iMessage before building.
- `ops/deploy/prod-build.sh`: isolated Auth0 production web build, frozen API venv
  and iMessage dependencies; no provisioning, secrets, symlink or service changes.
- `ops/deploy/prod-release.py`: serialized build/migration/activation, metadata-only
  protected-env check, transient systemd migration, bounded-stop drop-ins, atomic
  symlink replacement, restart, HTTP/DB/house-WebSocket readiness, rollback,
  interruption handling with build-process-group cleanup, and three-release retention.
- `ops/deploy/village-prod-{api,bridge,imessage}.service`: five-second stop limits;
  API also receives `--timeout-graceful-shutdown 3`.
- `ops/deploy/rehearse_release.py`: disposable front-VM systemd rehearsal with
  synthetic services and protected synthetic env; cleanup included.
- `ops/deploy/test_release_api.py`: real scratch API health/WebSocket probe and
  shutdown with a held-open house connection, guarded to runner scratch DBs.
- `ops/deploy/test_cutover.py`: feed shell syntax checks on stdin so Git Bash works
  when invoked by Windows Python.
- `ops/deploy/cutover.md`, `docs/infra/PRODUCTION-DEPLOYS.md`, this report: current
  deployment procedure, historical cutover labeling, recovery and limitations.

## Executed verification

| Command / location | Result |
| --- | --- |
| `python ops/deploy/test_cutover.py` on PC | Exit 0; four tests, including every deployment shell script's syntax |
| `python3 /tmp/deploy002-tests.ThdywL1g/test_cutover.py` on front VM | Exit 0; same four tests on Linux |
| `python -m py_compile ops/deploy/prod-release.py ops/deploy/prod-deploy.py ops/deploy/rehearse_release.py ops/deploy/test_release_api.py` | Exit 0 |
| `python3 /tmp/deploy002-tests.eZoT9h4y/rehearse_release.py` on front VM (final controller) | Exit 0; systemd/rollback/concurrency/retention/interruption checks |
| From `apps/api`: `bash ../../ops/remote_run.sh --with-api python ../../ops/deploy/test_release_api.py` | Exit 0; real app and disposable DB; 130.98 s including runner queue/setup |
| From `apps/web`: `bash ../../ops/remote_run.sh --env VITE_MOCK --env VITE_DEMO_AUTH --env VITE_AUTH0_DOMAIN --env VITE_AUTH0_CLIENT_ID --env VITE_AUTH0_AUDIENCE bun run build` | Exit 0; 46.64 s including sync/cache; normal large-chunk warning only |
| `git diff --check` | Exit 0 |

The frontend build forwarded only synthetic public settings: `VITE_MOCK=0`,
`VITE_DEMO_AUTH=0`, domain `synthetic.invalid`, client ID and audience `synthetic`.
No secret values were forwarded. Actual API migrations and fixture seeding in the
runner wrapper used its disposable database, which the wrapper removed afterward.

The front-VM rehearsal exercises the actual deployment controller with real
systemd restart jobs and a loopback HTTP/WebSocket proxy fixture. It deliberately
uses synthetic builds/migrations and service fixtures, rather than the production
database/env or a full app build on the serving VM. Separately, the runner verifies
the real frontend build, API migration/startup and actual house WebSocket route.
The complete uploader-to-production path is reserved for the integrator.

Observed results:

- Old API/proxy/bridge PIDs stayed unchanged and HTTP plus WebSocket probes passed
  repeatedly throughout a deliberately slow build.
- A stubborn old API and proxy that ignored SIGTERM were stopped by the new
  five-second limit. Repeated successful restart-to-healthy windows were about
  **5.3–5.4 seconds**, below the ten-second target. Ordinary synthetic restarts
  took **0.24–0.29 seconds**. Final bounded-stop result: **5.40 seconds**. These are
  scratch measurements, not production SLAs.
- Build and migration failure left the old symlink/services healthy. HTTP/DB,
  WebSocket and process-start failure each restored the old release and exited
  nonzero; failed-readiness recovery took about **15.3–15.5 seconds**.
- A failed SHA could be retried; a successful SHA could not be overwritten.
  Concurrent deployments serialized; retention ended with exactly three releases.
- SIGTERM during readiness retries restored and rechecked the old release, exiting
  nonzero; final activation/recovery window was **1.33 seconds**.
- The real house WebSocket returned 101, and actual Uvicorn terminated with an
  open non-cooperating client in **0.17 seconds** using the new graceful limit.
- Scratch unit files/drop-ins, env files, releases and upload tooling were removed.

Earlier attempts exposed and fixed Windows shell-path handling and a scratch
fixture's invalid temporary-directory name; those test attempts exited 1. An
interruption rehearsal also exited 1 after rapid restarts exhausted systemd's
burst limit; the controller now resets failed state for its three units before
each intentional restart so rollback can start them. An
initial runner build invocation prefixed with `env` queued behind the shared
browser lock and was deliberately cancelled (remote exit 143); the explicit
`--env` invocation above used the independent-build path and passed. A nested
Python-to-Bash launch also failed to find Python; direct Git Bash invocation passed.

## Teammate handoff and limits

Follow [PRODUCTION-DEPLOYS.md](PRODUCTION-DEPLOYS.md). From the integrated checkout
in Git Bash, with `VILLAGE_ENV_FILE` pointing to the existing PC env:

```bash
python ops/deploy/prod-deploy.py <integrated-commit-sha>
```

No pre-build service stop is needed. The target commit must include DEPLOY-002.
The integrator runs the first real deploy and checks the printed restart timing.
For a safe reproduction, upload the two rehearsal/controller Python files to one
temporary VM directory and run `python3 <directory>/rehearse_release.py` as root.

No implementation blockers or proposed contract changes. There are no UI changes,
so screenshot path is **not applicable**. Production timing remains unmeasured by
design. Migrations must be backward-compatible with old code, including after code
rollback; database changes are not reversed. The updater restarts API/bridge/web;
iMessage keeps running and requires an operator-managed restart to load new code.
The persistent bounded-stop drop-ins apply to both new and rolled-back releases.
