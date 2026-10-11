# PERF-002 performance report

Branch: `perf/PERF-002`. All implementation changes stay in `apps/web` and `apps/api`.
No provider generation or Solana transactions were requested. The external environment
file was loaded at runtime by the existing disposable API fixture; no secrets were copied.

## Changes and evidence

- The baseline CPU profile spent about 2.56 of five seconds in Three's program selection
  and parameter construction. Physical transmission rendered the scene with two different
  output/tone-mapping program variants each frame. `TownRenderer` keeps both passes linear
  and applies output conversion once. Default glass, geometry, lighting and authored textures
  remain intact. Low quality uses alpha glass to avoid the extra refraction pass.
  Low quality renders directly without the HDR/output pass. Offscreen buffer width
  stays fixed during profile-width animation, avoiding repeated allocations.
- Cloned GLBs reuse matching materials within each instance. Instances keep separate
  palettes. Houses, characters and the town are memoized with stable callbacks; character
  activity still advances on the five-second schedule. Label geometry reads precede writes.
  The instancing audit found existing batches for trees, repeated town props and arena
  crowds, plus merged arena geometry; those working paths were retained.
- Profile, shop/check-in/goal/Mayor panels, Outfit, House editor and Make it real load through
  local Suspense boundaries. Hover/focus and idle prefetch warm common panels without
  unmounting the town. Existing arena and LAM splitting remain. Photo objects no longer
  pull the showcase renderer into the entry bundle.
- The build writes lossless gzip sidecars and versions model URLs from model content.
  Original GLBs remain untouched. The preview server negotiates compression and immutable
  caching. This achieves the transfer budget without lossy geometry or texture conversion.
- Village/feed JSON supports private ETags and 304 after authorization. JSON uses gzip.
  Revalidation still executes the authorized read; it does not cache database results.
  Live seeded checks: village 4,504 decoded bytes / 866 gzip bytes; feed 6,402 / 1,317.
  Each unchanged conditional read returned 304 with zero body bytes.

## Measurements

**The strict full performance gate is not yet consistently green on this shared host.**
Every budget has been observed individually, but the latest full run failed the profile
transition and low-tier FPS checks while host CPU was 77% busy overall / 86% during low
sampling. Do not treat the best samples as a guarantee under concurrent browser jobs.

| Metric | Before | Final-code samples | Budget |
| --- | ---: | ---: | ---: |
| Normal steady town | 76.52 FPS | 124.47–203.80 FPS | >=100 |
| Largest transition frame | 47.6 ms | 44.6–80.8 ms | <=50; inconsistent |
| CPU 4x / low tier | 10.94 FPS | 31.19–45.18 FPS | >=45; inconsistent |
| Canvas/control readiness | 0.687 s | 0.692–0.755 s | <=4 s |
| Visible projected villager | not recorded | 1.294–1.351 s | <=4 s |
| Main chunk gzip | 232,824 B | 201,991 B | <=600,000 B |
| Cold transfer | 8,289,776 B | 2,248,006–2,248,044 B | <=8,000,000 B |
| Repeat transfer | 3,023 B | 610–1,240 B | <=500,000 B |
| Default / profile visual difference | reference | 0.3688% / 0.0417% | <=1% |

The final-code range uses `after-shared-context/metrics.json`, `after/metrics.json`
and the independent `low-isolated/metrics.json` / `low-verified/metrics.json`. The shared-context run had **zero**
transition frames over 50 ms (profile 39.9, shop 44.6, arena 12.1, town return 17.3,
fullscreen 10.2, fullscreen return 12.4, dashboard 17.0 ms). The latest fresh-context
run had one 80.8 ms profile frame; all other transitions stayed below 50 ms.
The isolated low sample passed at 45.18 FPS with 38.5% host CPU usage. A later probe
with explicit GPU/error checks measured 31.19 FPS at 80.3% host CPU usage (RTX 5090,
no browser errors, exit 1). Earlier failed
and intermediate samples are retained, including the severely contended run which
automatically fell back to low quality. No other worktree's processes were stopped.

The real-API development probe independently passed at **131.89 FPS**, 707 scene-pass
draw calls and 125,718 triangles, with shadows enabled and no browser exceptions.
See `artifacts/perf002/live/after-hardware.json` and its compressed Chrome timeline.

Baseline: `artifacts/perf002/before/metrics.json`, committed before implementation.
Headed Chromium, RTX 5090, 1440x1000, DPR 1, uncapped rAF. Network samples use a
Cloudflare quick tunnel, 25 Mbps and 20 ms added latency. The test clears the browser
cache, not Cloudflare's infrastructure cache. Fixture town assets are used for reproducibility.
Interactive means visible profile control and attached town canvas (procedural fallback
is usable); it does not imply all optional models have finished loading. Cold bytes include
15 seconds of idle loading, including arena warm-up. Transition windows include the click
and 1.2 seconds afterward. Steady samples last five seconds after warm-up. These are
browser frame intervals, not measurements of physical display presentation.
The final low-device profile uses a fresh browser context; baseline and earlier runs
reused the desktop context. This avoids carrying the desktop tour's audio/unlock state
and retained pages into a different simulated device. The stronger rendered-readiness
check and explicit quality assertion were also added after baseline measurement.

Visual A/B freezes the exact same scene and compares direct rendering with the new
compositor. Pixelmatch's standard 0.1 perceptual threshold, including antialiasing pixels,
reports 5,311 changed pixels of 1,440,000 (0.3688%, budget 1%). No regions are masked.
The stricter raw channel-difference >8 diagnostic is 1.0293%; mean absolute channel
difference is 0.0976%. Evidence: `artifacts/perf002/visual/{direct,composed,diff}.png`
and `comparison.json`. This validates default rendering, not identical low-tier refraction.
The profile-view comparison is in `visual-profile/`: 601 changed pixels (0.0417%).
Both comparisons confirmed normal quality, DPR 1, shadows enabled, and six meshes with
physical transmission. The profile screenshot was also inspected visually.

## Reproduce

Follow `tests/perf/README.md` for fixture builds, tunnel measurements, CPU profiles,
production smoke, visual A/B and the disposable real-API integration sample.
Use `PERF_ASSERT=1` to enforce every PERF-002 budget; run GPU measurements serially.
Open My profile / Outfit / House, Shop, Compete and return to Village, toggle fullscreen,
then pop out Around the Village. Repeat with model requests blocked to exercise fallback.

## Validation

Commands run from the corresponding app directory (all listed completed runs exited 0):

- Web `bun run test`: 127 passed; broader `bun test src`: 153 passed across 38 files.
- Web `bun run typecheck` and fixture `bun run build`.
- API Python 3.12 virtual environment: `python -m pytest -q`: 419 passed, 3 skipped.
  After adding the real membership regression, `python -m pytest -q tests/test_perf002.py`:
  2 passed. The baseline full API suite had 418 passed, 3 skipped.
- API `python -m ruff check app/main.py app/assets_cache.py app/read_cache.py tests/test_perf002.py`.
- Web `bunx playwright test --config playwright.perf.config.ts`: 3 passed (all optional
  models available, every model blocked, gzip bytes/caching).
- Web `node tests/perf/visual.mjs` and `node tests/perf/visual-diff.mjs`.
- The same visual commands with `PERF_VISUAL_PROFILE=1`.
- Web `node tests/perf/low.mjs`: isolated 45.18 FPS, exit 0; later verified run 31.19 FPS, exit 1 (recorded separately from the passing commands above).
- Web `node tests/perf/trace.mjs`, its `PERF_LOW=1` variant and `shop-trace.mjs`: exit 0.
- Web `VILLAGE_PERF_DIR=artifacts/perf002/live node tests/perf/town.mjs after hardware`:
  131.89 FPS, exit 0. The disposable API was then stopped through `/qa/stop`; its process
  exited 0 after teardown and private-schema cleanup.
- Web `bunx playwright test tests/web017.spec.ts --grep 'opening a profile' --reporter=line`:
  1 passed after the buffer-sizing change. Production smoke was rerun afterward: 3 passed
  with `PERF_PREVIEW_PORT=5197` (port 5187 was occupied, and that earlier attempt exited 1).

Default browser suite history (hardware opt-in, no retries hidden):

| Invocation | Passed | Failed | Exit |
| --- | ---: | ---: | ---: |
| `bunx playwright test --reporter=line,json` | 41 | 30 | 1 |
| `bunx playwright test --last-failed --reporter=line,json` | 25 | 4 | 1 |
| same command after corrections | 3 | 1 | 1 |
| `bunx playwright test tests/fix003.spec.ts tests/web015.spec.ts --grep 'phone people\|portraits populate' --reporter=line,json` | 2 | 0 | 0 |

`artifacts/perf002/e2e-coverage.json` records **71/71 scenarios with a passing latest
result across these runs**, not a single clean full-suite invocation. The renamed
portrait/dashboard test was explicitly included in the last run. Sanitized per-run
summaries are committed; raw runner logs are not. Two earlier exploratory software/
stale-selector runs were interrupted and are not counted as passing validation.

`PERF_ASSERT=1 node tests/perf/measure.mjs` is a separate performance gate: its latest
exit was **1** for the transition/low-tier misses described above. It must be rerun on
a quiet host before claiming every budget passes together. No failed budget was relaxed.

Older browser tests were updated for current Outfit/House navigation, photo creation,
profile settings, demo seats and dashboard controls. Model-failure routes now match
versioned URLs. Hardware opt-in shares the existing GPU argument helper; software GL
remains the default. Test-generated changes to other tasks' committed screenshots are
not included in this task's commits.

## Deployment and scope

The production-preview measurements require compression and cache headers at the host.
The shared `infra/Caddyfile` is outside this task's allowed paths and was not edited.
The integrator should enable `precompressed gzip` inside its `file_server` block and
immutable caching for hashed `/assets/*` and revisioned `/models/*.glb?v=...` URLs;
unversioned model URLs should revalidate. Caddy's existing `encode zstd gzip` remains
useful for responses without sidecars. See the official
[file_server documentation](https://caddyserver.com/docs/caddyfile/directives/file_server)
for sidecar negotiation. A deployment using another host needs equivalent behavior.

No HTTP or database contract changes are proposed. GPU workers remain optional.

## Files and commits

- API: `app/main.py`, `app/assets_cache.py`, new `app/read_cache.py`, and
  `tests/test_perf002.py`.
- Web: `performanceAssets.ts`, `vite.config.ts`, `package.json`, `bun.lock`,
  `src/App.tsx`, `components/{ProfilePanel,ShowcasePreview,PhotoObject,lazyPanel}.tsx`,
  `scene/{TownRenderer,VillageScene,OptionalModel,LabelSpacing,TownCamera}.tsx`,
  `scene/quality.ts` and corresponding unit tests, plus the current Gazette label assertion.
- Verification: both Playwright configs, current browser regression flows, all probes
  under `tests/perf`, and measurements/screenshots under `artifacts/perf002`.
  Only PERF-002 evidence is added; other tasks' screenshot changes are restored.
- Milestones: `d272e70` baseline; `a90df6c` API compression/revalidation;
  `550db64` renderer/splitting/transport; `5879a44` visual/fallback validation.
  `d84d719` contains the final render-buffer, regression and probe changes; later commits
  contain this report and its evidence.

Remaining blockers: strict whole-run performance certification on a quiet host, and
the out-of-scope shared Caddy configuration change. No pushes or merges were performed.
