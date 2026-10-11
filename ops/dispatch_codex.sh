#!/usr/bin/env bash
# Usage: ops/dispatch_codex.sh <TASK_ID> <worktree_dir>
# Runs one Codex worker (MODEL, default gpt-6-astra; EFFORT, default medium) non-interactively in its own worktree. Logs stay local (ops/reports, gitignored).
set -u
TASK="$1"; WT="$2"; ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/ops/reports/$TASK"; mkdir -p "$LOG"
export VILLAGE_ENV_FILE="$ROOT/.env"
PROMPT="You are a Codex worker on the Village hackathon project. Your task record is docs/tasks/$TASK.md in this worktree — read it and AGENTS.md first, then complete it fully and autonomously (no questions; make reasonable choices and note them). The root .env with secrets is at \$VILLAGE_ENV_FILE ($ROOT/.env) — read values from it at runtime, never copy secrets into files. Work only inside allowed_paths. Commit to the current branch as you reach milestones. End with the final report required by AGENTS.md."
echo "$(date -Is) start $TASK in $WT" >> "$LOG/events.txt"
# Windows workspace-write sandbox is broken on this host (see D-013); workers are confined by worktree + allowed_paths.
codex exec -m "${MODEL:-gpt-6-astra}" -C "$WT" --dangerously-bypass-approvals-and-sandbox \
  -c model_reasoning_effort="${EFFORT:-medium}" \
  --json -o "$LOG/final.md" "$PROMPT" < /dev/null > "$LOG/events.jsonl" 2> "$LOG/stderr.txt"
echo "$(date -Is) exit $? $TASK" >> "$LOG/events.txt"
