# FIX-017 final report

Branch: `fix/FIX-017`. Implementation commit: `0f9e1df`.
The following test/artifact commit contains this report (resolve with `git log -1`).

All consenting, non-placeholder members selected in the stage can animate during
Everyone says it. The spotlight keeps its live Gaussian head; other slots play
muted cached MP4s synchronized to normalized progress of the spotlight audio clock.
Late clips join the clock without delaying playback. Portraits and waveforms remain
visible when clips are pending, missing, broken, or the worker is offline.

The new POST reuses FEAT-017 speech generation, consent, durable audio cache, and
10-new-generations-per-requester-per-UTC-day limit. A batch selects one surprise
line. GET polling is read-only and rechecks consent; revoked permission also blocks
voice MP4 asset downloads. Exclusive sidecar creation prevents duplicate render
requests, ready videos survive API restarts, and failed/stale work can only retry
on an explicit POST after a three-minute cooldown. Stop and close cancel playback,
video synchronization, and browser polling; already-requested renders may finish
and populate the cache.

## Changed files

- `apps/api/app/chorus.py`: batch endpoint, polling, asynchronous worker adapter,
  persistent clip cache beside audio.
- `apps/api/app/main.py`: router registration and MP4 consent gate.
- `apps/api/tests/test_fix017.py`: batch/cache/quota/consent/offline/worker tests.
- `apps/web/src/components/{HeadStudio.tsx,HeadStudio.css,ChorusVideo.tsx}`:
  batch playback, authenticated media loading, shared clock, clip overlay.
- `apps/web/src/api/mock.ts`: offline chorus contract and cache behavior.
- `apps/web/tests/fix016.tsx`: existing regression fixture supports batch calls.
- `apps/web/tests/fix017.{config.ts,html,spec.ts,tsx}` and
  `apps/web/tests/chorus-synthetic.mp4`: deterministic browser harness and synthetic
  moving test pattern (no real person's image or voice).
- `apps/web/artifacts/fix017/`: four reviewed screenshots, browser WebM, run-output
  ignore rule; `apps/web/tests/FIX-017-REPORT.md`: this report.
- `packages/contracts/api.md`: documented endpoints and optional cast/village filters.

## Validation

All final commands exited **0**. API commands ran from `apps/api`, with
`VILLAGE_ENV_FILE=C:/Users/mourn/Downloads/hacklanta/.env` loaded at runtime.
Tests used only `village_test` with a private test schema and mocked paid providers.
Web commands ran from `apps/web`.

- `python -m uv run pytest tests/test_fix017.py tests/test_feat017.py tests/test_feat010.py -q`
  — 16 passed (final run 14.38s).
- `python -m uv run ruff check app/chorus.py app/main.py tests/test_fix017.py`
  — all checks passed.
- `bun run typecheck` — passed.
- `bun test src/components/headPlayback.test.ts src/api/mock.test.ts`
  — 16 passed, 74 assertions.
- `bunx playwright test --config tests/fix017.config.ts`
  — 3 passed; three videos progressing with <150ms inter-video skew, late clips,
  replay, stop/close cleanup, offline waveform, and live spotlight with two videos.
- `bunx playwright test --config tests/fix016.config.ts`
  — 3 passed; readiness gate, cache, six-second fallback, cancellation, chosen text,
  and exclusion of nonconsenting/placeholder villagers.

Initial local checks encountered missing dependencies; resolved with
`bun install --ignore-scripts --no-save --cwd apps/web` and
`npm ci --prefix apps/web/src/components/pot --install-links --no-audit --no-fund`.
An initial fixture type error and lint findings were corrected before final runs.
No live demo mutations, paid calls, secret copies, or pushes were performed.

## Visual evidence

Reviewed `apps/web/artifacts/fix017/chorus-desktop.png`, `chorus-mobile.png`,
`live-spotlight.png`, and `offline.png`. Recording:
`apps/web/artifacts/fix017/chorus-demo.webm` (synthetic browser video, no recorded audio).

## Try it

From `apps/web`, run `bunx vite --config tests/fix016.vite.config.ts`, then open
`http://127.0.0.1:5198/tests/fix017.html`. Open Everyone says it and press the dialog's
Everyone says it button. Add `?late`, `?offline`, or `?live&delay=100` to exercise
fallback and spotlight cases. This harness is completely local and synthetic.

For a real configured test village, open the normal chorus and choose a line.
First play may show portraits while clips render; replay reuses audio and ready
clips. No setup or destructive debug action on the shared demo is required.

## Choices and limits

No blockers and no outstanding proposed contract changes; the allowed contract
file was updated. GPU integration was validated through HTTP mocks, not live GPU
or Modal calls. The configured GPU URL remains the source of worker routing.
Videos are normalized to each active voice's duration, so lip/word timing is
approximate. Speech preparation still uses the existing synchronous speech API;
only video rendering is asynchronous. Failed members are skipped and named in
the completion status. The optional multi-Gaussian renderer stretch was omitted
to preserve the existing singleton renderer.
