"""Generate original component sources for optional WEB-047 before screenshots.
Run from apps/web before invoking tests/web047.config.ts on the remote runner.
Delete tests/web047-before.json after capturing; it is a temporary test input.
"""
import json
import subprocess
from pathlib import Path

baseline = "d9d82fc8078f029d225f6829ff448ff11d5eadd9"
files = ["ProfileOutfit.tsx", "ProfilePanel.tsx", "ItemColorPanel.tsx", "HouseEditor.tsx",
         "HouseInterior.tsx", "HouseInterior.css", "TryOnPane.tsx", "tryOn.css"]
sources = {"/src/components/" + name: subprocess.check_output(
    ["git", "show", baseline + ":apps/web/src/components/" + name]).decode("utf-8") for name in files}
Path(__file__).with_name("web047-before.json").write_text(json.dumps(sources), encoding="utf-8")
