#!/usr/bin/env bash
# Village GPU services: WSL GPU worker (:8100) + Windows job bridge (avatar_jobs -> worker -> manifests).
#   ops/run_gpu.sh start | stop | restart | status | logs
# Run from Git Bash on the Windows host. Both processes run under a small supervisor loop (auto-restart on crash,
# 5 s backoff); PIDs in $DATA/run, logs in $DATA/logs/{gpu_worker,bridge}.log. `start` is idempotent: if a
# supervisor is already alive it is left alone; stale pid files are cleaned up.
set -uo pipefail
REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
MAIN=/c/Users/mourn/Downloads/hacklanta          # main checkout (holds .env + data) when run from a worktree
if [ -n "${VILLAGE_DATA_DIR:-}" ]; then DATA=$VILLAGE_DATA_DIR
elif [ -f "$REPO/.env" ]; then DATA=$REPO/data; else DATA=$MAIN/data; fi
RUN=$DATA/run; LOGS=$DATA/logs; mkdir -p "$RUN" "$LOGS"
DISTRO=${WSL_DISTRO:-Ubuntu-24.04}
WORKER_URL=${GPU_WORKER_BASE:-http://localhost:8100}
to_wsl() { echo "$1" | sed -E 's#^/([a-zA-Z])/#/mnt/\L\1/#'; }
WSL_SCRIPTS=$(to_wsl "$REPO/workers/gpu/scripts")

alive() { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }
healthy() { curl -sf -m 3 "$WORKER_URL/health" >/dev/null; }

supervise() {  # supervise <name> <cmd...>
  local name=$1; shift
  ( trap 'kill $child 2>/dev/null; exit 0' TERM INT
    while :; do
      echo "[$(date '+%F %T')] supervisor: starting $name" >>"$LOGS/$name.log"
      "$@" >>"$LOGS/$name.log" 2>&1 & child=$!
      wait $child; rc=$?
      echo "[$(date '+%F %T')] supervisor: $name exited rc=$rc; restart in 5s" >>"$LOGS/$name.log"
      sleep 5
    done ) </dev/null >/dev/null 2>&1 &   # detach from the caller's stdout so `start | tail` returns
  echo $! >"$RUN/$name.pid"
}

start() {
  if alive gpu_worker; then echo "gpu_worker supervisor already running (pid $(cat "$RUN/gpu_worker.pid"))"
  elif healthy; then echo "a GPU worker is already answering on $WORKER_URL (not started by this script) - leaving it"
  else
    MSYS_NO_PATHCONV=1 wsl.exe -d "$DISTRO" bash "$WSL_SCRIPTS/stop_server.sh" >/dev/null 2>&1  # clear orphans
    supervise gpu_worker env MSYS_NO_PATHCONV=1 wsl.exe -d "$DISTRO" bash "$WSL_SCRIPTS/run_server.sh"
    echo "gpu_worker starting (pid $(cat "$RUN/gpu_worker.pid")), log $LOGS/gpu_worker.log"
  fi
  for i in $(seq 1 30); do healthy && break; sleep 1; done
  healthy && echo "gpu_worker healthy at $WORKER_URL" || echo "WARN: gpu_worker not healthy yet (see $LOGS/gpu_worker.log)"
  if alive bridge; then echo "bridge supervisor already running (pid $(cat "$RUN/bridge.pid"))"
  else
    supervise bridge env PYTHONUNBUFFERED=1 python -m uv run --with "psycopg[binary]" --with httpx --with python-dotenv \
      python "$REPO/workers/gpu/bridge.py"
    echo "bridge started (pid $(cat "$RUN/bridge.pid")), log $LOGS/bridge.log"
  fi
}

stop() {
  for n in bridge gpu_worker; do
    if alive $n; then
      local pid; pid=$(cat "$RUN/$n.pid")
      pkill -TERM -P "$pid" 2>/dev/null; kill -TERM "$pid" 2>/dev/null; sleep 1
      pkill -KILL -P "$pid" 2>/dev/null; kill -KILL "$pid" 2>/dev/null
      echo "stopped $n supervisor ($pid)"
    fi
    rm -f "$RUN/$n.pid"
  done
  MSYS_NO_PATHCONV=1 wsl.exe -d "$DISTRO" bash "$WSL_SCRIPTS/stop_server.sh"   # worker + model children
  # bridge python started via uv on Windows: kill any leftover by command line
  powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -like '*workers*gpu*bridge.py*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
  echo "stopped"
}

status() {
  for n in gpu_worker bridge; do alive $n && echo "$n: supervisor running (pid $(cat "$RUN/$n.pid"))" || echo "$n: not running"; done
  healthy && curl -s "$WORKER_URL/health" && echo || echo "worker: no answer on $WORKER_URL"
}

case "${1:-status}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  logs) tail -n 40 "$LOGS/gpu_worker.log" "$LOGS/bridge.log" ;;
  *) echo "usage: $0 start|stop|restart|status|logs"; exit 2 ;;
esac
