---
id: INTEG-015
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-015 (from main, AFTER INTEG-014 lands)
allowed_paths: [apps/**, packages/**, docs/**]
---
# INTEG-015 — Land PERF-002 (whole-app performance pass) on main

`git merge --no-ff perf/PERF-002`. It branched long ago; main since gained many features (FEAT-013 interiors, FEAT-014 colosseum modes, FEAT-015/016/
017/018, WEB-030–039, FIX-008–016, VFX-001, INTEG-012/013/014). Keep every feature; re-apply PERF-002's techniques to the new code too: lazy-load
the new heavy modules (shop/farm interiors, house interiors + Tiger live editor, HeadStudio/chorus, colosseum, cinematic check-in/Mayor scenes,
disaster VFX) with idle prefetch; GLB compression for assets added after PERF-002 branched (ASSET-008..012, FEAT-008/013/015 furniture, café patio,
Community Hall if present); memoization/re-render fixes; API gzip + ETags for any new read endpoints. Known conflicts now: App.tsx, ProfilePanel.tsx,
VillageScene.tsx, tests/connection.spec.ts.
Measure after merging (headed RTX 5090; mention host contention): town fps, transitions (town↔arena, shop, house interior, check-in scene), cold
transfer, main chunk gzip, visual diff ≤1%. All suites green. Don't merge to main. Report before/after numbers.
