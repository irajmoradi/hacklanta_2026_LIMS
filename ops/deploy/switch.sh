#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]]
[[ ${WRITE_FREEZE_CONFIRMED:-} == yes && ${PROD_VERIFIED:-} == yes ]] || { echo 'Require WRITE_FREEZE_CONFIRMED=yes PROD_VERIFIED=yes after verify_prod.sh.' >&2; exit 1; }
exec 9>/run/lock/village-caddy-cutover.lock; flock 9
config=/etc/caddy/Caddyfile
backup=$(mktemp /etc/caddy/Caddyfile.before-prod-$(date -u +%Y%m%dT%H%M%SZ).XXXXXXXX)
cp -p "$config" "$backup"
candidate=$(mktemp /etc/caddy/Caddyfile.prod-candidate.XXXXXXXX)
trap 'rm -f -- "$candidate"' EXIT
python3 "$(dirname "$0")/caddy_switch.py" "$config" "$candidate"
caddy validate --config "$candidate" --adapter caddyfile
install -m 644 "$candidate" "$config"
if ! systemctl reload caddy; then
  install -m 644 "$backup" "$config"
  systemctl reload caddy
  echo "Reload failed; restored $backup" >&2; exit 1
fi
echo "Switched. Rollback backup: $backup"
