"""Check paired remote captures; this reads measurements, never starts a browser."""
import json
from pathlib import Path

artifacts = Path(__file__).resolve().parents[1] / "artifacts/web043"
results = []
for seed in (1337, 42, 19):
    before = json.loads((artifacts / f"before-{seed}-performance.json").read_text())
    after = json.loads((artifacts / f"after-{seed}-performance.json").read_text())
    for a, b in zip(before, after, strict=True):
        assert a["view"] == b["view"]
        result = {"seed": seed, "view": a["view"], "before_calls": a["calls"], "after_calls": b["calls"],
                  "before_fps": round(a["fps"], 2), "after_fps": round(b["fps"], 2),
                  "calls_change_percent": round((b["calls"] / a["calls"] - 1) * 100, 2),
                  "fps_change_percent": round((b["fps"] / a["fps"] - 1) * 100, 2),
                  "pass": b["calls"] <= a["calls"] * 1.1 and b["fps"] >= a["fps"] * .9
                  and a["shadows"] == b["shadows"] and a["renderer"] == b["renderer"]}
        results.append(result)
print(json.dumps(results, indent=2))
(artifacts / "comparison.json").write_text(json.dumps(results, indent=2))
raise SystemExit(0 if all(r["pass"] for r in results) else 1)
