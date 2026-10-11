---
id: INTEG-018
owner: codex (gpt-6-astra, high)
branch: integ/INTEG-018
allowed_paths: [apps/web/**, apps/api/**, apps/imessage/**, packages/**, docs/perf/**]
---
# INTEG-018 — Land the PERF-002 / INTEG-015 performance pass on current main

`integ/INTEG-015` (read `docs/INTEG-015-REPORT.md` on that branch) has the performance pass: lazy loading, renderer
optimizations, GLB compression and cache handling, API gzip and ETags. RTX 5090: 53→162 FPS; cold transfer 10.8→2.85 MB;
visual diff 0.135%. It is NOT merged. It branched hours ago, and main has since gained (all merged and live):
- WEB-043/050 town variety and woodland; SCALE-001 (crowd LOD, label culling, 053 indexes);
- FEAT-019 Hall/floors; FEAT-020 library; WEB-040/042/048 cinematics; WEB-044 close-up and seating; WEB-045 walk focus;
- WEB-046 friends hub; WEB-049 house undo; ASSET-013 new wearables; Gemini switch; DEPLOY-002 production deploy flow.
In this worktree, `git merge --no-ff integ/INTEG-015`. Resolve every conflict keeping ALL current main behavior plus the perf
work. When in doubt, main's feature behavior wins and the perf change adapts. Then:
1. Fix the six unresolved browser cases from the INTEG-015 report (or prove they're obsolete on current main).
2. Re-measure (same method as the report): cold transfer, fps overview/street, draw calls. Report before/after against current main.
3. GLB compression must not break any model added since (new wearables, Hall furniture, trees); check the fallbacks.
4. Prod serving: if API gzip/ETags or cache headers need web-server config, describe it for `ops/deploy` in your report
   (don't edit ops).
Run the full web suite, full API suite, build and the key Playwright specs (village, house, cinematics, wardrobe) via
`ops/remote_run.sh` (AGENTS.md); mock or scratch only. Commit the merge on `integ/INTEG-018`. Final report per AGENTS.md.
If acceptance can't be reached, land the safe subset (API gzip/ETags, lazy loading, cache headers) and list what was deferred.
