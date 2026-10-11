---
id: INTEG-009
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-009 (from main)
allowed_paths: [apps/**, packages/**, docs/**]
---
# INTEG-009 — Land INTEG-008 (coins + organic map) onto main with WEB-031

`git merge --no-ff integ/INTEG-008` into this branch (= main). Main gained WEB-031 (left Dashboard widgets component,
useCleanView fullscreen, zoom-collapse; App.tsx restructured: the dashboard replaces the old feed-panel/self-card) and FIX-007
(API tests green: keep main's versions of apps/api/tests/test_api009.py and test_catalog_registry.py). Conflicts: App.tsx,
VillageScene.tsx (+ those two tests). Resolution intent: WEB-031's layout wins structurally; port INTEG-008's additions into
it. The **wallet balances** (XP 💎 · coins 🪙 · SOL devnet tag) go into the top bar or the "Your corner" dashboard widget (not the
removed self-card); currency icons are used in dashboard widgets; VillageScene keeps BOTH WEB-031's `onZoomChange` + clean-view exit
handlers AND INTEG-008's map/perf changes. Run everything: API pytest (0 failed expected), web typecheck/test/build, catalog,
e2e (dashboard, clean view, currency, map), perf ≥55 fps on the 5090. Don't merge to main. Final report.
