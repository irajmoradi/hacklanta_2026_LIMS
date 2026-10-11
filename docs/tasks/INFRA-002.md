---
id: INFRA-002
owner: codex (gpt-6-astra, medium)
branch: infra/INFRA-002
allowed_paths: [ops/**, AGENTS.md, docs/infra/**]
request: R-104 (owner 18:56) run agents' heavy commands on the Vultr runner so the home PC stays light and we can run more agents
---
# INFRA-002 — Remote runner for builds/tests (option B)

A new VM `village-runner` (16 vCPU / 64 GB, Ubuntu 24.04, ewr) is booting; get its IP from `docs/infra/runner.env` (the integrator writes
`RUNNER_IP=` there) or poll `ssh -i ~/.ssh/village_vultr root@$RUNNER_IP`. SSH key: `~/.ssh/village_vultr` (local only, never commit or copy it).
1. **Provision** (idempotent `ops/runner/provision.sh` run over ssh): a non-root `runner` user; git, rsync, build-essential; **bun** (same version as
   local), **node 22**, **uv + Python 3.12**, **Playwright browsers + system deps** (chromium), **Docker + a Postgres 17/TimescaleDB container** on
   :5432 for scratch test DBs (pytest fixtures already create scratch DBs; point them via env), ffmpeg. A ufw firewall: only ssh in.
2. **`ops/remote_run.sh <cmd…>`**: run from inside any worktree. It rsyncs the worktree to `/srv/runs/<worktree-name>/` (excluding node_modules,
   .venv, test-results, artifacts; with a persistent per-worktree dependency cache on the runner: bun install / uv sync run there and are cached by
   lockfile hash), runs `<cmd>` in the same relative cwd with the same env vars the test needs (NO secrets except the ones the command explicitly
   needs via `--env NAME`, passed through ssh env, never written to disk), streams stdout/stderr live, returns the exit code, and rsyncs back
   `test-results/`, `artifacts/`, `playwright-report/`, and screenshot folders. Handles concurrency (many agents at once: per-worktree dirs + a
   simple per-run lock). Times out after 30 min.
3. **Agent instructions:** add an "Heavy commands run remotely" section to AGENTS.md: use `ops/remote_run.sh bun run test`, `… bun run build`,
   `… bunx playwright test …`, `… python -m uv run pytest -q` when `RUNNER_IP` is configured; fall back to local when it's unreachable. Browser
   tests that need the live dev API should run against a disposable API started on the runner (document `ops/remote_run.sh --with-api …`, which starts
   the API + scratch DB on the runner) and NEVER against the live demo.
4. Prove it: run the full web unit suite, a web build, one Playwright suite, and the API pytest suite remotely from a fresh worktree; report the wall
   times vs local and the local RAM used during the run.
Final report per AGENTS.md (commands, timings, how to add another runner, how to tear down).
