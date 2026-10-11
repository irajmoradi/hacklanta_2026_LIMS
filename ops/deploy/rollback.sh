#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]]
[[ ${WRITE_FREEZE_CONFIRMED:-} == yes ]] || { echo 'Freeze writers; reconcile any post-cutover writes before rollback.' >&2; exit 1; }
backup=${1:?timestamped backup printed by switch.sh}
[[ $backup == /etc/caddy/Caddyfile.before-prod-* && -f $backup && ! -L $backup ]]
exec 9>/run/lock/village-caddy-cutover.lock; flock 9
caddy validate --config "$backup" --adapter caddyfile
current=$(mktemp /etc/caddy/Caddyfile.before-rollback.XXXXXXXX)
cp -p /etc/caddy/Caddyfile "$current"
install -m 644 "$backup" /etc/caddy/Caddyfile
if ! systemctl reload caddy; then
  install -m 644 "$current" /etc/caddy/Caddyfile
  systemctl reload caddy
  exit 1
fi
echo 'Old tunnel routing restored. Verify it before resuming old writers.'
