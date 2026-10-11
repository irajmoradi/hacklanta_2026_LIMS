"""Ship a committed snapshot only; never transfer local env files or runtime data."""
import argparse
from pathlib import Path
import subprocess as sp
import sys
import tarfile
import tempfile

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("commit", help="Git commit/ref to stage")
p.add_argument("--host", default="root@207.246.81.187")
p.add_argument("--key", default=str(Path.home() / ".ssh/village_vultr"))
a = p.parse_args()
root = Path(__file__).resolve().parents[2]
sha = sp.check_output(["git", "rev-parse", "--verify", a.commit + "^{commit}"], cwd=root, text=True).strip()
ssh = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-i", a.key, a.host]
with tempfile.TemporaryDirectory(prefix="village-stage-") as tmp:
    archive = Path(tmp) / "source.tar"
    sp.run(["git", "archive", "--format=tar", "-o", str(archive), sha], cwd=root, check=True)
    with tarfile.open(archive) as src:
        for entry in src:
            parts = Path(entry.name).parts
            if any((x.startswith(".env") and x != ".env.example") or x in {"data", ".ssh", ".venv", "node_modules"} for x in parts) or entry.name.endswith((".pem", ".key", ".pt", ".ckpt", ".safetensors")):
                raise SystemExit("Refusing archive with private/runtime files")
    # The trusted committed source is unpacked into a fresh temporary directory.
    with archive.open("rb") as stream:
        result = sp.run(ssh + [f"set -eu; incoming=$(mktemp -d /tmp/village-stage.XXXXXXXX); tar -xf - -C \"$incoming\"; bash \"$incoming/ops/deploy/stage.sh\" {sha} \"$incoming\""], stdin=stream)
sys.exit(result.returncode)
