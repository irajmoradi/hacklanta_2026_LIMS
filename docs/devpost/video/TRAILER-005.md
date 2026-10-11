# Village: the full story and the short story

Open [index.html](index.html) for the **2:48 Devpost film**, the **exactly 1:30 short
film**, and the retained **39-second square edit**. The new landscape exports are
1920 × 1080 at 30 fps; the square remains 1080 × 1080 at 60 fps. Each landscape
edit has a separate Discord copy with a hard 24,000,000-byte limit.

MP4s, contact sheets and personal source assets are gitignored. Transfer these
separately from git. The team uploads `village-trailer-v4-long.mp4` to the
Devpost submission video host and supplies that hosted URL in the submission.
No published video URL is recorded in this checkout; the live village URL is
the application, not a video publication link. Local player filenames are
`village-trailer-v4-long.mp4`, `village-trailer-v4-90.mp4` and
`village-trailer-v4-square.mp4`, with `-discord` copies for both landscape cuts.
The committed poster contains no personal portrait.

## Edit

The long film is a distinct edit, not a slowed-down copy of the short film. It
gives daily life, group progress, decorating, the Colosseum and the Mayor their
own shots. Both cuts follow the requested arc:

| Long | Short | Beat |
| --- | --- | --- |
| 0–7 | 0–4 | Quiet chat → a reason to show up |
| 7–33 | 4–23 | Photo → SAM 3 → traits → villager → large LAM orbit → original memo → ElevenLabs clone |
| 33–55 | 23–33 | Check-in cinematic, goals/stretch goals, friends/cheers, video Villager-grams |
| 55–77 | 33–44 | Challenges → collective XP → building unlock → pets |
| 77–89 | 44–50 | Disaster → Mayor repair mission → collective check-ins → repair reveal |
| 89–129 | 50–70 | Two-window walking, shop/try-on, Hunyuan3D mesh and placement, homes/Hall, persistent routines |
| 129–140 | 70–75 | Colosseum and illustrated devnet payout modes |
| 140–157 | 75–83 | Gemini Mayor → Gazette → real delivered content in an iMessage reconstruction |
| 157–168 | 83–90 | Stack → Village URL |

`timeline-long.json` and `timeline-90.json` record every shot boundary. Both use
**six seconds of Iraj's original recording at its original speed**, followed by
his cached ElevenLabs video. The original oscillator score is edited from an
intact 16-second musical phrase, ducked under the voices, and faded into the end
card. No paid generation was run.

The square keeps the previous shot order, pacing, audio and 39-second duration.
The small Lab FPS telemetry is covered and the two room inserts use the refreshed,
verified footage. The timing, surrounding captions and audio remain intact.

## Evidence and reasonable choices

- Reuse the existing consented v4 assets and captures; no new personal material.
- Re-capture Friends read-only: visual review found vertical `placeholder face`
  text in the older source. The refreshed production capture has initial badges;
  a requestAnimationFrame audit checks its placeholder labels throughout the shot.
- Crop the Lab sidebar and cover its FPS counter. Keep unlock/repair celebrations
  and progress intact. The film continues to label these as local simulations.
- Houses and Hall retain the scratch-Postgres disclosure alongside the TigerData
  architecture caption. Walking comes from the previously verified disposable
  village. House/Hall/placement footage is refreshed on a disposable API after
  frame review caught a visitor canvas that painted only at the final screenshot.
  The recorder now warms both windows before the action and holds both afterward;
  a per-frame canvas-variance check rejects blank house/Hall windows. Saving still
  caused a short WebGL reload: 14 house frames and 8 Hall frames were jump-cut
  from **both** windows together, retaining the real before/after states. No frame
  or movement was fabricated. All 61 retained house and 67 Hall frames pass.
- Payout modes are an **illustrated preview**, explicitly labelled: winner takes
  all, proportional, ranked split (60/30/10 example). The available branch/capture
  does not establish a completed transfer or the newer FEAT-027 implementation.
  No signature, transaction, settlement, or deployment is claimed or performed.
- The original iMessage frame is still honestly labelled as reconstructed from
  actual delivered outbox content. No phone recording was supplied.
- No secrets were needed for this edit or the protected Friends refresh. No env
  file was copied or uploaded. All production mutations and WebSockets remained
  blocked by the capture router.

See [TRAILER.md](TRAILER.md) for original capture provenance and asset/music credits.

## Reproduce

The existing private `apps/trailer/public/captures/` handoff is required, including
`v4-master-ready.mp4` (the verified 94-second v4 master), `v4-square-ready.mp4`,
Iraj's memo/talking clip and the individual captured shots. These files stay ignored.

From `apps/trailer`, with the configured runner:

```sh
bash ../../ops/remote_run.sh uv run --with pillow python scripts/cuts-v4.py render
bash ../../ops/remote_run.sh uv run --with pillow python scripts/cuts-v4.py verify
bash ../../ops/remote_run.sh python scripts/audit-cuts.py
bash ../../ops/remote_run.sh bun run check
```

The renderer caches completed shots in `artifacts/cuts-v4/work/`, keyed by source,
script, font and timing hashes. Changed inputs automatically invalidate their
cache; `render --refresh SHOT_KEY ...` also forces specific shots. Rendering
always remixes audio and creates both
Discord copies. A master already below 24 MB is copied without quality loss;
larger masters get a two-pass size-budgeted encode. OCR unpacks Ubuntu Tesseract dependencies into ignored
artifacts, without sudo or system installation.

From the repository root, after reviewing the encoded contact sheets:

```sh
python apps/trailer/scripts/package-cuts.py
```

Packaging requires successful full decode, dimension/duration/frame-count checks,
upload-size checks, zero OCR flags, and matching audit/export hashes. It checks
the copies' hashes too. `frames/contact-sheet-v4-{long,90,square}.jpg` are the three
contact sheets; each landscape sheet includes every editorial shot.

## Validation

OCR examines every encoded master frame at 960 × 540, reusing results only for
exact duplicate grayscale frames. It searches for known placeholder/error/debug
text; it does not prove the absence of arbitrary unintended words. Contact sheets
and targeted full-resolution frames receive a separate visual review.

No contract changes are proposed. No production app files were changed.

### Measured final exports

| File | Seconds | Resolution / fps | Bytes |
| --- | ---: | --- | ---: |
| `village-trailer-v4-long.mp4` | 168.000 | 1920 × 1080 / 30 | 12,672,030 |
| `village-trailer-v4-long-discord.mp4` | 168.000 | 1920 × 1080 / 30 | 12,672,030 |
| `village-trailer-v4-90.mp4` | 90.000 | 1920 × 1080 / 30 | 9,049,079 |
| `village-trailer-v4-90-discord.mp4` | 90.000 | 1920 × 1080 / 30 | 9,049,079 |
| `village-trailer-v4-square.mp4` | 39.000 | 1080 × 1080 / 60 | 5,354,424 |

The masters already fit Discord's requested budget, so the named Discord copies
are byte-identical to their masters. All five passed complete FFmpeg decoding,
frame-count, codec, pixel-format, dimensions, duration and size assertions.
There are 5,040 long, 2,700 short and 2,340 square frames.

Successful commands (remote commands use `bash ../../ops/remote_run.sh` from the
owning app directory; all listed exit **0**):

- `node ../trailer/scripts/capture.mjs --only=friends` from `apps/web`: refreshed
  Friends; 10 actual rendered animation frames checked, no placeholder labels,
  zero forwarded production mutations or WebSocket connections.
- `python scripts/prepare-clips.py friends`: trim the refreshed protected footage.
- `--with-api node ../trailer/scripts/scratch-capture.mjs --rooms-only` from
  `apps/web`: disposable database; real sofa movement and Hall placement propagate
  to the other client; existing generated object placed in the scratch home.
- `python scripts/prepare-room-cuts.py` and `... hall-decor`: synchronized jump cuts.
- `uv run --with pillow python scripts/verify-room-frames.py artifacts/house-sync-clean.mp4`
  and `... artifacts/hall-decor-clean.mp4`: all 61 / 67 frames retain both canvases.
- `python scripts/audit-v4.py`: consented memo, cached voice, delivered-message
  provenance and clean source captures verified; accepts cleaned room footage
  only with matching per-frame proof hashes. Zero production writes/generation.
- `bun run check`: TypeScript passes.
- `uv run --with pillow python scripts/cuts-v4.py render`: final export succeeds.
- `uv run --with pillow python scripts/cuts-v4.py verify`: all five final exports
  pass and all three encoded-frame contact sheets are generated.
- `python scripts/audit-cuts.py`: all **10,080 final frames** examined, zero known
  placeholder/error/debug flags. Results are tied to the final MP4 hashes in
  `frame-text-audit.json`; byte-identical Discord copies share the masters' audit.
- Local `python apps/trailer/scripts/package-cuts.py`: all five delivered files
  match their verified source hashes; contact sheets, poster and records copied.
- Local HTMLParser link check: all 16 `src`/`href`/`poster` references exist.
- Local `python apps/trailer/scripts/cuts-v4.py cards`: caption safe areas and
  both timeline totals pass. All Python helpers parse with `utf-8-sig` decoding;
  `git diff --check` passes.

Recovery notes: the first timeline assertion caught an 87-second short draft
(exit 1); it was corrected to 90 before rendering. The OCR dependency probe
initially lacked Pillow/Leptonica/GIF libraries; isolated runner dependencies and
dereferenced package symlinks fixed the probes. The first room frame checks
returned exit 1, correctly rejecting 14 house and 8 Hall loading frames; the
cleaned sources above pass. Intermediate exports were superseded by the final
files in the table, not delivered as final.

Visual QA: all final encoded editorial-shot sheets reviewed, including the
refreshed two-window room shots and square insert. The poster is portrait-free;
all new headings and captions fit their safe areas. Contact sheets:
`frames/contact-sheet-v4-long.jpg`, `frames/contact-sheet-v4-90.jpg`,
`frames/contact-sheet-v4-square.jpg`. These require the separate media handoff;
private imagery and MP4s remain ignored.

### Files and handoff

Branch: `media/TRAILER-004`. Milestones: `053f44f` (timelines), `be08a69` (audit and
handoff), `1d0ef28` (room capture/verification and all-cut cleanup).

- `apps/trailer/scripts/cuts-v4.py`: edits, caption layout, soundtrack, exports,
  deterministic shot cache, metadata checks and contact sheets.
- `scripts/{audit-cuts,verify-room-frames,prepare-room-cuts,package-cuts}.py`:
  per-frame QA, documented loading-frame cuts, and hash-checked packaging.
- `scripts/{capture,scratch-capture}.mjs`, `scripts/audit-v4.py`: clean Friends
  capture, warmed room recording, backwards-compatible source audit.
- `docs/devpost/video/`: this report, updated player and provenance guide,
  portrait-free poster, final measurement/audit JSON and shot timelines.

A teammate opens `docs/devpost/video/index.html`, chooses either landscape length
or the square, and uses the download links. On another checkout, transfer the
five ignored MP4s plus the three `frames/contact-sheet-v4-*.jpg` files. No delivery
blockers remain; the labelled payout preview limitation is described above.
