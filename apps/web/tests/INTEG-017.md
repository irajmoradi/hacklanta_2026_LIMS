# INTEG-017 integration handoff

Merged `web/WEB-047` into `integ/INTEG-017` in merge commit `2aa8dda`.
All implementation and verification changes stay under `apps/web/`.

The merged interior retains Community Hall identity, permission checks, all floors,
photo objects, duplicate placement, categories, context actions, stairs, live room
updates and history. The pinned preview, scrolling controls, fixed Save/Cancel
footer and Escape cancellation apply to homes and the Hall. ProfileOutfit retains
R-124's `scrollWithinPanel()` and restores detail focus after closing color editing.

## Draft model for WEB-049

- `savedItems` is the latest shared baseline (snapshots, deltas, optimistic saves,
  or the offline BroadcastChannel). `setItems` updates that baseline.
- `draftMoves: DecorMove[]` is an ordered, local action log. `items` comes from
  `previewDecor(savedItems, draftMoves)`; `current.current` supplies the same
  preview synchronously to placement and collision checks.
- `send(item, action)` appends a draft. Only `send(item, action, true)` persists.
  `saveDecorating()` validates replay against the newest baseline, then sends the
  existing per-edit messages. This is not an atomic server transaction.
- Undo/redo continues to append inverse/forward actions inside the current draft;
  Cancel discards the draft and its undo/redo history. Escape cancels decorating
  first, then closes the room on a second press.
- `editSession` invalidates asynchronous placement after Save, Cancel or permission
  revocation. Purchases remain owned when an arrangement is canceled.
- `place(kind, duplicate)` preserves FEAT-019's new IDs, floor and creator metadata;
  regular placement can reuse a stashed item belonging to the current Hall member.
  Duplicate always creates a new instance. Keep this distinction when adding undo.

## Verification choices

The original FEAT-019 config requires a seeded API. To honor this task's mock-only
constraint, `tests/feat019.mock.config.ts` runs the same `feat019.spec.ts` with
Playwright-intercepted HTTP/WebSockets. The production room takes its connected
code path, but all room transport is in memory, with synthetic photo geometry.
No API process, database, live demo, secrets or paid generation is used.
The existing disposable-API config remains available. Browser expectations now
check that visitors receive changes after Save, and never receive draft changes.
The mocked run checks UI permission controls; it does not prove server enforcement.

`web047.spec.ts` now accepts FEAT-019's UUID-suffixed furniture IDs. The standard
unit script includes WEB-047's draft/color tests and a cross-floor duplicate test.

Try with mock Vite: My profile > Outfit > owned clothing > Choose colors, or House
> Edit my house. Scroll controls; the preview and Save/Cancel remain visible.
Go inside > Decorate; place/move furniture, then Save or Escape. Repeat at 390 px.
The FEAT-019 mock suite additionally exercises shared rooms, floors, photo objects,
duplicate/stash, creator removal controls, stairs and the Community Hall entrance.

No contract changes are proposed. Test results and screenshot review follow below.

## Verification results

Commands run from `apps/web` through `../../ops/remote_run.sh` on the documented
provisioned runner `<runner-1-ip>` (process-local `RUNNER_IP` override).

| Command | Result |
| --- | --- |
| `bun run build` | Exit 0; TypeScript build and Vite production bundle passed. Existing large-chunk warning. |
| `bun run test` | Exit 0; 200 passed, 0 failed across 50 files. |
| `bun run typecheck` | Exit 0 (`tsc --noEmit`), before the browser suites. |
| `bunx playwright test --config tests/web047.config.ts` | Exit 0; desktop and mobile passed in 2.4 minutes. Material updates measured 3.4 ms / 2.4 ms. |
| `bunx playwright test --config tests/feat019.mock.config.ts` | Final run exit 0; the two-user home/Hall scenario passed in 1.1 minutes. Latest fixture also passed `bun run typecheck` immediately beforehand. |

All eight WEB-047 screenshots were visually reviewed: previews and footer actions
fit the viewport, including the merged interior floor bar and context menu.
Evidence is generated locally (ignored by Git) under `apps/web/artifacts/web047/`:
`desktop-` and `mobile-` variants of `outfit-after.png`, `house-after.png`,
`exterior-decor-after.png`, and `interior-after.png`.
All seven FEAT-019 captures were also reviewed under
`apps/web/artifacts/integ017/feat019/`: `home-desktop.png`, `home-floor3.png`,
`hall-floor2-desktop.png`, `hall-photo-object.png`, `hall-mobile.png`, `town.png`,
and `community-hall-asset.png`. Hall identity, floors, context actions and the
pinned room/footer remain legible, including the 390 px layout. Photo geometry
and its thumbnail are intentionally synthetic fixtures.

The first FEAT-019 mock invocation returned exit 1 before collecting tests because
Node required a JSON import attribute for `scene/interior.ts`'s catalog import.
Its transport now uses standalone synthetic starter positions and a type-only
`Item` import, leaving application code unchanged.
The next invocation passed typechecking but failed the initial room assertion
(exit 1): the mock's `**/api/**` glob also matched Vite's `/src/api/client.ts`.
The route now tests `url.pathname.startsWith('/api/')`, so application modules
load normally and only API requests are intercepted.
The final rerun passed; no remaining task blockers. Application source was unchanged
after the successful unit suite, production build and WEB-047 checks. Later changes
only corrected the FEAT-019 harness and documented/ignored generated QA artifacts.

The first standalone typecheck waited on the configured runner's browser lock and
was canceled before execution (exit 143). Two queued combined attempts were also
canceled before execution (local wrapper exit 1), then narrowed to remaining checks
on the second provisioned runner. An initial wrapper invocation from the repository
root used the app-relative path and returned exit 1; all actual checks use the app
directory. These were invocation/queue issues, not test failures.

## Changed files

All paths below are relative to `apps/web/`.

- `.gitignore`
- `package.json`
- `src/components/HouseEditor.tsx`
- `src/components/HouseInterior.css`
- `src/components/HouseInterior.tsx`
- `src/components/ItemColorPanel.tsx`
- `src/components/ProfileOutfit.tsx`
- `src/components/ProfilePanel.tsx`
- `src/components/ShowcasePreview.tsx`
- `src/components/TryOnPane.tsx`
- `src/components/decorDraft.test.ts`
- `src/components/decorDraft.ts`
- `src/components/previewColors.test.ts`
- `src/components/previewColors.ts`
- `src/components/tryOn.css`
- `tests/INTEG-017.md`
- `tests/WEB-047.md`
- `tests/feat019.mock.config.ts`
- `tests/feat019.spec.ts`
- `tests/feat019Mock.ts`
- `tests/web047-baseline.py`
- `tests/web047.before.spec.ts`
- `tests/web047.before.vite.ts`
- `tests/web047.config.ts`
- `tests/web047.spec.ts`
- `tests/web047Scene.ts`
