"""systemd supplies /etc/village/env; enforce scratch-only, no paid staging calls."""
import os

from psycopg.conninfo import conninfo_to_dict

# libpq otherwise accepts PGHOSTADDR/PGSERVICE defaults independently of the URL.
for name in tuple(os.environ):
    if name.startswith("PG"):
        os.environ.pop(name)

try:
    params = conninfo_to_dict(os.environ.get("DATABASE_URL", ""))
    if not (params.get("host") == "127.0.0.1"
            and params.get("port") == "55432"
            and params.get("dbname") == "village_stage"
            and params.get("user") == "postgres"
            and set(params) <= {"host", "port", "dbname", "user", "password", "sslmode"}):
        raise ValueError("Non-staging DSN")
except Exception:
    raise SystemExit("Staging refused: DATABASE_URL must target the documented scratch database") from None

# Avoid a second dotenv read as the unprivileged service user. systemd already
# read the sole credential source, the root-owned 0600 /etc/village/env.
os.environ.update(VILLAGE_ENV_FILE="/dev/null", MAYOR_SCHEDULER="0",
                  MAYOR_VOICE="0", LLM_MAX_CALLS_PER_HOUR="0", DEMO_DEBUG="0",
                  ASSET_DIR="/var/lib/village/assets")
for name in ("GOOGLE_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "ELEVENLABS_API_KEY"):
    os.environ.pop(name, None)
os.execv("/opt/village/current/apps/api/.venv/bin/uvicorn",
         ["uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8011"])
