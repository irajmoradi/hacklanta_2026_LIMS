---
id: INTEG-008
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-008 (from main)
allowed_paths: [apps/**, packages/**, docs/**]
---
# INTEG-008 — Land INTEG-007 onto the latest main

`git merge --no-ff integ/INTEG-007` (FEAT-007 coins/SOL/XP + WEB-029 organic map + perf) into this branch (= current main). Main
gained INTEG-006 (hero colosseum + arena prewarm) and FIX-006 (batched village queries in apps/api/app/domain.py: 83 → 28 SQL
calls, prepare_threshold/hot-migration safety, optimistic save acknowledgments in App.tsx, photo-token affordability in
PhotoItems.tsx, colosseum contrast). Conflicts: domain.py, App.tsx, CompetitionsPanel.tsx, PhotoItems.tsx, styles.css. Keep
BOTH: FIX-006's batched queries must also batch the new coin balances (no N+1 regression; re-measure village GET p95 <250 ms);
PhotoItems affordability must use **coins**; keep optimistic saves; keep arena prewarm + contrast; keep the map perf work.
Run everything: API pytest (note FIX-007 is separately fixing 5 known baseline failures in test_api009 penalties + registry
count; don't duplicate that, just report them), web typecheck/test/build, catalog, branch e2e, the perf script (≥55 fps on the
5090). Don't merge to main. Final report.
