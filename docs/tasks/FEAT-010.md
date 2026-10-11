---
id: FEAT-010
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-010 (parallel)
allowed_paths: [apps/api/**, apps/imessage/**, apps/web/**, packages/contracts/api.md]
request: R-46 (Iraj 14:30) "add the video" — Villager-grams should include a video of the avatar saying the line
---
# FEAT-010 — Villager-gram video (talking avatar)

The GPU subagent is adding a worker endpoint (branch cv/talk-video): `POST {GPU_WORKER_URL}/avatar/talk_video?wait=true
{user_id, audio_path_or_url, max_seconds:15}` → `{video_path, seconds}` (an MP4 H.264+AAC 512x512 saved next to the audio).
Code against that contract; mock it in tests.
1. **API:** after the villagergram audio is rendered, if the speaker has a LAM head and the GPU worker is reachable (health
   check, ≤2 s), request the video asynchronously (don't block the 201). Store `video_key` on the villagergram/outbox row
   (migration suffix `_gram_video`), expose `video_url` in `/internal/outbox` items, and mark the row ready only after the video
   finishes or after a 120 s timeout (then send without video). If the GPU is offline, send voice + portrait as today.
2. **iMessage agent:** send the video as an attachment (convert with ffmpeg-static if needed; iMessage-friendly H.264 mp4)
   BEFORE the audio. If the video is sent, skip the separate portrait image. Keep per-item progress so retries don't resend
   parts already delivered.
3. **Web:** the Villager-gram send flow shows "Rendering video…" status and a preview player once ready (poll the gram status).
4. **Docs:** api.md; pytest (video path, timeout fallback, GPU offline), agent unit tests (video attach order, retry
   progress). Final report per AGENTS.md.
