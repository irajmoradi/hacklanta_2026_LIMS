---
id: FEAT-024
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-024
allowed_paths: [apps/api/**, apps/web/src/**, apps/web/tests/**, packages/contracts/api.md]
---
# FEAT-024 — Avatar barks: random voice lines when avatars do things (R-144, owner)

Owner: "for all cloned voices, I want a set of voice lines that randomly play when someone's avatar does stuff."
1. **Line bank:** ~8 short, fun, PG-13 lines per trigger (profanity allowed per D-034, but no slurs or harassment) for:
   start walking, wave, cheer, dance spin, sit at the café, join an attraction (dance at the festival, ride the ferris
   wheel), check in, get cheered, and enter a house. Keep 2–6 words, in the app's plain voice; no AI-ish copy.
2. **Generation (paid; must be bounded):** only for members with **voice consent ON** and an existing ElevenLabs voice
   (reuse the existing voice adapter and consent checks). Build a one-time, idempotent batch job that synthesizes a
   **subset** (e.g. 3 lines × each trigger, ≈27 clips per consenting member), caching each clip by `(voice_id, line_id)`
   in the asset store, so it never regenerates. It must respect SEC-001's ElevenLabs daily cap; generate only what fits,
   resume the rest on later runs, and report the count. Add a `scripts/generate_barks.py --village <id> --max N` CLI.
   Never trigger generation from page loads or ticks.
3. **Playback:** when an avatar does a trigger action (own or others', from FEAT-021 movement events and the existing
   emote/attraction/seat events), play a random cached clip for that person with: a per-avatar cooldown (≥ 20 s); a global
   limit (at most 1 bark per 4 s); positional attenuation by camera distance (no sound if far or off-screen);
   respecting the mute/sound setting and reduced-motion; never more than one at a time. If a person has no clips, stay silent
   (no TTS fallback at runtime).
4. Settings: a "Voice barks" toggle (default on), per user.
Tests: API (consent gating, cap respect, idempotent cache keys, never regenerates); web unit tests (cooldowns, the global
limiter, mute); mock mode only. Do NOT run the generation script against production. The integrator runs it once with a
small `--max`. Final report per AGENTS.md, with the exact command for the integrator and the expected credit cost.
