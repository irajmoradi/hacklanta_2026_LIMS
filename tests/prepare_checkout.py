"""Copy tracked source plus current QA edits under tests; never copy .env/assets."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
target = ROOT / "tests/.runtime/checkout"
names = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).splitlines()
names += [str(p.relative_to(ROOT)) for p in (ROOT / "tests").glob("wave4/**/*") if p.is_file()]
names += ["tests/wave4_live.py", "tests/playwright.wave4.config.ts"]
for name in set(names):
    src = ROOT / name
    if src.is_file():
        dest = target / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
(target / "tests/.runtime").mkdir(parents=True, exist_ok=True)
print(target)
