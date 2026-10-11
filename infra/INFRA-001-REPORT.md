# INFRA-001 final report

Branch: `infra/INFRA-001`. Initial implementation milestone: `3540192`; follow-up
commit contains validation fixes and this report (see branch HEAD). No push or merge.

## Delivered files

- `.dockerignore`: excludes secrets, local assets, dependencies and generated artifacts.
- `apps/{api,web,imessage}/Dockerfile`: frozen-lock builds, Python 3.12/uv API on 8010,
  Bun static build served by Caddy, Bun messaging runtime.
- `infra/compose.prod.yml`, `infra/Caddyfile`: persistent DB/assets/TLS state, HTTP or
  domain-based automatic HTTPS, API proxy, healthchecks and restart policies.
- `infra/imessage-entrypoint.sh`: explicit opt-in for provider connection/message processing.
- `infra/seed-assets.sh`: optional avatar import, non-root ownership, symlink rejection,
  Git Bash path handling.
- `infra/vultr/{README.md,cloud-init.yml}`: verified plan pricing, owner-run creation and
  destruction commands, Docker install/deploy template, private-repository prerequisites.
- `infra/validate.ps1`, `infra/test-assets/synthetic.txt`, `infra/.gitattributes`: repeatable
  isolated integration checks and LF shell files.
- `infra/INFRA-001-REPORT.md`: this record.

## Real verification results

All Docker tests used project `village-infra001-test`, loopback ports 18080/18443 and
throwaway volumes. No production/provider credentials were supplied to containers.

| Command | Exit/result |
|---|---|
| `docker compose -p village-infra001-test -f infra/compose.prod.yml config --quiet` (synthetic POSTGRES_PASSWORD and alternate ports exported) | 0 |
| `docker compose -p village-infra001-test -f infra/compose.prod.yml up -d --build --wait --wait-timeout 240` | 0; all four services healthy |
| `powershell -ExecutionPolicy Bypass -File infra/validate.ps1` | Final run 0; full build/up, HTTP health, GPU offline, SPA fallback, unauthenticated 401, Caddy HTTP/domain config, agent imports, empty/synthetic asset seed, five fixture villagers, restart persistence |
| `docker compose -p village-infra001-test -f infra/compose.prod.yml down -v --remove-orphans` (validator finally block) | 0; all test containers/network/volumes removed |
| `bash -n infra/seed-assets.sh` | 0 |
| `bash -n infra/imessage-entrypoint.sh` | 0 |
| `docker run --rm --mount "type=bind,source=$((Get-Location).Path)/infra,target=/infra,readonly" village-infra001-test-api uv run --no-project --with pyyaml python -c "import yaml,subprocess; c=yaml.safe_load(open('/infra/vultr/cloud-init.yml')); s=c['write_files'][1]['content']; subprocess.run(['bash','-n'],input=s,text=True,check=True); print('Cloud-init YAML and bootstrap shell syntax valid')"` | 0; YAML parse and embedded Bash syntax valid, no cloud execution |
| `git diff --check` | 0 |
| `docker volume ls --filter name=village-infra001-test --format '{{.Name}}'` | 0; empty after cleanup |
| `docker ps --format '{{.Names}} {{.Ports}}'` | 0; original village-db, website-app-1 and website-worker-1 remain running on original ports |

Two intermediate validator runs exited 1: PowerShell stripped quotes from inline Bun
code, then Git Bash rewrote Linux paths during asset copying. Both defects were fixed;
both failed runs still cleaned up successfully. The final complete run passed.
Vite reports its existing large Three.js bundle warning; builds succeed.

Authenticated Vultr requests were GET-only: `/v2/plans` and `/v2/os`. No cloud mutation,
paid model calls, real photos, or outbound messages. Keys were loaded at runtime from
the supplied external env file and never printed or copied into artifacts.

## Try it / deployment limits

Run `powershell -ExecutionPolicy Bypass -File infra/validate.ps1` from this checkout
with Docker Desktop running and no `infra/.env.prod`. It tests and removes its own stack.
For a persistent server, follow `infra/vultr/README.md`; use
`docker compose --env-file infra/.env.prod -f infra/compose.prod.yml up -d --build --wait`.

The owner must publish/provide the committed ref to the private repository, approve
instance creation, supply SSH/repository access and DNS, and fill runtime env values.
No public instance or HTTPS certificate was created; Caddy's TLS configuration was
validated locally, not ACME issuance. Cheapest returned >=2 GB CPU plan is vc2-1c-2gb,
$10/month, approximately $0.014881/hour and $0.54/36h before extras and rounding.

Public UI defaults to in-browser fixtures (`VITE_MOCK=1`), because the existing web client
has no Auth0 bearer-token flow and the contract forbids public `DEMO_AUTH=1`. Real API
and persistent DB are included and tested locally with demo auth restricted to loopback.
Frontend Auth0 integration remains an out-of-scope product blocker for a public live API UI.
Messaging is disabled until deliberately configured; its healthcheck proves process
liveness, not Photon readiness. No contract changes proposed.

Screenshot: not applicable; this task changes deployment infrastructure, not UI code.
