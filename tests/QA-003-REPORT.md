# QA-003 final report

**Release hold: group-photo onboarding is not usable end to end.** Two reproducible
integration failures are preserved as ordinary failing tests. Application source
was not changed because this task only allows `tests/**`.

Branch: `qa/QA-003`. Test milestone: `90321c8`. This report, README, release
checklist and screenshot scroll refinement are in the following handoff commit. Baseline:
`db3adff3edb83cb8f95204ca2cadc2ef79af2eb3`. No push or merge.

Files changed:

- `tests/integration/test_wave3.py`: fresh isolated identities, growth/unlock
  idempotency, weather rules, consent/owner restrictions, fake done crop artifacts,
  private asset access, concurrent exclusive claims and exact segment-job input.
- `tests/wave3_live.py`: deployed growth/unlock and rejected-upload checks with
  dedicated identities, fail-closed invalid upload bytes and verified cleanup.
- `tests/e2e/village.spec.ts`: live 390x844 Village panel and owner uploader gate.
- `tests/wave3/group-photo.spec.ts`: exact API-007 done response reproduction.
- `tests/wave3/scene.spec.ts`: WEB-008-derived day/night and late-model tests using
  explicit ferris-wheel unlocks required by integrated scene gating.
- `tests/playwright.mock.config.ts`: adds separate scene and wave3 projects;
  keeps development servers, test output and screenshots scoped safely.
- `tests/.gitignore`: excludes nested screenshot output from unchanged app tests.
- `tests/README.md`, `tests/RELEASE-CHECK.md`, this report: commands, evidence,
  limitations and handoff. No app, contract, root config or secret was committed.

Exact test commands, exit codes and counts are in
[RELEASE-CHECK.md](RELEASE-CHECK.md). API: 133 pass; web units: 29 pass; separate
scene rules: 4 pass; isolated cross-cutting API: 6 pass; live HTTP: 6 pass/4 skip;
new live API-007 checks: pass; iMessage: 9 pass and simulator pass; pot-client:
19 pass; health: 4 pass. Live browser: 3 pass/1 fail/2 skip (exit 1). Demo verifier:
exit 1 because capture.json is absent. LAM renderer has no test suite. The original
seed-dependent app live suite was inspected, not executed. Final mock/browser run:
36 pass/1 fail, exit 1, 3.7m. All 33 upstream cases and three scene cases pass;
the API-shaped done-photo case fails as described below.
After scrolling its screenshot to the status line, the targeted `--project=wave3`
rerun also exited 1 with the same missing-claim-control failure.

QA3-B01 - high priority, owner cannot upload a group photo:

1. Create a dedicated village as a fresh identity and open the live preview.
2. Choose Village, then Our group photo. The authenticated owner sees only
   "The village owner uploads the shared photo"; no file input or upload button.
3. `GET /api/villages/{vid}` selects id/name/seed and adds world/villagers/events,
   but exposes neither `owner_user_id` nor `my_role`. `isOwner` requires one of
   these for arbitrary villages. The owner role in `/me` is not propagated here.

The live regression fails at the missing Group photo input after passing mobile
Village level/no-overflow assertions. Proposed contract change: expose
`owner_user_id` or `my_role` in the village response and consume it consistently.
Alternatively the web adapter can carry the authenticated membership role from
`/me`; the server must continue enforcing owner authorization. API-only upload
owner checks pass, so this is a UI/response integration failure.

QA3-B02 - high priority, done crops never become claimable:

1. Open the photo panel and enter a shared job ID.
2. Return the actual API-007 shape: `{job_id,status:"done",error:null,crops:[...]}`.
3. The UI says "Finding your people · done" indefinitely and hides the crop grid.

The production API returns the avatar job's raw `done` status. GroupPhotoPanel
only renders crops for `ready` or `completed`; its client has no status adapter.
The new API-shaped browser test fails at the missing "This is me: person 1"
button. Backend tests independently show done crops and claims work. Proposed
contract alignment: document canonical job statuses and accept/map `done` in the
client; update mocks to use that same protocol. No real processing was needed.

Additional handoff observations:

- No dedicated weather endpoint exists in source or deployed OpenAPI. Weather
  rules are tested via `world.set_weather` and `GET village.world`. Clarify the
  task wording or define an authorized endpoint if one is intended.
- Shared photo discovery and resume fields (`group_photo_job_id`, `photo_url`,
  crop `avatar_job_id`) are absent from the API while the UI accepts them. Manual
  shared-job lookup exists, but these optional omissions limit automatic discovery,
  group image display after reload and resuming build progress. This is a source
  inspection observation, not a newly exercised live upload or claimed third failure.
- The upstream scene test assumes ferris-wheel GLB loading without including
  `ferris_wheel` in unlocked buildings. Integrated code correctly gates it. Tests
  under allowed paths now supply that explicit unlock; app files are untouched.
- Health's API-004 tag remains stale/ambiguous. Add an immutable deployed revision.
- Supply video capture artifacts in the demo lane. Do not run the recorder merely
  to turn this QA verifier green.

Safety and cleanup:

All live scenarios provision fresh UUID users with no phone and messaging disabled.
The retained `QA-002 ` village prefix is intentional: it matches existing scheduler
exclusion and cleanup guards. Tests do not select live seeded users or Hacklanta Crew.
Existing offline mock/API/simulation suites retain local synthetic seed fixtures;
they do not use the shared village. Credentials are loaded only through
`VILLAGE_ENV_FILE` at runtime. Zero live Mayor, ElevenLabs, vision, GPU, iMessage
or chain activity was initiated by QA.

Successful photo upload, done artifacts, claim queue assertions and voice-expression
assertions run solely in a random private schema of `village_test`, with scheduling
and provider credentials disabled. The live bridge cannot consume those rows.
Crop paths are rooted under `tests/.runtime`, preserving allowed paths instead of
writing live `data/assets`. The queued claim is marked failed after inspection;
fixture teardown drops the schema. Live uploads use invalid bytes and missing
consent/non-owner identities, so even a broken consent check cannot enqueue work.

Every live run cleaned up, including failed browser attempts. Successful standalone
HTTP checks cleaned 5 users/7 villages; new wave-5 checks cleaned 3 users/1 village;
final browser run cleaned 5 users/4 villages. The final direct DB audit found zero
qa002 users and QA-002 villages. Health returned to 5 users, 31 done jobs, zero
queued/running/failed jobs and zero pending outbox. No shared process was stopped.

Harness history is not hidden: the first browser batch passed all 33 upstream
regressions but failed three scene cases. Moving those cases from forced mock mode
to intercepted-HTTP mode still exposed stale ferris-wheel unlock assumptions; the
allowed-path copies correct the fixture. The first new mobile live test stopped
at a desktop-only Connected badge hidden on mobile; setting the viewport after
identity verification corrected the harness, then the owner-input failure reproduced.
Initial unextended live browser run was 3 pass/2 skip; final extended run is red.
No failed run is counted as passing, and neither product failure is xfailed/skipped.

Visually inspected the day/night scenes, mock mobile growth/photo panels, live
owner panel and done-status reproduction. Both 1920x1080 scenes render a complete
procedural town; night visibly darkens it and lights the stage. The 390x844 growth
panel is readable without horizontal overflow. Software foreground samples were
31.8 fps day and 32.3 fps night; hardware performance was not certified.

Local screenshots (ignored/uncommitted):

- `tests/test-results/web008-day.png`
- `tests/test-results/web008-night.png`
- `tests/tests/artifacts/web009-mobile-390x844.png`
- `tests/tests/artifacts/web009-mobile-growth.png`
- `tests/tests/artifacts/web009-group-photo.png`
- `tests/test-results/live/village-QA-003-village-own-7708c-roup-photo-upload-on-mobile/live-mobile-growth.png`
- `tests/test-results/live/village-QA-003-village-own-7708c-roup-photo-upload-on-mobile/live-owner-group-photo.png`
- `tests/test-results/mock/group-photo-API-007-done-photo-exposes-crop-claim-controls-wave3/api007-done-photo.png`

Teammate trial: install the locked dependencies, export `VILLAGE_ENV_FILE`, then
run the exact commands in RELEASE-CHECK.md. `tests/run_live.py e2e` provisions the
live owner reproduction and cleans it automatically. From `tests`, run
`node ../apps/web/node_modules/@playwright/test/cli.js test --config playwright.mock.config.ts --project=wave3`
for the done-status reproduction without touching a live backend. Use `--project=scene`
for synthetic day/night views. Two photo gates should remain red until app owners
implement the proposed alignment; then rerun them plus affected app suites.
