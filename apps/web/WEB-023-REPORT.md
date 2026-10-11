# WEB-023 — Instant portraits and interactive outfit previews

Branch: `web/WEB-023`. Implementation milestone: `87eaba9`. Validation/report commit follows it.

## Delivered

- Name tags, feed, lists and inbox retain static `face_512.png` portraits. Portrait and Gaussian URLs carry the manifest revision; authenticated media fetching preserves query strings.
- Gaussian mounts require an open profile, viewport intersection and a visible browser tab. Offscreen/closed heads release the existing singleton queue. Static portraits and the existing subtle shimmer remain during loading; renderer failures keep the static fallback.
- Revisioned avatar responses receive `public, max-age=31536000, immutable`, file ETags, conditional 304 responses and non-zip gzip. Authorization runs before conditional handling. Private uploads/evidence and unrevisioned assets retain `private, no-store`.
- Shared Wardrobe/ProfileOutfit previews support pointer capture, yaw, clamped pitch, inertia, bounded wheel/pinch zoom, double-click reset and auto-spin after four idle seconds. Touch and reduced-motion preferences work. Arrow keys and Home provide keyboard controls.
- Optional idle zip prefetch and thumbnail generation were omitted: static portrait caching meets the task without speculative downloads or generated files.

## Files changed

- `apps/api/app/main.py`, `apps/api/app/assets_cache.py`: asset response/cache integration.
- `apps/api/tests/test_web023.py`: cache, compression, validators, invalidation and authorization coverage.
- `apps/web/src/components/shared.tsx`, `GaussianHead.tsx`, `GaussianHead.test.tsx`: revision URLs and lazy visibility gating.
- `apps/web/src/components/Wardrobe.tsx`, `previewMotion.ts`, `previewMotion.test.ts`: shared interactive previews and motion tests.
- `apps/web/package.json`: include motion tests in the standard suite.
- `apps/web/tests/real.spec.ts`: accept revisioned zip URLs in the existing LAM smoke test.
- `apps/web/tests/web023-real.mjs`: real-mode transfer measurements and mouse/touch interaction checks.
- `apps/web/WEB-023-REPORT.md`: this report.

## Real-mode measurements

Same seeded five-person village, same local assets, fresh Chromium context per variant, two navigations per context. Baseline used the original committed portrait components/API route; after used this implementation. Vite :5323 proxied the API :8023 with the scheduler disabled. No paid generation calls were made.

Values are bytes from browser Resource Timing `transferSize` (subresources, including estimated response-header overhead). These are local real-mode measurements, not a public-tunnel speed benchmark. Development module traffic is included in the total column.

| Variant/load | Total subresource bytes | API asset bytes | Static portrait bytes |
| --- | ---: | ---: | ---: |
| Before, first | 21,629,918 | 5,313,532 | 1,635,224 |
| After, first | 21,429,944 | 5,060,822 | 1,635,224 |
| Before, second | 5,600,725 | 5,313,532 | 1,635,224 |
| After, second | 3,517,203 | 3,425,598 | 0 |

Town load made **zero zip requests in both variants**: the existing branch already defaulted ordinary portraits to static images. No claim is made of eliminating downloads that were absent in this baseline. Remaining second-load assets are unrevisioned town head GLBs. Non-zip gzip accounts for the first-load asset reduction. Portraits are fully cached on the second load.

Browser assertions passed for pointer-down spin pause, drag yaw, wheel zoom, double-click reset, touch drag and pinch. Recorded yaw: 0.31833 → 1.26873 radians; reset: 0; touch drag: 0.64 radians. Opening the profile subsequently requested its revisioned zip, as intended.

Artifacts (local, deliberately uncommitted because screenshots contain real portraits):

- `apps/web/test-results/web023/before.json`
- `apps/web/test-results/web023/after.json`
- `apps/web/test-results/web023/wardrobe.png` — visually inspected.

## Validation

- `bun install --frozen-lockfile` — exit 0.
- `bun run test` — exit 0; 44 tests passed.
- `bun run build` — exit 0; existing large-bundle warning remains.
- `node tests/web023-real.mjs` — exit 0; real-mode town, mouse and touch checks passed. An earlier run used a fixed 100 ms render wait and failed during CPU contention; it now polls actual Three.js rotation.
- `WEB023_LABEL=before node tests/web023-real.mjs` — exit 0 for the baseline measurements (PowerShell: `$env:WEB023_LABEL='before'`).
- `python -m pytest tests/test_web023.py tests/test_api.py -q` — initial run: 28 passed, exit 0. After adding the authorization case: 28 passed, one setup error, pytest exit 1; the existing join test hit a database connection timeout under host contention. The trailing ruff command returned 0; it does not erase the pytest failure.
- `python -m ruff check app/assets_cache.py tests/test_web023.py` — exit 0 after fixing one test line-length finding.
- `python -m pytest tests/test_web023.py tests/test_api.py::test_join_idempotent_and_concurrent_slots -q --tb=no` — exit 0; all 3 passed on targeted retry, including both new cache tests and the previously timed-out join test.
- `git diff --check` — exit 0.

Python commands use `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`; environment values are loaded at runtime through `VILLAGE_ENV_FILE`, never copied into this worktree.

## Try it

Run the API from `apps/api` with the existing environment and assets:

```powershell
$env:VILLAGE_ENV_FILE='C:/Users/mourn/Downloads/hacklanta/.env'
$env:MAYOR_SCHEDULER='0'
$env:ASSET_DIR='C:/Users/mourn/Downloads/hacklanta/data/assets'
& C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe -m uvicorn app.main:app --loop app.runtime:selector_loop --host 127.0.0.1 --port 8023
```

From `apps/web`, set `VILLAGE_API_URL=http://127.0.0.1:8023`, `VITE_MOCK=0`, `VITE_DEMO_AUTH=1`, `VITE_DEMO_USER=13370000-0000-4000-8000-000000000001`, and `VITE_VILLAGE_ID=13370000-0000-4000-8000-000000000000`; run `bun run dev --port 5323`. Run `node tests/web023-real.mjs` in another terminal. Or open My profile → Wardrobe and drag, scroll/pinch, then double-click. Peer profile Outfit uses the same controls.

No contract changes proposed. Public-tunnel latency and physical-device touch performance were not measured; Chromium touch input was exercised. The implementation and asset caching work without new generated assets or GPU-worker access.
