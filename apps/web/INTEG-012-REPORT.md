# INTEG-012

Branch: `integ/INTEG-012`. Merge milestone: `344b060` (parents `d986575`, `d1e3ae1`); browser-check corrections: `128d27d`. No push or merge to main.

Integrated WEB-037's custom SVG icons across widgets, feed rows, activity badges, empty states, portraits, inbox and toasts. Preserved WEB-036's top-bar alerts and colosseum behavior, and VFX-001's complete disaster effects and repair/revival implementation. Moved the incoming banner icons onto the current alert badge/dropdown and vet label. Scoped progress-ring CSS to its direct SVG so the warning icon stays upright at 18px. Kept both branches' unit test lists.

Changed files: all under `apps/web/`: package.json; App.tsx; api/idleActivity.ts; component icon consumers and Dashboard/ActivityFeed CSS; new VillageIcon.tsx and its unit tests; VillageAlerts.tsx; scene/DisasterEffects.tsx and VillageScene.tsx; styles.css; playwright.web037.config.ts; tests/web030, web031, web032, web036, web037 and vfx001-transitions specs; incoming WEB-037 report/captures; this report and artifacts/integ012 captures. Exact inventory: `git diff --name-only d986575 HEAD`.

Validation (commands from apps/web):

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile` | 0 | Dependencies installed, lock unchanged |
| `bun run typecheck` | 0 | Passed |
| `bun run test` | 0 | 156 passed, 0 failed |
| `bun run build` | 0 | Passed; Vite large-chunk warning |
| `bunx playwright test --config playwright.web037.config.ts` | 1 | 7 passed; 2 outdated privacy-copy assertions |
| `bunx playwright test --config playwright.web037.config.ts --grep "profile tabs and thumbnails"` | 0 | Both corrected profile checks passed |
| `bunx playwright test --config playwright.web036.config.ts` | 0 | All 6 alert/competition checks passed |
| `bunx playwright test --config playwright.vfx001.config.ts` | 1 | All 4 disaster render/repair checks passed; transition test assumed always-visible banner |
| `bunx playwright test --config playwright.vfx001.config.ts vfx001-transitions.spec.ts` | 0 | Corrected transition check passed, including low quality, reduced motion and revival |
| `git diff --check` | 0 | Passed |

HUD overlap checks passed at 1280x720, 1600x900 and 2560x900 with and without the profile. Icon/widget checks passed at 390x844, 1280x720 and 1600x1000. The two rerun groups address every failure from the original runs; unchanged passing tests were not rerun. Test-only corrections match existing main behavior: the current privacy message and explicitly opening the auto-minimizing alerts dropdown.

Screenshots: `artifacts/integ012/hud-1600-town.png`, `hud-2560-profile.png`, `dashboard-390.png`, `alerts-390.png`, `revival.png`. Desktop HUD, mobile dashboard/alerts and procedural revival captures were visually inspected. Original suites' historical captures were retained; selected fresh captures live in integ012.

Try it in PowerShell from apps/web:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
$env:VITE_VILLAGE_ID='13370000-0000-4000-8000-000000000000'
$env:VITE_DEMO_USER='00000000-0000-4000-8000-000000000001'
bun run dev --port 5337
```

Open http://127.0.0.1:5337, choose a demo seat, inspect widget popouts and profile, then use the mock debug menu to trigger/repair an outbreak and inspect the alert icon and vet label.

Assumptions: task-directed merge into this integration branch is authorized; main must remain untouched. Validation uses mock data or a fully intercepted MockApi, including procedural assets with model requests blocked for VFX. No live world mutations, paid calls, secret reads/copies, or contract changes were needed. Blockers: none.
