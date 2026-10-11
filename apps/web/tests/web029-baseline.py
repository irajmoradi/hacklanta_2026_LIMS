"""Capture the pre-WEB-029 scene with the same browser test and disposable API.

Run from apps/web after starting ../api/scripts/feat009_preview.py. This temporarily
substitutes only scene files under apps/web, and restores their exact bytes in finally.
No checkout, reset, secret copies, or changes to another worktree.
"""
import os
from pathlib import Path
import shutil
import subprocess
import sys

web = Path(__file__).resolve().parents[1]
root = web.parents[1]
base = sys.argv[1] if len(sys.argv) > 1 else "0674e80"
files = [
    "GridTown.tsx", "TownCamera.tsx", "VillageScene.tsx", "OptionalModel.tsx",
    "InstancedTrees.tsx", "FarmAnimals.tsx", "MayorPlaza.tsx", "ShelterPets.tsx",
    "StudyNook.tsx", "layout/town.ts", "layout/navigation.ts",
]
originals = {web / "src/scene" / name: (web / "src/scene" / name).read_bytes() for name in files}
# Resolve all git objects before changing anything, so an invalid base leaves files intact.
baseline = {path: subprocess.check_output(["git", "show", f"{base}:{path.relative_to(root).as_posix()}"], cwd=root)
            for path in originals}
try:
    for path, data in baseline.items():
        path.write_bytes(data)
    result = subprocess.run([shutil.which("bunx"), "playwright", "test", "--config", "playwright.web029.config.ts"],
                            cwd=web, env={**os.environ, "WEB029_STAGE": "before"})
finally:
    for path, data in originals.items():
        path.write_bytes(data)
sys.exit(result.returncode)
