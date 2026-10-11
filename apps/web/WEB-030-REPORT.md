# WEB-030 - Profile structure and HUD cleanup

Branch: `web/WEB-030`. Implementation milestone: `96e6e05`; verification milestone is the commit containing this report.

## Delivered

- Every profile has Overview, Outfit, House, Rewards and Activity tabs, keyboard navigation, persistent compact portrait/level/XP/streak/honors header, and 120 ms tab transitions (disabled for reduced motion).
- Overview pairs the current goal and progress with recent check-ins and accomplishments with reactions. Activity loads and filters the recent village feed for the selected person, with loading, empty, error and retry states.
- Outfit retains the interactive showcase and exposes the owned collection directly. Equipped and owned items use actual thumbnail PNGs; selection retains equip/unequip, shop navigation and color editing with preview/save. Photo creation and avatar controls open explicitly instead of adding permanent sections to the page.
- House has its own showcase, owned house items and an owner-only editor entry. House navigation opens the House tab directly.
- Rewards show source, rarity, actual requirements, earned/locked state, desaturated locked art and measured 28-day streak progress. Missing art uses a neutral silhouette without spawning additional WebGL contexts.
- R-63 HUD: top-bar profile portrait; tall feed below the hero; no self-card or duplicate Mayor card; neighbors above the dock; dock ordered Check in, Village, My goal, Weekly review, Compete, Mayor, Shop. Gazette remains accessible through the headline/scene and accomplishments through the feed.
- Mobile tabs, dock and header actions scroll horizontally. Desktop profile layout preserves the town's no-overlap guarantees.

## Files changed

- `src/App.tsx`
- `src/components/ProfilePanel.tsx`
- `src/components/ProfileOutfit.tsx`
- `src/components/ProfileSections.tsx` (new)
- `src/components/ItemThumbnail.tsx`
- `src/styles.css`
- `tests/web021.spec.ts`
- `tests/web030.spec.ts` (new)
- `playwright.web030.config.ts` (new)
- `artifacts/web030/*.png` (fixture-only desktop/mobile evidence)
- `WEB-030-REPORT.md`

All changes are inside `apps/web/`. No contracts, environment files, real photos, voice data or secrets were changed or committed.

## Verification

Commands run from `apps/web` unless noted:

- `bun install --frozen-lockfile`: exit 0. Dependencies were initially absent (`bun run typecheck` initially exited 1 because `tsc` was unavailable).
- `bun run typecheck`: exit 0.
- `bun run build`: exit 0; Vite reports the existing large-bundle warning.
- `bun run test`: exit 0; 96 passed, 0 failed across 25 files.
- `bunx playwright test --config playwright.web021.config.ts tests/web021.spec.ts`: exit 0; 7 passed, including HUD checks at 1280x720, 1600x900 and 2560x900 with/without the profile, shop errors/restrictions and touch house navigation.
- `bunx playwright test --config playwright.web030.config.ts`: exit 1 (5 passed, 1 failed verification lookup); the three HUD cases and both profile cases passed; the new persistence test initially failed because its verification lookup used a live seed ID instead of the mock membership ID. The lookup was corrected to use `api.me()` membership data.
- `bunx playwright test --config playwright.web030.config.ts --grep "profile tabs|owned outfit"`: exit 0; 3 passed. Covers desktop/mobile tabs, keyboard navigation, requirements/progress, loaded thumbnails, owner/visitor controls, equip/unequip, persisted and reopened colors, and missing-thumbnail fallback. All six WEB-030 cases have passed across the full run and corrected targeted rerun.
- `git diff --check` (repository root): exit 0.

Initial WEB-030 browser runs exposed the inherited camera-control overlap, which was fixed. A concurrent screenshot run exceeded its 45-second timeout; the final dedicated configuration runs one browser worker with a 90-second test budget and a separate output directory. An initial WEB-021 invocation from the repository root exited 1 because the config path was relative to `apps/web`; the corrected invocation above passed.

## Screenshots

`artifacts/web030/` contains desktop/mobile Overview, Outfit and Rewards; town views; and all three desktop HUD sizes with and without a profile. All 13 screenshots use offline fixture identities only. Desktop/mobile profile and town captures were visually reviewed during implementation. Review the desktop and mobile pairs together; the header and tabs stay fixed while the selected tab scrolls.

## Try it

In PowerShell, from `apps/web`:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
$env:VITE_VILLAGE_ID=''
bun run dev
```

Open the Vite URL, choose a demo seat if prompted, and use the round portrait at the top right. Visit every tab; choose an owned item to equip or change its colors; open Edit my house. Visit a neighbor to check the public profile. At mobile width, swipe the tab, action and dock rows to reach more controls. No GPU worker or paid provider is required.

## Decisions and limitations

- Only current streak length is a reliable reward counter in the existing profile shape. Perfect-week requirements use the backend's Monday-Sunday UTC rule; no guessed weekly/event counters are displayed.
- Other villagers' private inventories are not exposed. Their Rewards tab labels unequipped rewards as earnable instead of asserting that they are unowned.
- Overview shows the latest two check-ins/accomplishments; Activity shows that person's entries within the API's recent village-feed window.
- Full editing forms and large inventories can scroll within their tab. At narrow town widths the dock scrolls so all seven actions remain reachable.
- Live API and paid media generation were not invoked; verification uses offline fixtures. Existing Vite runtime environment loading remains unchanged.
- No blocking issues or required contract changes. Optional future contract enhancement: authoritative per-reward progress and a paginated per-person activity endpoint. The catalog's existing mojibake in the Mayor's Medal name is outside this task's allowed paths.
