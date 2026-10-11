#!/usr/bin/env bash
# End-to-end test against a running worker. usage: smoke_test.sh <image_path_under_data_dir> [user_id] [audio_path]
set -eo pipefail
source "$(dirname "$0")/env.sh"
U=${2:-smoke_user}; B=${WORKER_URL:-http://localhost:8100}
AUDIO=${3:-$VCV_ROOT/repos/LAM_Audio2Expression/assets/sample_audio/BarackObama_english.wav}
t(){ local s=$(date +%s.%N); "$@"; echo "  [$(echo "$(date +%s.%N) - $s" | bc) s]" >&2; }
echo "== health"; curl -sf $B/health; echo
echo "== segment (multipart upload, wait)"; t curl -sf -X POST "$B/segment?wait=true" -F user_id=$U -F file=@"$1" | python3 -c "import json,sys;j=json.load(sys.stdin);print(j['status'],j['error'],j['result'] and [(c['crop_id'],c['colors']) for c in j['result']['crops']], j['result'] and j['result']['timing_s'])"
echo "== head (async + poll)"; J=$(curl -sf -X POST $B/avatar/head -H 'content-type: application/json' -d "{\"user_id\":\"$U\"}" | python3 -c "import json,sys;print(json.load(sys.stdin)['job_id'])")
s=$(date +%s); while :; do S=$(curl -sf $B/jobs/$J | python3 -c "import json,sys;print(json.load(sys.stdin)['status'])"); [ "$S" = queued -o "$S" = running ] || break; sleep 2; done
echo "  head job $J -> $S in $(( $(date +%s)-s )) s"; curl -sf $B/jobs/$J | python3 -c "import json,sys;j=json.load(sys.stdin);r=j['result'] or {};print(j['error'], r.get('head_package_url'), r.get('timing_s'), r.get('peak_vram_gb'))"
echo "== expr (multipart, wait)"; t curl -sf -X POST "$B/voice/expr?wait=true" -F user_id=$U -F line_id=smoke1 -F file=@"$AUDIO" | python3 -c "import json,sys;j=json.load(sys.stdin);r=j['result'] or {};print(j['status'],j['error'],r.get('expr_url'),r.get('n_frames'),r.get('timing_s'))"
echo "== segment again (evicts LAM, SAM 3 reload)"; t curl -sf -X POST "$B/segment?wait=true" -H 'content-type: application/json' -d "{\"user_id\":\"$U\",\"image_path\":\"$1\"}" | python3 -c "import json,sys;j=json.load(sys.stdin);print(j['status'],j['error'],j['result'] and j['result']['timing_s'])"
echo "== bad input"; curl -s -X POST $B/segment -H 'content-type: application/json' -d '{"user_id":"../x","image_path":"/etc/passwd"}'; echo
echo "== health"; curl -sf $B/health; echo
echo "== fetch package"; curl -sf -o /dev/null -w "%{http_code} %{size_download} bytes\n" $B/files/avatars/$U/head/avatar.zip
