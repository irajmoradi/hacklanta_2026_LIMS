# INTEG-015

See `docs/INTEG-015-REPORT.md` at the repository root for integrated results, caveats,
commands and screenshots. `integ015-measure.mjs` adds shop/farm, house and cinematic
transitions. `integ015-server.mjs` serves captured production bundles with a deliberately
unavailable API; it never proxies the live village. Build snapshots stay ignored.
Set `PERF_VISUAL_DIR` on both visual commands to avoid replacing historical evidence.

# PERF-002 whole-app performance

PERF-002 probes run from `apps/web`. They use fixture avatars, never request generation,
and keep measurements and synthetic screenshots in `artifacts/perf002`.

Build a reproducible production fixture app in PowerShell:

```powershell
bun install
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
$env:VITE_VILLAGE_ID=''
bun run build
bun run preview --port 5186
```

The preview server negotiates the build's lossless `.gz` sidecars. A different static
host must negotiate those sidecars (or enable gzip itself), set `Vary: Accept-Encoding`,
and retain the revision query in its cache key. Hashed JS/CSS and revisioned model URLs
can be cached immutably. Unversioned model URLs must revalidate. Originals are retained
in `public/models`; changing any model changes the model-set revision automatically.

Run the following in another terminal, serially, with other browser tests stopped:

```powershell
cloudflared tunnel --url http://127.0.0.1:5186 --no-autoupdate
# In another terminal, use the URL printed by cloudflared:
$env:PERF_URL='https://YOUR-TUNNEL.trycloudflare.com'
$env:PERF_STAGE='after'
$env:PERF_ASSERT='1'
node tests/perf/measure.mjs
node tests/perf/trace.mjs
```

`measure.mjs` uses headed Chromium at 1440×1000, DPR 1, real hardware GL, 25 Mbps
download/upload and 20 ms added latency. Vsync/frame limiting is disabled to measure
uncapped rAF throughput independently of the desktop refresh rate. This measures
browser frame intervals, not a display's physical presentation rate. The renderer
string is recorded and the assertion mode requires RTX 5090. First interaction is
the visible My profile control plus attached town canvas; procedural fallback is a
valid town, and this does not mean every optional GLB has downloaded. The probe
also records `renderedInteractiveMs` once Iraj's projected label is visible, and the
assertion requires that stronger readiness check within four seconds. The normal
sample must report `data-quality="normal"`; the throttled sample must report `low`.
Cold transfer
includes 15 seconds of initial idle loading, including arena warm-up. It clears the
browser cache, not Cloudflare's infrastructure. Repeat navigation retains the same
browser cache. Every transition samples from immediately before the click through
1.2 seconds after the action resolves. Steady samples last five seconds after a
15-second warm-up. The low tier sets CPU throttle to 4×, hardware concurrency to 4,
and `?quality=low` in a fresh browser context after the desktop context closes.
The baseline/earlier samples reused the desktop context; retain that distinction
when comparing them. Overall and low-sample host CPU busy fractions are recorded
to make competing jobs visible. `PERF_ASSERT=1` exits nonzero on any missed budget
or page error. `node tests/perf/low.mjs` runs the low profile independently for
diagnosis, with the same five-second window and 45 FPS assertion.

The CPU probe writes a Chrome CPU profile and a compact summary of self time and
layout/style/script counters. It defaults to localhost to separate render cost from
tunnel variability. Profiles can be opened in Chromium DevTools' Performance panel.
Set `PERF_LOW=1` for a throttled low-tier CPU profile. `shop-trace.mjs` records a CPU
profile and compressed timeline across closing a profile and opening the shop.

Production smoke and lossless compression checks:

```powershell
bunx playwright test --config playwright.perf.config.ts
```

Set `PERF_PREVIEW_PORT` if port 5187 is occupied (the final run used 5197).

To compare the renderer visually, start fixture Vite on port 5188, then run:

```powershell
$env:VITE_MOCK='1'; $env:VITE_DEMO_AUTH='1'; $env:VITE_VILLAGE_ID=''
bun run dev --port 5188
# Another terminal:
node tests/perf/visual.mjs
node tests/perf/visual-diff.mjs
```

The A/B probe freezes the exact same live Three scene, renders it through the old
direct path and the new compositor, and compares every pixel. Pixelmatch uses its
standard 0.1 perceptual threshold with antialiasing pixels included. The report also
records raw channel differences. No scene, avatar, HUD, or background region is masked.
Normal quality is required, and shadows/refraction metadata is saved. Set
`PERF_VISUAL_PROFILE=1` for both visual commands to compare the narrowed profile view.

Existing browser suites can opt into the machine GPU using
`$env:VILLAGE_BROWSER_GPU='hardware'`; software GL remains the portable default.

---

# INTEG-007 town performance

The committed `town.mjs` measures a ten-second RAF sample after fifteen seconds
of warm-up, at 1440 x 1000. It records the actual WebGL renderer, average reported
draw calls, triangles, DPR, shadows, p95 frame interval, screenshot, and a gzip
Chrome timeline trace. `after hardware` exits 1 below 55 FPS, on a renderer other
than RTX 5090, or on a browser exception. Hardware uses **headed** Chromium;
SwiftShader uses headless Chromium and has no hardware FPS assertion.

Install dependencies with `bun install --frozen-lockfile` in `apps/web` and
`python -m uv sync` in `apps/api`. Use separate PowerShell terminals:

1. From `apps/api`, set `$env:VILLAGE_ENV_FILE` to the external environment file,
   then run `python -m uv run scripts/feat009_preview.py`. This creates a private
   schema in `village_test`, seeds synthetic people, disables paid providers,
   fixes daylight/clear weather, and listens on 8029. Never use the development DB
   as a substitute for this script.
2. From `apps/web`:

   ```powershell
   $env:VITE_MOCK='0'
   $env:VITE_DEMO_AUTH='1'
   $env:VITE_DEMO_USER='13370000-0000-4000-8000-000000000001'
   $env:VITE_VILLAGE_ID='13370000-0000-4000-8000-000000000000'
   $env:VILLAGE_API_URL='http://127.0.0.1:8029'
   bun run dev --port 5299
   ```

3. From `apps/web`, run these sequentially, with other browser tests stopped:

   ```powershell
   node tests/perf/town.mjs after hardware
   node tests/perf/town.mjs after swiftshader
   $env:VILLAGE_BROWSER_GPU='hardware'
   bunx playwright test --config playwright.integ007-map.config.ts
   ```

Keep the headed browser in front during measurement. Evidence is written to
`artifacts/integ007`. The `before` argument records a baseline without enforcing
the gate; the committed baseline was captured at merge commit `21df6a9`, before
town performance edits. Decompress `*-trace.json.gz` and load the JSON in Chrome
DevTools Performance. The baseline trace is available in the same directory.

Stop the preview API with
`Invoke-RestMethod -Method Post http://127.0.0.1:8029/qa/stop`; its `finally` block
removes the private schema. Stop the Vite terminal afterward. The performance
script closes its own browser even on a failed gate.

`gl.info.render.calls` reports the main render pass (Three resets the counter
after its shadow pass). Shadow cadence changes do not reduce this reported
number. Do not compare SwiftShader and native GPU FPS as though they were the
same renderer, or interpret shared-host before/after timing as an isolated
causal benchmark.

For a new integration sample, set `$env:VILLAGE_PERF_DIR='artifacts/integ008'`
before running the script to preserve the earlier branch evidence.
