#!/usr/bin/env bash
set -euo pipefail
export MSYS_NO_PATHCONV=1
source_dir=${1:?Usage: sync_assets.sh source_dir [absolute_VM_asset_dir]}
destination=${2:-/var/lib/village-prod/assets}
[[ -d $source_dir ]]
[[ $destination == /var/lib/village-prod/assets || $destination =~ ^/var/lib/village-prod/rehearsal-assets-[a-z0-9]+$ ]]
host=${DEPLOY_HOST:-root@207.246.81.187}
key=${DEPLOY_KEY:-$HOME/.ssh/village_vultr}
[[ $host =~ ^[a-zA-Z0-9_.@-]+$ && $key != *\'* ]]
ssh -o BatchMode=yes -i "$key" "$host" "install -d -o village-prod -g village-prod -m 750 '$destination'"
# No delete: reruns preserve remote paths; checksums catch same-size/time changes.
# Reject symlinks instead of following them outside the intended asset directory.
[[ -z $(find "$source_dir" -type l -print -quit) ]] || { echo 'Asset source contains symlinks' >&2; exit 1; }
"${RSYNC_BIN:-rsync}" -rtc --protect-args --chown=village-prod:village-prod --chmod=D750,F640 \
  -e "ssh -o BatchMode=yes -i '$key'" -- "$source_dir/" "$host:$destination/"
echo 'Asset synchronization complete (no deletion).'
