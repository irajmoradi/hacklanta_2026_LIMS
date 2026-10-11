#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run over SSH as root' >&2; exit 1; }
BUN_VERSION=${1:?Pass the local bun --version}
[[ $BUN_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y git rsync build-essential curl ca-certificates unzip ffmpeg ufw docker.io python3.12 python3.12-venv postgresql-client shellcheck
id runner &>/dev/null || useradd -m -s /bin/bash runner
install -d -m 700 -o runner -g runner /home/runner/.ssh
install -m 600 -o runner -g runner /root/.ssh/authorized_keys /home/runner/.ssh/authorized_keys
install -d -o runner -g runner /srv/runs /srv/runner-locks /srv/runner-cache
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
# shellcheck disable=SC2016 # $1 belongs to the child shell.
runuser -u runner -- env BUN_INSTALL=/home/runner/.bun bash -c 'curl -fsSL https://bun.sh/install | bash -s -- "bun-v$1"' _ "$BUN_VERSION"
runuser -u runner -- bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'
ln -sf /home/runner/.bun/bin/bun /usr/local/bin/bun
ln -sf /home/runner/.bun/bin/bun /usr/local/bin/bunx
ln -sf /home/runner/.local/bin/uv /usr/local/bin/uv
uv venv /opt/runner-python --python /usr/bin/python3.12 --allow-existing
uv pip install --python /opt/runner-python/bin/python uv
# A symlink outside a venv loses pyvenv.cfg discovery; use an executable shim.
rm -f /usr/local/bin/python
printf '#!/bin/sh\nexec /opt/runner-python/bin/python "$@"\n' > /usr/local/bin/python
chmod 755 /usr/local/bin/python
export PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"
bunx --bun playwright@1.58.2 install --with-deps chromium
chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH"
systemctl enable --now docker
# No production credentials: trust is confined to this disposable loopback DB.
if ! docker inspect village-runner-db >/dev/null 2>&1; then
  docker run -d --name village-runner-db --restart unless-stopped \
    -p 127.0.0.1:5432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust \
    -v village-runner-db:/var/lib/postgresql/data timescale/timescaledb:latest-pg17
else
  docker start village-runner-db
fi
for _ in {1..60}; do
  pg_isready -h 127.0.0.1 -U postgres && break
  sleep 1
done
psql -h 127.0.0.1 -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='village_test'" | grep -q 1 || createdb -h 127.0.0.1 -U postgres village_test
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw --force enable
echo 'Runner provisioned. SSH as runner; Docker access stays root-only.'
