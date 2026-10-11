# Production updates and CUTOVER-001 integrator runbook

Production is now serving on the front VM. For routine updates, use the
[DEPLOY-002 procedure](../../docs/infra/PRODUCTION-DEPLOYS.md):

```bash
export VILLAGE_ENV_FILE=/c/Users/mourn/Downloads/hacklanta/.env
python ops/deploy/prod-deploy.py <integrated-commit-sha>
```

Do not stop the API, bridge or iMessage before building. The command builds a new
SHA directory while current keeps serving, runs migrations through systemd's
protected environment, atomically swaps `prod-current`, and restarts API/bridge/web.
It checks HTTP/DB health and the house WebSocket through :8082, rolls code back on
failure, retains three releases, and prints timing. Stop limits bound stuck sockets.
It does not change Caddy. Migrations must support both old and new code; code
rollback does not undo database changes. The integrator runs the first real update.

## Original one-time cutover (historical; do not repeat for updates)

The remaining sections document the original preparation and data migration.
Statements about production not yet serving describe that historical state.
The current updater requires an existing production symlink and protected env;
it no longer provisions a first installation.

Preparation is complete; live traffic has NOT been switched. Only the integrator
supplies `/etc/village/prod.env` and copies real data/assets. No secrets, real
assets, production dump, paid generation or messages were used in rehearsal.
Run local commands from this worktree in Git Bash unless marked PowerShell;
VM commands run as root over `ssh -i ~/.ssh/village_vultr root@207.246.81.187`.

## Prepared layout

- API: `village-prod-api`, user `village-prod`, loopback 8012.
- Web: `village-prod-web`, same unprivileged user, loopback 8082; Caddy proxies
  all `/api/*`, including WebSockets, to 8012 and serves the production build.
- iMessage / CPU Modal bridge: `village-prod-imessage`, `village-prod-bridge`;
  installed but disabled and stopped. API is also initially disabled/stopped.
- Committed releases: `/opt/village/prod-releases/<sha>`, symlink
  `/opt/village/prod-current`; separate tools at `/opt/village/prod-tools`.
- DB: `village-prod-db`, loopback 55433, Docker volume `village-prod-db`, database
  and role `village_prod`. PostgreSQL 17.11, TimescaleDB 2.30.2, pgcrypto 1.3,
  plpgsql 1.0. Image digest is pinned in `prod-db.sh` to match source `village-db`.
  Empty means no application tables; extensions are already installed.
- DB password: VM-generated `/etc/village/prod-db/password`, root:root 0600.
  Never print it or run Docker inspect without selecting only nonsecret fields.
- Assets: `/var/lib/village-prod/assets`, owned by `village-prod`.
- Existing public Caddy, staging, :8080 and :8090 tunnels remain untouched.

## Ordered cutover

1. **Before the freeze**, confirm this release contains the integrated app changes
   intended for launch. Do not assume this worker branch includes the parallel
   Modal agent's changes. Original preparation used the CUTOVER-001 version of
   `prod-deploy.py` with API/consumers stopped. That provisioning workflow is now
   superseded for routine updates by DEPLOY-002 above.

   The uploader reads only three public Auth0 build settings from that existing
   env at runtime and transfers committed source. No root env is transferred.
   The current DEPLOY-002 updater builds with `VITE_MOCK=0`, `VITE_DEMO_AUTH=0`
   and performs the complete API/bridge/web activation.
   Confirm Auth0 callback, logout and allowed-origin settings for
   `https://207-246-81-187.sslip.io`. An existing Auth0 user must have membership
   in the restored village; demo identities do not automatically become Auth0 users.

2. **Integrator-only secrets step on VM.** Create `/etc/village/prod.env` using
   the existing secret-management channel/editor. `prod.env.example` lists names
   with no values. Do not blindly fill every name with an empty value: omit unused
   optional variables so application defaults work. Require root:root 0600.

   Use these nonsecret settings:

   ```text
   ASSET_DIR=/var/lib/village-prod/assets
   VILLAGE_ENV_FILE=/dev/null
   VILLAGE_API_URL=http://127.0.0.1:8012/api
   DEMO_AUTH=0
   DEMO_DEBUG=0
   MAYOR_SCHEDULER=0
   MAYOR_VOICE=0
   LLM_MAX_CALLS_PER_HOUR=0
   PHOTON_SEND_ENABLED=false
   GPU_PREFER=modal
   GPU_WORKER_URL=http://127.0.0.1:1/health
   GPU_WORKER_BASE=http://127.0.0.1:1
   ```

   Set `AUTH0_DOMAIN` / `AUTH0_AUDIENCE` to match the frontend. Supply `SERVICE_KEY`,
   Photon `PROJECT_ID` / `PROJECT_SECRET`, and the intended provider credentials.
   Supply `GPU_FALLBACK_URL` / `GPU_FALLBACK_KEY` from the Modal integrator; leave
   bridge stopped until Modal-only support is accepted. Main's inspected Modal
   README still lacks head bake, body/Hunyuan3D, and object-from-photo support.
   The bridge imports no GPU models and uses the API Python environment.

   `DATABASE_URL` must use `village_prod` at `127.0.0.1:55433/village_prod`, with
   the password from the root-only password file. The integrator can assemble this
   in memory without printing a credential after securely populating other values:

   ```bash
   python3 - <<'PY'
   from pathlib import Path
   import os
   p = Path('/etc/village/prod.env')
   assert p.is_file() and not p.is_symlink()
   lines = [s for s in p.read_text().splitlines() if not s.startswith('DATABASE_URL=')]
   password = Path('/etc/village/prod-db/password').read_text().strip()
   os.chmod(p, 0o600)
   p.write_text('\n'.join(lines) + '\nDATABASE_URL=postgresql://village_prod:' + password + '@127.0.0.1:55433/village_prod\n')
   os.chown(p, 0, 0)
   PY
   test "$(stat -c '%a:%U' /etc/village/prod.env)" = 600:root
   ```

   **The existing environment DOES configure `TIGER_DATABASE_URL`.** Preserve that
   separately hosted cloud connection in the integrator-supplied env if retaining
   Tiger for house state. This Docker dump does NOT copy the separate Tiger DB.
   Only omit/empty this variable after explicitly migrating and verifying that
   house data in the VM DB. Do not leave a pointer to the home PC in production
   config, and do not silently switch house state to an empty local copy.

3. **Rehearsal before live copy:** while production API remains stopped:

   ```bash
   python ops/deploy/rehearse.py
   ```

   Creates unique `village_rehearsal_*` databases, applies the contract schema and
   synthetic fixture, dumps local Docker to SSH, restores on VM, compares ten table
   counts, syncs a tiny asset twice, temporarily runs a scratch API behind :8082,
   verifies HTTP/auth/asset/WebSocket behavior, stops it and drops both scratch DBs.
   It never copies live rows or assets. Timescale restore uses pre/post_restore,
   without parallel pg_restore, following the
   [official logical-backup procedure](https://www.tigerdata.com/docs/deploy/self-hosted/backup-and-restore/logical-backup).

4. **Optional pre-copy, integrator only:** before freeze, copy the real asset tree
   to reduce final downtime. This is non-deleting and preserves relative paths.

   ```bash
   bash ops/deploy/sync_assets.sh /c/Users/mourn/Downloads/hacklanta/data/assets
   ```

5. **Start the write freeze.** Stop the OLD iMessage process and its supervisor
   using its actual launcher (not managed by this task). Stop old GPU/bridge from
   the main checkout with `bash ops/run_gpu.sh stop`. Stop the old API gracefully
   in its owning terminal (Ctrl+C), which also stops its Mayor scheduler and waits
   for in-flight work. Disable any launcher that would restart these processes.
   Preserve the Vite web process and SSH tunnels for rollback. Verify port 8010 is
   no longer listening; in PowerShell:

   ```powershell
   if (Get-NetTCPConnection -LocalPort 8010 -State Listen -ErrorAction SilentlyContinue) {
     throw 'Old API still listening; do not dump'
   }
   ```

   Also pause any independent API instances, job runners and external callbacks
   that share the source database. There is no universal process-manager stop
   command in this repository for iMessage or external launchers. Do not substitute
   a broad kill of all Python/Bun processes. Confirm no old writer can restart
   before setting the freeze acknowledgment below.

6. **Copy DB then final asset delta from local Git Bash:**

   ```bash
   export WRITE_FREEZE_CONFIRMED=yes
   bash ops/deploy/db_cutover.sh production
   bash ops/deploy/sync_assets.sh /c/Users/mourn/Downloads/hacklanta/data/assets
   ```

   The script uses the source container's own env, verifies identical server and
   extension versions, refuses nonempty targets, streams `pg_dump -Fc` over SSH,
   restores with Timescale hooks, analyzes, and prints/compares source/target counts.
   Timescale job-owner names are created as NOLOGIN/NOSUPERUSER compatibility roles
   inheriting the target owner role; no source role passwords are transferred.
   Stop on any nonzero exit. Restore diagnostics, if any, stay in a root-only VM
   file; never publish them. Failed/partial restores require integrator recovery
   of the target; the script deliberately has no automatic overwrite/drop mode.
   The temporary dump is removed on completion/failure; the original DB is retained.
   Take any required retained backup through the existing secure backup system.

7. **Migrate, start private API, verify on VM:**

   ```bash
   systemd-run --unit=village-prod-migrate --wait --pipe --collect \
     -p User=village-prod -p Group=village-prod \
     -p WorkingDirectory=/opt/village/prod-current/apps/api \
     -p EnvironmentFile=/etc/village/prod.env -p Environment=VILLAGE_ENV_FILE=/dev/null \
     /opt/village/prod-current/apps/api/.venv/bin/python scripts/migrate.py
   systemctl start village-prod-api
   curl --fail http://127.0.0.1:8082/api/health
   read -rs -p 'Existing member Auth0 access token: ' VERIFY_BEARER_TOKEN; echo
   export VERIFY_BEARER_TOKEN
   bash /opt/village/prod-current/ops/deploy/verify_prod.sh \
     --village <restored-village-uuid> --house <existing-member-uuid> \
     --asset /api/assets/<existing-accessible-asset-key>
   unset VERIFY_BEARER_TOKEN
   ```

   Never seed production. Verification requires an actual member token and existing
   asset. It checks anonymous and demo-header rejection, an authenticated village
   GET, asset bytes, WebSocket 101 and anonymous rejection. It sends no WebSocket
   edit/presence auth; authenticated HTTP invokes the app's ordinary user upsert.
   GPU health may say down: Modal-only readiness is separate. Verify recent
   check-ins, XP, memberships and required generated assets before proceeding.

8. **Switch only after successful checks, on VM:**

   ```bash
   export WRITE_FREEZE_CONFIRMED=yes PROD_VERIFIED=yes
   bash /opt/village/prod-current/ops/deploy/switch.sh
   curl --fail https://207-246-81-187.sslip.io/api/health
   ```

   Record the timestamped backup path printed by switch.sh. It replaces BOTH old
   live upstreams (:8080 and :8090) with :8082, retains staging outside the live
   block, validates and reloads Caddy. It refuses unexpected/ambiguous layouts and
   restores the backup automatically if reload fails. Verify public Auth0 login,
   village, assets and house WebSocket in browser before reopening writes.

9. **End freeze / enable intended background behavior.** Keep all old writers
   stopped. Enable API at boot with `systemctl enable village-prod-api`. Enable
   exactly one consumer only after validating Photon configuration/delivery policy:
   `systemctl enable --now village-prod-imessage`. `PHOTON_SEND_ENABLED=true` is
   required for sends; leave false unless intentionally enabling them. Starting
   this unit can process inbound messages even with sending disabled. Enable
   bridge with `systemctl enable --now village-prod-bridge` only after the Modal
   agent's integrated feature set is accepted. Scheduler/provider limits require
   the owner's chosen values and API restart. Do not enable paid background loops
   merely as a deployment test. Leave old DB/tunnels intact until acceptance.

## Freeze duration and rollback

Reserve a **15?30 minute maintenance window** as a planning allowance, not a measured
production transfer time. Freeze lasts from stopping every old writer through dump,
SSH transfer, restore/analyze, final asset delta, migrations, authenticated checks
and public switch. Scratch timing is recorded in CUTOVER-001-REPORT.md; real volume,
bandwidth and manual auth checks determine the actual duration. Pre-copying assets
and completing secrets/build/Auth0 setup beforehand reduce the freeze.

Before any new user writes, stop new writers and restore the recorded Caddy backup:

```bash
systemctl stop village-prod-imessage village-prod-bridge village-prod-api
export WRITE_FREEZE_CONFIRMED=yes
bash /opt/village/prod-current/ops/deploy/rollback.sh /etc/caddy/Caddyfile.before-prod-<recorded-suffix>
```

Restart the old API using its original command/env (avoid `ops/run_api.sh` if its
migration/seed steps are unwanted), then old consumers and bridge using their
original launchers. Confirm `curl --fail http://127.0.0.1:8080/api/health` on VM and
public HTTPS health/login/WebSocket before releasing the freeze. Rollback script
validates the backup, restores it and reloads; reload failure restores the current
configuration. It never changes DB or assets. **After new writes have occurred**,
freeze both sides and reconcile/reverse-migrate new rows and assets first; switching
back alone loses progress. Never drop the original database as part of cutover.
