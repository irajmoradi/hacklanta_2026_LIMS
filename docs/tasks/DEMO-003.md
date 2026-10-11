---
id: DEMO-003
owner: codex (gpt-6-astra, medium)
branch: demo/DEMO-003
allowed_paths: [docs/devpost/video/**, ops/demo/**]
---
# DEMO-003 — Record the v3 demo video from the 150 s script

Follow `docs/devpost/DEMO_SCRIPT.md` (merged from DOCS-010). Record with Playwright (Chromium, 1920x1080, `recordVideo`) a
smooth scripted walk of every beat, scripts in `ops/demo/`. Use a SCRATCH stack, never the live village: run the API on a
spare port (e.g. 8030) against a scratch Postgres DB with fixtures + mock providers, and `vite preview` on a spare port (e.g.
4175) pointing at it. Cached/generated assets already on disk (heads, talk videos, thumbnails) may be reused read-only.
Pace with deliberate pauses so captions are readable; hide the cursor jitter; no debug menu visible. Produce
`docs/devpost/video/village-demo-v3.webm` (and an .mp4 via ffmpeg if available, ≤ 100 MB), plus a 10 s silent highlight loop
and a shot list `docs/devpost/video/SHOTS.md` mapping script lines → timestamps. Voiceover is NOT needed (the owner records it).
No paid calls, no sends, no uploads. Commit only allowed paths (use git LFS-free files ≤ 100 MB). Final report per AGENTS.md.
