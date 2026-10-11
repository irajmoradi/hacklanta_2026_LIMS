# FEAT-024 — Avatar voice barks

Branch: `feat/FEAT-024`. Implementation: `a29e609`. Lifecycle/Windows and UI fixes: `52435d2`. Verification artifacts are committed separately on the same branch.

Implemented 72 short fixed lines across nine triggers, with three lines per trigger selected for the explicit batch (27 clips per consenting cloned voice). No generation runs from HTTP reads, page loads, animation ticks, or playback. No real provider calls were made during this task.

The batch locks the speaker row while checking consent and generating, and takes a voice/line advisory lock across concurrent jobs. Successful MP3s are atomically installed under a hash of `(voice_id, immutable line_id)` and reused across members sharing that voice. It reports generated, cached, remaining, failed, capped, and synthesized-character counts. Provider errors stop the batch without retry loops; later operator runs resume missing clips.

ElevenLabs charges now use a SQLite counter in the shared asset directory, applying the existing SEC-001 global/IP/seat UTC daily caps across API processes and CLI restarts. Other provider budgets retain their existing behavior. Failed provider attempts still consume their reservation. With default caps (60 global / 15 IP / 10 seat), a full 27-clip set takes multiple days. Deploy/restart the patched API before using the CLI, and run both against the same `DATABASE_URL` and writable `ASSET_DIR`. Keep `.voice-budget.sqlite3` with that store; deleting it resets the counters.

Playback uses authenticated cached audio reads with consent checked on every request. It selects a random clip, limits each avatar to one bark per 20 seconds and the page to one per four seconds, and permits only one pending/playing bark. Camera distance attenuates volume to silence at 100 world units; offscreen/hidden avatars are silent. Moving out of view, muting, reduced sound/motion, hidden tabs, disabling barks, and scene/user cleanup stop playback. Cooldowns survive village/user switches. Pending downloads cannot start after cancellation. Missing clips remain silent.

Walking/emotes use the own/remote character state, cafe/festival/wheel transitions use activity state (and an optional allowlisted town movement activity field for peers), check-ins/received cheers use fresh feed entries, and interior avatar arrival triggers house entry. The listening toggle defaults on and saves separately for each user on the current device, matching the existing device-local sound settings.

## Integrator command and cost

From the deployed checkout's `apps/api` directory, in Git Bash, with the API's asset-store configuration:

```bash
VILLAGE_ENV_FILE=/c/Users/mourn/Downloads/hacklanta/.env python -m uv run python scripts/generate_barks.py --village 13370000-0000-4000-8000-000000000000 --max 3
```

Environment values load at runtime through the existing config loader. No secret file is copied. This command was **not** run against production. Run it only when the integrator intends to spend credits. `--max 0` reports cache/missing counts without generation. Repeating a positive limit fills the next missing clips; fully cached sets generate nothing.

A fresh first batch generates the three walking lines: 51 characters, approximately **25.5 credits** on a self-serve Flash v2.5 plan. A resumed three-clip batch is at most 93 characters / approximately 46.5 credits. The entire selected set is 474 characters / approximately **237 credits per voice**, spread across cap-limited runs. Provider rounding, failures, and enterprise terms may differ. Source: [ElevenLabs credit accounting](https://help.elevenlabs.io/hc/en-us/articles/27562020846481-What-are-credits), checked 2026-10-11. Cached playback costs zero generation credits.

## Try it

Run the web app in mock mode, open Settings, and toggle Voice barks; reload to confirm persistence. Mock villagers have no generated clips and remain silent. After the integrator seeds clips on a configured API, unmute sound, bring an avatar into view, and walk/wave or visit an attraction. Cooldowns intentionally suppress rapid repetitions.

## Files

- API: `app/barks.py`, `app/security.py`, `app/main.py`, `app/realtime.py`, `scripts/generate_barks.py`, `tests/test_feat024.py`, `tests/test_sec001.py`, this report.
- Web: `src/sound/{barks.ts,barks.test.ts,VoiceBarks.tsx,engine.ts,SoundControls.tsx}`, `src/scene/{barkSpatial.ts,VillageScene.tsx,InteriorAvatars.tsx}`, `src/api/{movement.ts,townLive.ts}`, `src/components/SettingsPanel.tsx`, `src/App.tsx`, `tests/{barks.config.ts,barks.spec.ts}`.
- Contract: `packages/contracts/api.md` documents the two read endpoints and optional movement activity field. No schema change or unresolved contract proposal.

## Verification

All heavy checks use `../../ops/remote_run.sh` from the owning app directory. API providers are mocked and use the runner's scratch database; browser checks use `VITE_MOCK=1`. No live demo writes or generation.

- Web: `bun test src/sound/barks.test.ts src/sound/engine.test.ts src/api/movement.test.ts` — exit 0, 14 passed.
- Web: `bun run build` — exit 0. Existing large-chunk warning only.
- API: `python -m uv run pytest -q tests/test_feat024.py tests/test_sec001.py tests/test_realtime.py` - exit 0, 50 passed, including CLI help/bound validation, consent, cache concurrency, persistent caps, and realtime regressions. Existing Starlette/httpx deprecation warning only.
- Browser: `bunx playwright test --config tests/barks.config.ts` - exit 0, one mock test passed. The first attempt timed out behind the existing demo-seat picker (exit 1); setting a mock seat fixed the test setup.
- Screenshot: `apps/web/tests/artifacts/barks/settings.png`. Visual review moved the toggle into the existing Sound card; final capture centers that card.
- No blockers. No outstanding contract proposals. The feature intentionally remains silent until consenting voices have been seeded by the integrator.
- Two queued API attempts were canceled while waiting for the shared runner API lock (exit 143 each); no tests had started. They were rescheduled after web verification.
- Local lightweight lint: `python -m uv tool run ruff check apps/api/app/barks.py apps/api/app/security.py apps/api/app/main.py apps/api/scripts/generate_barks.py apps/api/tests/test_feat024.py` — exit 0.
