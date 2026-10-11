"""Submission checks; optional read-only localhost probes, no secrets or paid calls."""

import argparse
import ast
import json
import urllib.request
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
DOCUMENTS = [
    ROOT / "README.md",
    ROOT / "docs/submission/devpost.md",
    ROOT / "docs/submission/pitch.md",
    ROOT / "docs/submission/demo-video.md",
    ROOT / "docs/architecture/overview.md",
    ROOT / "docs/submission/DOCS-003-REPORT.md",
    ROOT / "docs/architecture/content.md",
]


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def anchors(text):
    headings = re.findall(r"^#{1,6}\s+(.+)$", text, re.M)
    return {
        re.sub(r"[^\w\- ]", "", heading.lower()).replace(" ", "-")
        for heading in headings
    }


def seconds(timestamp):
    minute, second = map(int, timestamp.split(":"))
    return minute * 60 + second


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Read localhost:8010 health/OpenAPI; fail if unavailable")
    args = parser.parse_args()
    links = 0
    for path in DOCUMENTS:
        text = path.read_text(encoding="utf-8")
        require(text.count("```") % 2 == 0, f"Unclosed fence: {path.name}")
        for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc:
                continue
            destination = (path.parent / unquote(parsed.path)).resolve() if parsed.path else path
            require(destination.is_relative_to(ROOT), f"Link escapes repository: {target}")
            require(destination.is_file(), f"Missing link from {path.name}: {target}")
            if parsed.fragment and destination.suffix == ".md":
                require(
                    unquote(parsed.fragment) in anchors(destination.read_text(encoding="utf-8")),
                    f"Missing anchor from {path.name}: {target}",
                )
            links += 1

    readme = DOCUMENTS[0].read_text(encoding="utf-8")
    for code in re.findall(r"```powershell\n(.*?)```", readme, re.S):
        require(":8000" not in code and "--port 8000" not in code, "Stale API port in command")

    # Read router prefixes/decorators without importing the app or loading secrets.
    app_dir = ROOT / "apps/api/app"
    main_tree = ast.parse((app_dir / "main.py").read_text(encoding="utf-8"))
    mounted = {"main"}
    for node in ast.walk(main_tree):
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and node.func.attr == "include_router" and node.args):
            arg = node.args[0]
            if isinstance(arg, ast.Attribute) and isinstance(arg.value, ast.Name):
                mounted.add(arg.value.id)
    routes = set()
    for module in sorted(mounted):
        tree = ast.parse((app_dir / f"{module}.py").read_text(encoding="utf-8"))
        prefix = ""
        for node in ast.walk(tree):
            if (isinstance(node, ast.Assign) and isinstance(node.value, ast.Call)
                    and any(isinstance(t, ast.Name) and t.id == "router" for t in node.targets)):
                for keyword in node.value.keywords:
                    if keyword.arg == "prefix":
                        prefix = ast.literal_eval(keyword.value)
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for decorator in node.decorator_list:
                    if (isinstance(decorator, ast.Call)
                            and isinstance(decorator.func, ast.Attribute)
                            and isinstance(decorator.func.value, ast.Name)
                            and decorator.func.value.id == "router"
                            and decorator.args
                            and isinstance(decorator.args[0], ast.Constant)):
                        routes.add((decorator.func.attr, prefix + decorator.args[0].value))
    documented_routes = [
        ("get", "/villages/{vid}/weekly/current"),
        ("get", "/villages/{vid}/weekly/{week_start}"),
        ("get", "/villages/{vid}/competitions"),
        ("get", "/villages/{vid}/agent-log"),
        ("get", "/villages/{vid}/check-ins/{cid}/review"),
        ("post", "/villages/{vid}/check-ins/{cid}/review/override"),
        ("post", "/me/voice"),
        ("get", "/voice/lines/{line_id}"),
        ("get", "/health"),
        ("get", "/villages/{vid}"),
        ("post", "/villages/{vid}/check-ins"),
        ("get", "/villages/{vid}/feed"),
        ("get", "/villages/{vid}/shop"),
        ("post", "/villages/{vid}/goals"),
        ("post", "/villages/{vid}/shop/buy"),
        ("post", "/villages/{vid}/mayor/recap"),
        ("post", "/voice/lines"),
    ]
    documented_routes += [
        ("post", "/villages/{vid}/group-photo"),
        ("get", "/villages/{vid}/group-photo/{job_id}"),
        ("post", "/villages/{vid}/group-photo/{job_id}/claim"),
        ("post", "/villages/{vid}/inventory/equip"),
        ("post", "/villages/{vid}/inventory/unequip"),
        ("get", "/villages/{vid}/mayor/memory"),
        ("get", "/villages/{vid}/mayor/event-templates"),
        ("get", "/villages/{vid}/mayor/effects"),
        ("get", "/villages/{vid}/gazette/latest"),
        ("get", "/villages/{vid}/gazette"),
        ("post", "/villages/{vid}/messages"),
        ("get", "/villages/{vid}/messages"),
        ("get", "/villages/{vid}/messages/unread"),
        ("post", "/villages/{vid}/messages/{message_id}/read"),
        ("post", "/villages/{vid}/mayor/bribe"),
        ("post", "/villages/{vid}/presence/heartbeat"),
        ("get", "/villages/{vid}/presence/stream"),
        ("delete", "/me"),
    ]
    for route in documented_routes:
        require(route in routes, f"Documented demo route absent: {route}")

    video = DOCUMENTS[3].read_text(encoding="utf-8")
    shots = re.findall(r"^\| (\d\d:\d\d)–(\d\d:\d\d) \| (\d+) \|", video, re.M)
    cursor = 0
    for start, end, duration in shots:
        require(seconds(start) == cursor, "Video has a gap or overlap")
        require(seconds(end) - cursor == int(duration), "Video shot duration mismatch")
        cursor = seconds(end)
    require(len(shots) == 9 and cursor == 150, "Video must have nine shots totaling 150 seconds")

    pitch = DOCUMENTS[2].read_text(encoding="utf-8")
    segments = re.findall(r"^## (\d\d:\d\d)–(\d\d:\d\d)", pitch, re.M)
    cursor = 0
    for start, end in segments:
        require(seconds(start) == cursor, "Pitch has a gap or overlap")
        require(seconds(end) > cursor, "Empty pitch segment")
        cursor = seconds(end)
    require(len(segments) == 9 and cursor == 180,
            "Pitch must have nine stops totaling 180 seconds")
    spoken = re.findall(r"^> (.+)$", pitch, re.M)
    word_count = sum(len(line.split()) for line in spoken)
    require(len(spoken) == 9 and 300 <= word_count <= 500,
            "Expected nine spoken segments and 300-500 words")
    evidence_files = [
        "apps/api/tests/test_v2.py", "apps/api/tests/test_api003.py",
        "apps/api/tests/test_api004.py", "apps/api/tests/test_demo_story.py",
        "apps/web/tests/real.spec.ts", "apps/web/tests/connection.spec.ts",
        "apps/web/tests/auth.spec.ts", "programs/tests/pot.test.mjs",
        "packages/pot-client/tests/pot.test.ts", "packages/pot-client/tests/wallet.test.ts",
        "packages/pot-client/tests/react.test.ts", "workers/gpu/bridge.py",
    ]
    evidence_files += [
        "apps/api/tests/test_api007.py", "apps/api/tests/test_api008.py",
        "apps/api/tests/test_api009.py", "apps/api/tests/test_api010.py",
        "apps/web/tests/audits.spec.ts", "apps/web/tests/equipment.spec.ts",
        "apps/web/tests/web012.spec.ts", "apps/activity/tests/test_activity.py",
        "workers/gpu/items.py", "assets/sfx/qa.json",
    ]
    catalog = json.loads((ROOT / "packages/catalog/catalog.json").read_text(encoding="utf-8"))
    models = set((ROOT / "apps/web/public/models").glob("*.glb"))
    references = {e["asset"]["glb"] for e in catalog["entries"] if e.get("asset", {}).get("glb")}
    sounds = json.loads((ROOT / "apps/web/public/sfx/manifest.json").read_text(encoding="utf-8"))
    counts = (len(models), len(catalog["entries"]), len(references), len(sounds))
    require(counts == (134, 105, 101, 18),
            f"Asset snapshot changed: {counts}; update documentation and expected inventory")
    for sound in sounds:
        asset = ROOT / "apps/web/public" / sound["file"].lstrip("/")
        require(asset.is_file() and asset.with_suffix(".ogg").is_file(), "Missing SFX formats")
    for name in evidence_files:
        require((ROOT / name).is_file(), f"Referenced evidence source absent: {name}")
    architecture = DOCUMENTS[4].read_text(encoding="utf-8")
    require(architecture.count("```mermaid") == 3, "Expected three architecture diagrams")
    print(f"PASS: {len(DOCUMENTS)} documents, {links} local links, {len(documented_routes)} API routes")
    print(f"PASS: {len(evidence_files)} evidence source files; three Mermaid fences")
    print(f"PASS: {len(models)} GLBs, {len(catalog['entries'])} registry entries, "
          f"{len(references)} GLB references, {len(sounds)} sounds in both formats")
    print(f"PASS: video 150 seconds; pitch 180 seconds, {word_count} spoken words")
    if args.live:
        with urllib.request.urlopen("http://localhost:8010/api/health", timeout=10) as response:
            health = json.load(response)
        require(health.get("ok") is True and health.get("db") == "up", "API/DB unhealthy")
        with urllib.request.urlopen("http://localhost:8010/openapi.json", timeout=10) as response:
            paths = json.load(response)["paths"]
        for method, path in documented_routes:
            require(method in paths.get("/api" + path, {}), f"Live route missing: {method} {path}")
        print(f"PASS: live health build={health.get('build')}, db={health.get('db')}, "
              f"gpu={health.get('gpu_worker')}; {len(paths)} OpenAPI paths")
    else:
        print("Live services not checked (use --live for read-only health/OpenAPI).")
    print("Not checked: application tests, external links, provider delivery, Markdown/Mermaid rendering")


if __name__ == "__main__":
    main()
