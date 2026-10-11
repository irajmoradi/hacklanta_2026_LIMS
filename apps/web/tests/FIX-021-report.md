# FIX-021 verification

Branch: `fix/FIX-021`. Implementation commit: `f082c2b`.

## Baseline and changes

The task checkout and local `main` both pointed to `cfb24d4`. All three QA-011 P2
findings reproduced in Chromium with mock data at 1280×720 and 1440×900. None
were skipped. QA-011-00 was outside scope.

- `src/api/shopState.ts`: reuse the existing `sourceLabel` mapping for reward
  locks, including their accessible explanations. Purchase eligibility is unchanged.
- `src/components/ProfilePanel.tsx`: remember the actual Go inside button and
  focus it after reopening the profile surface on interior exit.
- `src/components/Colosseum.tsx`: retain the initiating Join button and restore
  it when the confirmation dialog unmounts, if it remains connected.
- `src/api/shopState.test.ts`: cover earned/event labels, fallback formatting,
  and the existing owned-item behavior.
- `tests/fix021.config.ts`, `tests/fix021.spec.ts`: isolated mock-only desktop
  repros, repeated open/close flows, Escape and explicit cancellation controls.
- `tests/artifacts/.gitignore`: exclude generated FIX-021 QA artifacts.

## Commands and results

Commands run from `apps/web` through the remote wrapper (invoked with Git Bash
on Windows):

1. `../../ops/remote_run.sh bunx playwright test --config tests/fix021.config.ts`
   on unchanged application source: **exit 1**, six expected failures. Assertions
   found `Earn-only: earned:auditor`, inactive Go inside, and inactive Join at
   both desktop sizes.
2. `../../ops/remote_run.sh bun run test`: **exit 0**, 188 passed, zero failed
   across 45 files, including the new reward-label coverage.
3. `../../ops/remote_run.sh bash -lc 'bun run typecheck && bunx playwright test --config tests/fix021.config.ts'`:
   typecheck **exit 0**; browser/combined **exit 1**, four cases passed. Both
   join cases passed the focus assertion, then failed because the test's
   non-exact Leaderboard locator also matched Close leaderboard. The selector
   was corrected to exact matching; no application change was needed.
4. `../../ops/remote_run.sh bunx playwright test --config tests/fix021.config.ts --grep 'cancelling join'`:
   **exit 0**, both desktop cases passed, including Cancel, Escape, repeated
   opening, restored Join focus, and an unchanged empty leaderboard.

Final coverage: typecheck passed, 188 unit tests passed, and all six focused
browser cases passed across the full run and the selector-corrected join rerun.

An early baseline attempt was interrupted after discovering that its API route
blocker also blocked Vite's `/src/api/` modules. The corrected blocker matches
only paths beginning `/api/`; the six baseline failures above are from that
corrected run. A queued combined validation attempt reached the wrapper's
30-minute timeout (reported **exit 124**) before executing checks. It was
resubmitted remotely; no local fallback or live API was used.

## Reproduce and artifacts

Run the focused Playwright command above. The config starts its own mock Vite
server, selects the fixture Iraj seat, blocks API HTTP requests, and uses no
secrets. The join scenario creates an in-memory fixture competition and cancels
the join; it never confirms a join or sends a transaction.

Manual checks in mock mode:

1. Shop: inspect Auditor Badge and Champion Mantle lock explanations.
2. My profile → House → Go inside: Escape or Back to village should focus Go inside.
3. Compete → create a fixture challenge → Open → Join: Cancel or Escape should
   focus Join and leave the leaderboard empty.

Generated screenshots are under `tests/artifacts/fix021/` (ignored):
`shop-1280.png`, `shop-1440.png`, `house-1280.png`, `house-1440.png`,
`join-1280.png`, and `join-1440.png`. All six were visually inspected.
The house and join screenshots visibly show the restored focus outlines. The shop
screenshots show the initial shop viewport; DOM assertions verify the reward
cards farther down the catalog.

No remaining blockers or proposed contract changes. All edits are inside the
task's allowed paths; the live demo village was not used.
