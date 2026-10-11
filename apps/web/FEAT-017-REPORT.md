# FEAT-017 delivery report

Branch: `feat/FEAT-017`.

Implementation commits:
- `77ca342` — consented head speech API, persistent cache/quota, migration, tests, HTTP contract.
- `d41dcd0` — head speech UI, orbit/big view, sequential chorus, mock fixtures and visual artifacts.

Profiles retain the existing “Hear them” action and add a dedicated head studio above the
overview/outfit/house tabs. Gaussian portraits support drag rotation, clamped wheel/pinch zoom,
double-click reset, and a dark fullscreen inspection stage. Twenty presets and “Surprise me”
use the new speech endpoint. The dashboard chorus plays one shared line through consenting
speakers in sequence. The existing LAM renderer supplies idle facial motion and consumes live
Audio2Expression frames; amplitude motion is explicitly labelled while frames are unavailable.

The API checks shared membership and current friend-voice consent, including on cache hits.
Self-use does not require friend consent. It chooses the existing clone or stock voice, reuses
the existing `voice_expr` worker queue, and persists cache and daily reservations. Cached
replays require no provider calls. Surprise context includes only villages shared with the
requester. No iMessage messages or world-changing demo actions were sent.

Reasonable choices:
- The ten-per-day limit is per requester, UTC, and counts failed/rejected new attempts. This
  prevents paid retries from bypassing the limit. Cache hits remain available after the limit.
- Cache identity includes speaker as well as effective voice ID and exact trimmed text, so
  worker expressions and asset ownership stay correctly scoped.
- The upstream renderer is a singleton. In a chorus, inactive neighbors retain their portraits;
  only the current speaker has a live head. Covered portraits release the renderer for modals.
- The live renderer supports expression input, so an MP4 rendering fallback is unnecessary.
  When the GPU is offline, audio and approximate motion remain available.
- A crashed pending request can be retried after five minutes, consuming another attempt.
- Offline mock mode clearly identifies its fixed, synthetic “Who ate my sandwich?” sample.

Files changed:
- API: `apps/api/app/heads.py`, `apps/api/app/main.py`,
  `apps/api/migrations/048_head_speech.sql`, `apps/api/tests/test_feat017.py`.
- Migration repair: `apps/api/migrations/047_competition_scoring.sql` now tolerates columns
  already present in the baseline schema. Fresh test-schema creation previously failed here.
- Contract: `packages/contracts/api.md` documents presets, speech, deferred expressions,
  permissions, quota, caching and errors.
- Web: `apps/web/src/components/HeadStudio.tsx`, `HeadStudio.css`, `GaussianHead.tsx`,
  `headControls.ts`, `headControls.test.ts`, `ProfilePanel.tsx`, `Dashboard.tsx`,
  `SettingsPanel.tsx`; `apps/web/src/styles.css`; `apps/web/src/api/mock.ts`,
  `headPresets.ts`; `apps/web/package.json`; `apps/web/public/heads-demo.wav`.
- Browser verification: `apps/web/tests/feat017.spec.ts`, `headRenderer.fixture.ts`,
  `apps/web/playwright.feat017.config.ts`, `apps/web/vite.feat017.config.ts`.
- Artifacts: `apps/web/artifacts/feat017/{speaking.png,big-view.png,chorus.png,mobile.png,
  head-saying-line.webm}`. This report is `apps/web/FEAT-017-REPORT.md`.

Validation actually run:

| Working directory | Command | Exit/result |
| --- | --- | --- |
| `apps/api` | `& C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe -m pytest tests/test_feat017.py tests/test_feat002.py tests/test_feat010.py -q` | 0; 22 passed |
| `apps/api` | `& C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe -m ruff check app/heads.py tests/test_feat017.py` | 0; all checks passed |
| `apps/web` | `bun run test` | 0; 150 passed, 68,936 assertions |
| `apps/web` | `bun run typecheck` | 0 |
| `apps/web` | `bun run build` | 0; TypeScript and production Vite build passed; existing chunk-size advisory |
| `apps/web` | `bunx playwright test --config playwright.feat017.config.ts` | 0; desktop/mobile test passed in 41.9 s |
| Worktree | `git diff --check` | 0 |

The browser test verifies audio playback and changing mouth weights, expression input, replay,
stop, drag/wheel/double-click, fullscreen close, consent-filtered chorus order, and mobile pinch
zoom within bounds. The screenshots above were visually reviewed. The WebM contains VP8 video
and Opus audio, recorded together from the synthetic test head and local speech sample.

An earlier full web test run during concurrent build/browser work hit the existing short-timer
assertion in `src/api/retry.test.ts`; the unchanged suite passed when rerun without that load.
Other initial failures exposed the repaired migration, inherited portrait layout, and test
harness routing/locator issues; the final checks above passed.

Testing generation count: **0 paid/remote generations**. One local Windows system-TTS sample
was created. API provider outputs, expression data, and the browser head are synthetic mocks.
The isolated `village_test` fixture loaded environment values at runtime through
`VILLAGE_ENV_FILE`; no secret values were copied into files. No live API `:8010` mutation was
used for verification.

How a teammate tries it:
1. For the fully isolated demonstration, run the Playwright command above from `apps/web`.
   Its dedicated Vite server on `5187` uses the synthetic renderer and intercepted API routes.
   Open `artifacts/feat017/head-saying-line.webm` for the recorded spoken line.
2. For normal development, apply the current API migrations to a scratch/development database
   using the existing API setup instructions, start that API, and point the web dev server's
   `VILLAGE_API_URL` at it. Open a profile, select a line, and click “Say something silly”.
   Click the expand icon to inspect the Gaussian head. The same studio stays available while
   browsing the profile's outfit showcase.
3. Let another scratch village member enable “Friends may use my avatar and AI voice” in
   Settings. Open “Everyone says it” on the dashboard to test the consenting sequence.
4. With `VITE_MOCK=1`, normal fixture portraits and the labelled local audio sample work
   without providers or generated assets. A real Gaussian package and running worker enable
   actual LAM rendering and generated Audio2Expression data in normal development.

Blockers: none for implementation. Validation limitation: this delivery does not claim a paid
ElevenLabs generation, a live GPU/A2E run, or visual QA of a real person's Gaussian package.
The production LAM runtime remains unchanged; its integration is exercised through a test-only
renderer implementing the same interface.

Proposed contract follow-up: no further HTTP changes are needed. The integrator can fold the
two tables from migration `048_head_speech.sql` into `packages/contracts/schema.sql` when
updating the baseline. That file was outside this task's allowed paths.
