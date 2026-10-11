#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]]
umask 077
image=timescale/timescaledb@sha256:b346edcdb51a1fd6020e3965e0bd1c9f3406fa6d5fbce1e28f4852587ef934e2
install -d -m 700 /etc/village/prod-db
if [[ ! -f /etc/village/prod-db/password ]]; then
  [[ ! $(docker volume ls -q --filter name='^village-prod-db$') ]] || { echo 'Existing volume without password; stop.' >&2; exit 1; }
  openssl rand -hex 32 > /etc/village/prod-db/password
fi
[[ $(stat -c '%a:%U' /etc/village/prod-db/password) == 600:root ]]
if ! docker container inspect village-prod-db >/dev/null 2>&1; then
  docker run -d --name village-prod-db --restart unless-stopped \
    --label village.purpose=production \
    -p 127.0.0.1:55433:5432 -e POSTGRES_DB=village_prod \
    -e POSTGRES_USER=village_prod -e POSTGRES_PASSWORD_FILE=/run/secrets/db_password \
    -v /etc/village/prod-db/password:/run/secrets/db_password:ro \
    -v village-prod-db:/var/lib/postgresql/data "$image" >/dev/null
else
  [[ $(docker inspect -f '{{index .Config.Labels "village.purpose"}}' village-prod-db) == production ]]
  [[ $(docker inspect -f '{{.Config.Image}}' village-prod-db) == "$image" ]]
  docker start village-prod-db >/dev/null
fi
for _ in {1..60}; do
  # pg_isready can succeed during initdb before POSTGRES_DB exists. Wait for
  # the final TCP listener and a real connection to the requested database.
  if docker exec village-prod-db sh -c 'export PGPASSWORD=$(cat "$POSTGRES_PASSWORD_FILE"); psql -X -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT 1"' >/dev/null 2>&1; then
    docker exec village-prod-db psql -X -v ON_ERROR_STOP=1 -U village_prod -d village_prod \
      -c 'CREATE EXTENSION IF NOT EXISTS timescaledb VERSION '\''2.30.2'\''; CREATE EXTENSION IF NOT EXISTS pgcrypto;'
    docker exec village-prod-db psql -X -At -U village_prod -d village_prod \
      -c 'SHOW server_version; SELECT extname,extversion FROM pg_extension ORDER BY extname;'
    exit 0
  fi
  sleep 1
done
exit 1
