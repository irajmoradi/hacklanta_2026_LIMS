# Village demo capture

## DEMO-002 feature tour

Open `data/demo/village_demo_v2_full.mp4` (team review) or `data/demo/village_demo_v2_judges.mp4` (2:30 edit). These paths are relative to this README, inside the authorized output directory. See [DEMO-002-REPORT.md](DEMO-002-REPORT.md) for exact durations, chapter times, screenshots and unavailable features.

Validate or re-export the existing delivery without generation:

```powershell
node tests/demo/verify-v2.ts
node tests/demo/export-v2.ts
```

Run commands from the repository root. The export uses the persisted main take plus two real browser pickups, captured with:

```powershell
node tests/demo/inspect-v2.ts
node tests/demo/record-v2.ts --live
node tests/demo/pickup-v2.ts
node tests/demo/pickup-wardrobe-v2.ts
```

Do not rerun the live take against this completed task's budget. `v2-budget.json` persists attempts before forwarding: at most two voice requests, one prayer, one pre-grade, one 1-XP bribe, and two inventory changes across runs. No photos, audio uploads, grades, transactions, messages or resets are allowed through the recorder. The wardrobe pickup removes and restores existing glasses. The group pickup is read-only and explicitly labels saved crops as artifacts, because the old worker job is not registered with the running API.

`VILLAGE_ARTIFACT_DATA` optionally overrides the read-only artifact source, defaulting to `C:/Users/mourn/Downloads/hacklanta/data`. The running API owns runtime secret loading; the recorder requires no provider keys. No environment values are copied. Captions and full-screen artifact slides are injected overlays; API responses and application UI are never fabricated. Sound-on playback events provide the main take's voice and effects; the two pickups are silent. Both cuts are 1080p H.264/AAC. `v2-capture.json`, `v2-verification.json`, `v2-pickup.json`, `v2-wardrobe-pickup.json`, `v2_stills/` and `v2_qa/` remain ignored with all media.

## DEMO-001 draft capture

The recorder drives the existing preview at `http://localhost:4173/?tour=1` using headed Chromium at 1920×1080. It changes no application source and never resets the database. Native Playwright video is silent, so the recorder saves the exact audio blob played by “Hear them”, records its browser playback timestamp, and muxes it into both exports. Lower thirds are injected into the browser top layer, including over native dialogs.

From the repository root, with Node 24 and Bun installed:

```powershell
bun install --cwd tests/demo
node tests/demo/inspect.ts
node tests/demo/record.ts --live
node tests/demo/export.ts
node tests/demo/verify.ts
```

The already-running API reads provider credentials from the external `VILLAGE_ENV_FILE` at runtime. The recorder needs no secret values, copies no environment file, and uses the application's existing demo authentication. Chromium must be installed (`bunx --cwd tests/demo playwright install chromium` if needed). Use `DEMO_URL` to select another existing preview.

`--live` explicitly enables one voice line, one weekly AI pre-grade and one Mayor prayer per run. Without that flag, the same tour is a silent rehearsal with no mutations. A persistent ignored `call-budget.json` limits this task across restarts to two voice attempts, two prayer attempts, and one pre-grade attempt. It counts attempts before forwarding; do not delete it to retry. All other API writes are blocked, including resets, grades, purchases, messages and payments. Existing generated heads are used; no GPU generation is requested.

All runtime artifacts are private/ignored under **`docs/submission/video/data/demo/`**, because the task's allowed paths do not include root `data/demo/`. The integrator may copy the finished files to root `data/demo/` separately. No generated media, photos, voice samples or large binaries are committed.

- `village_demo_draft.mp4`: H.264, AAC, 1080p, fast-start.
- `village_demo_draft.webm`: VP9, Opus, 1080p.
- `stills/01-village.png` through `06-compete.png`: six captioned key frames.
- `capture.json`: source commit, shot timestamps, API attempt counts, browser failures and audio timing; contains no credentials.
- `verification.json`: export duration, dimensions and full-decode result for both formats.
- `qa/contact-sheet.jpg`: sample every five seconds across the exported MP4.
- `raw/`: original Playwright WebM, including warm-up; not the final edit.
- `voice-1.audio`: exact provider audio blob used during the take, with its format detected by FFmpeg.

FFmpeg is absent from the machine PATH. Playwright's bundled FFmpeg lacks MP4/audio support, so `ffmpeg-static` is installed only inside the recorder's ignored dependency directory. No manual mux step is needed. If that download is unavailable elsewhere, install full FFmpeg and adapt `export.ts`'s executable path; use the persisted `startMs` as `adelay` milliseconds, trim the raw video's warm-up, pad audio, and export H.264/AAC with a maximum of 165 seconds.

The sequence uses actual browser panels available in WEB-005, superseding the older shot list's API-only views. AI journal footage precedes grading to follow the in-app tour. Stock synthetic speech is the only audio; lower thirds carry the remaining story. The historical 59.7-second CV timing is labeled as historical, competition amounts as intentions, and Photon delivery as not demonstrated. No external upload is performed.

The delivered take and observed limitations are documented in [DEMO-001-REPORT.md](DEMO-001-REPORT.md). To inspect the existing delivery without generating anything, open the MP4 or run only `node tests/demo/verify.ts`. Re-exporting also makes no provider calls.
