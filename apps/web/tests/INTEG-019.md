# INTEG-019 integration report

Branch: `integ/INTEG-019`. Base: `057ca56`.

Merge milestones (both `--no-ff`, in the requested order):
- `6bfca86`: `integ/INTEG-017` (pinned previews) into this task branch.
- `f912c8d`: `feat/FEAT-022` (interior walking/avatars/stairs) into this task branch.
- `6dc61cc`: reconcile movement payloads, draft history, exterior item previews and browser assertions.
- `17decfd`: full unit discovery, preview Escape handling and concurrent draft-save guards.
- `38ab19d`: capture-phase shortcuts inside modal previews and shared movement field validation.

No push, merge to main, live-demo writes, secret copies, paid generation or transactions.
All source changes are under `apps/web/`, `apps/api/`, and `packages/contracts/api.md`.

## Result and choices

The house and outfit editors retain the pinned preview and sticky Save/Cancel footer.
House style/material/color history, keyboard undo/redo, discard, and navigation leave
guards survive. Escape explicitly cancels the current pinned preview; navigation
still offers Save / Discard / Keep editing. Exterior item acceptance adds an undoable
house draft step; the collection's Save decor persists it. Canceling another item
preview preserves the already accepted draft steps.

Interior edits, including undo/redo inverses, operate on the local draft. Save replays
that ordered log through the existing furniture reducer and waits for acknowledgements;
observers see only saved changes. Cancel/Discard drops the draft, retains shared
updates, and invalidates asynchronous placement. Save also checks touched furniture
against its first-edit baseline, so another member's newer edit cannot be silently
overwritten by a stale preview. Room changes still use per-edit messages, not an atomic
server transaction: an interrupted save can leave the acknowledged prefix applied.

Hall identity, creator removal permissions, duplicate IDs, photo objects, history and
floors are retained. Own/visitor avatars walk, avoid furniture, and use adjacent-storey
stairs. Walking pauses while decorating or viewing room history. Missing generated
assets use the existing procedural fallback.

Interior movement reuses FEAT-021's `Movement` type and Python validator, adding room
bounds, a `floor` field and the `movement` envelope on the authenticated house socket.
Interiors send `running:false` and `emote:null`. Identity remains server supplied;
positions are ephemeral and rate limited. The allowed contract file documents this;
no additional contract changes are proposed.

## Try it

From `apps/web` in Git Bash, run the mock browser suites below. For interactive QA,
use `VITE_MOCK=1 VITE_DEMO_AUTH=1 bun run dev` and open My profile > House > Edit my
house. Paint, Undo/Redo, and Save or Escape. Select an exterior item, apply it to the
house draft, then Undo or Save decor. Go inside > Decorate, move an item, Undo, and
Save decor or Escape. The FEAT-022 disposable-API suite opens two independent members
upstairs and exercises the real house WebSocket without the live village.

## Verification

All heavy checks use `../../ops/remote_run.sh` from the relevant app directory on the
configured runner. API tests use scratch schemas; `--with-api` creates and destroys a
separate scratch database. No root env values are needed for these tests.

Final results and reviewed screenshot paths follow.

Initial checks and fixes:
- Initial typecheck failed on the inherited FEAT-019 `mockOnly` flag; fixed the merged harness.
- The original configured unit set passed: 213 tests; initial production build passed.
- WEB-047 passed both desktop and mobile (2 tests). Color updates measured 1.9/2.9 ms.
- The first WEB-049 run failed both shortcut assertions: modal event propagation hid the
  window's bubble-phase shortcut listener. Capture-phase listeners fix the production bug.
- Expanded unit discovery ran 256 checks: 255 passed; the historical WEB-050 comparison
  failed because its explicitly generated Git-baseline fixtures were absent. That benchmark,
  like SCALE-001's browser benchmark, stays outside the normal unit command. All source unit
  files remain included. No application assertion was weakened or skipped to fix this.
- API command: `python -m uv run pytest -q tests/test_interior_position.py tests/test_feat015.py
  tests/test_feat019.py tests/test_realtime.py`: exit 0, 35 passed / 1 skipped (live Tiger).

WEB-049 rerun: `bunx playwright test --config tests/web049.config.ts`: exit 0,
2 passed (1440 px and 390 px, 2.6 minutes). Includes a second-session observer,
local draft undo/redo, accepted inverse transport, placement/stash and navigation guards.

FEAT-019 mock rerun: `bunx playwright test --config tests/feat019.mock.config.ts`:
exit 0, 2 passed (2.4 minutes), including concurrent same-item draft rejection,
shared Hall/photo-object updates, three-storey homes, and offline/mobile Hall access.

FEAT-022 disposable-API run: `--with-api bunx playwright test --config tests/feat022.config.ts`:
exit 0, 2 passed (47.1 seconds). Real authenticated house WebSockets carry the shared
movement payload; two users walk upstairs, late join/departure works, visitor edits
are unavailable, decorating pauses walking, and three-storey stairs never wrap.

Final WEB-047 rerun: `bunx playwright test --config tests/web047.config.ts`: exit 0,
2 passed (2.8 minutes). Final color timings: 3.5 ms desktop / 4.6 ms mobile.
The four requested Playwright configs completed in one serialized `--with-api`
wrapper invocation, exit 0 (8 total tests). All browser checks used final production
source. The only later source-tree change was removing the historical benchmark
from the default unit command.

Final `bun run typecheck`: exit 0. Final `bun run test`: exit 0, 254 passed / 0 failed
across 67 files. `git diff --check`: exit 0.

## Reviewed screenshots

Required proofs, committed with this report (paths relative to the repository root):
- `apps/web/tests/artifacts/integ019/decorate-pinned.png`: decorating with the room
  pinned beside scrolling inventory and sticky Save/Cancel.
- `apps/web/tests/artifacts/integ019/undo-after-move.png`: sofa restored after a move;
  Undo is empty, Redo is available, and the room remains in preview mode.
- `apps/web/tests/artifacts/feat022/upstairs.png`: two independent users on Floor 2.
- `apps/web/tests/artifacts/feat022/peer-upstairs.png`: the same positions from the
  visitor's session.

Also reviewed the mobile undo screenshot in `apps/web/artifacts/web049/`, desktop/mobile
pinned house/outfit/interior captures in `apps/web/artifacts/web047/`, refreshed
`apps/web/artifacts/integ016/hall-{desktop,mobile}.png`, and FEAT-022's `home-floor3.png`
and `visitor-mobile.png`. Pinned renderers and footer actions fit the viewport;
Hall identity, floor selection, history controls and procedural fallback are visible.
The imported FEAT-022 `session-a.webm` remains its original branch evidence; new video
recordings remain ignored rather than being mislabeled as that original recording.

## Blockers and limitations

No remaining implementation blocker or proposed contract change. Included contract
update is limited to the allowed `api.md` movement section. Per-edit saves can apply
a prefix before a connection failure; this preserves the existing reducer contract.
No atomic save endpoint or schema change was introduced. Existing bundle-size warnings
and the optional live-Tiger skip are noted, not treated as passing live verification.

Final `bun run build`: exit 0 (TypeScript project build plus Vite production build,
2490 modules, 17.52-second Vite phase). Existing >500 kB chunk warning only.

## Commands as executed

From `apps/web` (final invocations, both wrapper exit 0):

```bash
../../ops/remote_run.sh bash -lc 'bun run typecheck && bun run test && bun run build'
../../ops/remote_run.sh --with-api bash -lc 'bunx playwright test --config tests/web049.config.ts && bunx playwright test --config tests/feat019.mock.config.ts && bunx playwright test --config tests/feat022.config.ts && bunx playwright test --config tests/web047.config.ts'
```

From `apps/api` (wrapper exit 0):

```bash
../../ops/remote_run.sh python -m uv run pytest -q tests/test_interior_position.py tests/test_feat015.py tests/test_feat019.py tests/test_realtime.py
```

On Windows these wrapper commands were launched with Git Bash (`bash ../../ops/remote_run.sh ...`).
Earlier failing aggregate invocations returned wrapper exit 1; the fixes and causes
are listed above. Tests were rerun remotely, never against the live demo.

## Files changed from task base

- `apps/api/app/houses.py`
- `apps/api/tests/seed_interior_walk.py`
- `apps/api/tests/test_interior_position.py`
- `apps/web/.gitignore`
- `apps/web/artifacts/integ016/hall-desktop.png`
- `apps/web/artifacts/integ016/hall-mobile.png`
- `apps/web/package.json`
- `apps/web/src/components/HouseEditor.tsx`
- `apps/web/src/components/HouseInterior.css`
- `apps/web/src/components/HouseInterior.tsx`
- `apps/web/src/components/HouseLeaveGuard.test.tsx`
- `apps/web/src/components/HouseLeaveGuard.tsx`
- `apps/web/src/components/ItemColorPanel.tsx`
- `apps/web/src/components/ProfileOutfit.tsx`
- `apps/web/src/components/ProfilePanel.tsx`
- `apps/web/src/components/ShowcasePreview.tsx`
- `apps/web/src/components/TryOnPane.tsx`
- `apps/web/src/components/decorDraft.test.ts`
- `apps/web/src/components/decorDraft.ts`
- `apps/web/src/components/interiorWalk/useInteriorWalk.ts`
- `apps/web/src/components/previewColors.test.ts`
- `apps/web/src/components/previewColors.ts`
- `apps/web/src/components/tryOn.css`
- `apps/web/src/scene/InteriorAvatars.tsx`
- `apps/web/src/scene/interiorWalk.ts`
- `apps/web/tests/FEAT-022-report.md`
- `apps/web/tests/INTEG-017.md`
- `apps/web/tests/INTEG-019.md`
- `apps/web/tests/WEB-047.md`
- `apps/web/tests/artifacts/feat022/home-floor3.png`
- `apps/web/tests/artifacts/feat022/peer-upstairs.png`
- `apps/web/tests/artifacts/feat022/session-a.webm`
- `apps/web/tests/artifacts/feat022/upstairs.png`
- `apps/web/tests/artifacts/feat022/visitor-mobile.png`
- `apps/web/tests/artifacts/integ019/decorate-pinned.png`
- `apps/web/tests/artifacts/integ019/undo-after-move.png`
- `apps/web/tests/feat019.mock.config.ts`
- `apps/web/tests/feat019.spec.ts`
- `apps/web/tests/feat019Mock.ts`
- `apps/web/tests/feat022.config.ts`
- `apps/web/tests/feat022.spec.ts`
- `apps/web/tests/interiorWalk.test.ts`
- `apps/web/tests/web047-baseline.py`
- `apps/web/tests/web047.before.spec.ts`
- `apps/web/tests/web047.before.vite.ts`
- `apps/web/tests/web047.config.ts`
- `apps/web/tests/web047.spec.ts`
- `apps/web/tests/web047Scene.ts`
- `apps/web/tests/web049.spec.ts`
- `packages/contracts/api.md`
