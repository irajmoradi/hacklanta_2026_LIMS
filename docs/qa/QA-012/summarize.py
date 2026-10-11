"""Summarize the audit's measurements without copying live API response bodies."""
import json
from pathlib import Path

base = Path(__file__).parent / "screenshots"
for filename in ("audit.json", "supplemental.json"):
    if not (base / filename).exists():
        continue
    report = json.loads((base / filename).read_text(encoding="utf-8"))
    print(filename, "cases", len(report["cases"]), "errors", report["errors"])
    for case in report["cases"]:
        issues = []
        s, v = case.get("surface"), case["viewport"]
        if case["document"]["w"] > v["w"] + 1:
            issues.append("document-overflow")
        if s:
            r = s["rect"]
            if r["x"] < -1 or r["y"] < -1 or r["right"] > v["w"] + 1 or r["bottom"] > v["h"] + 1:
                issues.append("surface-outside-viewport")
            if s["scrollW"] > s["clientW"] + 1:
                issues.append("surface-horizontal-overflow")
        if (case.get("scroll", {}).get("close") or {}).get("visible") is False:
            issues.append("close-offscreen-after-scroll")
        violations = case.get("axe", {}).get("violations", [])
        if violations:
            issues.append("axe=" + ",".join(f'{x["id"]}({len(x["nodes"])})' for x in violations))
        if case.get("escapeClosed") is False:
            issues.append("escape-did-not-close")
        if issues:
            print(case["label"], "; ".join(issues))
    print("Blocked writes:", report.get("blocked"))

perf = base / "performance.json"
if perf.exists():
    for run in json.loads(perf.read_text(encoding="utf-8"))["runs"]:
        print("PERFORMANCE", run["mode"], {k: run.get(k) for k in ("domContentLoadedWallMs", "townControlsVisibleMs", "interactiveDialogMs", "observationMs", "completedEncodedBytes", "modeBadge", "errors")})
        print("Largest resources:", sorted(run["resources"], key=lambda r: r["encoded"], reverse=True)[:8])
