# FIX-016 report

Branch: `fix/FIX-016`. Implementation milestone: `6d5aa0b`; the subsequent evidence commit contains this report, browser fixtures, and final readiness/test refinements.

## Delivered

- Dark spotlight stage, larger consenting portraits, active-speaker glow, approximate karaoke word highlighting, idle breathing, static fallback waveform, quiet voice-off strip, suggested chips and custom text (100 characters), custom VillageIcon actions.
- Explicit readiness gate, including painted Gaussian frames and loaded static images. Six-second chorus deadline snapshots unavailable heads into static fallback for the playback run. Stop/close cancels pending starts.
- Decoded audio is scheduled on AudioContext; the renderer receives a media-clock adapter derived from that same context. Profile Hear them also uses that clock. Removed the competing animated profile hero.
- Eligible Gaussian packages prefetch on panel open. One live head is retained across opens with authentication/revision-aware identity and 60-second eviction. Controls appear only for ready heads on hover or keyboard focus.
- Placeholder metadata, demo_cast asset paths, and the known demo Maya ID are labeled and excluded from studio and profile voice actions.

## Files changed

All paths below are under `apps/web/`:

- `src/components/HeadStudio.tsx`, `HeadStudio.css`: stage and playback orchestration.
- `src/components/headPlayback.ts`, `headPlayback.test.ts`: readiness, placeholder guard, shared clock, unit coverage.
- `src/components/GaussianHead.tsx`, `GaussianHead.test.tsx`, `lamRuntime.ts`: painted readiness, controls, bounded renderer reuse, lifecycle coverage.
- `src/components/ProfilePanel.tsx`, `shared.tsx`: profile playback, portrait readiness and labels.
- `package.json`: include playback unit tests in the normal suite.
- `tests/fix016.spec.ts`, `fix016.config.ts`, `fix016.vite.config.ts`, `fix016.html`, `fix016.tsx`, `fix016-renderer.ts`: isolated synthetic browser harness.
- `tests/FIX-016-REPORT.md` and `artifacts/fix016/`: report and reviewed evidence.

## Validation

Commands run from `apps/web`:

- `bun install --frozen-lockfile`: exit 0 (dependencies initially absent).
- `bun run build`: final exit 0; existing large-chunk warnings remain.
- `bun run test`: exit 0; 162 tests across 40 files.
- `bun test src/components/headPlayback.test.ts src/components/GaussianHead.test.tsx`: exit 0; 8 focused tests.
- `bunx playwright test --config tests/fix016.config.ts`: final exit 0; 3 tests. Checks delayed head readiness before audio, cache reuse, cancellation, six-second fallback, custom chorus text, and exclusion of nonconsenting/placeholder villagers.
- `git diff --check`: exit 0.

Initial harness runs exposed missing dependencies, timing-sensitive test assertions, screenshot timeouts, and inconsistent mock permission setup; these were corrected before the final passing runs. No live API calls, paid generation, or real personal assets were used.

Reviewed screenshots: `artifacts/fix016/stage-desktop.png`, `stage-mobile.png`, `profile-mobile.png`, `static-fallback.png`. Screen recording: `artifacts/fix016/chorus-demo.webm` (synthetic browser capture, no recorded audio).

## Try it

From `apps/web`, run `bunx vite --config tests/fix016.vite.config.ts`, open `http://127.0.0.1:5198/tests/fix016.html?delay=1800`, then open Everyone says it and press Play during warmup. Use `?delay=9000` for static fallback and `?profile&delay=100` for the profile studio. Close/reopen within 60 seconds to exercise renderer reuse. These URLs use synthetic fixtures only.

In the normal app, open Everyone says it from the dashboard or a villager profile and use the new line chips/text field.

## Constraints / follow-up

The upstream `packages/lam-renderer` explicitly permits only one live Gaussian renderer per page. This implementation preserves that restriction: one retained rendered head, package prefetch for all consenting heads, and deadline-based static fallback for the others. Simultaneously animated Gaussian heads and a multi-head live-renderer cache remain blocked by that out-of-scope package limitation; a future multi-instance renderer API (or isolated rendering contexts) is needed. No HTTP/schema contract changes are proposed.

`data/inputs/demo_cast/SOURCES.md` is absent from this worktree. The existing placeholder metadata/path markers plus known demo Maya identity are used conservatively; provenance for unmarked, renamed CC0 assets cannot be inferred by the frontend. Real GPU assets were not exercised. Word highlighting is duration-based approximation, not forced alignment.
