# INFRA-002 verification — 2026-10-10

Implemented on branch `infra/INFRA-002`. Milestones: `dddba7f` (provisioning and
wrapper), `e4ef483` (cache/Windows/cancellation fixes), `ef95e83` (control tests and
timeout budget); the final evidence commit follows these. No contracts or app
source files changed. No production credentials or private keys were copied.

Runner `<runner-1-ip>`: Ubuntu 24.04, 16 CPUs, 64,294 MiB RAM; Bun 1.3.11 matching
local, Node 22.23.3, uv 0.13.0, Python 3.12.3, Playwright 1.58.2 Chromium. Non-root
SSH works; UFW permits only SSH. Docker publishes Postgres only on 127.0.0.1:5432.
The Postgres 17 image digest is
`sha256:b346edcdb51a1fd6020e3965e0bd1c9f3406fa6d5fbce1e28f4852587ef934e2`.

## Fresh-worktree proof and measurements

Created a detached fresh checkout with:
`git worktree add --detach ops/runner/.runtime/verification dddba7f`.
Only the runner helpers were subsequently refreshed with fixes; application source
remained the fresh checkout. Its remote directory is `/srv/runs/verification-cb113b80`.
All four requested workloads ran there. Native Python invoked the same controller
used by the Bash wrapper (`python ../../ops/runner/remote_run.py ...`); the Bash
entry point was separately exercised by the isolation and exit-code checks.

| Command from package cwd | Result, local and remote | Remote wall seconds | Local wall seconds | Local RSS during remote, MiB | Local RSS during local, MiB |
| --- | --- | ---: | ---: | ---: | ---: |
| web: `bun run test` | 160 passed, exit 0 | 8.51 | 2.85 | 44.2 | 579.1 |
| web: `bun run build` | successful build, exit 0 | 37.37 | 19.23 | 50.1 | 1608.3 |
| web: `bunx playwright test --config ../../ops/runner/playwright.config.mjs` | auth suite: 1 passed, exit 0 | 10.63 | 5.51 | 50.9 | 2333.1 |
| API: `python -m uv run pytest -q` | 443 passed, 3 skipped, exit 0 | 580.03 | 388.11 | 50.4 | 322.3 |

Remote wall times include SSH, source sync, dependency checks, and artifact retrieval.
Web dependencies were warm for the comparison. API pytest itself reported 570.10s
remotely and 373.46s locally. The three skips are existing opt-in live/paid/browser
checks; paid checks were not enabled. Vite emitted its existing large-chunk warning.

Measurements are single runs using `ops/runner/benchmark.py`, sampled every 100 ms.
RSS is the summed resident memory of the local command's process tree, not total
machine usage; it excludes the observer and Docker's VM. The local scratch DB had
a separate 1 GiB cap and was observed at 116.8 MiB. Local Node is 24.20.0 and Python
3.12.15; the requested runner uses Node 22 and Python 3.12.3. These are operational
comparisons, not controlled CPU benchmarks. Remote execution was slower but greatly
reduced local memory use. Full raw measurements: [measurements.jsonl](measurements.jsonl).

The first browser retry queued behind the full API run in the **same** worktree and
took 564.83s; that valid serialization result is retained in raw measurements but
excluded from the uncontended table. Different worktrees can run web builds/unit
tests concurrently. API suites serialize around their shared `village_test` DB;
browser/arbitrary commands serialize to avoid existing fixed Vite ports.

Local API comparison used a new, temporary `village-infra002-baseline` container
on 127.0.0.1:15440 with the same image digest, trust auth, a 1 GiB cap and 2 CPUs.
`DATABASE_URL` and `VILLAGE_TEST_DATABASE_URL` pointed only to its `village_test`;
`VILLAGE_ENV_FILE=NUL`. The container was stopped and auto-removed afterward.
The existing local `village-db` and live API :8010 were never targeted.

## Additional checks (all final checks exit 0)

- `ssh ... root@<runner-1-ip> bash -s -- 1.3.11 < ops/runner/provision.sh`:
  initial provisioning and repeat provisioning succeeded. Verified versions,
  firewall, non-root SSH, and loopback Docker port binding.
- `python ops/runner/test_control.py`: preserved deliberate exit 23 and signal
  exit 143; overlapping same-worktree runs serialized; closing SSH stdin stopped
  the command/API and dropped its scratch DB; shortened timeout returned 124.
- `ops/remote_run.sh --with-api --env RUNNER_CANARY python ops/runner/check_isolation.py`:
  exit 0. `RUNNER_CANARY` was the synthetic string `synthetic value with spaces $ and quotes"`;
  a separately exported `RUNNER_UNREQUESTED` was absent remotely. Confirmed scratch
  DSNs, `/dev/null` env file, disabled Mayor, disposable API health, artifact download,
  and DB removal. No real secret was needed.
- `python -m py_compile ops/runner/remote_run.py ops/runner/execute.py ops/runner/benchmark.py ops/runner/check_isolation.py ops/runner/test_control.py`.
- `bash -n ops/remote_run.sh ops/runner/provision.sh`.
- `ssh ... runner@<runner-1-ip> shellcheck -s bash - < ops/runner/provision.sh`.
- `git diff --check`.

Reviewed screenshot downloaded from the runner:
[screenshots/runner-auth.png](screenshots/runner-auth.png). It shows the synthetic
identity provider reached by the existing auth suite. Other generated artifacts
remain under ignored `docs/infra/artifacts/`.

Initial failures were fixed, not omitted: catalog source under `dist/` was initially
excluded (unit exit 1); a Python shim/venv discovery issue prevented API launch
(exit 1 then 2); Windows could not apply Unix artifact permissions (transfer exit
23 despite a passing browser test). All corresponding final runs passed.

## Handoff

From `apps/web`, run `../../ops/remote_run.sh bun run test` or `bun run build`.
From `apps/api`, run `../../ops/remote_run.sh python -m uv run pytest -q`.
Use `--with-api` for browser/API work requiring a disposable backend and `--env NAME`
only for required variables. No local app dependencies are needed for remote work.

[REMOTE_RUNNER.md](REMOTE_RUNNER.md) contains Windows bootstrap, additional-runner
provisioning, environment forwarding, concurrency, and teardown instructions.
To add a VM, set `RUNNER_IP`, install the existing public key, and run provision.sh
with the local Bun version. To tear down, first wait for teammates to finish, then
remove scratch containers/volumes and delete the VM in Vultr. The runner was left
running and available; the local comparison container was removed.

Changed paths: `AGENTS.md`, `ops/.gitattributes`, `ops/remote_run.sh`, `ops/runner/`
(provisioning, controller, supervisor, bootstrap, proof config/checks, benchmark,
ignore file), and `docs/infra/` (runbook, evidence, measurements, screenshot, ignore
file). No blockers. No proposed contract changes.
