# FIX-014 profile layout

Branch: `fix/FIX-014`. Implementation commit: `3c0dfc4`. This report and screenshot evidence are in the subsequent documentation commit on the same branch.

Changed `src/components/ProfilePanel.tsx`, `src/components/ProfileSections.tsx`, and `src/styles.css`: accomplishments now use `repeat(auto-fill,minmax(180px,1fr))`, compact trophy/title/date rows and right-aligned reactions without bottom borders. The owner's settings action is a named gear button beside the profile name. Overview tracks can shrink, names wrap, and mobile tabs fit the sheet without horizontal scrolling. Narrow phones move the streak below the name.

Added `playwright.fix014.config.ts`, `tests/fix014.html`, `tests/fix014-profile.tsx`, `tests/fix014.spec.ts`, and `tests/fix014.tsconfig.json`. The fixture mounts the real profile component with synthetic avatars and two synthetic accomplishments. Model requests fail deliberately to exercise fallback assets. API requests are blocked; component data uses the in-memory mock. No live village, paid generation, credentials, or transactions were used.

Validation (commands from `apps/web`):

- `$env:FIX014_BEFORE='1'; node node_modules/@playwright/test/cli.js test --config playwright.fix014.config.ts --max-failures=1`: exit 0, five baseline capture cases passed against the original UI. Baseline mode only captures screenshots; it does not assert the fixed behavior.
- `node node_modules/@playwright/test/cli.js test --config playwright.fix014.config.ts`: exit 0, five cases passed in 17.8 seconds. Covers Overview, Outfit, House, Rewards and Activity at 1280, 1440, 1920, 390 and 320 pixels; descendant bounds and scroll widths; expanded reaction palette; absence of accomplishment bottom borders; owner-only settings placement/callback; long unbroken peer names and goal titles; no runtime errors. Intentionally ellipsized text may have a larger internal scroll width, but its element bounds must remain inside the panel.
- `bun run typecheck`: exit 1, existing `tests/web026.spec.ts:49` and `tests/web035.spec.ts:36` have incompatible Playwright `Page` types (TS2740). These unrelated tests were not changed.
- Focused app-source/new-test TypeScript check passed (exit 0); reusable command: `node node_modules/typescript/bin/tsc --noEmit --project tests/fix014.tsconfig.json`.
- `git diff --check`: exit 0.

Initial attempts were blocked by missing Vite launchers during dependency installation and then by a test network guard that also intercepted source-module imports. The install completed and the guard was corrected before the successful baseline/final runs. Another intermediate run rejected intentionally ellipsized Activity text; the assertion now distinguishes clipping from escaping element bounds.

Screenshots: `apps/web/artifacts/fix014/` contains before/after images of all five tabs at all five widths, plus after images scrolled to mobile accomplishments. Representative pairs: `before-1280-overview.png` / `after-1280-overview.png`, `before-390-overview.png` / `after-390-overview.png`; `after-390-accomplishments.png` shows both mobile rows. Desktop and mobile Overview/accomplishments images were visually inspected.

Try it: run the Playwright command above, or start Vite with `bun run dev --port 5398` and visit `http://127.0.0.1:5398/tests/fix014.html`. Resize the window, switch every tab, expand achievement reactions, and click the settings gear (the fixture displays “Settings opened”). Add `?peer&long` to check long names and the absence of settings on someone else's profile. In the normal application, open My profile; the gear calls the existing settings handler.

Assumptions: mobile coverage includes 390px and a narrower 320px sheet; a trophy is the shared accomplishment icon; existing two-item preview and reaction behavior are preserved. Expanded house/avatar editors are outside this tab-level regression.

Blockers: no implementation blockers. Full repository typecheck remains limited by the two unrelated test typing errors above. Proposed contract changes: none. All changes are inside `apps/web/**`.
