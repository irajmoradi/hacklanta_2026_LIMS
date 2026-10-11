# One-box Village deployment (owner-run only)

No cloud resource was created or modified for INFRA-001. Run the creation and deletion
commands below only after the owner approves them. GPU workers are intentionally absent.

## Plan and price

Authenticated read-only `GET https://api.vultr.com/v2/plans` on 2026-10-10 returned:

| Plan | CPU | RAM | Disk | Monthly | Hourly estimate | 36 hours |
|---|---:|---:|---:|---:|---:|---:|
| **vc2-1c-2gb** | 1 | 2 GB | 55 GB | $10 | $0.014881 | $0.54 |
| vhp-1c-2gb-intel | 1 | 2 GB | 50 GB | $12 | $0.017857 | $0.65 |
| vc2-2c-2gb | 2 | 2 GB | 65 GB | $15 | $0.022321 | $0.81 |

Choose vc2-1c-2gb: cheapest returned CPU plan with at least 2 GB RAM. Smaller plans
leave too little build/runtime headroom for Postgres, Python, Bun and Caddy. Cloud-init
adds 2 GB swap and builds serially; this is a small judge demo, not load-tested capacity.
Hourly estimates are monthly/672; allow rounding, tax, extra bandwidth and optional services.
The [Vultr billing policy](https://docs.vultr.com/support/platform/billing/how-am-i-billed-for-my-servers)
bills stopped instances too; destroy to end compute charges.

Recheck prices and Atlanta capacity with runtime-only credentials (Bash, trusted owner env):

```sh
set -a
. "${VILLAGE_ENV_FILE:-/c/Users/mourn/Downloads/hacklanta/.env}"
set +a
curl -fsS -H "Authorization: Bearer $VULTR_API_KEY" https://api.vultr.com/v2/plans \
  | jq '.plans[] | select(.id == "vc2-1c-2gb")'
curl -fsS -H "Authorization: Bearer $VULTR_API_KEY" https://api.vultr.com/v2/regions/atl/availability
curl -fsS -H "Authorization: Bearer $VULTR_API_KEY" https://api.vultr.com/v2/os \
  | jq '.os[] | select(.name == "Ubuntu 24.04 LTS x64")'
```

Ubuntu 24.04 x64 was OS ID **2284** at verification. Do not export provider secrets to
web build arguments. Never paste the Vultr API key into cloud-init or the instance.

## Prepare and create

1. Make the committed deployment branch available to the server. This checkout's origin
   `https://github.com/irajmoradi/hack_private.git` is private. Supply a read-only deploy key
   with pinned GitHub known-hosts in an owner-only cloud-init copy, or use an accessible
   deployment mirror. Do not embed credentials in the clone URL. This worker did not push.
2. Copy `cloud-init.yml` outside the repository. Replace repository URL/ref, domain and
   password placeholders. Generate hex passwords with `openssl rand -hex 32` (avoids
   connection-string/shell interpolation characters). Paste optional runtime keys into
   its env block only if needed. Treat the completed user-data file as a secret.
3. Pick an existing Vultr SSH key ID. Make an A record for your domain point to the new
   instance IP after creation; remove stale AAAA records. TCP 80/443 must reach Caddy.
   Leave DOMAIN empty for HTTP only. TLS certificates and renewals persist in Caddy's volume.
4. Owner-approved creation only (shown, **not executed**):

```sh
export SSH_KEY_ID='YOUR_EXISTING_VULTR_SSH_KEY_ID'
export CLOUD_INIT='/absolute/private/path/village-cloud-init.yml'
jq -n --arg key "$SSH_KEY_ID" --arg data "$(base64 < "$CLOUD_INIT" | tr -d '\n')" \
  '{region:"atl",plan:"vc2-1c-2gb",os_id:2284,label:"village-judges",
    sshkey_id:[$key],backups:"disabled",user_data:$data}' \
  | curl -fsS -X POST https://api.vultr.com/v2/instances \
      -H "Authorization: Bearer $VULTR_API_KEY" -H 'Content-Type: application/json' --data-binary @-
```

Record the returned instance ID/IP privately. The [Vultr cloud-init guide](https://docs.vultr.com/how-to-deploy-a-vultr-server-with-cloudinit-userdata/)
documents base64 user-data. SSH in and run `cloud-init status --wait`, then:

```sh
cd /opt/village
docker compose --env-file infra/.env.prod -f infra/compose.prod.yml ps
curl -fsS https://YOUR_DOMAIN/api/health
```

Expect `ok:true`, `db:up`, `gpu_worker:down`. Visit `https://YOUR_DOMAIN`.
API and DB ports are internal only. All services restart unless explicitly stopped.
Cloud-init installs Docker from Docker's Ubuntu repository and initializes the database
through the existing migration and additive fixture seed scripts. Persistent volumes survive
ordinary `down`/`up`. Schema changes require the integrator's migration review.

## Demo modes and runtime configuration

Public defaults: `VITE_MOCK=1`, `DEMO_AUTH=0`, `IMESSAGE_ENABLED=0`. The current web client
only sends X-Demo-User and has no Auth0 login/token flow. Thus the public judge UI uses its
fully interactive in-browser fixtures; changes reset on refresh and are not stored in DB.
The API remains real and its health route is proxied. A public authenticated end-to-end UI
needs a frontend Auth0 integration outside this task's allowed paths. Do not enable demo
authentication on a public instance; the contract explicitly forbids it.

For isolated local end-to-end tests, set `DEMO_AUTH=1` and build with `VITE_MOCK=0`.
`VITE_MOCK` is a build-time setting, requiring `up --build` after changes.

`infra/.env.prod` is read as the containers' runtime env. Always pass
`--env-file infra/.env.prod` too, so Compose interpolates passwords/domain/ports/build flags.
The file is optional when those variables come from the process environment (local tests).
Do not run plain `config` with real secrets in captured logs; use `config --quiet`.
Use `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `SERVICE_KEY`, `GOOGLE_API_KEY`,
`GOOGLE_GENAI_USE_VERTEXAI`, and `ELEVENLABS_API_KEY` as needed. Keep paid keys absent
for the fixture demo. No generation is triggered by infrastructure startup.

To activate real messaging intentionally, set `IMESSAGE_ENABLED=1`, `PROJECT_ID`,
`PROJECT_SECRET`, and the same `SERVICE_KEY` for API/agent in `.env.prod`, then recreate
imessage. It will process inbound messages and drain the outbox. Health is process
liveness only because the existing app has no provider-readiness endpoint. Local validation
keeps it disabled, never connects to Photon, and sends no messages.

Generated assets are optional. Review `data/assets/avatars/` before importing; only
owner-approved assets belong there. With Compose environment loaded, run:

```sh
set -a; . infra/.env.prod; set +a
sh infra/seed-assets.sh
```

The script copies into the API's asset volume as its non-root user, preserves existing
unrelated files, rejects symlinks, and succeeds when assets are absent. It does not change
database manifests; use the existing avatar workflow for manifest updates. Assets are
served through the authorized API, not a public Caddy directory.

## Local validation and teardown

Run `powershell -ExecutionPolicy Bypass -File infra/validate.ps1` on Docker Desktop.
It uses project `village-infra001-test`, ports 18080/18443 on loopback, synthetic credentials,
and disposable volumes. It tears down with `down -v` even on failure. It does not touch
village-db, website-app-1, website-worker-1 or ports 5433/8000/8010/4173/5173.

For production, export any needed DB/assets before destroying. `down -v` destroys volumes;
ordinary `down` preserves them. Owner-approved cloud deletion only (not executed here):

```sh
export INSTANCE_ID='EXACT_INSTANCE_ID_FROM_CREATE'
curl -fsS -X DELETE "https://api.vultr.com/v2/instances/$INSTANCE_ID" \
  -H "Authorization: Bearer $VULTR_API_KEY"
curl -fsS -H "Authorization: Bearer $VULTR_API_KEY" https://api.vultr.com/v2/instances
```

Confirm absence, remove DNS records and revoke the deployment key. Review any separately
created snapshots/backups/IPs; deleting an instance does not necessarily delete those.
