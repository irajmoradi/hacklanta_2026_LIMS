# WEB-049 — house customization undo

Branch: `web/WEB-049`. Implementation milestones: `bf7795b`, `31f71ec`.

## Changes

- `HouseEditor.tsx`, `houseHistory.ts`: snapshot history for style, architecture, materials, palettes, and individual paint picks; Undo/Redo, shortcuts, counts, and Discard all.
- `ProfileOutfit.tsx`: exterior house/decor equip changes preview as drafts, with their own Undo/Redo and Save decor. Existing equip/unequip APIs persist the accepted draft.
- `HouseInterior.tsx`: complete the existing live move history controls, including stash/place/rotate, one history step per drag, disabled empty stacks, save/discard, sync acknowledgement checks, and protection against undoing a neighbor's newer edit. Inverse actions use the existing reducer/WebSocket messages (and BroadcastChannel in mock mode).
- `HouseLeaveGuard.tsx`, `ProfilePanel.tsx`, `styles.css`: accessible Save / Discard / Keep editing modal for close, Escape, profile tabs, village dropdowns, and other app navigation. Browser tab close/reload uses the browser's native unsaved-changes warning. Prompts restore focus and can resolve both exterior drafts.
- Tests: history and leave-guard unit coverage plus `web049.config.ts` / `web049.spec.ts` for desktop and 390 px mock-mode browser coverage. `web049-room.html` / `web049-room.tsx` load the production room component as a mock-only second-session sync observer.

## Verification

All heavy commands run from `apps/web` through `../../ops/remote_run.sh`.

- `bun run build`: exit 0 (TypeScript project build and Vite production build).
- `bun run test src/components/houseHistory.test.ts`: exit 1; 184 passed, 1 failed. The unrelated existing thumbnail invariant fails because `apps/web/public/thumbs/town_hall.png` is 640×640 RGB instead of 512×512 RGBA. Asset files are outside this task's allowed paths.
- An initial `bun run typecheck` was cancelled while waiting for the shared browser lock (remote exit 143); the subsequent build performed the typecheck successfully.
- `bun test src/components/houseHistory.test.ts src/components/HouseLeaveGuard.test.tsx src/scene/interior.test.ts`: exit 0; 9 passed. An initial run exposed a Happy DOM fixture setup issue; adding the same `SyntaxError` setup used by existing component tests resolved it.
- Initial `bunx playwright test --config tests/web049.config.ts`: exit 1; 390 px passed, desktop exceeded its initial 120-second budget while opening the second full-village session. Replaced that observer with the production room component in a mock-only fixture and raised the full-flow budget to 240 seconds.
- Second combined `bash -lc 'bun run typecheck && bunx playwright test --config tests/web049.config.ts'`: typecheck passed; browser exit 1. 390 px passed again, while desktop found a missing `api.initialize()` in the new observer fixture. The fixture now checks `VITE_MOCK` before initialization and cannot call the live API. Added a 30-second per-action timeout and retained failure traces.
- Last full browser run: exit 1, with 390 px passing and desktop reporting `Village not found` in the observer fixture. The observer now imports `DEMO_VILLAGE_ID` / `DEMO_USER_ID` from the canonical fixtures instead of duplicating IDs.
- Final `bash -lc 'bun run typecheck && bunx playwright test --config tests/web049.config.ts --grep 1440px'`: exit 0; typecheck and the desktop case passed. This checks both forward moves and undo in the second session, plus the external village dropdown leave guard. The successful 390 px case from the preceding run used the same production code; only the desktop observer fixture changed afterward.
- The final browser commands used the wrapper with `RUNNER_IP=<runner-2-ip>`, the original reachable runner, after the shared runner configuration changed. One intervening browser invocation on the new runner was intentionally interrupted during the host switch (exit 143).
- `git diff --check`: exit 0.

Both requested viewport cases are verified. Six screenshots were rendered and inspected. The existing thumbnail invariant is the only unresolved test failure; it is outside the allowed source paths. WEB-047 was not an ancestor of `main` at the final check, so the requested conditional rebase did not apply.

## Try it

In mock mode, open **My profile → House → Edit my house**. Pick paint/styles/materials, undo/redo, then close the editor or switch tabs to exercise the leave prompt. House showcase equip/unequip changes use **Save decor**. Choose **Go inside → Decorate**, expand Room inventory, and move a piece with its arrow; Undo and Discard send inverse changes. A second mock tab sees the room changes and their inverses.

Interior edits remain immediately synced; Save accepts the session history, while Discard reverses it. Furniture purchases are existing explicit purchases, not reversible placement edits. No new endpoints or contract changes. No live demo actions, real transactions, or paid generation calls.

Screenshots: `apps/web/artifacts/web049/` (generated, not committed): `exterior-1440.png`, `exterior-390.png`, `interior-1440.png`, `interior-390.png`, `leave-1440.png`, and `leave-390.png`.

No contract changes are proposed. The production changes are limited to the task's allowed component and stylesheet paths; test code and this handoff are under `apps/web/tests/`.
