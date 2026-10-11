#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || exit 1
sha=${1:?commit}; incoming=${2:?source directory}
[[ $sha =~ ^[a-f0-9]{40}$ && $incoming == /tmp/village-stage.* && -d $incoming ]]
exec 9>/run/lock/village-stage.lock
flock 9
bash "$incoming/ops/deploy/provision.sh"
release=/opt/village/releases/$sha
if [[ ! -d $release ]]; then mv -- "$incoming" "$release"; fi
chown -R village:village "$release"
export PATH=/var/lib/village/tools/node/bin:/var/lib/village/tools/bun/bin:/var/lib/village/tools/uv:$PATH
# No local/root .env is shipped. Public staging always uses fixtures in-browser.
runuser -u village -- env PATH="$PATH" VILLAGE_ENV_FILE=/dev/null VITE_MOCK=1 VITE_DEMO_AUTH=1 \
  bash -ec 'cd "$1/apps/web"; bun install --frozen-lockfile; bun run build' _ "$release"
runuser -u village -- env PATH="$PATH" VILLAGE_ENV_FILE=/dev/null \
  bash -ec 'cd "$1/apps/api"; uv sync --frozen --python /usr/bin/python3.12' _ "$release"
# This nonsecret scratch DSN is ONLY for migration/fixtures. API reads its own DSN
# from /etc/village/env, and refuses any target other than this scratch database.
runuser -u village -- env VILLAGE_ENV_FILE=/dev/null DATABASE_URL=postgresql://postgres@127.0.0.1:55432/village_stage \
  bash -ec 'cd "$1/apps/api"; .venv/bin/python scripts/migrate.py; .venv/bin/python scripts/seed.py' _ "$release"
ln -sfn "$release" /opt/village/current.next
mv -Tf /opt/village/current.next /opt/village/current
install -m 644 "$release/ops/deploy/village-api.service" "$release/ops/deploy/village-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable village-api village-web
systemctl restart village-web
api_blocked=0
if [[ -f /etc/village/env ]]; then
  [[ $(stat -c '%a:%U' /etc/village/env) == 600:root ]] || { echo '/etc/village/env must be root-owned mode 600' >&2; exit 1; }
  systemctl restart village-api
else
  echo 'API BLOCKED: integrator must populate /etc/village/env (root:root 0600).'
  api_blocked=1
fi
# Append exactly one import; preserve every byte of the original live site block.
install -m 644 "$release/ops/deploy/stage.Caddyfile" /etc/caddy/village-stage.Caddyfile
candidate=$(mktemp /etc/caddy/village-candidate.XXXXXXXX)
cp /etc/caddy/Caddyfile "$candidate"
if ! grep -qxF 'import /etc/caddy/village-stage.Caddyfile' "$candidate"; then
  printf '\nimport /etc/caddy/village-stage.Caddyfile\n' >> "$candidate"
fi
caddy validate --config "$candidate" --adapter caddyfile
if ! cmp -s /etc/caddy/Caddyfile "$candidate"; then
  cp -n /etc/caddy/Caddyfile /etc/caddy/Caddyfile.pre-village-stage
  install -m 644 "$candidate" /etc/caddy/Caddyfile
fi
rm -- "$candidate"
systemctl reload caddy
curl --fail --silent --retry 10 --retry-connrefused --retry-delay 1 --output /dev/null http://127.0.0.1:8081/
echo "Staged commit $sha at https://stage.207-246-81-187.sslip.io (mock frontend)"
if [[ $api_blocked == 1 ]]; then exit 3; fi
curl --fail --silent --retry 10 --retry-connrefused --retry-delay 1 --output /dev/null http://127.0.0.1:8011/api/health
