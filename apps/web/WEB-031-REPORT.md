# WEB-031 — Dashboard widgets and clean view

Branch: `web/WEB-031`. Implementation milestone: `d6a2cb5`; final verification commit contains this report.

Delivered:
- Left dashboard with Around the Village, Your little corner, Mayor note, Gazette and current goal. Widget menus hide/reorder cards; a hidden-widget list restores them. Preferences and manual collapse persist separately for each village/seat, with safe defaults for invalid/unavailable storage.
- Compact feed shows four single-line entries. One draggable pop-out at a time offers exact local timestamps, reactions, activity filters and incremental loading of the available feed. Corner details show level XP breakdown and a 28-day UTC check-in calendar. Mayor details include available event/note history. Gazette links to the existing full paper/archive.
- Minimize button and Escape return focus and animate toward the originating card in 180 ms. Reduced motion uses opacity. Pop-outs stay within the viewport while dragging and reset position on resize.
- Camera-driven automatic collapse above 1.45 times the fitted zoom, restoring below 1.30 times. The ribbon temporarily overrides auto-collapse; a manual collapse persists through camera resets, zoom changes and reloads.
- Top-bar fullscreen button and F enter clean view. Browser fullscreen is requested when available; rejected requests retain the usable clean layout. Any key exits without also triggering a shortcut. Villager/building interactions exit and perform their normal action. The hint fades after two seconds. Scene labels remain available intentionally.
- Mobile dashboard is a scrollable bottom sheet above neighbors/dock, with the same widget controls.

Files: `src/App.tsx`, `src/components/Dashboard.tsx`, `src/components/Dashboard.css`, `src/components/useCleanView.ts`, `src/scene/TownCamera.tsx`, `src/scene/VillageScene.tsx`, `tests/web030.spec.ts`, `tests/web031.spec.ts`, `playwright.web031.config.ts`, `artifacts/web031/*.png`, this report. All changes stay within `apps/web/`.

Verification (commands from `apps/web`, except `git diff --check` from the repository root):

- `bun install --frozen-lockfile`: exit 0. Dependencies were initially absent; the first `bun run typecheck` exited 1 because `tsc` was unavailable.
- `bun run typecheck`: final exit 0. An intermediate check caught duplicate pointer-coordinate property names, which were corrected before browser testing.
- `bun run build`: exit 0, including the final implementation. Vite retains its existing large-chunk warning.
- `bun run test`: exit 0; 96 passed, 0 failed across 25 files.
- `bunx playwright test --config playwright.web031.config.ts`: exit 1; 11 passed, 3 failed. The run identified an obsolete standalone-Gazette HUD measurement, a test sending only one wheel event (OrbitControls zooms one step per event), and a genuine mobile sheet/neighbor overlap. All three were addressed: measure the dashboard container, use repeated real wheel input, and raise the mobile sheet 20px.
- `bunx playwright test --config playwright.web031.config.ts --grep "HUD no overlap|widgets expand|camera zoom|clean view|fullscreen rejection|dashboard layout"`: exit 0; 11 passed. Covers three desktop HUD sizes with/without profile, widget dragging/minimize/Escape/focus/load-more/filter/history, per-seat preferences, actual wheel zoom and manual-collapse persistence, native Fullscreen API, rejected fullscreen fallback, key exit, real villager and Gazette building clicks, and desktop/mobile screenshots. Together with the three existing profile/outfit cases that passed in the first run, all 14 cases have passed.
- `bunx playwright test --config playwright.web031.config.ts --grep "clean view exits"`: exit 0; 1 passed. Refreshed the clean-view screenshot after waiting for a rendered scene.
- `git diff --check`: exit 0.

Screenshots are fixture-only PNGs under `artifacts/web031/`: dashboard and expanded feed at 1280x720, 1600x900, 2560x900, and 390x844; clean fullscreen; and desktop profile-open HUDs. The mobile captures use reduced motion. Desktop dashboard/pop-out and clean/mobile captures are visually inspected before delivery. Initial fullscreen capture was taken before the scene was ready; the capture now waits for a rendered villager label.

Try it from `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
$env:VITE_VILLAGE_ID=''
bun run dev
```

Choose a demo seat. Use a widget's pop-out/options buttons, drag its expanded header, press Escape, hide/reorder and reload, then switch seats. Scroll repeatedly over the scene to zoom in; use the left ribbon or Reset camera. Press F, then a key or click a villager/Gazette building. At 390px width, scroll the bottom sheet for the remaining cards. No secrets or paid provider calls are required for this fixture demo; existing runtime environment loading is unchanged.

Decisions/limitations: only one pop-out is open at a time; labels remain in clean view to preserve discoverability. Load more reveals entries already supplied by the recent-feed API, not an invented historical endpoint. Mayor history is limited to available events and feed notes. The corner's XP breakdown is progression within the current level, not a fabricated award ledger; the calendar marks only check-ins returned by the profile API. These limits are also stated in the UI. No blocking contract changes. Optional future contracts: cursor-paginated activity, a Mayor note archive and an authoritative XP transaction ledger.
