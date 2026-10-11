#!/usr/bin/env bash
# Stop the Modal app if this month's metered spend passes a threshold (default $25 of the $30 budget).
#   bash workers/modal/budget_guard.sh [threshold_usd]      (run from WSL; safe to cron / call from ops)
set -eo pipefail
T=${1:-25}
# `modal` on PATH (VM: `uv tool install modal==1.6.1` + `modal token set`) else the WSL wrapper (PC)
if command -v modal >/dev/null 2>&1; then M=modal; else M="bash $(dirname "$0")/wsl_modal.sh"; fi
SPEND=$($M billing summary --json 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
def find(o):
    if isinstance(o,dict):
        for k,v in o.items():
            if 'metered' in k.lower() and isinstance(v,(int,float,str)):
                try: return float(v)
                except ValueError: pass
            r=find(v)
            if r is not None: return r
    if isinstance(o,list):
        for v in o:
            r=find(v)
            if r is not None: return r
print(find(d) or 0)")
echo "Modal metered spend this cycle: \$$SPEND (stop threshold \$$T)"
python3 -c "import sys; sys.exit(0 if float('$SPEND') < float('$T') else 1)" || { echo "over threshold -> stopping village-gpu"; $M app stop -y village-gpu; }
