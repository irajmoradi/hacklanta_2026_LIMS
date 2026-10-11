# Village SFX pack — SFX-001

18 cozy, humorous virtual-pet game sounds, generated with ElevenLabs on the owner's account.
Delivery: `apps/web/public/sfx/`, with matching MP3 and OGG files plus `manifest.json`.
No application code or contracts changed. The pack is static and requires no API key, GPU,
or paid call during playback. Exactly **18 of 18 authorized API calls** were made successfully;
`calls.jsonl` records each request, prompt, requested duration, result, and reported character cost.
There were no retries or regeneration calls.

## Try it

Open `assets/sfx/audition.mp3` in an audio player. It plays the manifest order, with 0.6-second
gaps and the suggested volume of each sound. Each ambience repeats twice to expose the seam.
`audition.json` lists start times. Individual files can also be opened directly in a browser/player.
With the existing web app running, fetch `/sfx/manifest.json` and load `/sfx/<name>.mp3` or
`/sfx/<name>.ogg`. Example in a browser console after a user gesture:

```js
const pack = await fetch('/sfx/manifest.json').then(r => r.json());
const item = pack.find(s => s.name === 'checkin_pop');
const sound = new Audio(item.file);
sound.volume = item.volume;
sound.loop = item.loop;
await sound.play();
// sound.pause(); // stop a loop
```

The manifest is an array with exactly `name`, `file`, `duration_ms`, `loop`, `volume`,
and `description`. `file` is an absolute web path to the MP3. Replace `.mp3` with `.ogg`
for the companion Vorbis file. `duration_ms` measures decoded audio, excluding codec padding.
For consistently gapless ambience, decode the OGG with Web Audio and use a looping
`AudioBufferSourceNode`; HTML media-element loop timing can vary by browser. Suggested volumes
are playback gain scalars, not additional normalization instructions. Avoid stacking repeated
notifications, and lower or pause ambience when the Mayor speaks.

## Prompts and choices

Every request uses `eleven_text_to_sound_v2`, `prompt_influence: 0.65`, MP3 44.1 kHz / 128 kbps,
and an explicit duration. Only the final two entries set `loop: true`. Both ambiences request
5 seconds; one-shot requests range from 0.5 to 2.2 seconds. These choices respect the current
[ElevenLabs sound-effects API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert),
whose minimum requested duration is 0.5 seconds.

Shared prompt prefix:

> Cozy cute virtual-pet village game sound effect; warm rounded toy-like timbre, playful gentle humor, clean close sound, no harsh transients, no music bed, no intelligible speech.

Append the following text verbatim. Machine-readable definitions are in `pack.json`; the exact
full request text is also preserved in `calls.jsonl`.

| Name | Requested seconds | Prompt suffix |
| --- | ---: | --- |
| checkin_pop | 0.7 | One plump bubble pop with a tiny upward wooden-plink sparkle. |
| xp_ding | 0.8 | One tiny bright toy glockenspiel ding with a soft sparkling tail. |
| level_up_fanfare | 2.2 | Three ascending toy trumpet notes ending in a triumphant squeaky kazoo flourish. |
| coin_purchase | 0.9 | One small gold coin clinks into a ceramic piggy bank followed by a tiny register ding. |
| equip_swoosh | 0.7 | A short airy cloth swoosh ending with a satisfying soft wooden click. |
| crown_ceremony | 2.2 | A miniature regal toy trumpet flourish followed by three twinkly ascending bell notes, slightly pompous and funny. |
| mayor_gong | 1.5 | One gentle small brass desk gong with a warm round bloom and a short decay, ending quietly to make space for speech. |
| prayer_chime | 1.7 | Two delicate glass wind chimes with a peaceful airy shimmer and gentle short decay. |
| event_drumroll | 2.0 | A tiny toy snare drumroll building quickly into one soft comic rimshot. |
| evidence_stamp_ok | 0.8 | One chunky rubber stamp thump on paper immediately followed by a cheerful two-note electronic approval chirp. |
| evidence_buzzer_sus | 1.0 | One funny questioning rubber duck honk with a downward then upward nasal pitch wobble, skeptical but friendly, never alarming. |
| pet_bark_happy | 0.9 | Two happy tiny cartoon puppy yips, bouncy and soft, with a faint collar jingle. |
| building_unlock_tada | 2.0 | A satisfying wooden block pop followed by a playful ascending toy xylophone ta-da flourish, purely instrumental. |
| crater_boom_cartoon | 1.7 | One muffled cartoon poof-boom with a rubbery bass bounce and tiny falling pebble ticks, comic and gentle, no realistic explosion. |
| poke_boing | 0.8 | One short rubber spring boing with a silly descending pitch wobble. |
| message_blip | 0.5 | Two very short rounded electronic toy blips stepping upward, a gentle friendly notification. |
| night_crickets_loop | 5.0 | Seamlessly looping quiet summer-night crickets, tiny rhythmic chirps over a very soft warm breeze, steady texture throughout, no foreground events, no fade in or fade out. |
| festival_crowd_loop | 5.0 | Seamlessly looping small cheerful cartoon village festival crowd, soft indistinct happy murmurs and scattered gentle chuckles with distant tiny bell jingles, no intelligible words, no music, steady texture throughout, no fade in or fade out. |

## Offline processing and verification

`process.py` uses FFmpeg to decode, NumPy to process, FFmpeg to encode, and ffprobe to verify
container duration and codec. It removes DC offset and trims one-shot edge silence below a
relative -45 dB amplitude threshold, retains 8 ms margins, and applies 5 ms edge fades.
The shared normalization target is **-20 dBFS RMS**, constrained by a **-3 dBFS sample-peak ceiling**
before lossy encoding. This is RMS normalization, not a claim of equal integrated LUFS. High-crest
transients may stay below the RMS target to preserve their shape. All output is mono 44.1 kHz;
MP3 is 128 kbps and OGG uses Vorbis quality 5. Original generated MP3s stay in ignored `raw/`.

Ambiences have a 120 ms tail/head crossfade with no fade to silence, producing approximately
4.88-second loops. This deliberately shortens the original 5-second material. `processing.json`
records sample counts, applied gain, and whether each clip was peak constrained.

`qa.json` records all 36 files: ffprobe duration, decoded duration, decoded sample peak, RMS,
size, SHA-256, codec, and loop-boundary measurements. Peaks and RMS are calculated from FFmpeg's
decoded samples; ffprobe alone does not measure waveform peaks. Verification also checks exact
manifest keys, all requested names, the 18-call cap, successful requests, playback volumes,
cross-format waveform correlation, and loop-boundary jumps relative to nearby sample changes.

The first processing check caught Vorbis decoder output extending past the declared end granule.
The verifier now honors that exact container end: it permits at most one extra codec block,
requires any discarded tail to be below -45 dBFS, and records the sample difference. Some
Vorbis files instead decode 128 samples (2.9 ms) shorter because of codec priming; those remain
within the 15 ms manifest tolerance. Both loop files decode to their exact 4,880 ms duration.

Final signal self-check: all **36/36 files pass**, with one-shots spanning **413–2,200 ms**,
both loops **4,880 ms**, maximum decoded sample peak **-2.879 dBFS**, and RMS levels
**-26.151 to -19.934 dBFS**. The quieter exceptions are deliberately peak-constrained transients.
The largest loop-boundary step is 0.280 times the signal's 99th-percentile adjacent-sample step.
The 36 playback files total **819,917 bytes**. Complete per-file durations and peaks are in `qa.json`.

Prerequisites: Python with `numpy` (processing) and `python-dotenv` (generation only), plus
`ffmpeg` and `ffprobe` on PATH or beneath ignored `assets/sfx/.tools/`. Run from the repository root:

```powershell
python assets/sfx/generate.py                         # dry run, no paid requests
python -m py_compile assets/sfx/generate.py assets/sfx/process.py
python assets/sfx/process.py --verify-only            # verify committed delivery, no raw files needed
python assets/sfx/process.py                          # rebuild from local ignored raw files
git diff --check
```

Generation was explicitly authorized by SFX-001. `generate.py --generate` reads the key at runtime
from `ELEVENLABS_API_KEY` or the dotenv file named by `VILLAGE_ENV_FILE`. It never prints the key,
copies the dotenv file, or logs API response bodies. A reserved request counts against the cap
even if its outcome is unknown. The exclusive lock prevents concurrent generation. Existing
names are never requested again, and this pack has no remaining call budget. Preserve the
ledger; deleting it would defeat the lifetime accounting. Tool downloads and raw source files
are ignored and are not delivery dependencies.

## Listening self-check and license note

The reproducible signal checks and audition sequence are provided, but this agent session has
no audio-listening tool. **Subjective listening was not performed**: prompt fidelity, humor,
and whether the crowd contains unintended syllables remain for a human listening pass.
Listen especially for a questioning honk on `evidence_buzzer_sus`, room for speech after
`mayor_gong`, and clicks or rhythmic stutters halfway through each doubled ambience in
`audition.mp3`. Do not interpret numerical seam checks as proof of perceptual seamlessness.

License/provenance: generated with ElevenLabs on the owner's account, using text prompts only;
no uploaded voice, photo, voice clone, or third-party recording was supplied. Use remains subject
to the owner's ElevenLabs subscription and applicable terms. No separate public-domain or
blanket redistribution license is asserted here.

No UI was changed, so a UI screenshot is not applicable. No contract changes are proposed.
