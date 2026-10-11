# FIX-003 verification

Branch: `fix/FIX-003`. Milestones: `38c20c7` (responsive navigation, accessibility,
feed), `6e54b67` (LAM lifecycle and regression coverage), `aab6501` (nested
evidence cancellation). Final validation commit
is the latest commit touching this report.

Implemented the task's ten ordered polish wins:

| Finding | Result |
| --- | --- |
| R01 | A scrollable people strip with names and independent 44px-or-larger targets remains available on phones/tablets, including with More expanded. |
| R02 | Four explicit phone header rows separate brand/identity, village selection, sound/inbox, and tour/AI controls. Scene height accounts for the header. |
| R03 | Laptop feed and Mayor cards clear the dock. Feed height also adapts to short 1280x720 windows so My profile remains clickable. |
| R04 | The same featured villager supplies the tour's selection and name. |
| R06/R13 | Profile tabs support Left/Right wraparound, Home/End, roving tabindex and tabpanel associations. The full-screen profile uses a native modal dialog at <=1050px, with inert background, contained focus, Escape and opener restoration. Desktop retains an aside. Nested evidence cancellation does not close its parent. |
| R07 | API agent summaries name the agent, action, target when present, and reason. The home feed coalesces identical background decisions while keeping friend activity. HTTP shape unchanged. |
| R09 | My goal and Weekly review consistently name navigation, dialog headings and relevant tour copy. |
| R10 | Feed, XP, profile and event supporting text is 12–13px with darker ink. |
| R11 | Optional absent tier/effort rows are omitted; zero effort remains visible; equal reward endpoints render one amount. Penalty/recovery information remains explicit. |
| R05 | Cancellation is idempotent, cancelled queued mounts never start, and the queue awaits viewer disposal. A version-checked Vite transform makes upstream getInstance await addSplatScene, preventing disposal of a still-loading scene and its unhandled rejection. The photo/initial fallback remains available. |

R12: three probes against this branch's API took 509, 454 and 447ms, all healthy.
The isolated >1s observation did not recur. The health implementation is outside
allowed paths, so it was not modified. R08 draft persistence was not among the
task's selected ten wins or additional requested findings and remains deferred.

Implementation choices: kept the renderer fix in apps/web because the shared
LAM package is outside allowed paths. The transform checks the exact upstream
loading pattern and fails explicitly if a renderer update changes it. It applies
to development and production builds; no node_modules source was edited. The
renderer still bundles another Three.js instance and emits its existing warning;
no global error/warning suppression was added.

Changed files (all inside allowed paths):

- `apps/api/app/domain.py` (feed text only), `apps/api/tests/test_fix003_feed.py`.
- `apps/web/src/App.tsx`, `src/styles.css`, `src/components/{ProfilePanel,Tour,Modals,WeekPanel,EventTerms}.tsx`, `src/components/{homeFeed,lamRuntime}.ts`.
- `apps/web/lamLifecyclePatch.ts`, `vite.config.ts`, `playwright.config.ts`.
- `apps/web/src/components/GaussianHead.test.tsx`, `src/api/gazette.test.ts`.
- `apps/web/tests/{audits,features,polish,real,village,web012,fix003}.spec.ts`, `fix003-capture.mjs`, `fix003-real.mjs`, this report.

Validation commands run from apps/web unless stated otherwise:

| Command | Result / exit code |
| --- | --- |
| `bun run typecheck` | Pass / 0 |
| `bun run build` with VILLAGE_ENV_FILE and VITE_MOCK=0 | Pass / 0; existing large-chunk warning |
| `bun run test` | 33 passed / 0 |
| `bun test ./src` | All 60 source tests passed / 0 |
| `bun run test:e2e` | 44 passed / 0 |
| `bunx playwright test --config tests/web014.config.ts` | 6 passed / 0 |
| `bunx playwright test --config tests/web012.config.ts` | 10 passed, 1 intentional flag-off skip / 0 |
| `bunx playwright test --config tests/scene.config.spec.ts` | 4 passed / 0 |
| `bunx playwright test --config tests/scene.town.config.spec.ts` | 2 live day/night tests passed / 0; software WebGL, not hardware performance certification |
| API: shared venv Python `-m pytest -q` from apps/api, VILLAGE_ENV_FILE set | 253 passed, 2 paid-generation opt-in tests skipped / 0 |
| `node tests/fix003-capture.mjs before` | Three real-mode baseline screenshots / 0 |
| `node tests/fix003-real.mjs` | All three requested viewports passed in headed Chromium/D3D11 on RTX 5090, visibly rendered settled heads, zero uncaught errors / 0 |
| `node --check tests/fix003-real.mjs` and `node --check tests/fix003-capture.mjs` | Both pass / 0 |
| `git diff --check` | Pass / 0 |

Earlier failing runs were used to correct short-screen overlap, opener restoration,
tour text, nested cancel propagation, and test assertions for the new native
profile dialog/people-strip layout. A live verification run encountered backend
500s with PostgreSQL `cached plan must not change result type`; restarting only
the task-owned API process cleared its cached plans. No schema changes were made.
The initial API startup also required the project's Windows selector-loop flag.

Visual QA also caught that SwiftShader reports LAM ready while drawing an empty
portrait. This reproduced on the unchanged localhost:4173 baseline; a hardware
WebGL run visibly renders the head. The final real-mode script uses headed D3D11
and waits for drawn frames before its settled-head screenshots. Software-renderer
DOM readiness is not treated as proof of visible LAM output.

Before/after screenshots are local and gitignored because they contain real
people's portraits. They were captured from this worktree's production build,
not the older review deployment:

| Viewport | Before | After |
| --- | --- | --- |
| 1920x1080 | [wide](../test-results/fix003/before/wide-home.png) | [wide](../test-results/fix003/after/wide-home.png) |
| 1366x768 | [laptop](../test-results/fix003/before/laptop-home.png) | [laptop](../test-results/fix003/after/laptop-home.png) |
| 390x844 | [phone](../test-results/fix003/before/phone-home.png) | [phone](../test-results/fix003/after/phone-home.png) |

The same `after/` directory holds each viewport's profile, six tour steps, settled
LAM head, and `results.json` with uncaught errors and warnings. The headed real-mode
script blocks API writes, visits all five people, checks profile keyboard behavior,
runs the tour, rapidly supersedes/closes portraits and waits for a fresh ready head.
No paid generation or real wallet signing was used. Wallet tests use synthetic hooks.

Teammate quick try: open http://localhost:4184, select each person at 390x844,
Tab through the profile, use Left/Right on Profile/Wardrobe, and press Escape.
Start Tour and compare step 2 with the profile's name. Resize to 1366x768 and
inspect dock/card spacing and feed summaries. The preview uses this branch's API
at 127.0.0.1:8014; the existing 4173/8010 services were left alone.

To reproduce with the external environment file (values are read only at runtime):

```powershell
# apps/api; use an installed Python 3.12 venv containing the API dependencies
$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'
$env:MAYOR_SCHEDULER='0'
$env:ASSET_DIR='C:/Users/mourn/Downloads/hacklanta/data/assets'
python -m uvicorn app.main:app --loop app.runtime:selector_loop --host 127.0.0.1 --port 8014

# separate terminal, apps/web
$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'
$env:VITE_MOCK='0'
$env:VILLAGE_API_URL='http://127.0.0.1:8014'
bun run build
bun run preview --port 4184
# separate terminal, apps/web
node tests/fix003-real.mjs
```

Dependencies used existing local node_modules junctions and the installed API
venv; no lockfile or secret file changed. No pushes or merges. Proposed contract
changes: none. Shared LAM package upstreaming and Three.js bundle deduplication
are follow-up integration work; this task's lifecycle fix is self-contained.
Blockers: none for the selected task scope. R08 remains deferred as noted above;
the pre-existing SwiftShader limitation is documented rather than called a
successful visible portrait render.
