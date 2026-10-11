"""Deterministic agent status snapshot (no LLM). Usage: python ops/status.py"""
import json, pathlib, subprocess, datetime
ROOT = pathlib.Path(__file__).resolve().parents[1]
WTS = {"FIX-022": "hl-fix22", "WEB-053": "hl-web53", "FEAT-026": "hl-feat26", "TRAILER-003": "hl-trailer3", "WEB-054": "hl-web54"}
def git(wt, *a):
    try: return subprocess.run(["git", "-C", str(ROOT.parent / wt), *a], capture_output=True, text=True, timeout=20).stdout.strip()
    except Exception as e: return f"? {e}"
now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
print(f"snapshot {now}")
for task, wt in WTS.items():
    commits = git(wt, "log", "--oneline", "main..HEAD")
    n = len(commits.splitlines()) if commits else 0
    dirty = len(git(wt, "status", "--porcelain").splitlines())
    last = commits.splitlines()[0][8:70] if n else "-"
    rep = ROOT / "ops/reports" / task
    state, last_msg = "subagent", ""
    if (rep / "events.txt").exists():
        ev = (rep / "events.txt").read_text().strip().splitlines()
        state = "done" if ev and " exit " in ev[-1] else "running"
        try:
            for line in reversed((rep / "events.jsonl").read_text(encoding="utf-8", errors="ignore").splitlines()):
                j = json.loads(line); it = j.get("item", {})
                if it.get("type") == "agent_message": last_msg = it.get("text", "")[:140].replace("\n", " "); break
        except Exception: pass
    print(f"{task} [{state}] commits={n} dirty={dirty} last_commit='{last}' note='{last_msg}'")
