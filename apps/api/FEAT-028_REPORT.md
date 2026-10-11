# FEAT-028 handoff

Branch: `feat/FEAT-028`. API milestone: `b8d9de1`. UI, agent-log response and
screenshots: `5f523bf`. This report is committed separately on the same branch.

## Behavior and choices

- New disasters store two or three bounded repair tasks, a two-to-four-sentence
  public rationale, model provenance, and an explicit example/fallback label.
  Explicit disaster creation uses Gemini first, then the existing OpenRouter
  adapter. Invalid, offline or capped output falls back to a deterministic plan.
- Automatic failure detection can happen during GET requests. Those starts use
  the deterministic plan instead of making paid calls from polling. This is a
  deliberate interpretation of the repository's explicit-action generation rule.
- Tagged evidence is bound to the active repair event, checked for upload
  ownership, and counted only after verification. Each distinct photo asset
  counts once per task. All tasks must finish; progress survives the deadline.
  Shared activities use the photo route (at least two visible participants), not
  location collection. Existing owner overrides work when vision is unavailable.
- Disasters without a repair plan retain their rolling check-in behavior.
- The alert panel, Mayor panels, and both check-in forms support tasks. The Lab
  streams public workflow status and displays the final public rationale; it
  does not expose private model reasoning. Local simulation completes each task
  and reveals the rebuilt village. Generation happens only on Ask the Mayor.
- The stateless Lab route uses synthetic activity and SEC-001 in-memory caps. It
  does not open a database connection, write assets, or change a village.

## Files

API: `app/repair_plans.py`, `app/disasters.py`, `app/domain.py`, `app/auditor.py`,
`app/budget.py`, `app/demo.py`, `app/main.py`, `app/models.py`,
`migrations/058_repair_tasks.sql`, `tests/test_feat028.py`, and legacy regression
fixtures in `tests/test_api007.py`, `tests/test_api009.py`, `tests/test_feat012.py`.

Web: `src/api/types.ts`; components `RepairTasks.tsx`, `RepairTaskPicker.tsx`,
`VillageAlerts.tsx`, `MayorModal.tsx`, `MayorSceneDashboard.tsx`,
`CheckInDialogue.tsx`, `Modals.tsx`; Lab `WorldDemo.tsx`, `sandbox.ts`, `lab.css`,
`repairPlan.ts`, `repairPlan.test.tsx`; browser tests `repair.spec.ts`,
`repair.config.ts`, `repair-harness.html`, `repairHarness.tsx`, `lab.spec.ts`.

Contracts: `packages/contracts/api.md` documents the additive fields and route;
`packages/contracts/schema.sql` folds in idempotent migration 058. No additional
contract changes are proposed.

## Verification

Commands below ran through the remote wrapper from the indicated app directory.
All API data was synthetic, in the runner's scratch test database. No live demo
disasters, paid model calls, or Solana transactions were triggered.

From `apps/api`:

- `bash ../../ops/remote_run.sh python -m uv run pytest -q tests/test_feat028.py
  tests/test_feat012.py tests/test_api007.py tests/test_api009.py -k
  'not test_demo_level_four_replay_and_repair'`: exit 0, 78 passed, 1 deselected.
- `bash ../../ops/remote_run.sh python -m uv run pytest -q tests/test_feat028.py`:
  exit 0, 12 passed, including the final agent-log response assertion.
- The broader run including the deselected test returned exit 1. The remaining
  unrelated failure is `test_demo_level_four_replay_and_repair`: unchanged
  `scripts/demo_story.py` creates a SOL competition without the now-required
  timezone-aware deadline. Legacy recovery fixtures were updated to explicitly
  persist old disaster payloads; their rerun passed.

From `apps/web`:

- `bash ../../ops/remote_run.sh bun test src/lab/repairPlan.test.tsx
  src/lab/sandbox.test.ts tests/MayorScene.test.tsx`: exit 0, 9 passed.
- `bash ../../ops/remote_run.sh bun run build`: exit 0. Existing large-chunk warnings.
- `bash ../../ops/remote_run.sh bun run test`: exit 1, 263 passed, 1 failed:
  unchanged `src/api/gazette.test.ts` / "SOL entry gating covers both flags,
  friendly, zero and settled competitions". No Solana implementation changed.
- `bash ../../ops/remote_run.sh bunx playwright test --config tests/repair.config.ts`:
  exit 0, 5 passed: two feature cases at 1440 and 390 plus the three existing Lab
  cases, including unavailable model assets. An earlier attempt failed
  because runner port 5255 was occupied; this config now uses port 5278.
- `git diff --check`: exit 0.

Reviewed, committed screenshots:

- `apps/web/tests/screenshots/FEAT-028/lab-1440.png`
- `apps/web/tests/screenshots/FEAT-028/lab-390.png`
- `apps/web/tests/screenshots/FEAT-028/banner-1440.png`
- `apps/web/tests/screenshots/FEAT-028/banner-390.png`

## Try it

Open `/lab#disasters`, choose a disaster, and click **Ask the Mayor**. Expand
**Why the Mayor chose these**, simulate each listed task until complete, then
click **Repair**. An offline API or exhausted cap produces a labelled example.
Do not use live village debug disaster controls to rehearse this feature.

For a disposable API village, apply the normal migration command
`python -m uv run python scripts/migrate.py` against its scratch database. New
disasters show tasks in the alert and Mayor panels. Attach a photo in either
check-in form, select a repair task, and submit. Verification or an owner review
advances the matching task. The agent log preserves the original plan and rationale.

No feature-specific blocker remains. The two unrelated Solana regression failures
above prevent claiming a completely green repository-wide suite.
