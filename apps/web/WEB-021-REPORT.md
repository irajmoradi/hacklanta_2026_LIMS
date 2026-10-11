# WEB-021 handoff

Branch: `web/WEB-021`. Implementation milestone: `63dc962`; follow-up verification and polish are in the commit containing this report. No push or merge.

## Delivered

- Centralized owned/buyable/locked state from shop ownership/inventory, balance, legacy and explicit prerequisites, and village unlocks. Cards show status chips with tooltips, full reason lists, disabled purchase explanations, and a View Backyard jump that focuses its card. HTTP 409 detail reaches both the inline error and toast.
- Profile Outfit item names, pet/house/voice summaries, and wardrobe item names open the viewer's shop focused on that item. Owned items remain disabled for purchase. Supplied earn-only sources explain the reward; custom photo items remain non-purchasable. Missing shop entries show an availability message.
- House nameplate ink is hidden until house/nameplate hover, keyboard focus, or selection. Touch tap opens the owner's profile and reveals the selected house. Villager tags retain existing behavior.
- Desktop HUD reserves a 66px dock row plus spacing through CSS variables. Self-card and hint stack above it; feed, Mayor note and neighbors occupy separate positions. Face invitation is compact, retaining its optional explanation as a title.

## Files changed (all under apps/web)

- `src/App.tsx`, `src/api/types.ts`, `src/api/shopState.ts`, `src/api/shopState.test.ts`
- `src/components/Modals.tsx`, `ProfileOutfit.tsx`, `ProfilePanel.tsx`, `Wardrobe.tsx`
- `src/scene/VillageScene.tsx`, `src/styles.css`, `package.json`
- `tests/web021.spec.ts`, `tests/web021-real.spec.ts`, `tests/web016.spec.ts`
- `playwright.web021.config.ts`, `playwright.web021-real.config.ts`, `playwright.web021-profile.config.ts`
- `WEB-021-REPORT.md`

## Validation

Run commands from `apps/web` unless noted.

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile` | 0 | Installed existing locked dependencies; no lockfile changes |
| `bun run test` | 0 | 39 tests, 243 assertions; includes 4 purchase-state tests |
| `bun run typecheck` | 0 | Final source passes TypeScript |
| `bun run build` | 0 | Production build; existing large-chunk advisory |
| `bunx playwright test --config playwright.web021.config.ts` (task-only configuration at that milestone) | 0 | All 7 WEB-021 tests passed |
| `bunx playwright test --config playwright.web021-real.config.ts` | 0 | Real API read-only shop capture; Connected asserted, no purchase/generation |
| `bunx playwright test --config playwright.web021-profile.config.ts` | 0 | Both WEB-016 profile regressions passed, 1366px and 390px; all models offline |
| `git diff --check` (repository root) | 0 | No whitespace errors |

The final broader command `bunx playwright test --config playwright.web021.config.ts web021.spec.ts equipment.spec.ts village.spec.ts` also exercises HTTP 409 through the actual client using an intercepted response. Its final results are recorded below.

The first live screenshot attempt timed out loading the shop; the successful retry used a 30-second assertion timeout. Initial implementation compile errors were fixed before the successful checks above.

## Screenshots and manual check

Screenshots are local QA artifacts, intentionally not committed (live views can contain real portraits):

- `apps/web/test-results/web021/shop-real.png` — inspected, actual API dog prerequisite state.
- `apps/web/test-results/web021/shop-mock.png` — prerequisite jump and focused Backyard card.
- `apps/web/test-results/web021/hud-{1280,1600,2560}-{town,profile}.png` — tested at 1280x720, 1600x900, 2560x900. All visible HUD panel pairs, including self-card/dock/hint, must not intersect. Town/profile 1280 screenshots visually inspected.

For a teammate: from `apps/web`, set `VITE_MOCK=1` and `VITE_DEMO_AUTH=1`, then `bun run dev --port 5321`. Open Shop and inspect Village Dog; follow View Backyard. Open Lance's profile, click Festival Hat in Outfit, and inspect its focused shop card. Open your own Headphones to see Owned. Hover/tab to a house nameplate, or tap on touch. Resize with the profile open to check the dock separation. Run the focused suite with `bunx playwright test --config playwright.web021.config.ts web021.spec.ts equipment.spec.ts`.

For real mode, preserve `VILLAGE_ENV_FILE` pointing to the existing external root environment file; Vite reads public values at runtime. The real screenshot config uses the already-running API at port 8010 and seeded demo identity. No secrets were copied, and no paid provider calls or live purchases were made.

## Choices, limitations and proposed contract change

No implementation blocker. Existing `/shop` provides `owned` and `balance`; durable building unlocks currently come from `/villages/{id}.world`. The implementation also accepts additive `inventory` and `unlocks` fields when provided. A prerequisite link jumps to the card rather than spending XP immediately.

Current `/shop` and public equipment responses do not supply earn-only `source` descriptions. The frontend renders them when supplied, but cannot infer an event's acquisition rules when metadata is absent. Proposed integrator change: expose an optional human-readable `source` on shop/public equipped items, and include earn-only catalog entries with their acquisition descriptions. No contract files or other apps were edited.

Final broader regression result: **exit 1, 11 passed / 3 failed**. All 7 WEB-021 tests and both equipment tests passed, as did the existing check-in/purchase and goal/Mayor/user-switch flows. All 3 failures are existing `village.spec.ts` selectors for `villager-Dev` (lines 9 and 128); current unchanged fixtures contain Iraj, Lance, Stefanny, Maya and Mario, not Dev. This is a stale test-fixture mismatch, not a WEB-021 assertion failure. The tests were left intact and the failure is reported rather than hidden. Re-running only the task and equipment files avoids these unrelated stale cases.
