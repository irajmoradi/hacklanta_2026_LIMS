---
id: AUDIO-001
owner: codex (gpt-6-astra, medium)
branch: audio/AUDIO-001 (parallel)
allowed_paths: [apps/web/public/sfx/**, apps/web/src/sound/**, apps/web/src/scene/**, assets/audio/**, tools/sfx/**]
request: R-67 (Iraj 17:11) "better ambient sounds, the cicadas suck"
---
# AUDIO-001 — Cozy ambient soundscape

Current ambience (public/sfx/manifest.json + src/sound/engine.ts) is a few flat loops; the cicada/cricket bed is harsh and constant.
1. **Generate new ambience** with the ElevenLabs Sound Effects API (owner-requested; key in root .env as ELEVENLABS_API_KEY,
   loaded via env, never copied). **Hard cap: 14 generations total**, logged with prompt + duration in
   `assets/audio/AUDIO-001-log.md`. Seamless loops (generate ~22 s with a loop prompt, then crossfade-trim with ffmpeg-static
   so the seam is inaudible): day_birds_breeze (soft songbirds, light wind in leaves; NO cicadas), village_life_distant (faint
   chatter, a far-off bicycle bell, gentle and low), fountain_trickle (near the plaza), creek_babble (near the creek/park),
   night_soft (quiet distant crickets at low density, an occasional owl, warm and calm; replaces the harsh cicadas), rain_soft,
   wind_gust_light, arena_crowd_murmur (warm, not roaring), market_bustle_light (near the shops). Also 3 one-shots: bird_chirp_1/2,
   distant_dog. Export ogg + mp3 at -18 LUFS (loops) / -14 LUFS (one-shots), 96 kbps mono for beds.
2. **Engine:** a layered, spatial ambience mixer. A global bed by time of day/weather (day/night/rain, 3 s crossfades) plus
   positional emitters attached to scene objects (fountain, creek, shops, colosseum) using Web Audio PannerNode with distance
   falloff relative to the camera target, so zooming into the plaza brings up the fountain. Random one-shot birds every 8–25 s
   during the day. Master ambience at about 35% by default, under UI SFX; respect the sound toggle, volume slider, reduced sound;
   pause when the tab is hidden; nothing autoplays before interaction.
3. Remove or replace the old cicada/cricket loop. Update the manifest.
Tests: engine unit tests (crossfades, emitter gain vs distance, toggle), a short recorded A/B (webm with audio) of day → night →
plaza zoom. Final report per AGENTS.md, with exact generation count/cost.
