# DOCS-015 handoff

Branch: `docs/DOCS-015`. Source baseline: `86bc24e`, with the task checkout at
`24b40c1`. Documentation commit: the commit containing this report
(`git log -1 --oneline`). No deployment or live rehearsal is claimed.

## Changes

- `README.md`, `docs/SETUP.md`: shipped repair plans, five Lab scenes, optional
  Auth0 claims, WEB-058 usability fixes, migration range through 059, trailer cuts
  and owner prerequisites for Solana v2.
- `.env.example`: `VITE_AUTH0_ENABLED=0`, `VITE_DEMO_DEBUG=0`, optional
  `OMP_THREAD_LIMIT` and `QA014_FOLLOWUP`, with readers and safe defaults.
- `docs/devpost/{SUBMISSION,DEMO_SCRIPT,EVIDENCE}.md`: current product story,
  repair rehearsal, source evidence and video upload handoff.
- `docs/devpost/video/{TRAILER,TRAILER-005}.md`: original 94-second v4 versus
  2:48 Devpost, 1:30 short and 39-second square; ignored media supplied by the team.
- `docs/auth/{JUDGE_LOGIN,FEAT-029_REPORT}.md`: migration 059, hidden production
  Sign in default, explicit enable/rebuild and operator seat-code workflow.
- `docs/solana/FEAT-027.md`: integrated migration numbers, portable checkout path
  and new v2 address prerequisite; retained source ID is the recorded v1 address.
- `docs/infra/PRODUCTION-DEPLOYS.md`: fourth public build input and default flag.
- `docs/infra/check_docs014.py`: covers the new runbooks, environment controls,
  safe auth/debug defaults and isolated offline Lab commands.

## Choices and source findings

Repair plans use 2–3 distinct tasks, targets 1–6 and a short public rationale.
The latest verified evidence review and distinct tagged photo assets determine
progress for the active repair event. Legacy disasters retain check-in rules.
The Lab's status text is a public selection summary, not private model reasoning.

`apps/web/src/lab/repairPlan.ts` directly fetches the stateless plan endpoint,
even with `VITE_MOCK=1`. Vite otherwise defaults to the shared API on 8010.
Offline launch commands therefore explicitly target unused loopback port 9,
selecting the labeled example after an expected proxy connection error. Keep
that port unused. Connected explicit clicks can incur capped provider calls.
This was documented within scope; application code was not changed.

Production tooling defaults Sign in off; raw Vite can enable configured Auth0
when the flag is unset. Claims do not remove impersonable demo access. No codes
were issued. No private env file was needed or read for this source-only task.

## Validation

Commands run locally from the repository root; these are lightweight offline
checks, so no runner, database, provider, GPU or wallet is needed.

- Initial `python docs/infra/check_docs014.py --shell`: exit 1, identified four
  missing environment names, all now added.
- Final `python docs/infra/check_docs014.py --shell`: exit 0; 180 env names
  cover 177 detected/reviewed readers; 14 documents have valid local links and
  fences; explicit auth/debug defaults and isolated Lab launches pass; eight
  contiguous demo beats total 150 seconds; `bash -n` parses 25 command blocks
  without executing them.
- `python ops/deploy/test_auth_flag.py`: exit 0; three offline release-input
  tests pass. The printed invalid-flag usage error is an expected negative case.
- `git diff --check`: exit 0.

Application test suites, a browser rehearsal and video encoding were not rerun
for this documentation-only change. Existing feature/film results remain
historical evidence. No UI was changed; screenshot path: not applicable.

## Teammate try-out and remaining owner work

Run `python docs/infra/check_docs014.py --shell`, then follow
[mock setup](../SETUP.md#local-in-five-minutes-mock-mode) and visit
`http://127.0.0.1:4174/lab#disasters`. Ask the Mayor should show a labeled example;
simulate every task and Repair. The 150-second live script remains separate
from the 2:48 Devpost film.

No documentation blockers. The owner still enables/rebuilds Auth0, verifies
tenant origins/connections and issues private codes for real login rehearsal;
approves and deploys a separate Solana v2 devnet address, configures Treasury and
approves wallet smoke actions; and supplies/uploads the ignored trailer MP4s.
No published video URL is established by this checkout. No contract changes
are proposed. No live village mutation, paid generation, message or transaction
was performed.
