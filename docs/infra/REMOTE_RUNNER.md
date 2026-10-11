# Village remote runner

Use Git Bash (Windows), Bash on Linux/macOS, Python 3.10+, SSH, and rsync. On this
Windows host, `powershell -File ops/runner/bootstrap-rsync.ps1` installs rsync into
ignored `ops/runner/.runtime` using public [MSYS2 packages](https://packages.msys2.org/packages/rsync).
Keep Git's `usr/bin` on PATH for its MSYS DLLs. Install `python-dotenv` locally only
if `--env NAME` must read an unexported value from `VILLAGE_ENV_FILE`. No env file
is required for ordinary tests. The wrapper never sources shell code from env files.

## Provision or add another runner

Create Ubuntu 24.04 with the existing **public** SSH key. Never upload the private
key. Set `RUNNER_IP` in your shell (overrides `docs/infra/runner.env`). Then:

```bash
ssh -i ~/.ssh/village_vultr root@$RUNNER_IP 'bash -s' -- "$(bun --version)" < ops/runner/provision.sh
ssh -i ~/.ssh/village_vultr runner@$RUNNER_IP 'bun --version; node --version; uv --version'
```

Verify a new host's fingerprint with the VM console before accepting it. Provisioning
is repeatable, copies only authorized **public** keys, and retains the database volume.
It installs Node 22, the supplied Bun version, uv/Python 3.12, ffmpeg, Chromium for
Playwright 1.58.2, Docker and [TimescaleDB/Postgres 17](https://hub.docker.com/r/timescale/timescaledb).
The `runner` user has neither sudo nor Docker-group access. UFW permits SSH only;
Postgres is bound to 127.0.0.1:5432 (Docker published ports otherwise bypass UFW).
The scratch container uses passwordless trust: this is a shared trusted-agent VM,
not a security boundary between mutually untrusted users. Never store production data.

## Run from any worktree

```bash
cd apps/web
../../ops/remote_run.sh bun run test
../../ops/remote_run.sh bun run build
../../ops/remote_run.sh bunx playwright test --config ../../ops/runner/playwright.config.mjs
../../ops/remote_run.sh --with-api bunx playwright test --config YOUR_DISPOSABLE_CONFIG
cd ../api
../../ops/remote_run.sh python -m uv run pytest -q
```

Arguments are preserved; shell syntax requires explicit `bash -lc '...'`.
`--env NAME` forwards only that requested variable (exported value first, otherwise
runtime lookup in `VILLAGE_ENV_FILE`). Values cross encrypted SSH stdin, not command
arguments or files. Commands themselves must not print secrets. SSH requires the
local key at `~/.ssh/village_vultr`, overridable with `RUNNER_SSH_KEY`.

Source goes to `/srv/runs/<worktree-name>-<path-hash>/`. Sync excludes `.git`, env
files, keys, dependencies, private runtime data, weights, builds, and test output.
The committed `packages/catalog/dist/catalog.ts` is explicitly retained as source.
Tracked and untracked source edits are included. Dependencies persist in each remote
worktree, with successful install hashes in `/srv/runner-cache`; changed lockfiles,
manifests, nested pot lock, or Bun version invalidate the cache. `bun install
--frozen-lockfile` and `uv sync --frozen --python 3.12` execute in the command cwd.
Run commands from the package directory owning its lockfile. `--with-api` additionally
installs API dependencies. Never put secrets in ordinary source filenames.

A per-worktree flock covers upload, execution, and download. Different worktrees
sync independently; web unit tests/builds also execute in parallel across worktrees.
API pytest execution serializes because existing fixtures share `village_test`.
Browser and other arbitrary commands serialize conservatively to avoid fixed Vite
port collisions (per-worktree locks always apply).
Lock waiting, upload and execution share a 30-minute budget (timeout exit 124);
cleanup and retrieving timeout artifacts can add up to a minute. Interruption cleans
process groups and disposable DBs. SSH liveness checks detect dropped connections. Do not manually edit a remote
worktree during a run. If SSH is unreachable, explicitly fall back locally against
mock/scratch data; test failures are returned, not silently rerun locally.

The wrapper streams output and returns the command status (or a transfer failure).
It downloads `test-results`, `artifacts`, `playwright-report`, and screenshot folders,
preserving their relative paths. Set `RUNNER_ARTIFACT_DIR` to redirect this tree;
otherwise output returns to the source worktree. Generated files may contain test
data: inspect before committing.

`--with-api` migrates/seeds a separate `run_<hash>` DB, disables Mayor scheduling and
voice, starts loopback uvicorn on an available port, exports `VILLAGE_API_URL`, waits
for health, then stops the process group and drops the database. API defaults and
pytest DSNs always point to the runner's scratch server. `DATABASE_URL`,
`VILLAGE_TEST_DATABASE_URL`, `VILLAGE_ENV_FILE`, `MAYOR_SCHEDULER` and `MAYOR_VOICE`
are reserved safety overrides, even when requested with `--env`. No root `.env` is synced.
Use configs that honor `VILLAGE_API_URL`; hardcoded remote demo URLs are prohibited.
The supplied auth proof config uses a synthetic provider and port 5189 (override
with `--env RUNNER_WEB_PORT`).

## Teardown

Wait until all agents finish. Remove individual `/srv/runs/<name-hash>` and matching
`/srv/runner-cache/<name-hash>` directories as root only after checking their exact
paths. On the runner, `docker rm -f village-runner-db` stops/removes the scratch
container; `docker volume rm village-runner-db` permanently removes scratch data.
Delete the VM in Vultr to stop VM charges, and unset `RUNNER_IP` / remove its config.
Do not run teardown while teammates are using the runner.

## Infrastructure regression checks

From the root, `python ops/runner/test_control.py` exercises actual SSH exit codes,
same-worktree serialization, disconnect cleanup with a disposable API, and a shortened
timeout. `ops/runner/check_isolation.py` additionally verifies the explicit env
allowlist under `--with-api`; see the verification report for the synthetic value.
These checks use only scratch data. `python ops/runner/benchmark.py --label NAME
--cwd DIRECTORY --output RESULTS.jsonl -- COMMAND ...` samples local process-tree
RSS every 100 ms (requires local `psutil`) and records elapsed time/exit status.

## Historical front VM tunnel: house live-sync WebSocket (R-117)

This section records the pre-cutover layout, not the current serving path. Production now runs API/web on the VM: public Caddy ? private web :8082 ? API :8012 for all `/api/*` WebSockets. See [production updates](PRODUCTION-DEPLOYS.md) and [setup](../SETUP.md).
`vite preview` does not upgrade WebSockets, so `/api/houses/{uid}/live` failed publicly ("Connecting…").
The front VM's Caddy routes only that path (`path_regexp ^/api/houses/[^/]+/live$`) to `127.0.0.1:8090`, a second
persistent reverse SSH tunnel to the home API (`ssh -N -R 127.0.0.1:8090:127.0.0.1:8010 root@<front-ip>` in a reconnect loop,
log `ops/reports/vm-api-tunnel.log`). Port 8081 is the staging web server; don't reuse it. Previous config: `/etc/caddy/Caddyfile.pre-ws`.
