# Talking-head video for Villager-grams: worker contract

`POST http://localhost:8100/avatar/talk_video[?wait=true]` (GPU worker, internal only; the API calls it, never the browser).

Request (JSON):
```jsonc
{ "user_id": "13370000-0000-4000-8000-000000000001",   // REQUIRED. Must have a LAM head (avatars/<uid>/face_512.png)
  "audio_path": "villages/<vid>/grams/<id>.mp3",       // EITHER a key relative to data/assets (preferred), or an absolute
                                                        //   path under the data dir (WSL /mnt/c/... or C:\...\data\...)
  "audio_url": "/api/assets/villages/<vid>/grams/<id>.mp3", // OR an /api/assets/<key>, /files/<key> or http(s) URL
  "max_seconds": 15,                                    // optional, default 15, clamped to 1..15
  "force": false }                                      // optional: re-render even if a fresh .mp4 already exists
```
Behavior: the worker decodes the audio and trims it to `max_seconds`. It then runs Audio2Expression (ARKit-52 at 30 fps), resampled to 25 fps. Those frames
drive the user's **LAM Gaussian head** offline on the GPU: FLAME geometry with LAM's ARKit blendshape basis, plus a gentle head sway. Frames
are composited onto a soft village-green background and encoded as **MP4: H.264 (yuv420p, `+faststart`) + AAC 128k, 512×512, 25 fps, ≤15 s**.
The video is saved **next to the audio** with the same stem: `…/grams/<id>.mp4` (for URLs, under the same asset key with `.mp4`).

Response, without `wait`: `{ "job_id": "…", "status": "queued" }`. Poll `GET /jobs/{job_id}`; it shares the serial GPU queue with the other stages.
Response with `?wait=true` (or `result` of the finished job):
```jsonc
{ "video_path": "/mnt/c/Users/mourn/Downloads/hacklanta/data/assets/villages/<vid>/grams/<id>.mp4", // absolute, worker (WSL) view
  "video_key":  "villages/<vid>/grams/<id>.mp4",       // key relative to data/assets -> API serves it as /api/assets/<video_key>
  "video_url":  "/files/villages/<vid>/grams/<id>.mp4", // worker static URL (debugging)
  "seconds": 2.9, "frames": 73, "fps": 25, "size": [512, 512], "bytes": 123456,
  "timing_s": { "expr": 1.2, "lam_prep": 12.3, "render": 3.4, "encode": 0.8, "total": 18.0 } }
```
Errors (job `status: "failed"`, `error` string; with `wait` the HTTP status is still 200 and the job object is returned):
- `no LAM face for this user (run /segment + /avatar/head first)`
- `audio not found` / `could not decode audio`: the audio must live under the data dir, or be an /api/assets or /files URL that maps to it
- `400` for a bad `user_id` (`^[A-Za-z0-9_-]{1,64}$`)

Notes for the API/iMessage side:
- If an `.mp4` with the same stem already exists and is newer than the audio, it's returned immediately (`cached: true`), at no GPU cost.
- Typical warm time is a few seconds per clip, plus ~10–15 s per user for the first video (FLAME tracking is then cached per user in
  `avatars/<uid>/head/talk_prep.pt`). Cold model loads add more. Don't block an HTTP request on it; use the job or a background task.
- iMessage: send the `.mp4` as an attachment. It's H.264/AAC with faststart, so it plays inline on iPhone.
- No paid APIs are involved; everything runs locally on the GPU.

## Measured (RTX 5090, 2026-10-10): Iraj, villagergram `96b101d9-….mp3` (2.18 s of speech)
- Output: `data/assets/villages/13370000-…0000/grams/96b101d9-46b3-41c1-a54d-bc83ed759f2a.mp4`, copied to `data/demo/iraj_gram_video.mp4`.
  H.264 yuv420p 512×512 25 fps, 55 frames, plus AAC 44.1 kHz. **112 KB**.
- Warm: LAM render **1.8 s** for 55 frames (3.3 s for the whole LAM step), and Audio2Expression ~4 s once loaded.
  By default A2E is unloaded after each video so only one model process is alive (RAM ~70–80%). It then cold-loads each time (~15–17 s).
  **Job total ~20 s**. With `TALK_KEEP_EXPR=1` in the worker env, A2E stays resident and the job takes ~6–8 s.
- First video after a worker restart: ~35–50 s (LAM load, plus a one-time ARKit basis build ~6 s). First video for a new user: +10–15 s of FLAME
  tracking, cached in `avatars/<uid>/head/talk_prep.pt`. Peak VRAM **4.2 GB**. A repeat request returns the cached mp4 instantly (`cached: true`).
- Quality: the lips follow Audio2Expression (ARKit jawOpen, mouth* and so on, through LAM's FLAME-ARKit basis). The head sways gently around an upright pose.
  Background: cream to sage gradient with a soft halo. Teeth come from the LAM Gaussians (no separate teeth mesh), so wide-open vowels look slightly soft.
