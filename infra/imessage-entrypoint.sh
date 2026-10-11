#!/bin/sh
set -eu
if [ "${IMESSAGE_ENABLED:-0}" != 1 ]; then
  echo 'iMessage disabled; set IMESSAGE_ENABLED=1 to connect and process messages.'
  exec bun -e 'setInterval(() => {}, 60000)'
fi
: "${PROJECT_ID:?PROJECT_ID required}"
: "${PROJECT_SECRET:?PROJECT_SECRET required}"
: "${SERVICE_KEY:?SERVICE_KEY required}"
exec bun src/index.ts
