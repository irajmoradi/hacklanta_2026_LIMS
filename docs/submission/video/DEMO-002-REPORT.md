# DEMO-002 — feature tour v2

Delivered two review cuts with the live build's gaps explicitly disclosed. This is not a claim that every requested feature works: night switching, the API-backed group claim grid, crown replay, a configured wallet pot/program display, and the photo-item reward UI remain blocked as detailed below.

Branch: `demo/DEMO-002`. Milestone commits: `77c8989` (capture and inspection), `9dd2f76` (export, pickups, verification); final QA/handoff commit follows. Main capture source: `77c8989`. The existing preview at `http://localhost:4173` and real API at `:8010` were used without rebuilding or modifying applications. Their deployed revisions were not independently established.

## Delivery and how to try it

Open either MP4 below. All paths are relative to this worktree. The task's requested root `data/demo/` location is outside `allowed_paths`, so the same filenames are delivered under `docs/submission/video/data/demo/`. Media, screenshots, personal likenesses, audio and dependencies remain ignored and uncommitted.

| Artifact | Path | Result |
| --- | --- | --- |
| Full feature tour | `docs/submission/video/data/demo/village_demo_v2_full.mp4` | 208.64 s / **03:28.64**, 5,216 frames |
| Judges edit | `docs/submission/video/data/demo/village_demo_v2_judges.mp4` | 150.00 s / **02:30.00**, 3,750 frames |
| Ten stills | `docs/submission/video/data/demo/v2_stills/` | 1920×1080 PNGs, listed below |
| Full-cut contact sheet | `docs/submission/video/data/demo/v2_qa/full-contact.jpg` | Sample every five seconds |
| Judges contact sheet | `docs/submission/video/data/demo/v2_qa/judges-contact.jpg` | Sample every five seconds |
| Wardrobe verification frame | `docs/submission/video/data/demo/v2_qa/wardrobe-pickup.png` | Actual restored inventory + preview |
| Machine evidence | `docs/submission/video/data/demo/v2-{capture,verification,budget,pickup,wardrobe-pickup}.json` | Timing, attempts, original issues and pickup provenance |

Both movies are **1920×1080, 25 fps, H.264/AAC**, with fast-start enabled. The full cut uses normal playback speed. The judges edit trims each chapter from the same footage and keeps the speech window at normal speed. Both contain the real played speech, prayer chime, event drumroll and bribe purchase sound, synchronized to browser playback events. The two short pickups are silent. There is no generated narration or added background music.

Stills: `01-town.png`, `02-group-consent.png`, `03-voice-consent.png`, `04-talking-head.png`, `05-suspicious-evidence.png`, `06-agent-memory.png`, `07-gazette.png`, `08-bribe-receipt.png`, `09-week-grading.png`, `10-devnet-wallet.png`.

Run `node tests/demo/verify-v2.ts` from the repository root to check the existing delivery without provider calls. `node tests/demo/qa-v2.ts` independently measures audio signal. Re-export with `node tests/demo/export-v2.ts`. Setup and capture commands are in [README.md](README.md). Preserve `v2-budget.json`; do not delete it for retakes.

## Chapters

Timestamps below are floored to whole seconds for navigation; exact edit points and source windows are in `v2-verification.json`.

| Full | Judges | Chapter |
| --- | --- | --- |
| 00:00 | 00:00 | Rectangular town, mouse orbit, generated villagers and outfits |
| 00:12 | 00:08 | CV002 LAM strips; SAM 3, LAM and Audio2Expression |
| 00:20 | 00:14 | CV004 cast: photo → Gemini 2.5 Flash Image → Hunyuan3D-2mini → body |
| 00:29 | 00:20 | CV003 samples and a real SAM 3 group crop |
| 00:37 | 00:26 | CV006 wearable swatches and 3D decorations |
| 00:46 | 00:33 | Group consent screen, then five saved crops with explicit artifact labeling |
| 01:01 | 00:43 | Single-selfie upload and consent |
| 01:07 | 00:48 | Settings: voice-clone consent, no recording uploaded |
| 01:14 | 00:53 | Dev's live LAM head and Hear them |
| 01:28 | 01:03 | Check-in form, then existing suspicious evidence verdict |
| 01:41 | 01:12 | Mayor memory and AI decision journal |
| 01:54 | 01:22 | Published Gazette issue |
| 02:01 | 01:27 | Live Mayor prayer and returned model-labeled answer |
| 02:15 | 01:37 | Actual 1-XP bribe receipt |
| 02:22 | 01:42 | Maya's weekly grading UI and advisory AI pre-grade |
| 02:36 | 01:52 | Stefanny's existing weekly crown; no ceremony replay |
| 02:42 | 01:56 | Study streak, DEVNET panel, missing-pot status |
| 02:54 | 02:05 | Remove and restore owned Round Glasses in Wardrobe |
| 03:06 | 02:14 | Shop and disclosure of unavailable photo-item reward UI |
| 03:14 | 02:19 | Poke/cheer controls and existing Inbox conversation |
| 03:23 | 02:26 | Closing town, sound-on and day/fog limitation |

## Actions and provenance

The persistent budget records **1 ElevenLabs request, 1 Mayor prayer, 1 AI pre-grade, 1 bribe, 2 inventory changes**. The prayer plus pre-grade totals two LLM-request opportunities. No other provider requests were made by this worker. Existing background scheduler activity is outside the recorder's control.

The bribe spent exactly **1 seeded-village XP**, changing Iraj's balance from 760 to 759. Round Glasses were unequipped and re-equipped, leaving equipment restored. The prayer and pre-grade persist naturally. No reset, new check-in, user creation, photo/audio upload, GPU generation, human grade, finalization, wallet connection/signature/broadcast or outgoing message was performed. Poke is shown as a control only. Automatic presence heartbeats were blocked by the recorder, so presence indicators are not demonstrated.

The API already loads its own external runtime environment. The recorder did not need to read, print or copy secrets. All requests used the app's existing demo identity. CV images were read directly from `C:/Users/mourn/Downloads/hacklanta/data/`; no new image generation was used. Slides are explicit interstitials, not application UI. No API responses were mocked or rewritten.

The timing captions cite local CV reports: CV002 18.6 s segment + 40.4 s head; CV004 451 s wall for five people; CV005 24 s cold group job; CV006 0.9–1.0 s warm plaid extraction and 76 s warm / 204 s cold mug. These are historical RTX 5090 measurements, not timings measured during this capture.

## Bugs, blocked requirements and visual limitations

1. **Group claim integration:** legacy job `d5eca46a-2175-4915-8c3d-df1d040cea29` exists on disk but `GET /api/villages/…/group-photo/<job>` returns **404 Group photo not found**. The source route joins `group_photos`; a worker-only job does not establish the required association. The original lookup timeout was replaced with a read-only consent-screen pickup and explicitly labeled saved crops. No working claim grid is claimed. Some saved person crops are partial/fragmented; the take preserves those actual results.
2. **Night/festival:** live world reports `weather: fog`, `time_of_day: day`. There is no day/night control in this build. The take does not demonstrate the requested night transition, festival lighting or dancing, and does not fabricate a server state or UI control.
3. **Voice expression:** the new voice line's `line_expr.json` returned **404 three times** during playback. LAM and speech loaded, but this take relies on the app's available fallback lip-sync; it does not establish generated Audio2Expression playback. The historical expression pipeline is shown only in the saved CV artifacts.
4. **Crown ceremony:** the current week is open and awaiting grades. Stefanny's existing crown is visible. No replay control exists; fabricating grades/finalizing the shared week would alter teammates' state, so no new ceremony is claimed.
5. **Wallet:** Join pot with wallet opens a DEVNET status panel saying it is waiting for deployment and the competition's pot address. The mounted wallet/program-ID view never appears; the requirement to show a program ID could not be satisfied. No transaction was signed or sent.
6. **Photo-item rewards:** the running API advertises item/token routes, but this preview has no corresponding reward/token-gate UI or photo items in its shop. Real CV006 output is shown as an interstitial instead. No end-to-end reward flow is claimed.
7. **Identity switching / renderer:** the main take logged `Scene disposed` twice and failed to find Iraj's glasses immediately after changing demo identity. A fresh-context pickup successfully verified both inventory updates. The original failure remains in capture diagnostics. The wardrobe preview shows a prominent teal block around the head/headphones that obscures facial detail; inspect cosmetic transforms/materials.
8. **Mayor layout:** its pinned response remains over scrolled journal content while viewing the bribe section. The receipt is readable, but this can obscure unrelated cards beneath it.
9. **Model attribution:** the live Mayor answer says `deepseek/deepseek-v4-flash:v2`; the pre-grade similarly retains its actual provider label. Seeded evidence explicitly says `demo-fixture/gemini-2.5-flash (not called)`. Gemini Image captions apply to saved CV artifacts, not to all live AI.
10. **Editorial limits:** this is a team-review tour, including explicit feature gaps. The judges cut inherits those disclosures. No subjective full-length listening review is claimed. Audio is sparse outside the captured speech/effects. Captions cover part of the lower-left feed, but leave the central dialogs and right profile visible.

## Validation actually run

| Command / check | Exit / result |
| --- | --- |
| `bun install` in `tests/demo` | 0 |
| `ffmpeg -version` | 1; not on PATH |
| `tests/demo/node_modules/ffmpeg-static/ffmpeg.exe -version` | 0; FFmpeg 6.1.1 |
| `node tests/demo/inspect.ts` | 0; Connected and ready LAM |
| `node tests/demo/inspect-v2.ts` | 0; read-only feature inspection |
| `node --check` for record-v2, export-v2, verify-v2, pickup-v2, pickup-wardrobe-v2 | 0 |
| `node tests/demo/record-v2.ts --live` | 0; 21 chapters captured; two per-chapter failures recorded, subsequently replaced |
| `node tests/demo/pickup-v2.ts` | 0; real consent UI + actual saved crops |
| `node tests/demo/pickup-wardrobe-v2.ts` | 0; both real inventory updates verified |
| First `node tests/demo/export-v2.ts` | 0; video/container decode passed, but later signal QA found silent audio; superseded |
| First `node tests/demo/qa-v2.ts` | 1; caught silent exported audio despite non-silent source speech |
| Audio correction | Normalize all source sample rates/timestamps before mixing; bounded padding; exporter now rejects silent output |
| Final `node tests/demo/export-v2.ts` | 0; both complete video/audio decodes passed; 208.64 s and 150.00 s; audio peak −3.1 dB in each |
| Final `node tests/demo/verify-v2.ts` | 0; durations, dimensions, frames, ten stills, 21 chapters, receipts, pickup coverage and budgets passed |
| Final `node tests/demo/qa-v2.ts` | 0; source speech, intermediate mux and both delivered movies have −3.1 dB peaks |
| Visual QA | Inspected both five-second contact sheets and full-resolution town, consent, bribe, wallet and wardrobe frames |
| `git diff --check` | 0 |

The original audio diagnostic was stopped after unbounded padding produced an oversized temporary WAV; that file was removed within the allowed output directory. The corrected, bounded diagnostic confirmed real signal. This was a local export issue, not a provider retry.

## Handoff

Changed tracked files: `tests/demo/{inspect-v2,record-v2,export-v2,verify-v2,pickup-v2,pickup-wardrobe-v2,qa-v2}.ts`, `docs/submission/video/README.md`, and this report. No application, root, environment or contract files changed.

Blockers to complete feature coverage are the integration/UI gaps above, not missing media delivery. The integrator can copy the MP4s/stills into root `data/demo/` if needed. No shared-contract edit is proposed by this capture task; group-job association, expression readiness, pot configuration and missing UI should be addressed by their owning workers. External publication is not performed.
