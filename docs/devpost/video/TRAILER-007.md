# TRAILER-007 — Gemini chibi and goals, short cut only

Branch: `media/TRAILER-004`. Renderer milestone: `8fdc7bc`.

The 82.233333-second short cut now shows Iraj's consented real photo beside
his supplied Gemini chibi, with an arrow and `GEMINI IMAGE · STYLIZE` chip.
The insert runs 9.566667–12.066667 seconds, immediately after SAM 3 / traits.
Its caption is “Gemini turns your photo into your villager's chibi face.”
The existing villager shot follows with “Hunyuan3D turns it into a 3D head.”

The existing goals/stretch-goal capture runs 29.433333–32.066667 seconds with
“Set a weekly goal. Check in daily. Stretch it when you're done.” The stack
slide is rebuilt with centered rows, adds Gemini Image, and omits Auth0.

Timing choices: recover the 75-frame insert by trimming 15 frames each from
the splat, generated-object and end-card holds, and 30 from the unlock beat.
The end card holds exactly two seconds. All caption beats last at least 1.2
seconds; captions fit within two 56 px lines and 72 px side margins. Speech
retains its original speed. Existing cuts are retained; optional transition
effects were skipped for the urgent turnaround.

No new captures, generation, credentials, live-village calls or transactions
were needed. `public/private/` and the supplied `input/` images are ignored.
Only sources, timeline and verification metadata are committed; portraits,
rendered frames, contact sheets and movies remain uncommitted.

## Reproduce

Retain the original 90-second TRAILER-005 master at
`apps/trailer/artifacts/cuts-v4/village-trailer-v4-90.mp4`, its
`work/music-phrase.wav`, and `public/captures/{memo.ogg,talk.mp4}`.
Copy the two supplied `docs/devpost/video/input/iraj-*.png` images into
`apps/trailer/public/private/`. These private render assets must be present
on the trusted runner; do not commit them.

From `apps/trailer`:

```sh
bash ../../ops/remote_run.sh uv run --with pillow python scripts/short-v4.py render
```

From the repository root:

```sh
python apps/trailer/scripts/short-v4.py package
git diff --check
```

## Handoff

Both exports are **82.233333 seconds, 1920 × 1080 at 30 fps, 8,552,119 bytes**
each (8.55 MB). Each contains 2,467 H.264 frames plus AAC audio. The master
fits the 24,000,000-byte Discord limit, so the Discord copy is byte-identical.
Hashes and full-decode receipts are in `verification-short.json`.

Validation actually run:

- Remote render command above: exit **0**, including frame count, dimensions,
  duration, audio codec and size assertions; both movies fully decoded with
  `ffmpeg -xerror`. Remote render/sync took 70.90 seconds.
- Local import/layout check invoking `timeline()`, `wrapped()` for every
  caption, `chibi_card()` and the stack overlay: exit **0**, 37 beats / 2,467
  frames, all text widths pass.
- Local packaging command above: exit **0**, SHA-256 checked before and after
  copying both files into the delivery directory.
- Local Python metadata/hash checks: exit **0**; long, long-Discord and square
  exports retain their hashes, caption minimum is 1.2 seconds, end hold is two
  seconds, traits/chibi/villager order is correct, and short-cut text has no Auth0.
- `git check-ignore` for both private portrait copies and the input photo:
  exit **0**. `git diff --check`: exit **0**.
- Visual QA: inspected the new full-size chibi and stack cards, then every
  encoded-shot midpoint in the 37-shot contact sheet. No visible Auth0;
  new pipeline and goals copy are present, and the end card is clean.

An exploratory read of nonexistent `ops/runner/common.py` returned exit 1;
the actual runner configuration was read from `remote_run.py`. No render,
decode, packaging or validation failures occurred.

Open `docs/devpost/video/index.html` and select **The short story · 1:22**,
or open `village-trailer-v4-90.mp4` / `village-trailer-v4-90-discord.mp4`
in that directory. On another checkout, transfer the ignored exports too.
Screenshot/contact sheet: `docs/devpost/video/frames/contact-sheet-v4-90.jpg`.

Files changed: `apps/trailer/.gitignore`, `apps/trailer/scripts/short-v4.py`,
`docs/devpost/video/.gitignore`, `index.html`, `timeline-90.json`,
`verification-short.json`, and this report.

No blockers or proposed contract changes.
