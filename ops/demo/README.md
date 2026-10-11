# DEMO-003 capture

Run from `apps/web` with the configured remote runner:

```bash
../../ops/remote_run.sh --with-api bash ../../ops/demo/run.sh --rehearse
../../ops/remote_run.sh --with-api bash ../../ops/demo/run.sh
../../ops/remote_run.sh python3 ../../ops/demo/verify.py ../../ops/demo/artifacts
```

Use `--all` in place of `--rehearse` to perform rehearsal, full capture and verification in one runner reservation. A normal full run also verifies automatically.

If encoding is interrupted after `full-capture.json` and its raw WebM are saved, re-export without repeating the browser walk:

```bash
../../ops/remote_run.sh python3 ../../ops/demo/export.py ../../ops/demo/artifacts
```

The wrapper creates, migrates and seeds its own `run_*` PostgreSQL database, starts a spare-port API with scheduling and voice disabled, and drops the database on exit. No secrets are required or forwarded. The capture checks the database name and loopback API before opening Chromium. Vite preview uses port 4175 and points to that API; `VITE_MOCK=1` keeps the interaction sequence entirely in the browser fixtures, as prescribed by the demo script. It does not demonstrate database-backed interaction persistence.

The production Vite build is written under `ops/demo/artifacts/build`. Playwright Chromium records a 1920×1080 viewport via `recordVideo`. A fresh context selects fixture Maya. Cursor and debug-menu launcher are hidden for capture. No application source is patched. All external browser requests and non-GET API requests are blocked and cause the run to fail; no sends, new media, model calls, or wallet actions are part of the script.

Rehearsal shortens pauses and saves diagnostics and a raw video. The recorder activates the actual UI buttons through DOM handlers and uses the outfit preview's keyboard rotation controls; it does not inject application records. To avoid software-renderer starvation, it selects the existing low-core quality path and spaces animation-frame requests by 33 ms. This is capture configuration, not a frame-rate benchmark. Screenshots are extracted after recording rather than blocking the timed sequence.

The full capture first preloads the profile, outfit preview, Colosseum, check-in form and weekly review without submitting anything. It records real-time actions and deliberate pauses, followed by 20 seconds of post-roll. Colored markers in the bottom 16 pixels identify rendered shot boundaries despite software-compositor lag. The exporter removes that margin, replaces it with a quiet matte, and trims or extends end holds to the nine scripted durations without speeding actions. It exports silent 25 fps WebM/MP4 plus a ten-second MP4 loop. `assembly.json` maps the final timeline to source frames. `capture.json` records shot boundaries, action completion times and browser errors. `verify.py` checks dimensions, durations, sizes (100 MB maximum per file), silence, and full decoding; it generates `verification.json`, selected full-resolution frames and a five-second contact sheet for visual inspection.

The wrapper retrieves the ignored `ops/demo/artifacts/` directory. Copy reviewed movies, selected screenshots, capture/verification JSON and the contact sheet into `docs/devpost/video/` for delivery. Do not commit raw takes or build products. The fixture-only capture contains no real photos, cloned voice, personal phone numbers or private messages.

See [SHOTS.md](../../docs/devpost/video/SHOTS.md) for narration substitutions and exact editorial timing. The full movie is silent by design; the owner records narration later.
