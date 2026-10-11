# WEB-042 — Mayor cinematic redesign

Branch: `web/WEB-042`
Implementation commits: `3b80a9e`, `20e87f5`, `9bac842`, `860a7f4`. Final source revision: `860a7f4`.

## Changes

- `src/components/MayorScene.tsx`: full-width letterboxed scene; original SVG Mayor on the left, existing player Portrait/head with initials fallback, and six custom VillageIcon choices. Short typed dialogue stays separate from readable Gazette, prayer, challenge, and rumour content. Number keys select; Back/Escape returns to the previous choice; closing returns to town. Pending writes block dismissal.
- `src/components/MayorSceneSpeech.tsx`: Mayor-specific typed dialogue with named-group semantics; check-in speech stays unchanged.
- `src/components/MayorScenePortrait.tsx`: wraps the existing portrait adapter with an accessible custom crown badge, without editing shared portrait behavior.
- `src/components/MayorSceneDashboard.tsx`: neighbor portraits, weekly-goals ring, XP leaders, longest streak, active challenges, and actual repair check-in/neighbor progress.
- `src/components/MayorSceneBribe.tsx`: balance, explicit amount, wish, review, confirmation, busy lock, and session receipts. Focus moves to the receipt after confirmation; the next offering resets from the returned balance. Review/edit never spends coins. A failed request blocks a repeat submission and explains the uncertain outcome.
- `src/components/mayorScene.css`: Mayor-scoped desktop/mobile layout, readable type, focus outlines, high contrast, and reduced-motion treatment.
- `src/components/CinematicScene.tsx`: small dispatch wrapper to the new Mayor scene; preserves the existing check-in implementation and shared greeting.
- `src/components/MayorModal.tsx`: removes duplicated headings only when embedded; keeps standalone dialog behavior and brings prayer responses into view in the new scroll container.
- `tests/MayorScene.test.tsx`, `tests/web042.spec.ts`, `tests/web042.config.ts`, `tests/feat016.spec.ts`, `tests/web042.html`, `tests/web042-fixture.tsx`, `package.json`: dashboard unit coverage, mock browser/screenshots, and updated Mayor assertions in the existing cinematic regression suite. Mayor unit tests join the normal test command.

## Decisions

- Reused existing custom icons; no new icon dependency or generated artwork.
- The Mayor has no existing user portrait manifest. An original SVG illustration works without generated assets; the player uses the existing Portrait/head adapter. Reduced motion uses the static portrait.
- The goals denominator excludes auditor-excluded goals. Completion counts a done goal or a completed grade once. Unavailable weekly data is distinct from an empty week.
- Ordinary Mayor events do not expose numerical completion counts. Display their actual active status and deadline; show numerical progress only for disaster repairs, where counts exist. No fictional health score or challenge percentage.
- Gazette and rumours read already-generated content. No automatic generation, new API calls for mutations, changed reward rules, or live-demo actions.
- Screenshots and browser actions use `VITE_MOCK=1`. No secrets are needed or forwarded.

## Verification

Commands run from `apps/web` through Git Bash (`bash ../../ops/remote_run.sh ...`); no local fallback has been used.

| Command | Result |
| --- | --- |
| `../../ops/remote_run.sh bun run typecheck` | Exit 0 |
| `../../ops/remote_run.sh bun run test` | Exit 0 on final source revision; 183 passed, 0 failed, including 4 new Mayor tests |
| `../../ops/remote_run.sh bun test tests/MayorScene.test.tsx` | Exit 0; 4 passed |
| `../../ops/remote_run.sh bun run build` | Exit 0 on final source revision; TypeScript and Vite passed; existing large-chunk warnings only |
| `../../ops/remote_run.sh bunx playwright test --config tests/web042.config.ts web042.spec.ts` | Playwright exit 0: 7 passed in 108 seconds, 0 failed/skipped/flaky. Wrapper exit 1: its 30-minute budget expired during artifact download after the tests finished. All artifacts recovered with SCP, exit 0. |

Final browser coverage: all six choices at 1440x900, 1280x800, and 390x844; number keys; Back/Escape and focus restoration; prayer send/dismiss; offering review/edit/confirm and receipt focus; disabled dismissal and duplicate-spend protection during a pending request; uncertain failure and zero-balance states; Gazette retry, stale-read protection, and empty rumours. Mobile checks include reduced motion, no horizontal overflow, and Axe WCAG 2 A/AA checks on every option, with zero violations. The final JSON report is `apps/web/artifacts/web042/results.json`.

An earlier isolated UI run had 5 passes and 2 failures. It exposed a crown badge with an invalid accessible label, a scrolling region missing keyboard focus, and native Escape closing the dialog after a focused Retry button disappeared. These were fixed in `860a7f4`; all seven cases then passed.

Earlier attempts: the full-town WEB-042 capture command exceeded the runner's 30-minute budget (runner exit 124; wrapper process exit 1), after long queueing and two 90-second desktop case timeouts. The optional `../../ops/remote_run.sh bunx playwright test --config tests/web042.config.ts feat016.spec.ts` regression command also reached the runner deadline while waiting, without starting tests (runner exit 124; wrapper exit 1). One still-waiting screenshot job was explicitly rescheduled (runner exit 143) to recover its queue-consumed budget. No other worker's process was interrupted.

The final detailed UI suite uses an isolated mock page rendering the real `CinematicScene` Mayor branch and mock API. This avoids continually rendering the unrelated 3D town during dozens of screenshots. Final UI captures replaced the initial full-town captures. No tests were rerun locally. The optional full-town FEAT-016 regression did not execute before its queue deadline; this remains a verification limitation, not a reported pass.

## Try it

From `apps/web`, start Vite with `VITE_MOCK=1 VITE_DEMO_AUTH=1 bun run dev` (Git Bash), choose a demo seat, and open **Mayor**. Try keys 1–6, Back, Escape, a mock prayer, and Bribe → Review offering → Confirm. Resize to 1440, 1280, and 390 pixels. Use the close button to return directly to town.

Screenshots: `apps/web/artifacts/web042/` contains 45 PNGs (generated verification artifacts, not committed source assets). `option-1-*` through `option-6-*` cover each option at all three widths; `*-lower.png` captures scrolling content. `menu-*`, `prayer-result-*`, `bribe-confirm-*`, `bribe-receipt-*`, and error/empty-state images cover the remaining states. Visually reviewed desktop and mobile layouts, readable type, custom icons, button alignment, challenge terms, and confirmation/response cards.

No implementation blockers remain. Runner congestion and artifact-transfer timeout are documented above; the required Mayor UI suite completed and its artifacts were recovered. Full-town regression remains unverified.

Proposed contract changes: none.
