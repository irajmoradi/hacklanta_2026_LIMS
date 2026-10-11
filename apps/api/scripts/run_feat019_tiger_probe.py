"""Forward just the Tiger credential at runtime; never copy the env file to the runner."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[3]
source = os.environ["VILLAGE_ENV_FILE"]
if os.name == "nt" and source.startswith("/") and source[2:3] == "/":
    source = source[1] + ":" + source[2:]
dsn = dotenv_values(source, interpolate=False).get("TIGER_DATABASE_URL")
if not dsn:
    raise SystemExit("Tiger is not configured")
environment = dict(os.environ, FEAT019_TIGER_DSN=dsn)
environment["PATH"] = str(Path(sys.executable).parent) + os.pathsep + os.environ["PATH"]
code = subprocess.call(
    [
        shutil.which("bash") or "bash",
        "../../ops/remote_run.sh",
        "--env",
        "FEAT019_TIGER_DSN",
        "--with-api",
        "python",
        "-m",
        "uv",
        "run",
        "python",
        "scripts/feat019_public_probe.py",
    ],
    cwd=ROOT / "apps/api",
    env=environment,
)
sys.exit(code)
