# WEB-016 — Home schedules and public outfits

Branch: `web/WEB-016`.
Feature milestone: `f791e5a`; test milestone: `a161748`. See subsequent commits for final label refinements and verification.

## Delivered

- Villagers start at their own front yard. During ordinary daytime, each address gets a staggered 90-second store visit in a ten-minute cycle (15% destination duty cycle, including travel); otherwise they return home. Normal nights stay home. An active, unexpired Mayor event sends them to the plaza; `festival_night` takes priority and selects the festival district stage. Unavailable destinations fall back safely. The five-second schedule refresh works even with a fixed API `time_of_day`.
- Each home has a round photo/initials nameplate above the door. Both its button and the 3D house open that owner's profile. HTML overlays remain inside the isolated scene with low stacking order; noninteractive wrappers do not intercept controls. Character labels lift clear of their own nameplate at home.
- Every profile's Profile view now has an Outfit section: selected villager's equipped icon/name/slot, pet, house level/upgrades, voice style, custom photo item metadata/preview, and the existing rotating Wardrobe preview. It performs no inventory mutations or voice generation. Owners retain the editable Wardrobe tab; peers never receive editing controls.
- Equipped item names come from the registry/local catalog or additive API metadata, with readable fallback names. Private custom-item inventory is never requested. Broken photo previews fall back safely.

## Files

Production: `src/scene/layout/town.ts`, `src/scene/VillageScene.tsx`, `src/components/ProfileOutfit.tsx`, `src/components/ProfilePanel.tsx`, `src/api/types.ts`, `src/styles.css`.
Tests: `src/scene/layout/town.test.ts`, `tests/web016.spec.ts`, `tests/web016.config.ts`, `tests/web016-real.mjs`, `playwright.web016-regression.config.ts`, `tests/auth.spec.ts` (expected redirect follows configured origin so isolated ports work).
This report: `tests/WEB-016-REPORT.md`.

## Verification

Commands run from `apps/web` unless noted. All 44 standard regression cases passed across the full run and focused corrective rerun; no unresolved failures remain.

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile` | 0 | Installed web and nested pot dependencies; no lockfile changes |
| `bun run typecheck` | 0 | TypeScript passed |
| `bun test src` | 0 | 61 passed, 3,013 assertions |
| `bun test src/scene/layout/town.test.ts` | 0 | 9 passed, 1,219 assertions after festival-stage correction |
| `bun run build` | 0 | Production build; existing large-chunk warning |
| `bunx playwright test --config tests/web016.config.ts` | 0 | 2 passed: desktop and mobile, all models unavailable, no mutations/generation |
| `bunx playwright test --config playwright.web016-regression.config.ts` | 1 | 42 passed; house button name collision and fixed Auth0 port expectation corrected |
| `bunx playwright test --config playwright.web016-regression.config.ts --grep 'goal edits\|HUD wins\|configured Auth0'` | 0 | 4 passed: both corrected failures plus desktop/touch label hit tests |
| `node tests/web016-real.mjs` | 0 | Live API, three viewports, no browser errors |

The default `bunx playwright test` initially exited 1 because another worktree owns port 5174. The isolated regression config uses 5294/5295/5297. Development iterations of the new tests also exposed and corrected a source-import interception, a resize/remount race, and an expected-name capitalization mismatch. Live capture initially asserted visibility of a deliberately hidden mobile connection badge; it now checks attachment. A later capture was interrupted by a Windows Vite file-watcher EBUSY error while this report was being written; the server was restarted on 5298 and capture rerun using WEB016_URL. No live writes or paid generation were performed.

## Screenshots and visual review

Local artifacts (not committed: live screenshots contain real people's photos):

- `test-results/web016/real-wide-village.png`, `real-wide-outfit.png` — 1920×1080.
- `test-results/web016/real-laptop-village.png`, `real-laptop-outfit.png` — 1366×768.
- `test-results/web016/real-phone-village.png`, `real-phone-outfit.png` — 390×844.
- `test-results/web016/real-results.json` — live checks and browser errors.
- `test-results/web016/mock-outfit-1366.png`, `mock-outfit-390.png` — offline models plus synthetic custom item.

## Teammate tryout

1. `cd apps/web`; `bun install --frozen-lockfile`.
2. For offline demo, set `VITE_MOCK=1`, `VITE_DEMO_AUTH=1`, then `bun run dev --port 5196`. For live mode, set `VILLAGE_ENV_FILE` to the shared root env at runtime, `VITE_MOCK=0`, and the public demo user/village identifiers; API defaults to port 8010. No secrets were copied.
3. Click a house or its nameplate. Scroll to Outfit. Compare another member with My profile; only your profile has the editable Wardrobe tab. On phones, the people list remains an independent accessible route to every profile.
4. Run `bunx playwright test --config tests/web016.config.ts`. For live screenshots, serve live mode at 5198 and run `node tests/web016-real.mjs` (or set `WEB016_URL`). The capture script blocks all API mutations.

## Choices, integration notes, limitations

- WEB-015 runs in parallel and its pfp component is absent from this worktree. This change reuses the existing shared `Portrait` in nonanimated mode (round authenticated photo with initials fallback). Integrator can swap that single use to WEB-015's cached pfp component when merging; no cross-branch edits were made.
- Store visits mean 15% of ordinary daytime schedule time. Event/festival attendance overrides that schedule. No event is invented to make villagers leave home.
- Custom items shown are the selected member's **equipped** public items; the API has no peer inventory endpoint. The shared Wardrobe 3D renderer retains its existing asset/fallback capabilities; custom photo previews are displayed alongside the equipment list.
- Contract changes: none required; optional frontend equipment metadata mirrors fields already returned by API-011. No contracts or other apps were edited.

Final blockers: none. Parallel WEB-015 pfp integration is noted above. Tracked screenshots overwritten by unrelated regression cases were restored.
