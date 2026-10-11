---
id: INTEG-006
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-006 (from main)
allowed_paths: [apps/**, packages/**, assets/**, docs/**]
---
# INTEG-006 — Land the hero colosseum + fix arena transition perf

1. `git merge --no-ff asset/ASSET-010` (hero colosseum, R-64). It branched from asset/ASSET-009 before ASSET-008's material
   library and WEB-028's colosseum-first Compete landed, so it conflicts in Colosseum.tsx, ColosseumScene.tsx, assets/*
   (gitignore, CATALOG, README, check_glb.py, tests) and catalog.json/schema/dist. Keep BOTH: WEB-028's arena-first UX
   (banners, filters, create-in-arena, transitions) + ASSET-010's model, intro (portcullis, banners), lighting and ambience.
   Switch ASSET-010's local stand-in materials to the shared ASSET-008 material library where equivalent.
2. **Perf (blocking acceptance):** INTEG-005 measured a 133 ms frame during the town→arena transition on an RTX 5090 (limit 50 ms).
   Profile it with a Playwright trace + `performance.mark` and fix the causes: pre-warm/precompile the arena (load the GLB,
   `gl.compile` its materials, and upload textures during idle time before the user clicks Compete); don't mount both scenes'
   heavy content in the same frame; pause town rendering *before* the swoop; instance the crowd/stands; avoid shader recompiles
   from light-count changes (keep the light count constant); move JSON/GLB parsing off the critical frame. Target: no frame
   >50 ms in the transition on the 5090, measured headed (not SwiftShader); also report the headless number.
Run all checks (web typecheck/test/build, catalog, assets, colosseum e2e + perf). All green. Don't merge to main. Final report.

## Completion

Completed on `integ/INTEG-006`: merge `d60e432`, implementation `83ad2e2`.
Final native RTX 5090 transition maxima: 20.8 ms headed, 33.3 ms headless; both pass
the strict 50 ms check. Full checks, screenshots, traces, decisions and teammate
instructions are in [INTEG-006-REPORT.md](INTEG-006-REPORT.md). No blockers or
proposed contract changes.
