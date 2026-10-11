#!/usr/bin/env bash
# Read-only final audit, plus a temporary Caddy candidate that is never installed.
set -euo pipefail
[[ $EUID == 0 ]]
here=${1:-$(cd -- "$(dirname -- "$0")" && pwd)}
before=$(sha256sum /etc/caddy/Caddyfile)
candidate=$(mktemp /etc/caddy/Caddyfile.dry-cutover.XXXXXXXX)
trap 'rm -f -- "$candidate"' EXIT
python3 "$here/caddy_switch.py" /etc/caddy/Caddyfile "$candidate"
caddy validate --config "$candidate" --adapter caddyfile
caddy validate --config "$here/prod.Caddyfile" --adapter caddyfile
systemd-analyze verify /etc/systemd/system/village-prod-*.service
[[ "$before" == "$(sha256sum /etc/caddy/Caddyfile)" ]]
printf '%s\n' "$before"
systemctl is-active village-prod-web village-web caddy
for unit in village-prod-api village-prod-imessage village-prod-bridge; do
  [[ $(systemctl is-enabled "$unit") == disabled ]]
  [[ $(systemctl is-active "$unit") == inactive ]]
done
test ! -e /etc/village/prod.env
sql="SELECT count(*) FROM pg_tables WHERE schemaname='public'; SELECT count(*) FROM pg_database WHERE datname LIKE 'village_rehearsal_%';"
counts=$(docker exec village-prod-db psql -X -At -U village_prod -d village_prod -c "$sql")
[[ $counts == $'0\n0' ]]
docker inspect -f '{{json .HostConfig.PortBindings}}' village-prod-db
curl -fsS -o /dev/null http://127.0.0.1:8082/
ss -lnt '( sport = :8080 or sport = :8090 or sport = :8081 or sport = :8082 or sport = :8012 or sport = :55433 )'
echo 'PASS: Caddy candidate, units, empty production DB, absent prod.env, no scratch DBs, stopped consumers'
