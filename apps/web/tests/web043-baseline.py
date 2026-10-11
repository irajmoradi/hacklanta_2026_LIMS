"""Prepare the optional remote browser baseline from the task's starting commit."""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[3]
paths = ["src/scene/GridTown.tsx", "src/scene/InstancedTrees.tsx",
         "src/scene/TownSurfaces.tsx", "src/scene/layout/town.ts", "src/scene/layout/streets.ts"]
snapshot = {path: subprocess.check_output(
    ["git", "show", "fae2ae8:apps/web/" + path], cwd=root).decode("utf-8") for path in paths}
Path(__file__).with_name("web043-baseline.json").write_text(json.dumps(snapshot), encoding="utf-8")
