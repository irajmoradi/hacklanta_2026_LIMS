---
id: DEMO-001
owner: codex (gpt-6-astra, medium)
branch: demo/DEMO-001
allowed_paths: [tests/demo/**, docs/submission/video/**]
---
# DEMO-001 — Automated 2.5-minute demo video capture (draft cut)

Read docs/submission/demo-video.md (shot list), docs/submission/pitch.md, apps/api/demo/README.md (tour), and the
web tour mode (`?tour=1`, WEB-005). Stable preview: http://localhost:4173 (real API :8010, demo village reset).
GPU worker may be stopped — that's fine (heads already baked).

Build `tests/demo/record.ts` (Playwright, headed Chromium so WebGL + the LAM head render, 1920×1080, recordVideo):
follow the shot list with deliberate pacing (smooth camera orbit over the village, open Stefanny (crown) → Dev's
profile with LAM head + "Hear them" lip-sync audio, Lance's suspicious evidence verdict, AI at work panel, Week grading
with AI pre-grade, Compete, a live "pray to the Mayor" call). Burn in simple lower-third captions via an injected
overlay (not part of the app). Capture tab audio if Playwright allows; otherwise record a separate audio track of the
ElevenLabs lines and mux with ffmpeg if available (check `ffmpeg -version`; if missing, document the manual step).
Output: `data/demo/village_demo_draft.mp4` (+ webm), ≤ 2:45. Also export 6 key stills to data/demo/stills/.
Live calls allowed: ≤2 Mayor prayers, ≤2 voice lines. Do not reset the DB. Report exact duration, file paths, and
anything that looked broken on screen (that's a bug list for the integrator).
