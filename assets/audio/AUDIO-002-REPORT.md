# AUDIO-002 completion report

Branch: `audio/AUDIO-002`. Implementation milestone: `75bb71e`. The following commit contains this report and the verified A/B preview URL fix; use `git log -2 --oneline` for both.

Replaced AUDIO-001's night loop with ElevenLabs take 4: distinct tonal cricket pulses, stronger quiet gaps, and lower broadband flatness. Both production encodings are 20 seconds, mono, and measure **−22.00 LUFS**. Dusk now fades in over **4 seconds**; other fades retain their existing three-second timing. Interrupted fades retain their instantaneous gain. Day stays at −18 LUFS; the existing night/day mixer gains (.45/.7) make night about 7.8 dB quieter than the primary day bed after settling, before additional day layers.

## Generation and selection

**4 requests attempted, 3 completed generations, 1 HTTP 400 rejection; hard cap exhausted.** Known billed credits: **726**. Take 2's longer prompt was rejected; no provider error body was retained, so its exact rejection reason is unconfirmed. The revised, shorter prompt succeeded on take 3. No automatic retries or further generation are needed. Keys were loaded at runtime from the external environment file and never written to the repository. See `AUDIO-002-log.md` and `AUDIO-002-ledger.json` for the exact prompts and statuses. API shape was checked against [ElevenLabs documentation](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert).

| Audio | LUFS | Mean flatness | Chirp-band contrast |
| --- | ---: | ---: | ---: |
| Previous production night | −17.99 | 0.02393 | 5.82 dB |
| Take 1, raw | −26.95 | 0.06758 | 5.08 dB |
| Take 3, raw | −9.82 | 0.02409 | 2.35 dB |
| Take 4, raw, selected | −13.00 | 0.01104 | 13.29 dB |
| New OGG | −22.00 | 0.01023 | 13.47 dB |
| New MP3 | −22.00 | 0.01145 | 13.37 dB |

Flatness alone also accepts the old sprinkler-like bed, so selection additionally required distinct chirp-band energy changes. Analysis uses mono PCM at 24 kHz, 1024-sample Hann windows every 10 ms, power-spectrum flatness over 1–10 kHz, and 80th/35th-percentile energy contrast over 3.5–5.5 kHz. Hysteresis with a 150 ms minimum separation detects 52 chirp-band onsets in the mastered OGG, including a 2.19-second inter-onset gap. These are objective proxies, not biological cricket counts or a claim of human listening signoff. The OGG quiet-frame RMS (10th percentile) is −43.64 dBFS versus −27.52 dBFS previously. This statistic is affected by overall level and is not an isolated measurement of broadband hiss. Full measurements are in `AUDIO-002-metrics.json`.

Take 4 meets the flatness and transient criteria, so the conditional procedural fallback was unnecessary. Mastering rotates the source into a two-second equal-power tail/head overlap; OGG/MP3 peaks are −7.29/−7.36 dBTP. Loop seams pass the existing discontinuity check. No voices, photos, or personal assets were used.

## Files changed

- `apps/web/public/sfx/{night_soft.ogg,night_soft.mp3,manifest.json}`: replacement loop, fallback, and description.
- `apps/web/src/sound/{ambience.ts,ambience.test.ts}`: four-second night fade and regression tests.
- `tools/sfx/{generate.mjs,verify.mjs}`: preserve AUDIO-002 night assets during legacy processing and validate their −22 LUFS target.
- `tools/sfx/{night-generate.mjs,night-process.mjs,night-metrics.py}`: capped generation, offline mastering/A/B, and spectral measurements.
- `tools/sfx/{night.html,night-browser.mjs}`: comparison player and real-browser checks.
- `assets/audio/AUDIO-002-{ab.ogg,before.ogg,source.mp3,ledger.json,log.md,metrics.json,qa.png,REPORT.md}`: deliverables, original/selected source, provenance, metrics, screenshot, and report.
- `assets/audio/validation.json`: updated night measurements; other assets unchanged.

## Verification

Commands executed from the repository root:

- `npm ci --prefix tools/sfx --no-audit --no-fund` — exit 0.
- `node tools/sfx/night-generate.mjs --generate` — four invocations: exits 0, 1 (HTTP 400), 0, 0. No retries beyond the four recorded attempts.
- `node tools/sfx/night-process.mjs` — exit 0; mastered assets, spectral/transient checks, and A/B generated.
- `bun test ./apps/web/src/sound` — exit 0; 10 tests, 51 assertions, zero failures.
- `node tools/sfx/verify.mjs` — exit 0; all 24 ambience encodings decode, duration/mono/level/peak/seam checks pass.
- `node tools/sfx/node_modules/typescript/bin/tsc --target ES2022 --lib ES2022,DOM --strict --noEmit --skipLibCheck --moduleResolution bundler --module esnext apps/web/src/sound/engine.ts apps/web/src/sound/ambience.ts` — exit 0.
- `node tools/sfx/night-browser.mjs` with the local Vite harness running — final exit 0; OGG and forced MP3 fallback both verify gesture gating, real decode, looping, four-second ramp, settled gain, source cleanup, and 20-second A/B metadata. An initial check failed on floating-point equality (3.9999999999999996 vs 4); fixed to use a tolerance and rerun successfully. Visual QA exposed the original preview URL resolving outside the harness root; imported it through Vite and added a duration assertion before rerunning successfully.
- `git diff --check` — exit 0.

Screenshot: `assets/audio/AUDIO-002-qa.png` (audio comparison harness, not a full village UI screenshot). No full application build was claimed; the isolated sound modules were typechecked and exercised in Chromium.

## Try it

Open `assets/audio/AUDIO-002-ab.ogg`: **0–10 s old; 10–20 s new**, with the four-second dusk fade at the start of the new half. The file preserves the actual loudness difference at asset level; it omits the common production master attenuation to make review easier.

For full loops through the production mixer:

```powershell
npm ci --prefix tools/sfx --no-audit --no-fund
node tools/sfx/node_modules/vite/bin/vite.js --config tools/sfx/vite.config.mjs
```

Open `http://127.0.0.1:5197/night.html`; click A or B. Both buttons use identical night mixer gain and fade settings. In another terminal, run `node tools/sfx/night-browser.mjs` for browser QA (requires Playwright Chromium). In the village, enable sound and select night/evening or enter local nighttime.

Offline rebuilding requires Python with NumPy plus the installed tooling dependencies: `node tools/sfx/night-process.mjs`. The selected source and old baseline are committed. Rejected/unselected raw takes remain ignored; their recorded metrics are included. Never rerun generation for review: the four-attempt ledger refuses further calls.

Blockers: none. Proposed contract changes: none. No paths outside the task's allowed paths were modified. Subjective preference remains reviewable through the supplied A/B; acceptance here is based on measured audio and browser behavior.
