import asyncio
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from psycopg.conninfo import conninfo_to_dict, make_conninfo


def configure_event_loop():
    if os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


def load_environment():
    path = os.getenv("VILLAGE_ENV_FILE", str(Path(__file__).resolve().parents[2] / ".env"))
    if os.name == "nt" and re.match(r"^/[a-zA-Z]/", path):
        path = path[1] + ":" + path[2:]
    load_dotenv(Path(path).expanduser(), override=False)


def database_url():
    value = os.getenv("DATABASE_URL", "")
    if not value:
        raise ValueError("DATABASE_URL is required; configure VILLAGE_ENV_FILE")
    params = conninfo_to_dict(value)
    if os.name == "nt" and params.get("host") == "localhost" and not params.get("hostaddr"):
        value = make_conninfo(value, hostaddr="127.0.0.1")
    return value
