"""Check QA-014 artifact completeness, not product correctness. No network access."""
import json
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "apps/web/tests/screenshots/QA-014"
required = {
    "first-load", "dashboard", "profile-overview", "profile-accomplishments",
    "profile-outfit", "profile-house", "profile-rewards", "profile-activity",
    "house-interior", "community-hall", "shop", "shop-bottoms", "shop-shoes",
    "shop-glasses", "shop-wardrobe", "shop-pets-shelter", "shop-treasury",
    "colosseum-open", "colosseum-current", "colosseum-mine", "colosseum-past",
    "mayor-plaza", "gazette", "inbox", "settings", "walking", "reload-mid-walk",
    "lab-town-10", "lab-town-25", "lab-town-50", "lab-town-100", "lab-futures",
    "lab-autoplay", "lab-onboarding", "lab-avatar-studio",
    *(f"lab-level-{n}" for n in range(2, 7)),
    *(f"lab-{kind}{suffix}" for kind in ("scorch", "outbreak", "blackout", "blight")
      for suffix in ("", "-repaired")),
}
summary = {}
for project in ("desktop", "mobile"):
    data = json.loads((EVIDENCE / project / "observations.json").read_text(encoding="utf-8"))
    names = {s["name"].removesuffix("-failed") for s in data["snapshots"]}
    assert not required - names, (project, sorted(required - names))
    repairs = [e for e in data["events"] if e["kind"] == "repair-step"]
    assert len(repairs) == 16, (project, "missing repair contribution steps")
    summary[project] = {
        "captured_at": data["capturedAt"], "checkpoints": len(data["snapshots"]),
        "blocked_writes": len(data["blocked"]),
        "navigation_failures": [e["surface"] for e in data["events"] if e["kind"] == "navigation-failure"],
        "page_errors": sum(e["kind"] == "pageerror" for e in data["events"]),
        "http_errors": [e for e in data["events"] if e["kind"] == "http"],
        "slow_requests": [e for e in data["events"] if e["kind"] == "slow-request"],
    }

focused = {
    "shop-footer", "shop-bottoms-recheck", "study-streak", "mayor-plaza",
    "profile-accomplishments", "house-floor-2", "house-ground", "hall-floor-2",
    "expanded-feed", "activity-event-target", "gazette-via-keyboard",
    "lab-sign-before", "lab-sign-after", "lab-clear", "lab-reload-resets",
}
for project in ("desktop-followup", "mobile-followup"):
    data = json.loads((EVIDENCE / project / "observations.json").read_text(encoding="utf-8"))
    names = {s["name"].removesuffix("-failed") for s in data["snapshots"]}
    expected = focused | ({"navigation-before-scroll", "navigation-after-scroll",
        "arena-terms-overlap", "arena-filter-after-detail", "arena-return-to-list",
        "arena-list-current", "arena-list-mine", "arena-list-past", "gazette-after-collapse"}
        if project.startswith("mobile") else set())
    assert not expected - names, (project, sorted(expected - names))
    summary[project] = {
        "captured_at": data["capturedAt"], "checkpoints": len(data["snapshots"]),
        "blocked_writes": len(data["blocked"]),
        "navigation_failures": [e["surface"] for e in data["events"] if e["kind"] == "navigation-failure"],
        "page_errors": sum(e["kind"] == "pageerror" for e in data["events"]),
        "http_errors": [e for e in data["events"] if e["kind"] == "http"],
    }

for doc in (ROOT / "docs/qa/QA-014.md", ROOT / "docs/qa/JUDGE_DEMO.md"):
    for target in re.findall(r"\]\(([^)]+)\)", doc.read_text(encoding="utf-8")):
        if not target.startswith(("https://", "http://", "#")):
            assert (doc.parent / target).resolve().exists(), (doc.name, target)

screenshots = list(EVIDENCE.rglob("*.png"))
for screenshot in screenshots:
    raw = screenshot.read_bytes()
    assert raw[:8] == b"\x89PNG\r\n\x1a\n", screenshot
    width, height = struct.unpack(">II", raw[16:24])
    expected = (390, 844) if screenshot.parent.name.startswith("mobile") else (1440, 900)
    assert (width, height) == expected, (screenshot, width, height)
summary["screenshot_count"] = len(screenshots)
print(json.dumps(summary, indent=2))
