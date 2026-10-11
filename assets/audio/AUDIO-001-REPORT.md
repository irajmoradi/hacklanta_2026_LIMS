# AUDIO-001 final report

Branch: `audio/AUDIO-001`.

Milestones: `75be57b` (generated assets and budget ledger), `1e629a3` (mixer, scene integration, corrected encoded loudness and QA). The final documentation commit contains this report.

## Delivered

- Nine requested ambience beds, generated at 22 seconds and crossfade-trimmed to 20 seconds; three requested 3-second one-shots. OGG and MP3, mono, 48 kHz, 96 kbps encoder target. OGG Vorbis uses an average bitrate target; actual bitrate varies.
- Measured encoded loudness is within 0.26 LUFS of -18 LUFS for beds / -14 LUFS for one-shots. No positive true peaks. Two-second equal-power tail/head overlap; decoded seam steps are smaller than internal transients. These are objective checks, not a claim of a human listening review.
- Separate Web Audio ambience bus at 35% of the user's volume, leaving UI effects at their existing levels. Day layers birds/breeze, distant village life and light wind; night reduces density and gain; rain takes priority. Three-second ramps preserve instantaneous gain when interrupted.
- Fountain, lake/creek and shop emitters live inside the actual scene groups, inheriting layout and scale. Locked/closed objects do not emit. The current town represents the creek/park water with its lake object. Arena crowd has its own emitter in the colosseum. Camera target supplies listener position; orthographic zoom lowers virtual listening height, bringing nearby sources forward. Native inverse-distance PannerNodes also provide stereo direction.
- Random daytime bird one-shots every 8–25 seconds, with an occasional distant dog. Mute, volume, reduced sound/device preference, gesture unlock, hidden-tab suspension and teardown are respected. Asset fetch/decode failures leave the village usable and silent; MP3 is tried if OGG fails.
- Harsh cricket files removed from public assets and manifest. A copy exists only in QA evidence as `before-night.mp3`, never loaded by the production application.

## Generation count and cost

Exactly **12 API requests / 12 successful generations**, no retries, no extra generations: 9 × 22 seconds + 3 × 3 seconds = **207 generated seconds**. The response `character-cost` headers total **2,277 credits** (242 per bed, 33 per one-shot). Dollar billing is not returned by the API and depends on the account plan; an exact USD cost cannot be established from these responses. See `generation-ledger.json` and `AUDIO-001-log.md` for every prompt, duration and billed credit count.

API reference: https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert

The generator reads `ELEVENLABS_API_KEY` from the process environment or the env file named by `VILLAGE_ENV_FILE` at runtime. It logs each attempt before requesting, enforces 14 attempts maximum and never automatically retries an attempted name. Secrets and raw intermediate audio are not committed. All correction passes were local ffmpeg operations.

## Files changed

- `apps/web/public/sfx/`: manifest, 24 new audio exports, two old cricket exports removed.
- `apps/web/src/sound/`: `engine.ts`, `engine.test.ts`, `SoundControls.tsx`; new `ambience.ts` and `ambience.test.ts`.
- `apps/web/src/scene/`: `GridTown.tsx`, `TownCamera.tsx`, `ColosseumScene.tsx`; new `SceneAmbience.tsx`.
- `tools/sfx/`: isolated tooling dependencies/lockfile, generation/processing and verification scripts, portable typecheck helper, Vite audio QA harness and browser recording script.
- `assets/audio/`: generation records, validation measurements, baseline audio, WebM, screenshot and this report. Raw generation/intermediate files are ignored.

## Tests and evidence

Commands run from the worktree root:

| Command | Exit | Result |
| --- | --- | --- |
| `bun test ./apps/web/src/sound` | 0 | 9 tests, 45 assertions: gesture gate, UI volume, mute/reduced sound, visibility, interrupted crossfades, distance falloff, missing assets and bird timing |
| `node tools/sfx/verify.mjs` | 0 | 24 exports decode; mono; duration, loudness, peak and seam checks pass; measurements in `validation.json` |
| `node tools/sfx/node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM --skipLibCheck apps/web/src/sound/engine.ts apps/web/src/sound/ambience.ts` | 0 | Production engine/mixer strict typecheck |
| `node tools/sfx/typecheck.mjs C:/Users/mourn/Downloads/hacklanta/apps/web/node_modules` | 1 | Scene/sound dependency graph blocked only by existing `ShowcasePreview.tsx:43` implicit-any and `:50` RootState/Object3D mismatch; no errors in changed files |
| `node tools/sfx/record.mjs` | 0 | Headless Chromium: no context before interaction, actual production mixer recording, no page errors |
| `tools/sfx/node_modules/ffmpeg-static/ffmpeg.exe -hide_banner -i assets/audio/AUDIO-001-ab.webm -af volumedetect -vn -f null -` | 0 | 28.03-second VP9 video + 48 kHz stereo Opus; mean -38.1 dBFS, maximum -15.8 dBFS, confirms recorded audio |
| `git diff --check` | 0 | Clean |

Initial encoded loudness verification failed on the day bed (-16.70 instead of -18 LUFS). The processing script was corrected to measure each encoded file and compensate locally, then all exports were reprocessed and passed. The first typecheck attempt had dependency-resolution noise; the portable helper resolves the shared installed declarations and exposes only the two existing component errors above.

Recording: `assets/audio/AUDIO-001-ab.webm`. Screenshot: `assets/audio/AUDIO-001-qa.png` (visually inspected). The recording uses a clearly labeled schematic audio QA view with the production mixer; it is not a full 3D application walkthrough. A: previous silent day / constant cricket night. B: layered day → three-second night fade → daylight plaza zoom and stronger fountain.

## How a teammate tries it

1. In the normal running Village app, interact once, leave sound enabled, and visit day/night/rain scenes. Pan to the fountain, shops or lake and scroll in. Open the colosseum to hear the warm crowd. Toggle sound, adjust the settings volume, enable reduced sound, and switch tabs to exercise gating. No GPU or generated avatar is required.
2. For a standalone comparison without an API or GPU, run `npm ci --prefix tools/sfx`, then `node tools/sfx/node_modules/vite/bin/vite.js --config tools/sfx/vite.config.mjs`. Open `http://127.0.0.1:5197` and click **Record A/B comparison**, or simply open the committed WebM.
3. To reproduce the recording with installed Playwright Chromium, run `node tools/sfx/record.mjs` while the QA server runs. If needed install its browser with `node tools/sfx/node_modules/playwright/cli.js install chromium`.
4. Run unit tests and `node tools/sfx/verify.mjs` without credentials. Do not regenerate to preview: all final assets are committed. `generate.mjs --process` is for the original local raw cache; `--generate` is an explicitly paid operation guarded by the committed attempt ledger.

## Blockers / proposed contract changes

No contract changes. The broader frontend typecheck remains blocked by the two existing errors in `apps/web/src/components/ShowcasePreview.tsx`, outside allowed paths. Dependencies were reused read-only from the primary checkout via the helper because this worktree has no web node_modules. No full app build or full 3D browser walkthrough is claimed. Exact USD billing and subjective human listening approval remain unavailable; exact API credit cost and objective audio QA are supplied.
