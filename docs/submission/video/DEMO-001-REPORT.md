# DEMO-001 — delivered draft

Branch: `demo/DEMO-001`. Milestones: `8039e07` (recorder and read-only inspection), `d8906a8` (mux/export and instructions); the final report/verification commit follows these. Recording began **2026-10-10 07:10:11 UTC**. Recorder source at capture: `8039e077df69e7b3f7bbc19e94d8803211b2d08d`. The existing preview/API were used as running; their separate deployed build revisions were not independently established.

## Delivery

All paths below are relative to this worktree. Output stays inside the task's allowed paths. Root `data/demo/` was not written.

| Artifact | Path | Result |
| --- | --- | --- |
| MP4 | `docs/submission/video/data/demo/village_demo_draft.mp4` | **152.000 s (02:32.000)**, 15,493,971 bytes, H.264/AAC |
| WebM | `docs/submission/video/data/demo/village_demo_draft.webm` | **152.029 s (02:32.029)**, 9,971,170 bytes, VP9/Opus |
| Six key stills | `docs/submission/video/data/demo/stills/` | `01-village.png`, `02-dev-lam.png`, `03-evidence.png`, `04-ai-at-work.png`, `05-week-grading.png`, `06-compete.png` |
| Whole-cut contact sheet | `docs/submission/video/data/demo/qa/contact-sheet.jpg` | A sample every five seconds |
| Mouth-motion detail | `docs/submission/video/data/demo/qa/voice-motion.jpg` | Twenty frames across the speech window |
| Mayor result frame | `docs/submission/video/data/demo/qa/mayor-response.png` | Exported frame at 02:20 |
| Machine evidence | `docs/submission/video/data/demo/capture.json`, `verification.json`, `call-budget.json` | Timing, decode results, call counts and known failures |

Both movies contain **3,800 frames, 25 fps, 1920×1080**. MP4 and WebM container durations were read at full precision after FFmpeg's rounded display. The original Playwright capture is 159.08 seconds including warm-up; the delivered movies remove 7.0702 seconds of pre-roll and meet the 2:45 maximum.

The audio is the exact “Hear them” provider blob, **3.204354 seconds**, placed at **31.7741 seconds** according to the browser's playback event. Playwright supplies video only. The rest of the cut is intentionally silent with burned-in explanatory captions; no full narration or background music was generated. Audio signal detection confirmed non-silent samples. No subjective listening review is claimed.

## What the take shows

| Time | Shot |
| --- | --- |
| 00:00–00:10 | Title, team and full village |
| 00:10–00:30 | Smooth mouse-driven orbit; Stefanny's crown/profile; dog and crater |
| 00:30–00:49 | Dev's baked LAM head; Hear them; visible mouth movement and synthetic speech |
| 00:49–01:07 | Lance's actual synthetic workout image and seeded suspicious verdict |
| 01:07–01:26 | AI at work, reasons, simulated provenance and restraint |
| 01:26–01:49 | Switch to Maya; current weekly rubric and one live AI pre-grade; no grade submitted |
| 01:49–02:07 | Minecraft/Study competition list, Study terms, fee/entry intentions and confirmed evidence |
| 02:07–02:26 | One live Mayor prayer and its returned encouragement |
| 02:26–02:32 | Closing village and local preview link |

Live calls made by this recorder: **1 voice line, 1 Mayor prayer, 1 weekly pre-grade**. The persistent request guard recorded no other mutations. No reset, GPU generation, human grade, competition decision, message, payment or transaction was performed. The prayer and suggestion naturally persist in the shared API database. Existing shared data changed between the read-only inspection and the take; no reset or cleanup of teammates' activity was attempted.

## Bugs and draft limitations for the integrator

1. **Expression asset missing:** Dev's new voice `line_expr.json` returned 404 on three polling attempts. Speech and the LAM canvas worked; the inspected speech frames visibly alternate open/closed mouth shapes using the app's amplitude fallback. This is not a demonstration of generated Audio2Expression timing. No on-screen error was displayed.
2. **Actual provider differs from the pitch:** the live weekly suggestion shows `deepseek/deepseek-v4-flash`. Seeded evidence says `demo-fixture/gemini-2.5-flash (not called)`. Do not describe the live grading result as Gemini. The take preserves the app's real provenance.
3. **Mayor presentation:** the returned prayer appears near the top among cards labeled “VILLAGE CHALLENGE” with +0 XP. The dedicated response below the long event list is not prominent in the final frame. Consider distinguishing prayer responses from challenges and keeping the response in view after refresh.
4. **Competition framing:** the confirmed entry is readable; the pending entry is further below the fold and is described by the caption rather than shown in detail. This is a draft editing limitation, not a failed competition request.
5. **Caption position:** lower thirds cover bottom navigation/form controls during some shots. They do not intercept clicks. Core evidence, grading rationale, portraits and challenge text remain visible. There is no full-length narration.

Visual QA inspected the full-cut five-second contact sheet, full-resolution key frames, Mayor result and the dense mouth-motion sequence. Full video/audio streams were decoded successfully in both formats. This is sampled visual inspection, not a claim of a human watching and listening to every second. No missing head, blank WebGL scene, blocking dialog error or missing evidence image was observed.

## Validation actually run

| Command | Exit / result |
| --- | --- |
| `bun install` in `tests/demo` | 0; recorder-only dependencies installed |
| `ffmpeg -version` | 1; absent from PATH |
| `tests/demo/node_modules/ffmpeg-static/ffmpeg.exe -version` | 0; full FFmpeg 6.1.1 available |
| `bun inspect.ts` in `tests/demo` | Stalled in browser startup; stopped its own process; not a pass |
| `node tests/demo/inspect.ts` | 0; Connected state and ready LAM canvas asserted, screenshots saved |
| `node --check tests/demo/record.ts` | 0 |
| `node --check tests/demo/export.ts` | 0 |
| `node tests/demo/record.ts --live` | 0; all nine shots, six stills, one speech blob and a Mayor response captured |
| `node tests/demo/export.ts` | 0; both encodes and complete FFmpeg decodes passed |
| `node tests/demo/verify.ts` | 0; dimensions, frames, exact durations, still count, shot count, audio, response and call budgets passed; only known expression 404s allowed |
| FFmpeg `-af volumedetect -vn -f null -` on delivered MP4 | 0; non-silent signal present |
| FFmpeg speech montage and Mayor frame extraction | 0 |
| `git diff --check` | 0 |

## Handoff and changed files

To try the result, open `docs/submission/video/data/demo/village_demo_draft.mp4`. To validate without paid calls, run `node tests/demo/verify.ts`. For setup/reproduction, see [README.md](README.md). Keep the persisted task call budget; do not reset it for retakes. The API loads secrets at runtime from the existing external environment file; this worker did not read, print or copy secret values.

Changed tracked files: `tests/demo/{record.ts,inspect.ts,export.ts,verify.ts,package.json,bun.lock,.gitignore}` and `docs/submission/video/{README.md,DEMO-001-REPORT.md,.gitignore}`. Runtime media, dependencies and captures are ignored, not committed. No application or contract files changed.

Blockers: none for the delivered draft. The integrator must relocate artifacts if root `data/demo/` is required, since that location is outside this worker's allowed paths. External publication and public URLs remain outside this task. Proposed contract changes: **none**.
