#!/usr/bin/env bash
# Git Bash/Linux. Explicit mode prevents an accidental live dump during rehearsal.
set -euo pipefail
export MSYS_NO_PATHCONV=1
mode=${1:?Usage: db_cutover.sh rehearsal|production [scratch_source scratch_target]}
here=$(cd -- "$(dirname -- "$0")" && pwd)
host=${DEPLOY_HOST:-root@207.246.81.187}
key=${DEPLOY_KEY:-$HOME/.ssh/village_vultr}
ssh_cmd=(ssh -o BatchMode=yes -o ConnectTimeout=15 -i "$key" "$host")
remote=/opt/village/prod-current/ops/deploy/db_remote.sh
if [[ $mode == rehearsal ]]; then
  source_db=${2:?scratch source}; target_db=${3:?scratch target}
  [[ $source_db =~ ^village_rehearsal_[a-z0-9_]+$ && $target_db =~ ^village_rehearsal_[a-z0-9_]+$ ]]
elif [[ $mode == production ]]; then
  [[ ${WRITE_FREEZE_CONFIRMED:-} == yes ]] || { echo 'Stop all old writers and set WRITE_FREEZE_CONFIRMED=yes first.' >&2; exit 1; }
  source_db=$(docker exec village-db sh -c 'printf "%s" "$POSTGRES_DB"')
  target_db=village_prod
else exit 2; fi
[[ $source_db =~ ^[a-zA-Z0-9_]+$ ]]
local_sql() { docker exec -i village-db sh -c 'exec psql -X -v ON_ERROR_STOP=1 -At -U "$POSTGRES_USER" -d "$1"' _ "$source_db"; }
versions='SHOW server_version; SELECT extname,extversion FROM pg_extension ORDER BY extname;'
left=$(printf '%s\n' "$versions" | local_sql)
right=$("${ssh_cmd[@]}" "bash $remote versions $target_db")
[[ $left == "$right" ]] || { echo 'Version mismatch; do not migrate.' >&2; printf '%s\n%s\n' "$left" "$right" >&2; exit 1; }
# Timescale stores job owners as regrole DATA; --no-owner cannot rewrite it.
# Copy names only as NOLOGIN roles, never source passwords or global role dumps.
roles=$(printf '%s\n' 'SELECT DISTINCT owner::text FROM _timescaledb_config.bgw_job ORDER BY 1;' | local_sql)
while IFS= read -r role; do
  [[ -z $role ]] && continue
  [[ $role =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ && $role != pg_* ]]
  "${ssh_cmd[@]}" "bash $remote role $target_db $role"
done <<< "$roles"
before=$(local_sql < "$here/row_counts.sql")
started=$SECONDS
docker exec village-db sh -c 'exec pg_dump -Fc --no-owner --no-acl -U "$POSTGRES_USER" -d "$1"' _ "$source_db" \
  | "${ssh_cmd[@]}" "bash $remote restore $target_db"
after=$("${ssh_cmd[@]}" "bash $remote counts $target_db")
source_after=$(local_sql < "$here/row_counts.sql")
printf 'SOURCE %s\n%s\nTARGET %s\n%s\n' "$source_db" "$source_after" "$target_db" "$after"
[[ $before == "$source_after" && $before == "$after" ]] || { echo 'Counts changed or differ; stop cutover.' >&2; exit 1; }
echo "Verified key-table counts; dump/transfer/restore/counts took $((SECONDS-started)) seconds."
