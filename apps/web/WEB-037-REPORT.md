# WEB-037 — Custom Village icons

Branch: `web/WEB-037`. Implementation milestone: `9c16a62`.
The following validation commit adds complete live-feed mappings, screenshots, and this report.

Implemented original inline SVGs on a 20px grid with 1.75px rounded strokes and an 18% currentColor silhouette. Dashboard headers now use accent-colored inline icons, medium-weight sentence-case titles, and no filled icon badges. Gazette serif styling remains in its content. Feed rows have type icons and custom actor icons; all nine idle activities have distinct drawings. Toasts support reward, success, error, and information icons. The existing inbox gets the shared bell. Other emoji chrome (review badges, house locks, empty states, weather, photo/message actions, Mayor welcome, construction, debug control, and scene crowns) uses the same family. User content, reactions, and custom coin/diamond/SOL artwork remain intact.

Reasonable choices:

- This branch has no separate top-bar alerts component, so the bell is applied to the existing inbox entry. `VillageIcon name="bell"` is available for WEB-036 integration.
- The toast system is still the existing single toast. Added an optional typed `kind` and exported `toastIcons` for WEB-034 without changing its lifecycle; existing callers remain compatible.
- Feed types are unrestricted strings. Explicit mappings cover current API formatter types, documented disaster events, and mock events; future types safely fall back to a speech bubble.
- Native activity select options keep plain readable text because native options cannot reliably render SVG. Name tags render the mapped activity icon alongside the same label.
- All work and artifacts are inside `apps/web`. No secrets were needed, copied, or printed. Browser testing used the fixture village and offline mock API; no live village changes or provider calls.

Validation (commands run from `apps/web`):

| Command | Result |
| --- | --- |
| `bun test src/components/VillageIcon.test.tsx src/components/activityFeed.test.ts src/scene/layout/idleActivities.test.ts src/components/Currency.test.tsx` | Exit 0; 13 passed |
| `bun run test` | Final run exit 0; 152 passed across 36 files |
| `bun test src/api/retry.test.ts` | Exit 0; 8 passed |
| `bun test src/components/VillageIcon.test.tsx` | Final mapping check exit 0; 3 passed, 441 assertions |
| `bun run build` | Exit 0; production build succeeds; existing large-chunk warning |
| `bun run typecheck` | Final run exit 0 |
| `bunx playwright test --config playwright.web037.config.ts --grep 'custom icons\|HUD no overlap'` | Exit 0; 6 passed |
| `git diff --check` | Exit 0 |

The first full unit run had 151 passes and one timing-sensitive failure in the existing background-poll test (`retry.test.ts` expected two starts within 130ms). Its isolated rerun and the subsequent full suite both passed without changing that test. Initial typechecking found missing worktree dependencies and an inferred feed-kind type; dependency junctions and an explicit type resolved those issues. Ignored dependency junctions point to the existing `hacklanta/apps/web` installation and its nested pot installation; they are not committed.

Browser checks cover desktop HUD separation with/without a profile at 1280×720, 1600×900, and 2560×900; icon/header contracts, five popouts, and HUD separation at 390×844, 1280×720, and 1600×1000. No browser page errors were reported. Visually inspected the mobile dashboard and Mayor popout, desktop Gazette popout, and large desktop dashboard.

Screenshots: `artifacts/web037/` contains 18 PNGs: `dashboard`, `feed`, `corner`, `mayor`, `gazette`, and `goal`, each at widths `390`, `1280`, and `1600`.

Try it in PowerShell from `apps/web`:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
$env:VITE_VILLAGE_ID='13370000-0000-4000-8000-000000000000'
$env:VITE_DEMO_USER='00000000-0000-4000-8000-000000000001'
bun run dev --port 5337
```

Open `http://127.0.0.1:5337`, scroll the dashboard, pop out its widgets, inspect name tags, and save a mock check-in to see the toast. The Playwright command above configures mock mode automatically.

Blockers: none. Proposed contract changes: none.

Files changed (relative to `apps/web`):

- `src/components/VillageIcon.tsx`, `VillageIcon.test.tsx`: shared icon vocabulary, exhaustive activity/actor maps, feed fallback, toast kinds, and rendering tests.
- `src/components/Dashboard.tsx`, `Dashboard.css`, `ActivityFeed.tsx`, `ActivityFeed.css`, `activityData.ts`: inline header styles and typed feed icon integration.
- `src/App.tsx`, `src/api/idleActivity.ts`, `src/components/shared.tsx`, `src/scene/VillageScene.tsx`, `DisasterEffects.tsx`: inbox bell, toast kinds, plain activity labels, custom name-tag/chrome icons.
- `src/components/AgentPanel.tsx`, `DemoTools.tsx`, `DisasterBanner.tsx`, `FaceCheck.tsx`, `HouseEditor.tsx`, `MayorModal.tsx`, `Messages.tsx`, `Modals.tsx`, `Onboarding.tsx`, `PhotoItems.tsx`, `ProfilePanel.tsx`, `VillagePanel.tsx`, `Villagergram.tsx`: remaining UI emoji replacements.
- `package.json`, `playwright.web037.config.ts`, `tests/web037.spec.ts`, `tests/web031.spec.ts`, `tests/web032.spec.ts`: test registration, mock screenshot/HUD checks, sentence-case expectations.
- `artifacts/web037/*.png`, `WEB-037-REPORT.md`: review evidence and handoff.
