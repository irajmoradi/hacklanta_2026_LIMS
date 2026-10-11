# INTEG-006 delivery report

Completed on `integ/INTEG-006`. Merge milestone: `d60e432`. Implementation: `83ad2e2`.
The subsequent evidence commit contains this report and the captured verification artifacts.
No push or merge to main was performed.

The hero Colosseum retains WEB-028's arena-first banners, filters, previews, creation,
explicit join/cost confirmation, evidence, reviews, settlement and return transition.
ASSET-010 adds the portcullis, cloth intro, crowd, lighting and ambience. Its original
stand-in surfaces now use ASSET-008's shared stone, fabric, wood, metal, shingle and
brass recipes. The generated GLB preserves UVs, vertex weathering, named anchors and
105 shared crowd instances. Static architecture and all 70 seating segments remain
batched by material. The merged catalog preserves the existing house variants and
head fitting metadata together with nature scatter metadata; it validates 291 entries.

The arena mounts during idle time after the town, stays mounted across visits, and
uses a stopped frame loop when inactive. It loads/parses GLBs before the entrance,
initializes textures, calls `gl.compile`, and draws all contender/material variants
into an offscreen target and the final framebuffer. The second draw matters because
the default framebuffer uses a different output-color-space shader variant.
The town pauses before two animation-frame boundaries and the entrance swoop.
The podium light remains mounted at zero intensity when unselected, preserving light
counts. Canvas measurement ignores the CSS scale, and the full-screen arena no longer
blurs the hidden town. The original camera, 240 ms entrance, reduced motion, fallback
geometry and participant controls remain intact. Hidden controls are excluded from
accessibility navigation, and dialogs retain opener focus behavior.

## Performance evidence

Native renderer in both final captures:
`ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 (0x00002B85) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
Neither final run used SwiftShader. Playwright traces are enabled; video is disabled
in the integration config to avoid video-encoder contention during GPU measurements.

| Final capture | Maximum interval | Median | p95 | Frames over 50 ms |
| --- | ---: | ---: | ---: | ---: |
| Headed | 20.8 ms | 7.0 ms | 7.1 ms | 0 |
| Headless | 33.3 ms | 16.7 ms | 16.8 ms | 0 |

The strict 50 ms assertion is unchanged and passed in both modes. The test verifies
that warmup finishes before the click and that town pause precedes arena entry.
Timing covers the frame spanning the actual Compete click through competition selection,
participant inspection and the complete camera move. Raw samples taken while Playwright
waits for the button are also retained in the JSON; those pre-click town frames are
not counted as transition frames. The test waits for the idle warmup marker rather
than benchmarking initial page/model loading. Clicking early still queues the reveal
until warmup finishes; initial startup/warmup itself is not certified below 50 ms.

The first merged headed capture failed at 343.95 ms (10 intervals over 50 ms).
The baseline used the older test's broader pre-actionability sampling window, so the
maximum is diagnostic rather than a like-for-like latency ratio. The baseline trace
and JSON are retained. Intermediate profiling exposed first-use shader linking for
hidden contenders; full framebuffer warmup resolved it. Intermediate headless runs
measured 83.3 ms with overlapping browser work and 66.7 ms in isolation; the backdrop
and canvas-sizing changes then produced the final passing 33.3 ms capture.
The full suite also caught a sibling React-key collision after making the arena
persistent; the arena now has its own key, and the weekly-review regression passes.

## Final checks

Commands were run from the indicated directory. Every final command below exited 0.

| Directory | Command | Result |
| --- | --- | --- |
| `apps/web` | `bun run typecheck` | Pass |
| `apps/web` | `bun run test` | 96 tests, 11,056 assertions |
| `apps/web` | `bun run build` | Pass; existing Vite chunk-size advisory remains |
| `packages/catalog` | `bun run validate` | 291 entries; generated TypeScript refreshed |
| `packages/catalog` | `bun run test` | 36 tests, 169 assertions |
| root | `python -m unittest discover -s assets -p 'test*.py'` | 30 tests |
| root | `python assets/check_glb.py` | 284 GLBs, zero failures |
| root | `python assets/validate_009.py` | Nature, building preservation and hero checks pass |
| root | `python assets/validate_010.py` | Anchors, instancing, footprint, shared materials and catalog tints pass |
| `apps/web` | `$env:VILLAGE_BROWSER_GPU='hardware'; bunx playwright test --config playwright.integ006.config.ts --headed` | 9 passed; live-only case intentionally skipped in mock project |
| `apps/web` | `$env:VILLAGE_BROWSER_GPU='hardware'; bunx playwright test --config playwright.integ006.config.ts --grep 'record transition' --output test-results/integ006-headless` | 1 passed, native GPU headless |
| `apps/web` | `$env:VILLAGE_BROWSER_GPU='hardware'; $env:VILLAGE_ENV_FILE='C:/Users/mourn/Downloads/hacklanta/.env'; bunx playwright test --config playwright.colosseum.config.ts --project real --grep 'real API' --headed` | 1 passed against the existing API; read-only |
| root | `git diff --check` | Pass |

The model was rebuilt with
`& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --python assets/blender/colosseum.py`
(exit 0). Dependencies were installed with `bun install --frozen-lockfile` in web and
catalog (both exit 0). The old ASSET-009 exact-facade check initially failed for the
intentional hero replacement; it now delegates that separate-scene model to ASSET-010's
anchor/envelope/material validation, while retaining the original town-building checks.

## Files and artifacts

Full changed-file inventory relative to `0674e80`:
[INTEG-006-files.txt](INTEG-006-files.txt).

The implementation changes `App.tsx`, `CompetitionsPanel.tsx`, `Colosseum.tsx`,
`shared.tsx`, `colosseum.css`, `ColosseumScene.tsx`, the Colosseum GLB/generator,
`web028.spec.ts`, the integration Playwright config, the catalog JSON/generated types,
and hero/nature validation documentation and scripts. The merge also brings in the
ASSET-009/010 assets and resolves the combined catalog, README and validator conflicts.

Reviewable synthetic-fixture artifacts are under `apps/web/artifacts/integ006/`:

- `arena-empty.png`, `arena-create.png`, `arena-evidence.png`, `arena-mobile.png`.
- `headed-performance.json`, `headed-steady-state.json`, `headed-trace.zip`.
- `headless-performance.json`, `headless-trace.zip`.
- `baseline-performance.json`, `baseline-trace.zip`, `headless-concurrent-performance.json`.
- `asset-validation.txt` (full 284-model validation output).

Desktop/mobile screenshots were visually inspected. Live screenshots remain local in
ignored `apps/web/test-results/`; they are not committed because the existing live API
contains real-person portraits. Committed HTTP traces contain no credential-bearing
HTTP headers. No secrets, real-person media, model weights, paid generation or Solana
transactions were added. The live Vite process read public settings from the supplied
env path at runtime; no env file was copied.

## Teammate trial

From `apps/web`, in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 5188
```

Open http://localhost:5188, choose Iraj if prompted, and click Compete after the town
loads. Hover/click a challenge banner, inspect a participant, switch filters, create a
challenge and confirm its terms. Return to Village and reopen the arena. For fallback
coverage, use the missing-model/reduced-motion browser tests in the integration suite.
Inspect the final trace with:

```powershell
bunx playwright show-trace artifacts/integ006/headed-trace.zip
```

Blockers: none. Proposed contract changes: none. Changes stay within `apps/**`,
`packages/**`, `assets/**` and `docs/**`; root files, env files and HTTP/DB contracts
were not edited. Performance acceptance describes these measured native-GPU runs,
not every device or initial cold page load.
