# FEAT-029 implementation report

Branch: `feat/FEAT-029`. Milestones: `e6142da` (API claims), `03a2b78`
(combined login UX). The final verification/configuration commit contains this report.

## Delivered

- Optional Auth0 Sign in alongside the existing default Play as experience,
  including the first-visit seat picker. Signed-in requests use bearer tokens
  exclusively; invalid bearer tokens cannot fall back to demo headers.
- One-time seat claims with 256 random bits, SHA-256 storage, 72-hour expiry,
  transactional consumption, code rotation, unique account/seat links, and
  stable seat IDs. Operator CLI prints a code only after successful commit.
- Claim onboarding, normal create/join when skipping, and Settings sign-out.
  Auth0 SDK owns tokens in memory. Existing seat selections are not used for
  signed-in identity. HTTP, overworld, and house connections share the mapping.
- Additive/idempotent migration 059, folded schema and HTTP contract updates.
- Production build toggle, offline flag tests, synthetic browser coverage,
  scratch-database API coverage, and a two-laptop judge runbook.

## Changed files

- API: `apps/api/app/{auth,claims,main}.py`,
  `apps/api/migrations/059_claim_codes.sql`, `apps/api/scripts/claim_codes.py`,
  `apps/api/tests/test_feat029.py`.
- Web: `apps/web/src/{App,Auth}.tsx`, `apps/web/src/api/{client.ts,auth.test.ts}`,
  `apps/web/src/components/{ClaimVillager,DemoTools,Onboarding,SettingsPanel}.tsx`.
- Browser tests: `apps/web/tests/.gitignore`, `feat029-auth0.tsx`,
  `feat029.config.ts`, `feat029.spec.ts`, `feat029.vite.ts`, and the six
  `apps/web/tests/screenshots/feat029-{desktop,mobile}-{demo,claim,settings}.png`
  proof images.
- Contracts: `packages/contracts/{api.md,schema.sql}`.
- Deployment: `ops/deploy/{prod-build.sh,prod-deploy.py,prod-release.py,test_auth_flag.py}`.
- Documentation: this report and `docs/auth/JUDGE_LOGIN.md`.

## Test commands and results

Commands below run from the indicated app directory unless marked root.

| Directory | Command | Result |
| --- | --- | --- |
| API | `../../ops/remote_run.sh python -m uv run pytest -q tests/test_feat029.py tests/test_providers_auth.py tests/test_realtime.py tests/test_feat019.py` | Exit 0, 36 passed, before final lock-order refinement |
| API | `../../ops/remote_run.sh python -m uv run pytest -q tests/test_feat029.py` | Exit 0, final 6 passed, including lock-order refinement and migration repeatability |
| Web | `../../ops/remote_run.sh bun test src/api/auth.test.ts` | Exit 0, 2 passed |
| Web | `../../ops/remote_run.sh bun run test` | Exit 0, 264 passed |
| Web | `../../ops/remote_run.sh bun run build` | Exit 0, final source builds; existing large-chunk warning |
| Web | `../../ops/remote_run.sh bunx playwright test --config tests/feat029.config.ts` | Exit 0, desktop 1440x900 and mobile 390x844 passed |
| Root | `python ops/deploy/test_auth_flag.py` | Exit 0, 3 passed; all deployment effects mocked |
| Root | `python ops/deploy/test_cutover.py` | Exit 0, 4 passed |
| Root | `bash -n ops/deploy/prod-build.sh` | Exit 0 |
| Root | `git diff --check` | Exit 0 |

Both browser sizes were rerun successfully with animations disabled for proof
captures. Desktop and mobile screenshots were visually inspected; the claim
form fits the viewport and Settings displays Sign out. API runs emitted the
existing Starlette TestClient/httpx deprecation warning.

API coverage includes synthetic RS256 mapping, demo on/off, bearer precedence,
wrong village, expiry, reused/rotated codes, already-linked accounts, racing
claims, Hall persistence/creator attribution, and claimed-account WebSocket
movement with independent connection IDs. The browser uses a test-only SDK
alias and mocked API traffic, and tests reload, sign-out, invalid claims, and
both onboarding choices. No real tenant, paid models, or live village was used.

Earlier browser harness attempts exited 1 for the config working directory,
IPv4 binding, overbroad request interception, and fixture village ID mapping;
these were fixed. One remote run exited 255 after an SSH reset. Waiting API
reruns were canceled (wrapper reported 4294967295) to let browser checks run
while another worktree held the shared API-test lock. These are not counted as
passing tests. The runner host changed during the task; the wrapper used its
current configuration. Automatic review blocked deletion of generated failure
artifacts with only "blocked by policy" as its reason; those files remain on
disk and are excluded from version control. Final proof PNGs are retained.

## Try it / production handoff

Follow [JUDGE_LOGIN.md](JUDGE_LOGIN.md) for migration, private claim-code issuance,
two teammates' own accounts, movement, Hall edits, reload persistence, and
Settings sign-out. It lists exact public Auth0 values, API values, callback,
logout, web-origin URLs for `https://thefriendshipvillage.vodka`, and rollback.
Keep server `DEMO_AUTH=1` and build `VITE_DEMO_AUTH=1`, `VITE_MOCK=0`.
Set `VITE_AUTH0_ENABLED=1` to show Sign in, or `0` and rebuild to hide it.
The deployment script forwards this flag from its process environment, defaulting
to `0` in the integrated release so Sign in stays hidden until owner approval.

No production deployment, tenant changes, account creation, production claim
issuance, secret-file changes, resets, or transactions were performed. The
operator still needs to verify tenant connection/origin settings and perform
the real two-laptop rehearsal. Passwords are always chosen by account owners.

## Decisions / contract changes

Codes contain the village UUID plus a random secret so teammates enter only
one field while the API can enforce village scope. Reissue revokes older codes.
An account already belonging to a village cannot silently abandon it to claim
a seat. Linking is stored separately so the seeded seat and its progress stay
intact, and accounts are never silently merged. Existing demo access remains
enabled as requested.

The task explicitly permits contract edits: migration 059 and the new endpoint
are included. No additional contract changes are proposed. Check migration
number availability when integrating concurrent branches. Production activation
and real-tenant rehearsal are operator handoff steps, not code blockers.
