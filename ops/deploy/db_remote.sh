#!/usr/bin/env bash
# Internal SSH endpoint: reads a custom-format dump on stdin for restore.
set -euo pipefail
action=${1:?action}; db=${2:?database}
[[ $db == village_prod || $db =~ ^village_rehearsal_[a-z0-9_]+$ ]]
[[ $(docker inspect -f '{{index .Config.Labels "village.purpose"}}' village-prod-db) == production ]]
psql_db() { docker exec village-prod-db psql -X -v ON_ERROR_STOP=1 -At -U village_prod -d "$db" "$@"; }
case $action in
  role)
    role=${3:?source Timescale job owner}
    [[ $role =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ && $role != pg_* ]]
    if [[ $role != village_prod ]]; then
      if [[ $(psql_db -c "SELECT count(*) FROM pg_roles WHERE rolname='$role'") == 0 ]]; then
        psql_db -c "CREATE ROLE \"$role\" NOLOGIN NOSUPERUSER;" >/dev/null
      fi
      [[ $(psql_db -c "SELECT rolcanlogin OR rolsuper FROM pg_roles WHERE rolname='$role'") == f ]] || { echo 'Unexpected privileged source compatibility role' >&2; exit 1; }
      psql_db -c "GRANT village_prod TO \"$role\";" >/dev/null
    fi ;;
  versions) psql_db -c 'SHOW server_version; SELECT extname,extversion FROM pg_extension ORDER BY extname;' ;;
  counts) docker exec -i village-prod-db psql -X -v ON_ERROR_STOP=1 -At -U village_prod -d "$db" < "$(dirname "$0")/row_counts.sql" ;;
  create)
    [[ $db != village_prod ]]
    docker exec village-prod-db createdb -U village_prod "$db"
    if ! psql_db -c "CREATE EXTENSION IF NOT EXISTS timescaledb VERSION '2.30.2'; CREATE EXTENSION IF NOT EXISTS pgcrypto;" >/dev/null; then
      docker exec village-prod-db dropdb -U village_prod "$db"
      exit 1
    fi ;;
  drop)
    [[ $db != village_prod ]]
    docker exec village-prod-db dropdb -U village_prod "$db" ;;
  restore)
    exec 9>/run/lock/village-prod-restore.lock; flock -n 9
    [[ $(psql_db -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'") == 0 ]] || { echo 'Target must be empty; refusing restore.' >&2; exit 1; }
    umask 077
    dump=$(mktemp /var/tmp/village-restore.XXXXXXXX)
    cleanup() { rm -f -- "$dump"; }
    trap cleanup EXIT
    cat > "$dump"
    # Check complete archive before changing target. Restore errors are kept private,
    # since PostgreSQL errors can include row contents from a private database.
    docker exec -i village-prod-db pg_restore -l < "$dump" >/dev/null
    psql_db -c 'SELECT timescaledb_pre_restore()' >/dev/null
    log=$(mktemp /var/tmp/village-restore-error.XXXXXXXX)
    status=0
    docker exec -i village-prod-db pg_restore --exit-on-error --no-owner --no-acl -U village_prod -d "$db" < "$dump" >"$log" 2>&1 || status=$?
    psql_db -c 'SELECT timescaledb_post_restore()' >/dev/null || status=1
    if [[ $status != 0 ]]; then
      echo "Restore failed. Private diagnostic: $log. Do not cut over; target needs integrator recovery." >&2
      exit "$status"
    fi
    rm -f -- "$log"
    docker exec village-prod-db vacuumdb -q --analyze-in-stages -U village_prod -d "$db"
    echo "Restored $db successfully." ;;
  *) exit 2 ;;
esac
