---
id: INTEG-014
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-014 (from main, START AFTER INTEG-013 lands — same files)
allowed_paths: [apps/**, packages/**, docs/**]
---
# INTEG-014 — Land FEAT-018 (stretch goals) + FEAT-016 (cinematic check-in/Mayor) + FEAT-015 (house interiors on Tiger) on main

`git merge --no-ff feat/FEAT-018` then `git merge --no-ff feat/FEAT-016`. Main by then includes INTEG-013 (toast system + de-AI copy), FEAT-017
talking heads (migration 048_head_speech), FIX-013/014/015, WEB-035/036/037, VFX-001, FEAT-014.
- FEAT-018's migration `048_goal_stretch.sql` collides with main's `048_head_speech.sql`: renumber to the next free number (049+) and update
  references. Its edits to `047_competition_scoring.sql` only add IF NOT EXISTS idempotency guards; keep them.
- Conflicts expected: package.json (union test lists), ActivityFeed.tsx, Modals.tsx, ProfilePanel.tsx (keep HeadStudio, settings gear),
  WeekPanel.tsx (keep FIX-013 auditor exclusion + compact cards and add stretch tiers), api.md (keep all sections).
- FEAT-016's cinematic check-in "Goal progress" choice must target the current stretch tier when the goal is done and stretched (FEAT-018),
  and use the toast system for confirmations; copy follows COPY-001's voice.
- Then `git merge --no-ff feat/FEAT-015` (house interiors, live furniture on Tiger). Its migrations `047_house_interiors.sql` and `048_house_presence.sql`
  collide with main's 047/048: renumber them after FEAT-018's (e.g. 050, 051) and update `apps/api/scripts/tiger_migrate.py` and references. They were
  already applied to the Tiger service under the old names — make the renumbered migrations idempotent (IF NOT EXISTS) so re-running is safe.
  FEAT-015's house editor entry must coexist with WEB-020's House editor (exterior) and FEAT-016's check-in-at-home scene.
Run everything (API pytest, web typecheck/test/build, e2e for both features + HUD overlap). Scratch DBs only. Don't merge to main. Report.
