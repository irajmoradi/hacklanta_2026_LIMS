# DEMO-003 validation and handoff

Completed and visually reviewed. Branch: `demo/DEMO-003`. Media delivery commit: `f786a7d`. The successful capture used recorder/export source from `6219a6b`; `2e77aa4` adds the Windows LF checkout guard. All changes are confined to `ops/demo/` and `docs/devpost/video/`.

Open [village-demo-v3.mp4](village-demo-v3.mp4) to try the finished demo; use [SHOTS.md](SHOTS.md) for the owner's narration. [WebM](village-demo-v3.webm) and a [10-second silent loop](village-highlight-10s.mp4) are also included. Every movie is 1920x1080, 25 fps and contains no audio stream.

| Deliverable | Duration | Bytes | Codec |
| --- | --- | --- | --- |
| `village-demo-v3.webm` | 150.00 s | 39,829,690 | VP9 |
| `village-demo-v3.mp4` | 150.00 s | 9,707,203 | H.264 |
| `village-highlight-10s.mp4` | 10.00 s | 1,020,944 | H.264 |

Changed files: `ops/demo/{.gitattributes,.gitignore,README.md,run.sh,record.mjs,export.py,verify.py}`; this directory's movies, `SHOTS.md`, `REPORT.md`, `.gitattributes`, `capture.json`, `assembly.json`, `verification.json`, `checksums.json`, `contact-sheet.jpg` and ten `frame-*.png` review stills. Raw takes and intermediate builds remain ignored.

Visual evidence: [contact sheet](contact-sheet.jpg), [try-on](frame-065.png), [AI provenance](frame-092.png), [consent controls](frame-110.png), [weekly review](frame-130.png), [closing town](frame-148.png). All nine beats were checked on the contact sheet and selected full-resolution frames. Captions are readable, markers are removed, the debug menu is hidden, and both the opening and closing town are present. The Settings phone field is empty; its visible example is the source-defined `placeholder` in `SettingsPanel.tsx`, not a saved contact.

The successful run reported no browser errors, no blocked requests, and a fixture coin change from 350 to 375. Rendered markers handle compositor lag; `assembly.json` records each source range and exact final shot boundaries. Longer shots lose trailing holds, shorter shots extend their final frame. Actions are never accelerated. A 16-pixel bottom matte replaces the marker strip. This is an edited demonstration, not a frame-rate benchmark.

The recording uses the script's offline-fixture and no-cleared-personal-media fallbacks. A disposable, seeded PostgreSQL/API stack is created through the runner wrapper; Vite preview points to it on port 4175. The shown interactions use browser fixtures, not database-backed persistence. The selected viewer is Maya; this checkout's weekly fixture auditor is Iraj. No live demo API, provider generation, sends, uploads, wallet signatures or transactions are used. No secrets are required, read, copied or forwarded. The root environment file is not needed for this mock-provider capture.

| Command (from `apps/web` unless noted) | Actual result |
| --- | --- |
| `bash ../../ops/remote_run.sh --with-api bash ../../ops/demo/run.sh --rehearse` | Exit 1. Production build passed. Two opening screenshots were saved; the check-in-stage screenshot hit the 12-second screenshot timeout. The optional Google Fonts request was blocked. |
| First `bash ../../ops/remote_run.sh --with-api bash ../../ops/demo/run.sh --all` | Exit 1 during rehearsal. Build passed; no browser errors or blocked requests. Check-in was saved and coins increased from 350 to 375, but the browser's click operation did not finish within 12 seconds. No final cut was exported. |
| Second `bash ../../ops/remote_run.sh --with-api bash ../../ops/demo/run.sh --all` | Exit 1 during rehearsal. Build and check-in passed. Shop selection found two items named Cozy Beanie. Recorder now selects `hat_beanie` by stable item ID. |
| Third `bash ../../ops/remote_run.sh --with-api bash ../../ops/demo/run.sh --all` | Exit 1 during rehearsal, after check-in, try-on, Gazette, AI journal, gram controls, Settings and Colosseum. The arena return selector also matched the background Village button. It now matches the exact “← Village” label. Queue/build/rehearsal wall time: 1,752.32 seconds. |
| First `bash ../../ops/remote_run.sh --with-api bash ../../ops/demo/run.sh` | Exit 1 after the first 135 seconds of the full take. The arena's delayed close callback closed the newly opened weekly review. Recorder now waits for that exit transition before opening the review, and closing an already closed panel is a no-op. No final media was exported from this attempt. |
| Second full-capture command | Local command exit 1 / remote supervisor exit 143. Deliberately cancelled our own queued supervisor after 1,672.64 seconds, before capture began, because the remaining reservation could not fit the take and export. Its disposable API shut down cleanly; a fresh reservation was started. Other workers were not interrupted. |
| Third full-capture command | Exit 1 at the shop shot: separate Playwright dispatches made the shot finish at 78.25 seconds, exceeding the recorder's initial per-shot tolerance. Rotation is now dispatched in one browser call; the preview hold uses the shot deadline. Per-shot timing slips are logged while the final take length remains checked. |
| Fourth full-capture command | Exit 0 for build, capture, encoding and numerical checks, but failed visual review: compositor lag left pre-roll at the start and cut off the closing town. Superseded; not delivered. Rendered shot markers and post-roll now replace clock-based trimming. |
| Fifth full-capture command | Local wrapper exit 1 / remote command exit 2 after 792.18 seconds including queue. Bash rejected CRLF line endings in `run.sh` before build/capture. Fixed by writing LF bytes; scratch API shut down cleanly. |
| Sixth full-capture command: `bash ../../ops/remote_run.sh --with-api bash ../../ops/demo/run.sh` | Exit 0. Production build, all nine UI beats, marker-based assembly, three exports, ffprobe checks and complete ffmpeg decodes passed. Wall time including queue/sync: 1,458.03 seconds. Scratch API stopped cleanly. |
| `ffmpeg -hide_banner -loglevel error -y -ss 92 -i ops/demo/artifacts/village-demo-v3.mp4 -frames:v 1 ops/demo/artifacts/frame-092.png` (root, local installed ffmpeg binary) | Exit 0. Lightweight single-frame extraction for AI provenance inspection; included in future verifier runs. |
| Python copy/SHA-256 verification of the 17 delivered artifacts (root) | Exit 0. Delivery bytes matched the reviewed artifacts; all files below 100 MB. `checksums.json` preserves the hashes. |
| `git check-attr filter -- docs/devpost/video/village-demo-v3.webm docs/devpost/video/village-demo-v3.mp4 docs/devpost/video/village-highlight-10s.mp4` | Exit 0. Filters unspecified; no Git LFS dependency. |
| `node --check ops/demo/record.mjs` (root) | Exit 0. |
| `bash -n ops/demo/run.sh` (root) | Exit 0. |
| Python `ast.parse` of `ops/demo/verify.py` (root) | Exit 0. |
| `git diff --check` (root) | Exit 0. |

The revised recorder serves the optional font stylesheet locally, keeps captions above native dialogs, uses real UI button handlers and outfit keyboard rotation, and extracts stills after capture. The software-rendered browser uses the app's existing low-core quality path with animation-frame requests spaced by 33 ms. This setup is not a benchmark of application frame rate. Raw rehearsals and intermediate builds stay ignored under `ops/demo/artifacts/`.

Reproduction commands and safety checks: [capture README](../../../ops/demo/README.md). Narration substitutions and the intended 150-second cut: [shot list](SHOTS.md). No remaining blockers or proposed contract changes. The owner still adds voiceover, which is outside this task. Personal source photos, a voice clip and handset-delivery footage were not established as cleared; the specified script fallbacks cover those omissions.
