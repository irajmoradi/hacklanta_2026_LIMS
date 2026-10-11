---
id: FEAT-018
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-018 (parallel; FEAT-016 cinematic check-in + FIX-013 weekly review touch nearby UI)
allowed_paths: [apps/api/**, apps/web/**, packages/contracts/api.md]
request: R-95 (Iraj 18:23) "can we build on the initial goal and strive above and beyond?"
---
# FEAT-018 — Stretch goals: go above and beyond after "done"

Today, once a weekly goal is `done`, goal-progress check-ins are locked until the next week. Add **stretch tiers** on the same goal:
- When your goal is done, My goal + the check-in show **"🚀 Go beyond"**: you add a stretch target (e.g. "Run 3×" → "Run 5×", optional), and the
  goal becomes `stretch` (tier 1, 2, 3…). Goal-progress check-ins work again and count toward the stretch tier; marking a stretch done
  awards bonus coins/XP (e.g. +50% of the base goal reward per tier, capped at 3 tiers/week) and a little "Above & beyond" badge on the goal,
  the profile and the feed.
- Weekly review: the auditor sees the base goal + stretch tiers with their evidence; the score adds a stretch bonus (ambition weight), so
  going beyond can win the crown; still one goal per person (stretch tiers extend it, not new goals).
- API: migration with suffix `_goal_stretch` (`goal_stretches` table: goal_id, tier, title, status, completed_at; or columns, your call);
  `POST /goals/{gid}/stretch {title}`, `POST /goals/{gid}/stretch/{tier}/status`; progress check-ins accept `stretch_tier`; XP/coin awards
  idempotent; api.md; pytest.
- Web: My goal panel shows the base goal ✓ with stacked stretch tiers (progress bar each); the check-in "Goal progress" option targets the
  current tier; accomplishments + feed show "went above & beyond".
Do NOT trigger world events on the live village. Tests: pytest, unit, e2e (mock: complete goal → go beyond → progress → finish tier → bonus).
Final report per AGENTS.md.
