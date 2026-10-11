#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || exit 1
export DEBIAN_FRONTEND=noninteractive
# Use Ubuntu's own sources; an unrelated third-party Caddy feed can be down.
apt_sources=/etc/apt/sources.list.d/ubuntu.sources
[[ -f $apt_sources ]] || apt_sources=/etc/apt/sources.list
apt_options=(-o "Dir::Etc::sourcelist=$apt_sources" -o 'Dir::Etc::sourceparts=-')
apt-get "${apt_options[@]}" update -qq
apt-get "${apt_options[@]}" install -y curl ca-certificates unzip git ffmpeg docker.io python3.12 python3.12-venv nodejs npm
id village &>/dev/null || useradd --system --create-home --home-dir /var/lib/village --shell /usr/sbin/nologin village
install -d -o village -g village /var/lib/village/assets /var/lib/village/tools
install -d /opt/village/releases /etc/village
if [[ ! -x /var/lib/village/tools/bun/bin/bun ]]; then
  runuser -u village -- env BUN_INSTALL=/var/lib/village/tools/bun bash -c 'curl -fsSL https://bun.sh/install | bash -s -- bun-v1.3.11'
fi
if [[ ! -x /var/lib/village/tools/uv/uv ]]; then
  runuser -u village -- env UV_INSTALL_DIR=/var/lib/village/tools/uv bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'
fi
# Ubuntu's Node 18 is too old for the nested wallet package. Keep Node 22 in
# our own tools directory; verify the official archive checksum before unpacking.
if [[ ! -x /var/lib/village/tools/node/bin/node ]]; then
  node_tmp=$(mktemp -d /tmp/village-node.XXXXXXXX)
  curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt -o "$node_tmp/SHASUMS256.txt"
  node_archive=$(awk '$2 ~ /^node-v22\..*-linux-x64.tar.xz$/ {print $2}' "$node_tmp/SHASUMS256.txt")
  [[ $node_archive =~ ^node-v22\.[0-9]+\.[0-9]+-linux-x64.tar.xz$ ]]
  curl -fsSL "https://nodejs.org/dist/latest-v22.x/$node_archive" -o "$node_tmp/$node_archive"
  (cd "$node_tmp"; grep "  $node_archive$" SHASUMS256.txt | sha256sum -c -)
  install -d /var/lib/village/tools/node
  tar -xJf "$node_tmp/$node_archive" --strip-components=1 -C /var/lib/village/tools/node
fi
systemctl enable --now docker
if ! docker inspect village-stage-db >/dev/null 2>&1; then
  docker run -d --name village-stage-db --restart unless-stopped \
    --label village.purpose=staging-scratch \
    -p 127.0.0.1:55432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust \
    -e POSTGRES_DB=village_stage -v village-stage-db:/var/lib/postgresql/data \
    timescale/timescaledb:latest-pg17
else
  [[ $(docker inspect -f '{{index .Config.Labels "village.purpose"}}' village-stage-db) == staging-scratch ]]
  docker start village-stage-db >/dev/null
fi
for _ in {1..60}; do
  if docker exec village-stage-db pg_isready -U postgres -d village_stage >/dev/null; then
    exit 0
  fi
  sleep 1
done
echo 'Scratch database did not become ready' >&2
exit 1
