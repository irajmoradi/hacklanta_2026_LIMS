#!/bin/sh
# Run from any directory. COMPOSE_PROJECT_NAME must match the target deployment.
set -eu
# Keep Git Bash from rewriting Linux paths passed to docker.exe.
export MSYS_NO_PATHCONV=1
repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_dir=${1:-"$repo/data/assets/avatars"}
if [ ! -d "$source_dir" ] || [ -z "$(ls -A "$source_dir")" ]; then
  echo 'No avatar assets; fixture avatars remain available.'
  exit 0
fi
# Symlinks could import files outside the approved generated asset directory.
if [ -n "$(find "$source_dir" -type l -print -quit)" ]; then
  echo 'Refusing avatar directory containing symlinks.' >&2
  exit 1
fi
source_dir=$(CDPATH= cd -- "$source_dir" && pwd)
cd "$repo"
docker compose -f infra/compose.prod.yml exec -T api mkdir -p /app/data/assets/avatars
tar -C "$source_dir" -cf - . | docker compose -f infra/compose.prod.yml exec -T api tar -xf - -C /app/data/assets/avatars
echo 'Copied avatars into the API asset volume; existing unrelated files retained.'
