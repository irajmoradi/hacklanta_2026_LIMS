---
id: AUDIO-002
owner: codex (gpt-6-astra, medium)
branch: audio/AUDIO-002 (small; parallel)
allowed_paths: [apps/web/public/sfx/**, apps/web/src/sound/**, assets/audio/**, tools/sfx/**]
request: R-77 (Mario 17:55) "night ambience sounds like an empty lawn sprinkler, not crickets"
---
# AUDIO-002 — A night bed that actually sounds like night

AUDIO-001's `night_soft` reads as hissy, periodic white noise (sprinkler-like), not insects. Replace it:
- Generate with the ElevenLabs Sound Effects API (key from root .env via env, never copied), **cap 4 generations**, logged in
  assets/audio/AUDIO-002-log.md. Prompt toward: "quiet summer night in a small village, a few distinct crickets chirping slowly at
  different distances, soft distant frogs, very gentle warm breeze, no hiss, no white noise, calm and sparse, seamless loop". Pick the best
  take by listening metrics: low broadband noise floor (spectral flatness < 0.3), distinct chirp transients.
- If no take is good, build the bed procedurally in the engine instead: a quiet low-passed warm pad + individually scheduled cricket chirp
  one-shots (short 4–5 kHz pulses with natural variation in rate/pitch/pan) + an occasional owl one-shot from AUDIO-001. That avoids
  hiss entirely.
- Level: night bed at -22 LUFS, noticeably quieter than day. Fade in over 4 s at dusk.
Deliver a 20 s webm/ogg A/B (old vs new) in assets/audio. Engine tests green. Final report with the generation count.
