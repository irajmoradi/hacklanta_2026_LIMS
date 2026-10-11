# TRAILER-006 — faster short cut

Delivered on branch `media/TRAILER-004`; renderer milestone `502022b`.
Only the short cut is replaced. The long and square movies retain their existing bytes.

| Export | Duration | Resolution | Size |
| --- | ---: | --- | ---: |
| `village-trailer-v4-90.mp4` | 82.233333 s | 1920 × 1080, 30 fps | 8,382,049 bytes |
| `village-trailer-v4-90-discord.mp4` | 82.233333 s | 1920 × 1080, 30 fps | 8,382,049 bytes |

Both have 2,467 H.264 frames and AAC audio. The master fits the 24 MB limit,
so its Discord copy is byte-identical. SHA-256 and full-decode results are in
`verification-short.json`, the authoritative verification for this revision.
The older `verification-cuts.json` and `frame-text-audit.json` describe TRAILER-005;
their short-cut hashes and 90-second timing are historical, not this revision.

## Edit choices

- A 2.5-second opening card reads **WEEKLY CHALLENGES AND DAILY CHECK-INS WITH FRIENDS**
  in centered bold 112 px Manrope, using the existing forest/cream/lime palette.
  The original animated hook follows it.
- Visual beats are shortened approximately 12.5%, rounded to whole frames.
  The original six-second memo and four-second voice clone retain natural speed.
  Total footage is 79.733333 seconds, plus the title. Original music is remixed
  with the existing voice assets and ducked beneath speech.
- Captions are 56 px DM Sans (1.75× the previous 32 px), with a solid dark band
  below the footage panels. Layout measures each caption, allowing at most two
  lines and 72 px side margins. Existing captions embedded in the master are covered.
  The pipeline and iMessage captions are restated, preserving reconstruction provenance.
- Only existing v4 footage, cached voice, local fonts and original music are used.
  No captures, generation, API calls, secrets, or live-village changes were needed.

## Reproduce and validation

The ignored private TRAILER-005 master at
`apps/trailer/artifacts/cuts-v4/village-trailer-v4-90.mp4`, its
`work/music-phrase.wav`, and the existing `public/captures/{memo.ogg,talk.mp4}`
are required. Keep that original 90-second master as the source; the new export
is written separately under `artifacts/short-v4/`.

Commands actually run, with results:

- From `apps/trailer`: `bash ../../ops/remote_run.sh uv run --with pillow python scripts/short-v4.py render`
  — exit **0**. Renders, checks dimensions/frame count/duration/audio/upload size,
  fully decodes both files with `ffmpeg -xerror`, and makes a 36-shot contact sheet.
- Local Python import/layout check invoking `timeline()` and `wrapped()` for all
  36 beats — exit **0**, 82.233333 seconds and all caption widths pass.
- From repository root: `python apps/trailer/scripts/short-v4.py package` — exit **0**;
  verified SHA-256 before and after copying both deliverables.
- `git diff --check` — exit **0**.

One initial inline PowerShell/Python layout-check command failed with a quoting
SyntaxError (exit 1); the corrected literal here-string check above passed.
No rendering or decoding failures occurred. Optional new OCR was skipped for
the urgent edit. Visual QA reviewed the complete encoded-shot contact sheet,
the full-size caption overlay and an encoded caption frame.

## Handoff

Open `docs/devpost/video/index.html` and select **The short story · 1:22**, or open
either named MP4 directly. The screenshot/contact sheet is
`docs/devpost/video/frames/contact-sheet-v4-90.jpg`.
On another checkout, transfer both ignored MP4s and that contact sheet.

Source changes: `apps/trailer/scripts/short-v4.py`, player `index.html`,
`timeline-90.json`, `verification-short.json`, and this report. Generated videos,
private frames and the contact sheet remain ignored and uncommitted.
No blockers or proposed contract changes.
