# WEB-035 completion report

Branch: `web/WEB-035`. Implementation milestone: `562a8cd`.

Implemented five widget identities in both dashboard cards and pop-outs: sage notebook feed, peach wallet/corner with a circular streak badge and one level caption, parchment Mayor note with wax crest, newsprint Gazette masthead, and blue perforated goal ticket. The dashboard heading is a compact left-aligned tab. Existing collapse, hide, reorder, drag and minimize behavior remains in place.

Feed rows now classify legacy AI prefixes into readable labels and Mayor/gear avatars, normalize leading bullets, and use the avatar as the single row marker. Ordinary feeds exclude debug rows and scheduler `none:` decisions. The Mayor note history uses the same visibility rules and cleaned text.

Files changed:
- `src/components/Dashboard.tsx`, `Dashboard.css`: widget identities and corner layout.
- `src/components/ActivityFeed.tsx`, `ActivityFeed.css`: labeled system avatars and clean row rendering.
- `src/components/activityData.ts`, `activityFeed.test.ts`: classification, visibility and unit coverage.
- `src/api/client.ts`: explicit visibility predicate callback, avoiding Array.filter's index being interpreted as the debug option.
- `playwright.web035.config.ts`, `tests/web035.spec.ts`: offline UI verification at three viewports.
- `tests/screenshots/WEB-035/`: dashboard, five pop-outs per viewport, and six HUD regression screenshots.

Verification (run from `apps/web`):
- `bun install --frozen-lockfile`: exit 0.
- `bun test src/components/activityFeed.test.ts`: exit 0, 5 tests / 46 assertions.
- `bun run typecheck`: exit 0 after correcting the filter callback signature.
- `bun run test --timeout 30000`: exit 0, 144 tests / 163,555 assertions. The initial `bun run test` exited 1 with 143 passes and the existing paddock test exceeding its five-second timeout during concurrent browser work.
- `bun run build`: exit 0; Vite reports large bundle chunks.
- `bunx playwright test --config playwright.web035.config.ts --grep 'widget identities|HUD no overlap'`: exit 0, three existing HUD overlap tests at 1280x720, 1600x900 and 2560x900, with and without the profile. At this point the widget test file had not yet been created.
- `bunx playwright test --config playwright.web035.config.ts --grep 'widget identities'`: exit 0, three passed viewport cases at 390x844, 1280x720 and 1600x1000; checks system avatars/filtering, all five theme backgrounds in compact and expanded forms, one level caption, wallet/streak visibility, minimizing/reopening, and axe color-contrast rules on every pop-out.
- `git diff --check`: exit 0.

An early typecheck could not start before dependencies were installed; an initial browser launch collided with the running HUD server, so the dedicated WEB-035 config now uses port 5335. No provider credentials, generated assets, GPU worker, or paid calls were needed.

Visual QA: inspected mobile dashboard and corner, laptop Gazette, and desktop dashboard PNGs. Screenshots are synthetic fixture data, with no real photos or voice. See `tests/screenshots/WEB-035/dashboard-390.png`, `dashboard-1280.png`, `dashboard-1600.png` and the individual widget PNGs alongside them.

Try it: run `bunx playwright test --config playwright.web035.config.ts --grep 'widget identities|HUD no overlap'`, or start Vite with `VITE_MOCK=1` and `VITE_DEMO_AUTH=1`, choose a demo seat, then scroll and pop out each dashboard widget. Check the wallet, minimize it, and collapse/reopen the dashboard.

Choices: retain the shared currency SVGs for recognizable XP/coins/SOL chips; SOL stays the existing unavailable devnet balance. The streak circle displays the actual day count without inventing a streak target. No debug-viewer feed mode exists in the UI, so all ordinary feeds are clean by default; the helper permits explicit debug inspection. Styles are scoped to widget/feed surfaces and do not modify dark arena currency exceptions or the shared stylesheet being worked on by WEB-034.

Blockers: none. Proposed contract changes: none. No changes outside `apps/web`.
