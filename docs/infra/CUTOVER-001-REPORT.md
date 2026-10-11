# CUTOVER-001 preparation report

Branch: `infra/CUTOVER-001`. Prepared VM release:
`b0e7604eb3b5b0d1b4e4b19f4b9bda9a1af73fdd` (implementation milestone).
Earlier incremental commits: `1694315`, `c0528f8`, `96c3485`, `2343345`, `689372c`.
Final documentation/audit commit is recorded in branch history and the task reply.

The production stack is prepared on `207.246.81.187`. The integrator-only secrets,
live data/assets copy and public traffic switch have deliberately not been performed.
The exact ordered commands, write-freeze procedure and rollback are in
[ops/deploy/cutover.md](../../ops/deploy/cutover.md).

## Verified VM state

| Component | State |
|---|---|
| `village-prod-web` | Enabled/active; static authenticated production build at loopback 8082 |
| `village-prod-api` | Installed, disabled/inactive; loopback 8012 when started |
| `village-prod-imessage` | Installed, disabled/inactive; send flag comes from integrator env |
| `village-prod-bridge` | CPU-only unit installed, disabled/inactive; Modal integration acceptance pending |
| `village-prod-db` | Running, persistent volume, bound only to 127.0.0.1:55433 |
| Database | `village_prod`, zero public application tables; TimescaleDB and pgcrypto installed |
| Versions | PostgreSQL 17.11, TimescaleDB 2.30.2, pgcrypto 1.3, plpgsql 1.0; exact source image digest pinned |
| Credentials | DB-only password generated on VM, root-owned 0600; never printed; `/etc/village/prod.env` absent |
| Assets | Empty production directory; temporary rehearsal assets removed |
| Existing services | Public Caddy and staging web still active; 8080/8090 tunnels and staging 8081 still listening |

Live `/etc/caddy/Caddyfile` SHA-256 before/after candidate validation:
`6f650638299ffac6bcdf77cd8e9fec93aa4b8028fd1ab3cf6d24da5e19ddccf6`.
Neither switch.sh nor rollback.sh was run against the live site. Candidate validation
used a temporary file and removed it without reload. Staging API was already inactive
at initial inspection and was not changed. No paid calls, messages, transactions,
real assets or live database dump were made.

## Tests and actual results

| Command | Result |
|---|---|
| `python ops/deploy/prod-deploy.py b0e7604` | Exit 0; front VM frozen Bun installs, `bun run build` (TypeScript + Vite), frozen Python dependency sync, iMessage install, private web HTTP 200 |
| From `apps/api`: `bash ../../ops/remote_run.sh python ../../ops/deploy/test_cutover.py` | Exit 0; 4 safety tests: preserve staging/remove both old upstreams, refuse ambiguous/changed/already-switched Caddy, shell syntax, names-only env example |
| `ssh -i ~/.ssh/village_vultr root@207.246.81.187 'python3 /opt/village/prod-current/ops/deploy/test_cutover.py'` | Exit 0; final lightweight rerun against the prepared release, 4 tests in 0.016 seconds |
| `python ops/deploy/rehearse.py` | Exit 0; local Docker fixture -> SSH -> VM scratch restore, ten matching table counts, two successful asset syncs, migrated scratch API behind real :8082 Caddy, HTTP/auth/asset/WebSocket proof, complete cleanup |
| VM `caddy validate --config <temporary-switch-candidate> --adapter caddyfile` | Exit 0; candidate includes the existing staging import and one live :8082 upstream |
| VM `caddy validate --config /opt/village/prod-current/ops/deploy/prod.Caddyfile --adapter caddyfile` | Exit 0 |
| VM `systemd-analyze verify /etc/systemd/system/village-prod-*.service` | Exit 0 |
| VM read-only final audit (hash, states, table count, scratch DB count, socket listeners, HTTP GET) | Exit 0; public table count 0, VM/local scratch DB counts 0, prod.env absent, all consumers inactive |
| SSH stdin execution of `ops/deploy/audit_prepared.sh`, with `/opt/village/prod-current/ops/deploy` as its argument | Exit 0; repeatable audit helper and candidate validation |
| `git diff --check` | Exit 0 |

Rehearsal database: `village_rehearsal_1791678372` on both sides, now dropped.
Dump/SSH/restore/analyze/count comparison: **3 seconds**, synthetic data only.
Nonzero rows: users 1, villages 1, village_members 1, check_ins 1, xp_ledger 1;
avatar_assets, avatar_jobs, goals, house_items and mayor_outbox each 0. Both source
and target counts matched. Fixture also included an activity-event hypertable row.
No source live rows were copied into scratch.

The verifier received HTTP 200 for health, authenticated scratch village and asset;
anonymous village returned 401. A genuine WebSocket connection upgraded through
8082, and empty authentication closed with code 1008. No house edit or presence
authentication was sent. Scratch API used demo auth with providers and scheduler
disabled. **Real Auth0 login/token checks remain integrator acceptance work**; the
production verifier requires a real existing-member token and also rejects demo
headers. GPU-offline operation succeeded in rehearsal.

Initial attempts failed and were fixed rather than counted as passes: readiness
before Postgres init completed (exit 2); production user unable to traverse staging
tool home (127); root-owned release directory retaining mktemp mode 0700 (7);
Timescale already present in template (1); Windows resolving WSL Bash instead of
Git Bash (127); Timescale job-owner role missing during restore (1). The latter is
handled by copying only role names as NOLOGIN/NOSUPERUSER compatibility roles with
target-owner membership, never credentials or a global role dump. Failed scratch
databases were removed. pg_dump's Timescale continuous_agg circular-FK warning was
observed; full custom-format restore subsequently passed. Vite large-chunk and
Caddy formatting warnings are nonfatal.

A duplicate shared-runner regression rerun queued behind another task's API lock
for 326 seconds. Only this worktree's waiting process was identified and terminated
(remote exit 143; wrapper exit 1), then the lightweight checks ran successfully on
the front VM as shown above. No teammate process or lock was stopped, and no failed
remote test was rerun locally.

## Changed files and teammate usage

All changes stay within `ops/deploy/**` and `docs/infra/**`:

- Preparation: `prod-deploy.py`, `prod-prepare.sh`, `prod-db.sh`, `prod.env.example`,
  `prod.Caddyfile`, four `village-prod-*.service` units.
- Migration/assets: `db_cutover.sh`, `db_remote.sh`, `row_counts.sql`, `sync_assets.sh`.
- Traffic operations: `caddy_switch.py`, `switch.sh`, `rollback.sh`.
- Verification/rehearsal: `verify_prod.sh`, `verify_prod.py`, `test_cutover.py`,
  `rehearse.py`, `rehearse_vm.py`, `rehearsal_fixture.sql`, `audit_prepared.sh`.
- Documentation: `cutover.md` and this report.

Teammate: read the runbook, optionally rerun `python ops/deploy/rehearse.py` while
production API is stopped, then perform the integrator steps in order. For a quick
prepared-web view, use SSH forwarding `-L 18082:127.0.0.1:8082` and open
`http://127.0.0.1:18082`; real login should be validated using the configured public
origin, not this arbitrary forwarded origin. Screenshot: N/A, no UI source changes;
verification concerns deployment and transport behavior.

## Remaining integration conditions and rollback

The root environment **has a separate `TIGER_DATABASE_URL`**. Its values were not
printed/copied. Preserve the hosted Tiger connection in production or explicitly
migrate/verify its house data; the local Docker dump does not contain that separate
database. Public Auth0 fields exist; confirm callback URLs and restored membership
mapping. The parallel Modal work must be integrated before enabling the bridge;
main's inspected README still documents unsupported stages. No contract changes
are proposed.

Reserve **15–30 minutes** for the production write freeze as a planning allowance,
not a measured guarantee. The 3-second fixture transfer is not a live-size estimate.
Build, secrets, Auth0 checks and optional initial asset copy happen before freeze.
Freeze all old writers; dump/restore and final sync; migrate; start private API;
verify; switch both live paths; verify public behavior; then resume exactly one set
of consumers. The runbook includes commands for each step.

Rollback before new writes: stop new consumers/API, set `WRITE_FREEZE_CONFIRMED=yes`,
run `rollback.sh` with the timestamped backup printed by switch.sh, restart original
writers and verify the preserved tunnels/public site. After new writes, first
reconcile/reverse-migrate changed DB rows and assets under a renewed freeze. Neither
rollback nor preparation destroys the original DB or tunnel configuration.
