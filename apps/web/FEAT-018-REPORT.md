# FEAT-018 — stretch goals

Implemented on `feat/FEAT-018`.

Milestones: `15d8ca9` (fresh-schema migration prerequisite), `0c56411` (API),
`3828c17` (web/mock/browser coverage), `7a9279c` (legacy check-in compatibility).

Completed goals can now extend through three sequential stretch tiers on the same
goal. My goal and check-in offer Go beyond; the profile shows the base completion,
stacked tier progress, and Above & beyond badge. Feed/accomplishments celebrate
each tier. Weekly review shows targets and tier-labelled evidence, and completed
tiers contribute an ambition bonus to human-approved goals.

Choices made without clarification:

- Each tier awards 10 XP and 10 coins, half the existing 20-point weekly goal
  reward. Maximum three tiers per goal/week. The XP ledger's existing coin trigger
  mirrors the award; source keys and village locks prevent duplicate payment.
- Each completed tier adds one ambition point to the weekly score (maximum +3).
  Human approval of goal completion remains necessary to win the crown.
- Blank stretch title reuses the base target. Tier completion is self-reported,
  consistent with base goals; the auditor sees its evidence before approving the week.
- Progress bars show ready / progress shared / complete, rather than inventing a
  numeric percentage for free-text goals. Base completion time remains unchanged.
- Current-week/finalized guards apply to stretch mutation and goal-linked progress.
  Older API clients omitting goal_id resolve to their current goal, or retain
  unlinked progress if they have no current goal.
- Starting/finishing tiers or adding progress invalidates cached weekly grading.

Validation (all commands run from the named app directory):

- API uses `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`
  and `VILLAGE_ENV_FILE=C:/Users/mourn/Downloads/hacklanta/.env`, loaded at runtime.
  No secrets copied. Tests enforce `village_test` and create private schemas.
- `python -m pytest tests/test_feat018.py tests/test_api003.py -q --tb=short`:
  **23 passed, exit 0**.
- `python -m pytest tests/test_api.py tests/test_feat018.py -q --tb=short --basetemp=.runtime/feat018-regression`:
  **29 passed, exit 0**, after restoring legacy progress compatibility.
- Final `python -m pytest tests/test_feat018.py -q --tb=short --basetemp=.runtime/feat018-final`:
  **2 passed, exit 0**, including concurrent starts/completions, ownership, tier cap,
  XP and coin totals, legacy-client closure guards, crown scoring and closed weeks.
- Broad `python -m pytest -q --tb=short`: **426 passed, 11 failed, 3 skipped,
  exit 1**. This process began before the legacy-client fix and retained the old
  code in memory. Eight failures concerned omitted-goal progress/evidence; three
  were existing disaster-repair assertions, whose status-note path was unchanged.
  After the fix, `python -m pytest --lf -q --tb=short --basetemp=.runtime/feat018-failures`
  reran **all 11 failures successfully, exit 0** (including the three repair cases).
  The full suite was not rerun a second time; these are separate, accurately
  reported runs rather than a claim of one uninterrupted green full run.
- `python -m ruff check app/goal_stretch.py app/domain.py app/main.py app/models.py app/weekly.py app/auditor.py app/reactions.py tests/test_feat018.py`:
  **exit 0**. Changed Python files were also checked after the compatibility fix.
- `bun run test`: **150 passed, exit 0** across 36 files. The new stretch test
  is included in the default test script.
- `bun run typecheck`: **exit 0**.
- `bunx playwright test --config playwright.feat018.config.ts`: **1 passed, exit 0**.
  Mock browser flow completes base → stretch → progress → completion/bonus,
  verifies disabled completed-goal progress, follows the check-in Go beyond button,
  and checks the profile activity feed.
- `bun run build`: **exit 0**; existing large-chunk warning only.
- `git diff --check`: **exit 0**.

Initial failures resolved: missing worktree web dependencies (installed with frozen
lockfile); migration 047 duplicated columns already folded into the baseline (made
replay-safe); old goal-less progress callers were rejected (compatibility restored).
The existing mock reaction test now earns its progress XP before finalizing its
week, respecting the closed-week rule.

Visually verified screenshots (synthetic mock avatars only):

- `apps/web/tests/screenshots/FEAT-018/stretch-complete.png` — desktop goal and bonus.
- `apps/web/tests/screenshots/FEAT-018/stretch-mobile.png` — 390px mobile goal.
- `apps/web/tests/screenshots/FEAT-018/stretch-feed.png` — profile/feed badge and rewards.

Try it without touching the shared live village:

1. From `apps/web`, run `bunx playwright test --config playwright.feat018.config.ts`
   for the automated demo, or set `VITE_MOCK=1`, `VITE_DEMO_AUTH=1` and run
   `bun run dev --port 5198` for manual use.
2. Choose a mock seat, open My goal, mark the goal done, enter an optional stretch
   target and select Go beyond. Check in using Goal progress, then finish the tier.
3. Open the profile/activity feed and Weekly review to see the badge and tier evidence.
4. For a separate API deployment, apply migrations before starting the updated API.
   No migration or debug/world action was run against the live demo village on :8010.

Contract: updated `packages/contracts/api.md` directly as authorized. No proposed
schema.sql change; `049_goal_stretch.sql` owns the additive schema migration.
No remaining feature blockers or additional proposed contract changes. No live
deployment performed. Final UI polish uses unique input IDs when the profile and
goal modal are open together; typecheck passed after that change.

Changed files:

- API: `app/{auditor,domain,goal_stretch,main,models,reactions,weekly}.py`,
  `migrations/{047_competition_scoring,049_goal_stretch}.sql`, `tests/test_feat018.py`.
- Web API/mock: `src/api/{auditMock,client,mock,reactionMock,reactions.test,stretch.test,types}.ts`.
- Web UI: `src/components/{Accomplishments,ActivityFeed,GoalStretch,Modals,ProfilePanel,WeekPanel}.tsx`,
  `src/components/activityData.ts`.
- Web checks/delivery: `package.json`, `playwright.feat018.config.ts`,
  `tests/feat018.spec.ts`, three screenshots listed above, this report.
- Contract: `packages/contracts/api.md`.
