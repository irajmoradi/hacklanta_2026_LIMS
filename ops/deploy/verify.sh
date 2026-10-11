#!/usr/bin/env bash
set -euo pipefail
systemctl is-active village-web caddy
systemd-analyze verify /etc/systemd/system/village-api.service /etc/systemd/system/village-web.service
python3 - <<'PY'
from pathlib import Path
original = Path('/etc/caddy/Caddyfile.pre-village-stage').read_bytes()
current = Path('/etc/caddy/Caddyfile').read_bytes()
assert current == original + b'\nimport /etc/caddy/village-stage.Caddyfile\n'
assert b'reverse_proxy 127.0.0.1:8080' in original
print('Original live Caddy block byte-for-byte preserved; one staging import')
PY
ss -ltnp '( sport = :8080 or sport = :8081 or sport = :55432 )'
docker exec -i village-stage-db psql -U postgres -d village_stage -v ON_ERROR_STOP=1 <<'SQL'
SHOW server_version;
SELECT extversion FROM pg_extension WHERE extname='timescaledb';
SELECT count(*) AS migrations FROM api_migrations;
SELECT count(*) AS villages FROM villages;
SELECT count(*) AS users FROM users;
SQL
docker image inspect timescale/timescaledb:latest-pg17 --format '{{index .RepoDigests 0}}'
readlink /opt/village/current
for tool in /var/lib/village/tools/bun/bin/bun /var/lib/village/tools/uv/uv /var/lib/village/tools/node/bin/node; do
  "$tool" --version
done
curl --fail --silent --output /dev/null --write-out 'stage HTTP %{http_code}\n' https://stage.207-246-81-187.sslip.io/
curl --fail --silent --output /dev/null --write-out 'live HTTP %{http_code}\n' https://207-246-81-187.sslip.io/
if [[ ! -f /etc/village/env ]]; then
  echo 'API BLOCKED: /etc/village/env absent (not created by deployment).'
  if curl --fail --silent --output /dev/null --write-out 'stage API HTTP %{http_code}\n' https://stage.207-246-81-187.sslip.io/api/health; then
    echo 'Unexpected API response without env' >&2
    exit 1
  fi
  exit 3
fi
systemctl is-active village-api
curl --fail --silent https://stage.207-246-81-187.sslip.io/api/health
