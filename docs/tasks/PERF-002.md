---
id: PERF-002
owner: codex (gpt-6-astra, medium)
branch: perf/PERF-002 (from main; FEAT-013 shop interiors runs in parallel)
allowed_paths: [apps/web/**, apps/api/**, assets/**, apps/web/public/models/**]
request: R-68 (Iraj 17:11) "it will need a nice performance pass"
---
# PERF-002 — Whole-app performance pass

Measure first and commit the numbers (before/after table in the report). Targets on the RTX 5090, headed Chromium, 1440×1000:
town ≥100 fps steady; no frame >50 ms on any transition (town↔arena, profile open, shop open, fullscreen toggle, dashboard pop-out);
first load (cold, through the Cloudflare tunnel, simulated 25 Mbps) to interactive town ≤4 s; JS bundle main chunk ≤600 KB gz;
total transferred on first visit ≤8 MB, repeat visit ≤500 KB. Also report a mid-range profile: CPU 4× throttle plus the
`quality` low tier ≥45 fps.
Likely work (verify with traces before changing): code-split heavy routes (Colosseum, profile showcase, Wardrobe, House editor,
GaussianHead/LAM viewer, Make it real) with React.lazy + prefetch on hover/idle; compress GLBs (meshopt or Draco + KTX2/webp textures,
gltf-transform in a build script; keep originals); dedupe materials; instancing audit; reduce React re-renders (memo, stable props,
zustand selectors instead of top-level state for per-frame data); throttle Html labels; avoid layout thrash in the dashboard; the API:
add ETag/304 for village/feed reads and gzip responses; preload critical assets. Keep visuals identical (screenshot diff ≤1%).
Tests: perf scripts under apps/web/tests/perf committed + all existing suites green. Final report per AGENTS.md.
