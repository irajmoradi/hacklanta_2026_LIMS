# SCALE-001 — 100-person village

## Reproduction and isolation

From `apps/api`:

```sh
../../ops/remote_run.sh python -m uv run python scripts/scale_benchmark.py before
../../ops/remote_run.sh python -m uv run python scripts/scale_benchmark.py after
../../ops/remote_run.sh python -m uv run pytest -q
```

`scale_benchmark.py` uses the configured server only to create an exclusively owned,
random `scale001_<uuid>` Postgres database. It drops that database in `finally`.
The seeder refuses other database names. Never pass the live database as a seed
connection. The runner injects its scratch server URL; no secrets or `.env` files
are transferred. All avatars are presets; provider keys, scheduling, and voice
are disabled. There are no paid generations or Solana transactions.

Each population has deterministic user/village IDs, unique house slots, varied
house levels and activities, equipped hats, four goals and 28 check-ins/feed
events per person, four competitions with entries, and a seeded gazette. These
are synthetic people, not copies of teammate accounts.

API measurements use FastAPI's ASGI transport against real Postgres (including
authentication, serialization, transactions, and middleware; excluding TCP/TLS).
Each route has three warm-up requests and 30 measured requests, sequentially,
with p50 as the upper middle sample and p95 by nearest rank. This measures
hot-route latency, not peak throughput.
The `before` run drops the four SCALE-001 indexes inside its new scratch DB and
bypasses the validation cache, retaining the original per-read validation work.
The recorded baseline was captured before the cache existed. The separate
indexes-only run keeps that original application code and measures the migration
alone, avoiding attributing the catalog improvement to indexes.
Presence measurements here are authenticated heartbeat round trips with the
whole population present; SSE fan-out is covered separately by a concurrency test.

The runner is a shared 16-vCPU AMD EPYC Rome Linux VM with 64 GB RAM and Postgres
17/TimescaleDB. Browser rendering uses Chromium/SwiftShader at 1440×1000. Results
are software-renderer observations, not hardware-GPU frame-rate guarantees.

From `apps/web`, after the API benchmark has exported its synthetic payloads:

```sh
../../ops/remote_run.sh bun test tests/scale001.runner.test.ts
../../ops/remote_run.sh bun run test
../../ops/remote_run.sh bun test src/components/reviewPage.test.ts src/scene/crowdBudget.test.ts src/scene/labelPlacement.test.ts
../../ops/remote_run.sh bun run build
```

The isolated Bun harness starts Vite on an OS-assigned port, then runs the
Playwright comparison in both modes. It uses no shared database or fixed server
port, so the wrapper's independent-web lane is safe. The original fixed-port
attempts spent their time queued behind other browser tasks. Production builds
never load the test-only baseline config or archived scene modules from `2abbd0e`.

Browser runs mount the real `VillageScene` with the scratch API response.
All GLB/GLTF requests fail deliberately, exercising the zero-assets requirement;
API requests are intercepted and the Vite proxy points at loopback port 1.
Initial load is navigation to mounted avatar labels in the Vite scene harness,
not a production full-app/network load. After 14 seconds for the existing quality
governor, overview and street views each sample frames/draw calls for five seconds.
JS heap comes from CDP; it is not GPU memory. Screenshots and raw JSON are written
under `apps/web/tests/artifacts/scale001`, with API JSON under
`apps/api/artifacts/scale001`.

## Changes and scope

- The existing rectangular grid already allocated 100 unique homes. New regression
  coverage checks stable addresses from 5→25→100 and traversable routes to every
  home; layout/tree placement is unchanged.
- Weekly review previously requested every full profile on opening and each
  ten-second poll. Search and ten-person pages bound that to ten profiles per
  visible page. Five-person review retains its full list. Finalization still
  checks all goals, including off-page ones.
- SSE listeners now share membership reads per village with a 0.5-second cache
  and one lock. Membership is still revalidated; maximum additional revocation
  delay is 0.5 seconds. Groups disappear when their final listener disconnects.
- Migration `053_scale_hot_reads.sql` adds idempotent indexes for member check-in
  history, evidence lookup, village feed ordering, and positive XP aggregation.
  The highest migration on the inspected local `main` was 051.
- The measured fixed cost was catalog validation: village load validated the
  complete registry twice (including the event-pack projection), and a profile
  validated it once. Eight content-addressed validated snapshots now retain that
  pure work. Every request still reads the current database definitions; the full
  definition and schema contents form the key. Deep copies isolate callers.
  Regression coverage checks immediate updates, rollback, and mutation isolation.
- Towns above 25 people keep at most twenty ordinary detailed bodies plus
  interacting villagers (player, selection, hover/cinematic). Other bodies use
  clickable shirt/skin-colored silhouettes. The normal 15-second village refresh
  supplies other manifests instead of one additional poll per avatar. Five- and
  25-person towns keep their existing body rendering and polling behavior.
- Label allocation uses a visible-label set instead of scanning all labels for
  every label. Player/selected labels take precedence within the existing 24-label
  cap, and spacing ignores culled labels. `VillageScene` has only the small wiring
  change; `OptionalModel`, town layout, and tree placement remain untouched.
- Feed results were already bounded to 50 by default/200 maximum. Village avatar
  queries were already batched. No HTTP response shape or contract file changed.

Source map: API changes are in `app/catalog.py`, `app/catalog_registry.py`,
`app/presence.py`, migration 052, `scripts/scale_benchmark.py`, and
`tests/test_scale001.py` (plus the artifact ignore rule). Web changes are in
`WeekPanel.tsx`/`reviewPage*`, `CrowdDetail.tsx`/`crowdBudget*`,
`TownLabel.tsx`, `LabelSpacing.tsx`/`labelPlacement*`, the small `VillageScene.tsx`
wiring, `styles.css`, and the town-layout regression test. `tests/scale001*`
contains the isolated benchmark, archived baseline, and synthetic evidence.

## Measurements and validation

### API latency

All entries are milliseconds, **p50 / p95**; response bytes are unchanged.

| People | Route | Before | After | Bytes |
|---:|---|---:|---:|---:|

| 5 | village | 366.71 / 468.27 | 110.39 / 232.61 | 6,030 |
| 5 | feed | 14.75 / 18.93 | 13.43 / 16.75 | 18,650 |
| 5 | week_review | 13.00 / 15.30 | 12.20 / 16.03 | 2,158 |
| 5 | profile | 166.63 / 237.57 | 63.46 / 79.67 | 10,904 |
| 5 | presence | 3.48 / 3.93 | 4.44 / 4.88 | 437 |
| 5 | gazette | 4.55 / 5.18 | 5.17 / 7.93 | 335 |
| 5 | competitions | 4.68 / 5.79 | 5.92 / 8.18 | 1,625 |
| 25 | village | 345.08 / 392.90 | 106.58 / 203.44 | 27,145 |
| 25 | feed | 13.26 / 16.33 | 12.60 / 14.78 | 18,167 |
| 25 | week_review | 11.98 / 16.43 | 15.45 / 18.22 | 9,708 |
| 25 | profile | 188.49 / 260.67 | 63.02 / 80.36 | 10,906 |
| 25 | presence | 3.89 / 4.75 | 4.71 / 7.08 | 2,137 |
| 25 | gazette | 3.91 / 4.60 | 5.70 / 8.54 | 335 |
| 25 | competitions | 4.49 / 5.42 | 5.05 / 7.50 | 1,625 |
| 100 | village | 409.02 / 579.68 | 147.51 / 248.30 | 106,717 |
| 100 | feed | 15.32 / 17.67 | 16.52 / 20.10 | 17,842 |
| 100 | week_review | 19.88 / 24.81 | 20.24 / 29.86 | 38,023 |
| 100 | profile | 193.44 / 235.39 | 52.20 / 65.85 | 10,922 |
| 100 | presence | 6.30 / 7.95 | 6.16 / 8.20 | 8,512 |
| 100 | gazette | 5.03 / 8.28 | 4.47 / 5.88 | 335 |
| 100 | competitions | 5.68 / 7.92 | 5.74 / 8.17 | 1,625 |

At 100 people, village p50 improves 64% and p95 57%; profile p50 improves
73% and p95 72%. Other routes stay below 30 ms p95. The largest village payload
is 106,717 bytes; the bounded feed remains under 19 KB. Check-ins/history grow
without being included wholesale in village load.

The [indexes-only control](scale001-results/api-indexes-only.json) had 100-person
village p95 525.97 ms and profile p95 254.80 ms versus baseline 579.68 / 235.39.
It did not fix the dominant repeated-validation cost. Small differences on fast
routes should not be interpreted as causal wins or regressions on this shared VM.
Raw [before](scale001-results/api-before.json) and
[after](scale001-results/api-after.json) include every measured endpoint and size.

### Browser

Values are **before -> final after**. Heap is MiB; initial load is milliseconds.

| People | View | Initial load | JS heap | Draw calls | FPS | p95 frame ms |
|---:|---|---:|---:|---:|---:|---:|
| 5 | overview | 3984 -> 4803 | 31.8 -> 37.3 | 296 -> 296 | 9.66 -> 6.81 | 166.7 -> 316.7 |
| 5 | street | 3984 -> 4803 | 25.9 -> 26.2 | 206 -> 206 | 5.83 -> 5.29 | 300.0 -> 333.3 |
| 25 | overview | 2121 -> 2472 | 54.2 -> 42.2 | 745 -> 745 | 7.66 -> 7.30 | 250.0 -> 283.3 |
| 25 | street | 2121 -> 2472 | 37.2 -> 38.8 | 274 -> 271 | 5.58 -> 4.33 | 366.7 -> 416.6 |
| 100 | overview | 3338 -> 3543 | 82.2 -> 68.7 | 1212 -> 848 | 5.88 -> 6.68 | 250.0 -> 283.3 |
| 100 | street | 3338 -> 3543 | 88.5 -> 79.8 | 321 -> 318 | 4.38 -> 4.32 | 433.4 -> 450.0 |

The final 100-person overview has 21 detailed bodies and 79 simplified bodies:
draw calls fall 30% (1,212 -> 848), and measured JS heap falls 16%
(82.2 -> 68.7 MiB). The street view has six detailed bodies and 94 simplified
bodies, but draw calls barely change (321 -> 318); town geometry dominates that
view. FPS remains poor and initial-load timing does not improve consistently.
Shared-VM timing variation and the adaptive quality governor make these single
runs descriptive, not statistical proof of frame-rate gains.

Dedicated avatar requests during the initial overview fall from 100 to one,
and from 200 to two cumulatively after the street sample. Existing village
refreshes supply other manifests. The final overview displays 22 nonoverlapping
villager tags; the baseline displayed zero because transparent house targets
exhausted its label budget. Five-person draw-call counts remain unchanged.
The five-person screenshot retains the existing inline placeholder caption,
including its preexisting cramped appearance; the dense-town rule is scoped
above ten people.

Raw browser JSON and all screenshots are in
[the evidence directory](../../apps/web/tests/artifacts/scale001/).
Visually inspected final [100-person overview](../../apps/web/tests/artifacts/scale001/after-100-overview.png),
[street view](../../apps/web/tests/artifacts/scale001/after-100-street.png),
[five-person overview](../../apps/web/tests/artifacts/scale001/after-5-overview.png), and
[review search](../../apps/web/tests/artifacts/scale001/review-100-search.png).
Final-after screenshots/measurements include the label-decluttering correction;
the baseline uses the archived original scene and the same synthetic payloads.

### What breaks first and remaining limits

Repeated catalog validation was the largest fixed API cost. On the browser,
per-person manifest polling and full avatar bodies grew with population, and
transparent house-label hit targets consumed the readable-label budget. Weekly
review fetched 100 rich profiles just to display its initial list.

The revised review browser test proves ten initial profile requests, twenty after
moving to page two, and twenty-one after searching for Villager 100; the final
search shows only that person. Labels in dense towns are hidden when no clear
position exists within 96 px; player/selected labels take priority. Dense name
tags omit the overflowing inline placeholder caption, retaining its title and
profile/hover explanation. Five-person tags retain their existing presentation.

This establishes that the data and tested UI paths handle 100 synthetic people,
with stable homes, bounded detail and profile requests, and no browser page
errors. It does **not** establish 100 simultaneous full browser clients or smooth
hardware-GPU rendering. SwiftShader is already slow at five people; town/house
rendering and street-level frame time remain the next profiling targets. Generated
GLB/talking-head assets are deliberately absent, so their production memory and
animation costs remain unmeasured. Presence remains process-local as before;
multiple API replicas still require shared presence infrastructure.

### Validation and handoff

All heavy checks use the remote wrapper. In Windows PowerShell the commands
below are prefixed with `bash`; paths are relative to the indicated app.

| Directory | Command after `bash ../../ops/remote_run.sh` | Exit / result |
|---|---|---|
| apps/api | `bash -lc 'uv run python scripts/scale_benchmark.py before && uv run python scripts/scale_benchmark.py after'` | 0; baseline and indexes-only control |
| apps/api | `bash -lc 'uv run python scripts/scale_benchmark.py after && uv run pytest -q'` | 0; benchmark completed, 473 passed / 4 skipped / 1 deprecation warning (534.06 s pytest) |
| apps/web | `bun run test` | 0; 180 passed, 0 failed, 45 files |
| apps/web | `bun test src/scene/labelPlacement.test.ts src/scene/crowdBudget.test.ts src/components/reviewPage.test.ts` | 0; 3 passed, 0 failed, 26 assertions |
| apps/web | `bun run build` | 0; TypeScript and Vite production build passed (existing large-chunk advisory) |
| apps/web | `bun test tests/scale001.runner.test.ts` | 0; before and initial-after comparisons, 4 Playwright cases each |
| apps/web | `--env SCALE_STAGE bun test tests/scale001.runner.test.ts` with `SCALE_STAGE=after` | 0; 4 Playwright cases passed in 2.3 minutes; parent Bun test passed |

The full suite command uses the repository's defined web test list; new scale
unit tests are run explicitly because editing `apps/web/package.json` is outside
this task's allowed paths. API regressions include scratch-seed protection,
idempotent indexes, immediate catalog update/rollback/mutation isolation, and
100 simultaneous SSE listeners sharing one membership query per aligned tick,
including revocation and group cleanup. Full browser-client concurrency is a
separate workload.

An early fixture run failed because the gazette fixture lacked `gossip`; an early
browser run intercepted Vite's `/src/api/client.ts` as an API request and failed
before mounting. Both harness issues were corrected; the successful commands
above are subsequent runs. Queued fixed-port browser attempts were cancelled
before execution. No failing remote test was silently replaced by a local run.

The initial production build also passed; its existing large-chunk advisory
remains. Local `git diff --check` and Python AST parsing passed. Screenshots in
`apps/web/tests/artifacts/scale001` cover both views at all three populations;
`review-100-search.png` demonstrates the paged/searchable review.

No live village actions, real photos/voices, paid provider calls, or transactions
were used. No contract changes are proposed. Changes are restricted to the task's
allowed API, web source/tests, and performance documentation paths. Reproduction
commands above create disposable benchmark databases and an isolated browser
server; the screenshot fixtures are entirely synthetic.
