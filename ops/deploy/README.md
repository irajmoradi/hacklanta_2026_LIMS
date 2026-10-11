# Stage Village without cutover

Run from the worktree root with Python 3 and SSH (the existing host key must
already be trusted): `python ops/deploy/deploy.py COMMIT`. Only a committed Git
archive crosses SSH. No local `.env`, credentials, generated private assets,
dependencies, or working tree edits are uploaded. Build and dependency installs
run on the front VM, never on the owner's PC. Deployment is serialized by flock.
The root env referenced by `VILLAGE_ENV_FILE` is deliberately unnecessary here:
the task prohibits copying its secrets to the VM.

Target: root@207.246.81.187, key `~/.ssh/village_vultr`. Source releases live at
`/opt/village/releases/COMMIT`; `/opt/village/current` is an atomic symlink.
Bun 1.3.11, uv, Ubuntu Python 3.12, ffmpeg, Node 22/npm, Docker are installed.
Node's official archive checksum is verified; the first installed Node 22 and uv
are retained on repeat runs, and their exact versions are recorded in verification.
The system Caddy installation is retained. Re-running preserves scratch data,
replays only pending migrations and uses the additive fixture seed.
The Timescale image uses the repository runner's `latest-pg17` convention; an
existing container is retained, not upgraded by redeploy. Record its image digest
in verification for reproducibility. This is scratch infrastructure, not a
production database: loopback-only 55432 uses passwordless trust for local users.

`village-web` runs a separate unprivileged Caddy on 127.0.0.1:8081 and proxies
`/api/*` to 127.0.0.1:8011. The system Caddy adds one staging import; the live
207-246-81-187.sslip.io block and its 8080 reverse tunnel remain untouched.
The browser build deliberately sets `VITE_MOCK=1`, `VITE_DEMO_AUTH=1` so
verification cannot generate paid content or depend on GPU availability.

## Integrator-owned API prerequisite

The deployer does **not** create, copy, print, chmod, or populate
`/etc/village/env`. The integrator must supply a root-owned mode 0600 env file.
`env.example` is an inventory of names only, not a dotenv template to source.
Only `DATABASE_URL` is mandatory; demo access also needs `DEMO_AUTH=1`.
Staging `DATABASE_URL` must be
`postgresql://postgres@127.0.0.1:55432/village_stage`.
No live/Tiger URL is accepted by the staging API launcher. Provider/auth/GPU
variables are optional. `GPU_WORKER_URL` is passed through from the file.
`GPU_FALLBACK_URL` is listed for the integrator but the current API does not
implement it (API-owner follow-up required). Do not put real people/media in staging.

systemd loads that sole env file as root; the unprivileged process prevents a
second dotenv read and disables the scheduler, voice, debug mutations, LLM
budget, and provider credentials. ASSET_DIR is fixed at `/var/lib/village/assets`
for service sandboxing. No secrets are in unit files or deployment arguments.
Missing env is reported as **API BLOCKED**, not a healthy full-stack deployment.
Exit code 3 means web/database staging finished but the API env prerequisite is
missing; exit 0 additionally requires local API health. Other failures propagate.
After the integrator supplies it, rerun deployment, then:

```bash
systemctl is-active village-api village-web
curl --fail https://stage.207-246-81-187.sslip.io/api/health
curl --fail -H 'X-Demo-User: 13370000-0000-4000-8000-000000000001' \
  https://stage.207-246-81-187.sslip.io/api/villages/13370000-0000-4000-8000-000000000000
```

From `apps/web`, run browser verification on the configured runner:

```bash
../../ops/remote_run.sh bun test ../../ops/deploy/stage-smoke.test.ts
```

This uses real Playwright Chromium through Bun's test runner. It only opens the
external staging site and needs no fixed local ports or DB, so the wrapper's
independent Bun-test lane is safe. For the serialized Playwright CLI equivalent:
`../../ops/remote_run.sh bunx playwright test --config ../../ops/deploy/playwright.config.mjs`.

Screenshot: `docs/infra/screenshots/deploy-stage.png`. This smoke asserts no
browser mutations and tests the mock web build; it does not claim API connectivity.
Keep the deployment output and report HTTP/API status separately.

## iMessage (documentation only)

Keep `apps/imessage` on its existing Photon-connected Mac/provider host. Do not
start a second sender or move provider credentials to the web VM. After approved
cutover, the integrator sets `VILLAGE_API_URL=https://207-246-81-187.sslip.io/api`
and the matching SERVICE_KEY using
the agent's existing env configuration, then performs one explicitly authorized
test. Avoid two consumers claiming the same outbox. No messages are sent here.
