# Village v4 launch film — TRAILER-004

**Current delivery:** [TRAILER-005.md](TRAILER-005.md) documents the new 2:48 and
exactly 1:30 cuts, with the retained 39-second square edit. The player now opens
those films. The report below preserves the provenance of the original v4 sources.

V4 is a 94-second main film and a 39-second square edit. The current `index.html`
player presents the later long/short cuts and retained square; open the original
`village-trailer-v4.mp4` separately to watch the 94-second master.
The MP4s and private source media are ignored; transfer them separately from git.

## Deliverables

- `village-trailer-v4.mp4`: 1920 × 1080, 60 fps, 94 seconds.
- `village-trailer-v4-discord.mp4`: same edit, under 24,000,000 bytes.
- `village-trailer-v4-square.mp4`: 1080 × 1080, 60 fps, 39 seconds, under 24,000,000 bytes.
- `village-trailer-v4-poster.png`: committed end card, no personal portrait.
- `frames/village-trailer-v4-sections.png` and square counterpart: encoded-frame contact sheets.
- `verification.json`: actual dimensions, durations, frame counts, sizes, hashes and full decoding results.

## Edit and evidence

| Main | Beat | Evidence |
| --- | --- | --- |
| 0–6 | Quiet group chat → Village | Title animation and existing production village capture |
| 6–32 | Photo → mask → traits → villager → LAM → original voice → clone | Consented Iraj assets; actual SAM mask; actual avatar palette; fresh big-head orbit; six seconds of original memo; cached ElevenLabs gram |
| 32–39 | Shared goals and collective XP | Production check-in, goals, refreshed challenge cards and Village growth panel |
| 39–47 | Unlock the town together | `/lab#futures`, levels 1–5 and building celebrations; Pet Shelter unlocks at level 4 |
| 47–54 | Save it together | `/lab#disasters`: outbreak closes Shelter, four local check-in increments fill the repair bar, repair celebration |
| 54–61 | Pets and synchronized walking | Production Shelter and pet preview; two clients on a disposable API, fixture pet equipped by scratch seed |
| 61–67 | Generated object → mesh → room | Cached Hunyuan3D plant, textured/wireframe turntable, placement in the real house component on scratch data |
| 67–73 | House and Community Hall design | Two browsers; saved edits propagated through the actual house API and WebSocket transport |
| 73–81 | Gemini Mayor and real iMessage content | Fresh frosted Mayor capture; actual delivered Iraj gram in a labelled reconstructed iMessage frame |
| 81–90 | Persistent, lived-in world | Demo Lab routines, friends, shop/clothing, farm, reading, weekly review, Solana competition and Gazette |
| 90–94 | Village / connected stack / URL | End card |

The square cut compresses these beats. The main original-voice passage is 21–27 s,
followed by the cached clone at 27–32 s. No new voice, image or GPU generation runs.
Music is the existing sample-free CC0 score, looped with voice ducking.

## Capture boundaries and honest labels

Production uses `https://thefriendshipvillage.vodka`, the owner demo seat, and only
GET/HEAD/OPTIONS. The capture router blocks every mutation, all production WebSockets,
and presence streams. It also blocks automatic scene-voice requests. Other people's
personal portraits/head references and contact fields are sanitized. Iraj is the only
real face/voice shown, under D-041. Production control screens are previews; no purchase,
adoption, check-in, send, upload or debug action is submitted.

The Demo Lab's independent in-memory client performs the unlock and repair actions.
These shots say **Demo Lab / local simulation**. No disaster hits the live village.
The production world lighting used for old establishing shots is a browser-only choice.

Walking and saved furniture edits run through `remote_run.sh --with-api`. The wrapper
creates and removes a disposable `run_*` database. `seed-scratch.py` checks this prefix
before installing a fixture dog and the existing generated plant. Only loopback application traffic and specific public font GETs are allowed; all
external mutations remain blocked. The TigerData caption describes
the production architecture; the capture itself is explicitly scratch Postgres.

`v4-assets.py` reads the supplied env file at runtime, never copies credentials, and
uses a database-enforced read-only transaction. The available sent outbox contained
Iraj's existing video gram, not a new Mayor-written message. The film uses its actual
text and cached clip. The phone frame is reconstructed and labelled; no owner phone
recording was supplied. If `input/imessage-*.mp4` or `.png` is later supplied, the helper
prefers it automatically. Private message JSON remains ignored.

No generated object was installed in the live catalog at capture time. The film
therefore reuses `data/assets/items/cv006test/object_plant_v2/` from the existing source
checkout: real 3,000-face generated GLB, stylized reference and manifest. Its placement
is labelled scratch home; the film does not claim a live purchase or live generation.

The LAM shot is cropped from its native 864 × 864 big-head canvas and displayed at
800 px high in the main edit. There is no blurry digital enlargement. The Gaussian
source itself has soft edges, particularly around hair; no new inference was allowed.
The full 128-second software-rendered mouse orbit is retimed to six seconds.

## Reproduce

Use `AGENTS.md` and `docs/infra/REMOTE_RUNNER.md`. All heavy commands ran on the remote
runners. No root env file is uploaded. Set `VILLAGE_ENV_FILE` to the existing file;
Python accepts the supplied Git Bash `/c/...` path and normalizes it on Windows.

From the repository root, with the private v3 owner assets already available:

```sh
python apps/trailer/scripts/v4-assets.py
```

The existing source plant must be placed in ignored `apps/trailer/public/captures/`
as `plant.glb`, `plant.png` and `plant-source.json`. Preserve the existing owner
`photo.jpg`, `segmented.png`, `mask.png`, `memo.ogg`, `talk.mp4`, and v3 fallback footage.
These are private handoff assets, not files to commit.

From `apps/web`:

```sh
bash ../../ops/remote_run.sh node ../trailer/scripts/capture.mjs --only=colosseum,competition,mayor,head,growth,growth-unlock,disaster-repair,routines,hall,pets
bash ../../ops/remote_run.sh --with-api node ../trailer/scripts/scratch-capture.mjs
bash ../../ops/remote_run.sh node ../trailer/scripts/object-capture.mjs
```

Use separate `RUNNER_ARTIFACT_DIR` paths for concurrent runners. Otherwise their
artifact downloads can overwrite each other's audits. Merge production audits with
`merge-captures.py`, then stage the merged audit, stills and referenced raw recordings
under ignored `public/captures/raw-source/` for runner sync. Artifacts themselves are
excluded from upload. Successful scratch clips go into `public/captures/`.

From `apps/trailer`:

```sh
bash ../../ops/remote_run.sh python scripts/prepare-v4.py
bash ../../ops/remote_run.sh python scripts/prepare-media.py
bash ../../ops/remote_run.sh bun run check
bash ../../ops/remote_run.sh bun run stills
bash ../../ops/remote_run.sh python scripts/audit-v4.py
bash ../../ops/remote_run.sh bun run deliver
python scripts/contact_sheet.py
```

Extract `artifacts/fresh-captures.zip` into `public/captures/` after preparation and
before subsequent syncs. Copy final MP4s, poster and verification JSON to this folder;
copy encoded frame grabs/contact sheets into `frames/`. `bun run studio` previews both
compositions. The render helper fails on missing required v4 clips.
Alternatively, from the repository root, run
`python apps/trailer/scripts/package-v4.py PATH/TO/DOWNLOADED/apps/trailer/artifacts`.
This copies all three verified files, compares transfer hashes, and builds both
encoded-frame contact sheets in the handoff folder.

## Credits

- Village UI, models and existing CV output: underlying project asset licenses apply.
- Original music: `apps/trailer/public/audio/LICENSE.txt`, CC0 1.0; no external samples.
- Manrope and DM Sans: bundled SIL Open Font Licenses in `public/fonts/`.
- Remotion 4.0.534: its own license applies.
- iMessage frame: repository-authored reconstruction, using actual delivered content.

## Validation record

Branch: `media/TRAILER-004`. First milestone: `7ed2446` (v4 edit/capture workflows).
Final export measurements and review results are appended after verification.
No contract changes are proposed.

Recovery notes: the initial v4 asset helper used obsolete `avatar_jobs.output`; it
was corrected to `result` (failed command exit 1, retry exit 0). A production capture
hit a demo-seat dialog; explicit dismissal fixed the refresh. One runner SSH reset
returned exit 255 and left the worktree lock open; the orphaned lock holder for this
worktree was identified and released, then remote work resumed. No local heavy fallback.
Early scratch retries exposed rapid-click assumptions, movement focus/collision issues,
and a blank visitor canvas. The latter was a capture-router restriction on Troika's
public fallback font, resolved with a narrow font GET allowlist. Both room canvases
render in the successful final capture. Earlier attempts remain separate from
successful footage; they are not counted as passing tests.

Completed checks before export:

- `python apps/trailer/scripts/v4-assets.py`: exit 0; three sent messages read,
  no generated objects installed in the live catalog, zero writes/generation.
- Remote `node ../trailer/scripts/capture.mjs --only=colosseum,competition,pets`:
  exit 0. Both competition shots checked all 16 rendered animation frames; zero
  visible placeholder labels. The video recorder duplicates these low-rate software
  frames; this is a per-render-frame check, not an OCR claim.
- Remote `--with-api node ../trailer/scripts/scratch-capture.mjs`: exit 0;
  synchronized movement assertion passed, saved sofa movement propagated, plant
  placed in owner room, Hall placement propagated. Final font-enabled room refresh:
  `--with-api node ../trailer/scripts/scratch-capture.mjs --rooms-only`, exit 0.
- Remote `node ../trailer/scripts/object-capture.mjs`: exit 0; actual cached GLB
  turns and switches between textured and wireframe materials.
- Remote `python scripts/prepare-v4.py`, `python scripts/prepare-media.py`: exit 0.
- Remote `bun run check`: exit 0. Remote `bun run stills`: exit 0; main and square
  layouts and six pipeline stages reviewed. Later layout fixes are checked again
  from the final encoded frames.
- Remote `python scripts/audit-v4.py`: exit 0. Original memo is 57.42 s, of which
  6 s is used in the main edit. Head crop is 6 s, cached clone 3.901 s; the last clone
  frame holds briefly at the end of its five-second slot. Sent message matches
  the outbox, action clips cover their complete actions, zero production mutations.
- Python AST parsing for every trailer helper: exit 0. `git diff --check`: exit 0.
- Remote `node scripts/render.mjs pipeline`: exit 0; targeted seven-stage review
  in both formats, including the animated real-color traits swatches.

The final scratch captures use renderer background-throttling overrides and explicit
foreground focus so both clients render, rather than relying on headless tab focus.
Generated-object placement uses the owner view; the two-window claims are the walking,
sofa move and Hall placement, each with assertions against the other client.

Final layout recovery: `bun run deliver` completed the main render, then was
intentionally stopped during square rendering (exit 143) after review found the
iMessage disclosure clipped inside the square phone. Only the square video area
was shortened; the main composition is unchanged. The corrected square is rendered
separately on the second runner. `finish-v4.py --encode-only` creates the Discord
copy from the completed master; `--verify-only` installs the corrected square and
runs full verification of all three files. This avoids rerendering the good master.

## Final delivery validation

| Export | Resolution | Duration (container) | Bytes | Full decode |
| --- | --- | --- | --- | --- |
| Main | 1920 × 1080 | 94.016 s | 50,244,508 | Passed |
| Discord | 1920 × 1080 | 94.016 s | 15,483,262 | Passed |
| Square | 1080 × 1080 | 39.019 s | 14,986,409 | Passed |

All exports are H.264 with AAC audio at 60 fps. Main/Discord contain 5,640 video
frames; square contains 2,340. The small container tails are AAC padding. Both
share copies are below the 24,000,000-byte limit. `verification.json` records the
SHA-256 hashes, pixel formats, and exact metadata.

- Final remote `bun run check`: exit 0.
- Remote `node scripts/render.mjs square`: exit 0; corrected square export.
- Remote `python scripts/finish-v4.py --encode-only`: exit 0; Discord encode.
- Remote `python scripts/finish-v4.py --verify-only`: exit 0; ffprobe checks and
  complete FFmpeg decoding of all three final files.
- Local `python apps/trailer/scripts/package-v4.py apps/trailer/artifacts/verified/apps/trailer/artifacts`:
  exit 0; source/destination hashes match, poster and contact sheets packaged.
- Visually reviewed final encoded main and square section sheets and detailed
  Mayor, walking, mesh, placement, unlock and repair frames. The square phone's
  reconstruction disclosure is fully visible.

Open `docs/devpost/video/index.html` locally to try the delivered films. On another
checkout, transfer the three ignored MP4s and `frames/` alongside the committed
player and poster. No remaining delivery blockers or proposed contract changes.

## Changed sources

- `apps/trailer/src/{index,v4,pipeline,trailer}.tsx`: composition registration,
  94/39-second timelines, seven-stage pipeline, real-message frame and shared type.
- `scripts/{capture,scratch-capture,object-capture}.mjs`: production read-only,
  isolated multiplayer/room actions, and the existing generated object's turntable.
- `scripts/{v4-assets,seed-scratch,prepare-v4,prepare-media}.py`: provenance,
  guarded scratch fixtures, complete-action retiming, native crop and waveform.
- `scripts/render.mjs`, `scripts/{verify,audit-v4,finish-v4,package-v4,contact_sheet}.py`:
  rendering, source/output checks, split-runner finishing, hash-checked packaging,
  and encoded contact sheets.
- This guide, `index.html`, and `village-trailer-v4-poster.png`: teammate handoff.

All edits stay within the task's allowed paths. No production app or contract is changed.
