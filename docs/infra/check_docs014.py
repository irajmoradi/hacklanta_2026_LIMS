"""DOCS-014/015 offline checks: env readers, links, and safe example values.

Run from any directory: python docs/infra/check_docs014.py
No application imports, private env reads, providers, database or network calls.
"""

import argparse
import ast
from collections import defaultdict
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
DOCS = ["README.md", "docs/SETUP.md", "docs/devpost/SUBMISSION.md",
        "docs/devpost/DEMO_SCRIPT.md", "docs/devpost/EVIDENCE.md", "docs/infra/PRODUCTION-DEPLOYS.md",
        "docs/infra/REMOTE_RUNNER.md", "docs/infra/DOCS-014-REPORT.md",
        "docs/infra/DOCS-015-REPORT.md", "docs/auth/JUDGE_LOGIN.md",
        "docs/auth/FEAT-029_REPORT.md", "docs/solana/FEAT-027.md",
        "docs/devpost/video/TRAILER.md", "docs/devpost/video/TRAILER-005.md"]


def environment_readers():
    """Literal Python/JS reads, shell default inputs, and reviewed dynamic names.

    Include test/tool controls; exclude shell locals, SDK built-ins and generated code.
    Dynamic env maps cannot be exhaustively inferred: explicit lists cover config.ts,
    destructured browser auth, SEC-001 and deployment integrations.
    """
    found = defaultdict(set)
    files = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).splitlines()
    for name in files:
        p = ROOT / name
        if p.suffix not in {".py", ".ts", ".tsx", ".mjs", ".sh", ".yml"}:
            continue
        if not name.startswith(("apps/", "workers/", "ops/", "packages/", "infra/", "tools/", "programs/")):
            continue
        if "/generated/" in name:
            continue
        source = p.read_text(encoding="utf-8-sig", errors="replace")
        names = set()
        if p.suffix == ".py":
            tree = ast.parse(source)
            for node in ast.walk(tree):
                if isinstance(node, ast.Call) and ast.unparse(node.func) in {
                    "os.getenv", "os.environ.get", "os.environ.setdefault"
                } and node.args and isinstance(node.args[0], ast.Constant):
                    names.add(node.args[0].value)
                if isinstance(node, ast.Subscript) and ast.unparse(node.value) == "os.environ" and isinstance(node.slice, ast.Constant):
                    names.add(node.slice.value)
        else:
            names.update(re.findall(r"(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)", source))
            names.update(re.findall(r"(?:process\.env|import\.meta\.env)\[['\"]([A-Z][A-Z0-9_]*)['\"]\]", source))
            if p.suffix in {".sh", ".yml"}:
                names.update(re.findall(r"\$\{([A-Z][A-Z0-9_]*):[-?]", source))
        for key in names:
            if isinstance(key, str) and key not in {"HOME", "PATH", "TEMP", "NODE_ENV", "DEV", "PROD", "BASE_URL", "MODE", "SSR"}:
                found[key].add(name)
    explicit = {
        "apps/imessage/src/config.ts": "SERVICE_KEY PROJECT_ID PROJECT_SECRET VILLAGE_API_URL OUTBOX_POLL_MS PHOTON_SEND_ENABLED",
        "apps/web/src/Auth.tsx": "VITE_AUTH0_DOMAIN VITE_AUTH0_CLIENT_ID VITE_AUTH0_AUDIENCE VITE_AUTH0_ENABLED",
        "apps/web/src/components/DemoTools.tsx": "VITE_DEMO_DEBUG",
        "workers/gpu/scripts/env.sh": "HF_TOKEN",
        "workers/modal/wsl_modal.sh": "MODAL_CONFIG_PATH MODAL_PROFILE",
        "infra/compose.prod.yml": "POSTGRES_PASSWORD",
        "ops/deploy/prod-db.sh": "POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD_FILE",
        "Uvicorn CLI environment option": "UVICORN_LOOP",
        "docs/infra/REMOTE_RUNNER.md": "RUNNER_IP RUNNER_SSH_KEY",
    }
    for reader, keys in explicit.items():
        for key in keys.split():
            found[key].add(reader)
    for kind in ("LLM", "ELEVENLABS", "GPU", "PHOTON", "PHOTON_QUEUE"):
        for scope in ("GLOBAL", "IP", "SEAT"):
            found[f"COST_{kind}_{scope}_DAILY"].add("apps/api/app/security.py")
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shell", action="store_true", help="also parse Bash examples without executing them")
    args = parser.parse_args()
    example = (ROOT / ".env.example").read_text(encoding="utf-8")
    assignments = re.findall(r"^\s*(?:#\s*)?([A-Z][A-Z0-9_]*)=(.*)$", example, re.M)
    names = [name for name, _ in assignments]
    assert len(names) == len(set(names)), "Duplicate environment names"
    missing = set(environment_readers()) - set(names)
    assert not missing, f"Undocumented environment readers: {sorted(missing)}"
    # These public flags must stay explicit: raw Vite can enable configured Auth0
    # when unset, and the Lab's direct fetch bypasses the mock API client.
    for name in ("VITE_AUTH0_ENABLED", "VITE_DEMO_DEBUG"):
        assert re.search(rf"^{name}=0$", example, re.M), f"Expected safe default: {name}=0"
    for name in ("OMP_THREAD_LIMIT", "QA014_FOLLOWUP"):
        assert name in names, f"Missing new trailer/QA control: {name}"
    for name, value in assignments:
        if name.endswith(("_KEY", "_TOKEN", "_SECRET", "_PASSWORD", "_DATABASE_URL")) or name == "DATABASE_URL":
            assert not value, f"Credential placeholder must be blank: {name}"
    for relative in DOCS:
        path = ROOT / relative
        source = path.read_text(encoding="utf-8")
        assert source.count("```") % 2 == 0, f"Unclosed fence: {relative}"
        for target in re.findall(r"\]\(([^)]+)\)", source):
            if re.match(r"(?:https?://|mailto:|#)", target):
                continue
            target = target.split("#", 1)[0]
            assert (path.parent / target).exists(), f"Broken link: {relative}: {target}"
    print(f"PASS: {len(names)} environment names cover {len(environment_readers())} detected/reviewed readers; {len(DOCS)} documents have valid local links and fences.")
    for relative in ("README.md", "docs/SETUP.md", "docs/devpost/DEMO_SCRIPT.md"):
        source = (ROOT / relative).read_text(encoding="utf-8")
        launches = re.findall(r"VITE_MOCK=1[^\n`]*bun run dev[^\n`]*", source)
        assert launches, f"Missing offline launch: {relative}"
        for launch in launches:
            assert "VILLAGE_API_URL=http://127.0.0.1:9" in launch, f"Unsafe Lab proxy: {relative}"
            assert "VITE_AUTH0_ENABLED=0" in launch, f"Implicit auth flag: {relative}"
    print("PASS: explicit hidden auth/debug defaults and isolated offline Lab launch examples.")
    script = (ROOT / "docs/devpost/DEMO_SCRIPT.md").read_text(encoding="utf-8")
    beats = re.findall(r"^\| (\d+):(\d+)\u2013(\d+):(\d+) \|", script, re.M)
    cursor = 0
    for start_min, start_sec, end_min, end_sec in beats:
        start, end = int(start_min) * 60 + int(start_sec), int(end_min) * 60 + int(end_sec)
        assert start == cursor and end > start, "Demo beats must be contiguous"
        cursor = end
    assert len(beats) == 8 and cursor == 150, "Expected eight beats totaling 150 seconds"
    print("PASS: eight contiguous demo beats total 150 seconds (not a timed UI rehearsal).")
    if args.shell:
        bash = shutil.which("bash")
        assert bash, "Bash is required for --shell"
        count = 0
        for relative in DOCS:
            source = (ROOT / relative).read_text(encoding="utf-8")
            for block in re.findall(r"```(?:bash|sh)\n(.*?)```", source, re.S):
                result = subprocess.run([bash, "-n"], input=block, text=True, capture_output=True)
                assert result.returncode == 0, f"Invalid Bash in {relative}: {result.stderr}"
                count += 1
        print(f"PASS: bash -n parsed {count} command blocks; none executed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
