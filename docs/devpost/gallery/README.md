# Devpost gallery · DOCS-011

Use `screenshots/00-cover.png` as the cover. The eleven numbered images after it are the gallery, in narrative order. Every export is a 1500 × 1000 PNG. Copy the one-line text from [CAPTIONS.md](CAPTIONS.md).

The cover uses the exact tagline from [SUBMISSION.md](../SUBMISSION.md). The iMessage image is an empty, explicitly labeled placeholder frame; replace it only with a consented, redacted handset screenshot. It does not establish real delivery.

## Capture provenance

The product views come from https://207-246-81-187.sslip.io in Chromium on the shared CPU runner. No local application build or fixture API is substituted. `capture.mjs` opens the deployed interface and navigates its existing controls. `screenshots/capture-audit.json` records capture time, output names, failures, page errors, and blocked write attempts without saving response bodies, credentials, or request bodies.

All HTTP methods except GET, HEAD, and OPTIONS are intercepted before reaching the server. Service workers are disabled and WebSockets never connect upstream. This also prevents the interface's automatic seat/presence writes and scene-voice generation. No check-in is submitted, no item is bought/equipped, no group photo is uploaded/claimed, no message is sent, and no debug action is used. The external secret file is not needed or read.

Presentation changes exist only in the capture browser:

- The village response's lighting becomes clear day or clear night. Neither value is written to the server.
- Display names become Maple, Finch, Clover, Robin, and Ash. Contact fields and contact-like text are concealed. Original photo thumbnails are hidden behind initials; generated 3D avatar artwork remains visible.
- Debug/seat controls and camera hints are hidden. Town overviews use the app's clean view with native fullscreen suppressed to preserve the fixed viewport. The arena's competition navigation and the house's capture-only reconnect indicator are hidden for framing.
- The cover is an HTML composition of the day screenshot and title. The iMessage frame is rendered from `imessage.html`; it is not a screenshot of an actual conversation.

The talking-head surface is captured at rest. Playback would request generated speech, so no speech is requested. A still image cannot establish voice quality or lip sync. The house is read from its HTTP snapshot with live editing transport disconnected; it does not demonstrate multi-user synchronization. The group-photo frame shows the consent/start flow, without supplying a photo or creating a job. Existing Gazette content is read without generating a new edition.

The CPU runner gets a 120-second browser-side head warm-up deadline instead of the interface's normal 30-second fallback deadline. The capture requires the real renderer's ready state and non-uniform pixels in its canvas, since the Gaussian scene finishes loading after the ready callback. It does not force a success state, generate a new head, or establish normal-device loading performance.

## Reproduce

From `apps/web`, with the configured runner and SSH key available:

```sh
bash ../../ops/remote_run.sh node ../../docs/devpost/gallery/capture.mjs
```

The wrapper installs dependencies remotely and retrieves the `screenshots` directory. The source script keeps all output inside this task's allowed directory. The script fails if a required scene fails or the export count is wrong. Live scene content may change between captures; these are curated snapshots, not pixel baselines. Review all resulting images before replacing the committed gallery.

To recapture selected views after a complete/partial pass, append `--only=night,profile,house,06-colosseum` (or another comma-separated set of step names). The capture audit retains the previous run and identifies the newly captured frames. Failed selected steps remain failures; they are not silently accepted. `capture-baseline.json` supplies the prior manifest when a new runner has no cached screenshots/audit. Existing accepted PNGs remain in this worktree; partial captures replace only their selected outputs.

From the worktree root:

```sh
node --check docs/devpost/gallery/capture.mjs
python docs/devpost/gallery/verify.py
git diff --check
```

`verify.py` checks PNG signatures, chunk checksums, exact dimensions, unique content, caption coverage, the head's pixel check, and the capture audit's read-only/privacy assertions. Visual review is separate: inspect framing, legibility, loaded 3D scenes, concealed thumbnails, and the placeholder label.

No application code, contracts, environment files, or root files are changed. No contract change is proposed.

## Validation record

The final remote profile capture (`bash ../../ops/remote_run.sh node ../../docs/devpost/gallery/capture.mjs --only=profile`, from `apps/web`) exited 0. Its canvas contained 75 distinct sampled colors, with no page errors. The recorded 403 responses are blocked writes; the unrelated `/api/demo/debug` read returned 404. All twelve exports were visually inspected. The deployed head is visible but has soft detail and downward framing; this gallery preserves that asset limitation rather than substituting artwork or claiming animation quality.

Earlier remote capture passes exited 1 while exposing a buffered presence stream, headless fullscreen sizing, and premature head readiness. The capture harness now suppresses the stream/native fullscreen and waits for painted head pixels. A later pass exited 0 but was rejected visually for a blank head; the final paint-aware pass replaced it. Diagnostic images and original-photo inspection captures are excluded from the deliverable.

Final lightweight checks all exited 0: `python docs/devpost/gallery/verify.py` (12 valid, unique, captioned 1500×1000 PNGs plus audit assertions), `node --check docs/devpost/gallery/capture.mjs`, and `git diff --check`.
