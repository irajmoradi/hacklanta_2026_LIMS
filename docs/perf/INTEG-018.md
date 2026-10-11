# INTEG-018 performance integration

Branch: `integ/INTEG-018`. Starting revision: `11d4e2264baeb2a2775b308928de7b207e66ee6e`.
Two-parent merge: `e669b47` (INTEG-015 into this worktree). Application follow-ups through `2c869e3`.
The historical report is available with `git show integ/INTEG-015:docs/INTEG-015-REPORT.md`.
It was not added outside this task's allowed paths.

## Integration decisions

- Retained current navigation, Hall/floors, library, friends, cinematic behavior,
  close-up camera framing, crowd LOD, woodland variety, and walking label priority.
- Added deferred panels/disaster effects, model revision URLs and production gzip
  sidecars, private API JSON ETags and gzip, and the performance renderer.
- Resolved the new Furniture component's import of extracted `PhotoObject`.
- Combined batched label geometry reads with current crowd culling and avatar
  overlap handling. Preserved current close-up DPR behavior.
- Fixed expanded portrait focus restoration after its opener remounts. Removed a
  dependency-optimizer reload from the synthetic header fixture and updated
  scroll tests for the current Mayor and check-in surfaces.
- Background arena mounting and shader warm-up now pause while another surface
  is open and resume when the town is idle. Opening Compete still warms immediately.
- Reset the dormant shop's entrance clock and completion fields in a layout
  effect before its first active frame. Kept the 360 ms animation and 400 ms gate.
- Kept security middleware outside conditional responses; authorization still runs
  before a response can become 304. SSE, errors, writes, and no-store bypass ETags.
- Original GLBs are unchanged. This is transport compression, not geometry rewriting.

## Validation

All commands below use `../../ops/remote_run.sh` from the indicated app directory,
except the headed helper, which invokes that wrapper and forwards only the
ephemeral browser endpoint. API tests use the runner's scratch database; browser
servers point at an unavailable loopback API and use mock/intercepted responses.

- API: `python -m uv run pytest -q`: **565 passed, 4 skipped, exit 0**.
  One existing Starlette/httpx deprecation warning; 542.01 seconds execution.
- Web: `bun run test`: **198 passed, 0 failed, exit 0** (48 files).
- Web: `bun test src --timeout 30000`: **238 passed, 0 failed, exit 0** (62 files).
- Web: `bun run build`: **exit 0**. Final build with `--env VITE_MOCK --env
  VITE_DEMO_AUTH bun run build --outDir artifacts/integ018/final-build`: **exit 0**.
  Environment values were both `1`; no credentials were forwarded.
- Web: `python tests/perf/integ018-build.py`: baseline and integration builds,
  package tests and full source tests **exit 0**.
- Production: **313 GLBs** round-trip byte-for-byte through gzip, including the
  newer trees, wearables and Hall furniture. 38,872,988 original bytes become
  6,807,929 gzip bytes. Gzip negotiation, immutable revision caching, unversioned
  revalidation, and complete model-offline Hall/library/shop/profile flows pass.
- Frozen-scene compositor parity: town **0.10785%**, profile **0.17681%**;
  threshold 1%, pixelmatch tolerance 0.1, antialiasing pixels included, no masks.

Expanded browser suite: **33 passed, exit 0** (village, house, wardrobe,
Hall/library, friends, house undo, walking, eight cinematic cases, production asset
and fallback checks, and two frozen-scene visual comparisons). Command:
`PERF_INTEG=018 node tests/perf/remote-hardware.mjs --workers=1 --project=mock
--project=integration --project=production --project=visual village.spec.ts
house.spec.ts equipment.spec.ts web048.spec.ts feat020.spec.ts web046.spec.ts
web049.spec.ts web045.spec.ts panels.spec.ts renderer.spec.mjs`.

The six historical unresolved cases passed together (**6 passed, exit 0**) after
the current profile scroll owner correction. The final application run passed those six cases again plus the competition
create/join/review flow (**7 passed, exit 0**):
`PERF_INTEG=018 node tests/perf/remote-hardware.mjs --workers=1
--project=integration --project=mock --grep "walk in|fullscreen rejection|expanded
portrait|sticky modal|open ? explicit cost confirmation"`. The strict 400 ms shop
limit was retained; final measured entrance is recorded in `shop-final.json`.
Full source tests were repeated after this last application change: 238 passed.
Initial failures were retained, not counted as passes: first build failed on the
Furniture import; the first baseline archive omitted the shared material catalog;
the first six-case run passed 2/6, the next passed 3/6, and the first key-spec run
passed 23/24. Fixes address fixture reloads/onboarding, actual portrait focus loss,
obsolete cinematic scroll assumptions, and the shop entrance-clock race.
No timing or visual thresholds were relaxed. Earlier artifact transfer errors came
from runner-local source symlinks in the baseline artifact directory; the corrected
harness keeps temporary source outside downloadable artifacts.

## Current-main comparison

Measured on the same RTX 5090, against baseline `11d4e226` and application revision
`2c869e3`; both measurement commands exited 0 with no page errors.

| Metric | Current-main baseline | Integrated |
|---|---:|---:|
| Cold transfer (decimal MB) | 12.584 | 2.911 |
| Repeat transfer (bytes) | 23,056 | 4,609 |
| Main entry gzip (bytes) | 297,598 | 237,704 |
| Overview FPS | 60.8 | 160.2 |
| Street zoom FPS | 123.4 | 261.9 |
| Overview draws/frame, median / max | 1,305 / 1,851 | 1,306 / 1,852 |
| Street draws/frame, median / max | 557 / 1,103 | 558 / 1,104 |
| Rendered-interactive time (ms) | 2,414 | 1,454 |
| Whole-host CPU busy fraction | 28.3% | 35.3% |

Cold transfer falls **76.9%**; overview is **2.64x** and street zoom **2.12x** the
baseline FPS. Draw calls are effectively unchanged (+1 output quad): the renderer
avoids repeated material program changes between transmission and output passes,
while batched labels reduce layout work. The canvas remains 1440x1000 in both.
These are single five-second steady-state samples, not a cross-device guarantee;
CPU figures cover the whole shared host. Low-tier performance was not re-benchmarked.
The baseline fixture server sends identity assets; the integrated server enables
the intended gzip/cache policy. Thus transfer gains include serving configuration,
not just bundling, and require the production handoff below.

Evidence: `apps/web/artifacts/integ018/{before,after}/metrics.json`, with overview
and street PNGs in those directories. The frozen direct/compositor comparisons
are separate from the moving benchmark screenshots. No render or timing threshold
was relaxed; final shop entrance was **366.8 ms** against the existing 400 ms gate.

## Measurement reproduction

`tests/perf/integ018-build.py` builds the exact starting revision and integrated
source remotely, using a temporary source-only Git archive (ignored, no env files).
Captured comparison bundles are in `apps/web/artifacts/integ018/{before,final}-build`.
Create the ignored archive with `git archive --format=tar -o
apps/web/tests/perf/baseline-source.tar 11d4e226 apps/web packages` from the root
(exclude public assets, artifacts, test-results and node_modules to reduce transfer).
The baseline uses the same public assets and installed dependency cache as the
integration; no dependency version change is part of this task.
The fixture server returns 503 for every `/api/*` request, so no live village is used.

From `apps/web`, serve each bundle with `node tests/perf/integ015-server.mjs
artifacts/integ018/before-build 16818` and `node tests/perf/integ015-server.mjs
artifacts/integ018/final-build 16820 gzip`. Run `tests/perf/integ018-measure.mjs`
with `PERF_STAGE=before|after`, `PERF_REVISION=11d4e226|2c869e3` and the matching
`PERF_URL=http://127.0.0.1:16818|http://127.0.0.1:16820`. Both commands exited 0.

The probe uses headed RTX 5090 Chromium, 1440x1000, DPR 1, uncapped rAF,
25 Mbps and 20 ms latency, 15-second warm-up and five-second samples.
Street view uses thirty-six -100 wheel steps at a fixed canvas position.
Draw calls count actual WebGL draw invocations per rendered frame, including
shadow, transmission and compositor passes. They are not Three's last-pass count.
Host CPU utilization and canvas dimensions accompany each run. rAF FPS is not
monitor presentation FPS. Unlike the historical tunnel run, this comparison uses
loopback with explicit network emulation, avoiding changing proxy compression.

## Production serving handoff (ops/deploy; no ops edits)

- `vite preview` negotiates generated `.gz` sidecars for `/assets/*` and `/models/*`.
  A static production server must provide equivalent `Accept-Encoding` negotiation,
  `Content-Encoding: gzip`, original MIME types and `Vary: Accept-Encoding`.
  Identity requests must receive original bytes, including clients sending gzip;q=0.
- Serve hashed JS/CSS and models with the matching build revision query using
  `Cache-Control: public, max-age=31536000, immutable`. Unversioned models must
  revalidate (`public, no-cache`); HTML must revalidate so deploys select new assets.
  Preserve query strings. Upload source assets and sidecars together, atomically
  with their referencing build; retain old hashed assets for existing sessions.
- API middleware supplies JSON gzip and private ETags itself. Preserve ETag,
  Vary, Authorization, X-Demo-User and If-None-Match through the proxy. Do not
  publicly cache private API responses or transform no-store into cacheable data.
  Avoid recompressing already encoded responses. SSE stays unbuffered and ZIP
  head packages bypass gzip. Existing WebSocket routing stays in place.

## Try it

From `apps/web`, set `VITE_MOCK=1`, `VITE_DEMO_AUTH=1`, and
`VILLAGE_API_URL=http://127.0.0.1:9`, then `bun run dev`.
Open My profile → Outfit/House, Community Hall → Floor 2, Reading list,
Shop, Compete, Check in and Mayor. No GPU worker or generated avatar is required.
For remote browser validation on this RTX host, set `PERF_INTEG=018` and run
`node tests/perf/remote-hardware.mjs` with the desired Playwright project/spec.
The helper forwards only the ephemeral browser endpoint over SSH.

No contract changes proposed. No paid adapters, GPU worker, live village mutations,
on-chain signing, deployment, pushes, or changes outside allowed paths were used.

## Files and limitations

Complete changed-file inventory (including inherited performance evidence):
[INTEG-018-FILES.txt](INTEG-018-FILES.txt). Core changes are API cache middleware,
web lazy panels, renderer/model serving, label batching, portrait focus, shop/arena
scheduling, and browser/performance harnesses. No imessage or contract edits.

All requested acceptance checks passed; no safe-subset fallback was needed.
Deployment has not been performed. The server configuration handoff is required
for the measured asset transfer gains. Vite still reports existing large vendor
chunks; the main entry itself is smaller. Results use fixture avatars, not paid
or GPU-generated assets. The six-case sequence initially exposed intermittent
shop timing (up to 1,099.8 ms); the last two complete runs passed, with foreground
arena warm-up deferred in the final run. Performance is host-dependent.
