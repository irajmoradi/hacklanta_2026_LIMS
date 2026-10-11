# WEB-004 handoff

Branch: `web/WEB-004`. Implementation milestone: `adeb4d4`. This report and the two synthetic
screenshots are in the subsequent documentation/QA commit. No push or merge.

## Delivered

- Week and Compete HUD actions, responsive dialogs, inline recoverable errors, bounded inputs,
  busy-state controls, private authenticated evidence images and revoked object URLs.
- Weekly auditor badge on the villager, sit-out labels, each member's goal/status, this week's
  goal-linked progress and evidence reviews, UTC countdown and finalized winner/star summary.
- Explicit AI pre-grade loading/refresh, three rubric scores, rationale, completion advice and
  model provenance. Accept copies advice into editable human fields; submission is separate.
  Only the assigned auditor sees grading/finalization controls. Scores are integers 1..5.
- Explicit finalization after eligible goals are graded. Crown GLB `hat_crown` has a falling/
  rotating arrival animation and procedural fallback. Finishers have stars. Winners receive
  village labels, CSS confetti and a short WebAudio chord sequence. Reduced-motion preferences
  disable moving confetti/crown; audio permission failures do not block results.
- Emergency insufficient vote with polled tally, required majority and auditor generation.
  The API handles rotation/penalties; replacement resets human grades and excluded auditors
  keep sitting out. Week panel polls every 10 seconds; HUD auditor state every 15 seconds.
- Competition listing, creation, fixed terms, auditor choice, friendly toggle and SOL intent.
  Eligible participants are listed at creation and each member opts in on the detail screen.
  Audited entries require an owned photo. Private images and AI evidence review provenance are
  shown alongside the authoritative confirm/reject decision, points and reason. Detail polls
  every 5 seconds. Pending decisions block settlement. Settlement celebrates all winners.
- Friendly mode has no auditor/stake or spendable XP; creator settles self-reported points.
  SOL is labeled “intent — settles on devnet after approval”; no payments are executed.
- Instance-scoped mock weekly/competition routes with role checks, bounds, immutable settled
  state, suggestion/grade separation, vote generations, evidence ownership, entry retry keys,
  deterministic ties, idempotent rewards and friendly no-XP behavior. Mock assignment uses the
  first eligible villager for repeatable demos; real assignment remains server-owned/random.
  Evidence upload IDs and entry keys survive failed retries within the mounted entry form.

## Files changed

All paths are under `apps/web/`; `public/models/**` is untouched.

- `src/App.tsx`: HUD actions, weekly badge state, panel mounting and celebration coordination.
- `src/components/WeekPanel.tsx`: weekly review/grading/voting, reusable evidence photo/review UI.
- `src/components/CompetitionsPanel.tsx`: creation, opt-in, entries, human decisions and settlement.
- `src/components/Celebration.tsx`: confetti and WebAudio fanfare with cleanup.
- `src/scene/VillageScene.tsx`, `src/styles.css`: crown animation, badges and responsive UI.
- `src/api/types.ts`, `src/api/client.ts`: additive API-003 types and authenticated route adapters.
- `src/api/auditMock.ts`, `src/api/mock.ts`: mock audit/competition state and goal invalidation.
- `src/api/audits.test.ts`: five unit tests covering roles, scores, advice separation, rotation,
  invalidation, entry ownership requirements, settlement/retry behavior and no-XP friendly mode.
- `tests/audits.spec.ts`: three mock browser tests for edited AI grading/finalization with all
  models unavailable, audited photo entry/confirm/reject/settle, friendly mode and mobile voting.
- `tests/real.spec.ts`: additive live weekly/current read test, asserting no audit mutations.
- `package.json`, `playwright.config.ts`: include the new suites in existing test commands.
- `README.md`, `WEB-004-REPORT.md`, `.gitignore`: usage, handoff and screenshot allowlist.
- `test-results/weekly-ai-grading.png`, `test-results/weekly-finalized-crown.png`: synthetic QA.

## Validation

Commands run in `apps/web` unless indicated. Final results:

| Command | Exit | Result |
| --- | --- | --- |
| `bun install` | 0 | Installed the existing lockfile dependencies; no lockfile change |
| `bun run typecheck` | 0 | TypeScript clean |
| `bun run test` | 0 | 20 passed, 114 assertions, including all 15 previous tests |
| `bun run build` | 0 | Production build; existing Three.js/LAM chunk-size warnings remain |
| `bunx playwright test --project=mock --grep 'AI pre-grade\|audited competition\|friendly competition'` | 0 | 3 passed |
| `bun run test:e2e` | 0 | 19 passed, including all 16 previous mock/Auth0/connection tests |
| `bunx playwright test --config playwright.real.config.ts --grep 'real weekly'` | 0 | 1 passed, executed against :8010 |
| `bun run test:e2e:real` | 0 | 3 passed, none skipped, including both previous real tests |
| `git diff --check` (root) | 0 | Clean |

Live OpenAPI was checked at :8010 and exposes every required weekly/competition route.
The new real test reads weekly/current and opens Week without suggesting, grading, voting,
finalizing or creating competitions. The existing real smoke test created one ordinary status
check-in, and the existing head-render test read Dev's authenticated LAM package. No paid AI,
voice, new GPU generation or on-chain action was invoked by this work's automated tests.
The real head screenshot remains ignored/local; no real-person image is committed.

Both requested screenshots were opened and visually reviewed after the final UI fixes:

- `apps/web/test-results/weekly-ai-grading.png`: model, AI scores/rationale, editable human scores
  and submit control; Lance's ambition is edited from 4 to 5.
- `apps/web/test-results/weekly-finalized-crown.png`: Lance crowned, four completion stars,
  auditor sit-out badge and winner celebration. Models were deliberately 404 in this test,
  proving the entire lifecycle works with zero generated assets and the GPU offline.

Development failures were resolved: the initial typecheck exited 1 before dependency install;
TypeScript then caught a missing JSX brace. One mock browser run failed on exact label lookup
for the native auditor select; explicit accessible labels fixed it. Windows Python extraction/
editing attempts failed on unavailable pypdf, encoding or an incorrect relative working path;
pypdf was run through uv and all file edits use UTF-8. A root-directory Playwright invocation
exited 1 because it had no mock project; the app-directory invocation passed. Final full suites
are green. Unit tests retain the pre-existing multiple-Three.js warning.

## Teammate trial

1. In `apps/web`, run `bun install`. For offline mode, PowerShell:
   `$env:VITE_MOCK='1'; bun run dev`. Open http://localhost:5173.
2. Stay as Iraj. Open Week. Load/accept or edit an AI suggestion for each eligible neighbor,
   submit each human grade, then finalize. Observe the crown, stars and celebration.
3. Open Compete; create an audited competition with Lance as auditor and an optional SOL
   intent. Agree to terms and join as Iraj, upload a synthetic photo and submit an entry.
4. Close the dialog; choose Lance in Play as. Open Compete and the competition; confirm or
   reject every entry with a reason, then settle. Reopen to inspect the immutable result.
5. Create a friendly competition for a no-photo, no-XP trial. To exercise voting, switch to a
   non-auditor and open Week's emergency section before finalization; three distinct fixture
   voters trigger replacement. Duplicate votes do not increase the tally.
6. For live reads, set `VITE_MOCK=0`, `VITE_DEMO_AUTH=1` and keep `VILLAGE_ENV_FILE` pointing to
   `/c/Users/mourn/Downloads/hacklanta/.env`. The existing Vite loader reads public VITE values
   at runtime; secrets were neither needed nor copied. The real auditor is chosen by the API.
   Suggestion/refresh and evidence submission can call providers only after an explicit click.

## Choices, limits and proposed contract changes

No implementation blocker remains. No API, shared contract, root, env or model file was edited.

1. Adopt the existing API-003 proposal into the shared contracts. The implementation follows
   the live shapes: WeekState.votes is a number; competition detail is the flat competition
   row plus participants/entries; settlement returns the row/result.
2. Weekly GET returns a cached Grade but omits its model. The UI honestly labels absent
   provenance and provides explicit Load AI pre-grade, whose response supplies model.
   Proposed additive `suggestion_model` on each weekly goal, or a full Suggestion object,
   would expose provenance without even a cached POST. Polling never calls suggestion routes.
3. CreateCompetition has no participant-selection/invitation field. The UI lists eligible
   villagers and requires self-opt-in; it never impersonates users to enroll them. If choosing
   a restricted subset at creation is required, add invited_user_ids plus an enforced invitation
   policy; invitations must not imply consent to entry or payment.
4. Countdown means next UTC Monday, not an API-enforced lock. The deployed API intentionally
   permits early demo finalization. Scores and human completion flags determine awards.
5. Mock state lasts one tab; deterministic fixture advice/reviews are explicitly labeled
   scripted-demo. Live paid-provider quality, real photo evidence review, and signed devnet
   settlement were not exercised. All competition SOL amounts remain intent-only.
6. Existing upstream small-village rotation/deadlock rules and in-process AI review jobs remain
   as documented in API-003. This UI reports server conflicts instead of inventing a replacement.
