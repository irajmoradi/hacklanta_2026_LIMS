# Village: 2:30 judged demo

**Length:** 150 seconds including transitions and a four-second prepared voice clip. AI/ML thesis: help friends show up through the Solana economy, Gemini Mayor, ElevenLabs + CV avatars, and iMessage IRL loop.

## Prepare the tabs

1. **Fixture simulation:** start the browser-only setup in [SETUP](../SETUP.md#local-in-five-minutes-mock-mode), then use Maya at `http://127.0.0.1:4174`. From `apps/web` in Git Bash: `VITE_MOCK=1 VITE_DEMO_AUTH=1 VITE_AUTH0_ENABLED=0 VILLAGE_API_URL=http://127.0.0.1:9 bun run dev --host 127.0.0.1 --port 4174`. Install dependencies using the repository's runner instructions if needed. Keep a visible **Fixture simulation** label. All interactive beats use this server; fixtures reset on refresh.
2. **Prepared media:** permission-cleared prior source → SAM mask → walking avatar → LAM portrait footage, with a four-second voice clip. Reuse existing media; do not generate, clone or send anything for rehearsal. If unavailable, use the architecture diagram and preset avatars, labeled **Pipeline illustration / placeholders**.
3. **Prepared evidence:** existing, cleared Mayor/Gazette and disaster-repair footage with provider or simulation labels retained; an interior/Hall still; and an iMessage preview. Label any simulated phone transport explicitly. Only show a real receipt if its provenance and publication permission are documented.
4. **Hidden Demo Lab:** open `http://127.0.0.1:4174/lab#disasters` in the mock server for local disaster/recovery controls. Also prepare `#pipeline` (Avatar studio) and `#town` (Big town). Reload resets local world edits; placeholders stay labeled. Do not use the main village debug menu. Choose a disaster, click Ask the Mayor, expand its public rationale, simulate each task and Repair. Keep the unused-port proxy from setup: this button bypasses mock API handling, so a normal proxy could reach a paid provider.
5. **Evidence tab:** [claim ledger](EVIDENCE.md), [submission](SUBMISSION.md) and [architecture](../ARCHITECTURE.md). A public town view at https://thefriendshipvillage.vodka is optional, read-only and unnecessary for this cut.

Keep private messages, phone numbers and uncleared likenesses offscreen. Do not open connected cinematic scenes: opening them can request speech generation. Do not trigger live disasters, resets, Mayor events, wallet actions or messages. The script needs no secrets, provider calls or production mutations.

## Shot list and narration

Only the quoted lines are spoken. Keep transitions inside each slot; prepared stills replace slow navigation.

| Time | Shot / action | Narration | Fallback |
| --- | --- | --- | --- |
| 0:00–0:15 | Fixture town, then Friends hub. | “Getting friends together is hard. Everyone cares; everyone is busy. Village uses AI to give us a reason to show up, share what we're doing, and push each other toward our goals.” | Preset town and Friends still, simulation label visible. |
| 0:15–0:35 | Fixture check-in; cut to Colosseum payout choices, then Shop → Treasury. No wallet action. | “Check-ins earn coins and lifetime XP. Competitions lock their payout rules. Wallet payments need verified receipts; Treasury trades test SOL for personal XP. This is devnet. The new payout program still needs its approved deployment.” | Existing fixture progress and competition still; skip submission if unavailable. |
| 0:35–0:58 | Fixture Mayor, then `/lab#disasters`: trigger and repair a local sandbox disaster. Never use live world debug controls. | “Gemini 3.5 Flash-Lite turns activity into news and challenges. This hidden Demo Lab lets us rehearse disaster recovery locally. The Mayor picks repair tasks and explains the choice. Verified photo updates restore the town; this rehearsal uses a labeled example. People still give the final weekly grades.” | Labeled static Mayor output and repair objective; retain fallback provenance. |
| 0:58–1:23 | Avatar studio at `/lab#pipeline`, or prepared source, mask, walking head and talking portrait. Play four-second clip; cut to wardrobe. | “Third, familiar faces and voices. SAM segments the photo. LAM makes the talking portrait; Hunyuan builds the walking head. ElevenLabs speech drives Audio2Expression. Modal L4 GPUs run those stages. Permission comes first, and preset avatars keep the town usable.” | Pipeline diagram and preset wardrobe. Say “This is the pipeline; these avatars are placeholders.” Omit unavailable clip. |
| 1:23–1:45 | Prepared iMessage footage or labeled Villager-gram preview; consent controls. No Send click. | “Fourth, the loop back to real life. Photon Spectrum brings nudges into iMessage. Friends reply with progress or photo evidence. A Villager-gram can use a permitted voice and avatar. This preview uses simulated transport; handset video receipt still needs proof.” | Static preview labeled “Simulated transport; video receipt unverified.” If showing documented real footage, accurately identify which media receipt it proves. |
| 1:45–2:05 | Fixture Friends hub, reading list, then prepared house/Hall and wardrobe montage. | “Between challenges, cheer a friend, share a reading list, visit a house or furnish the Hall. Connected clients share walking, activities and furniture edits. This fixture tab shows the interface; two connected browsers are needed to prove synchronization.” | Labeled stills; show two scratch-connected windows if demonstrating walking. |
| 2:05–2:20 | Evidence tab: benchmark rows and architecture. | “We measured village reads at 114 milliseconds p95 in an isolated benchmark and checked 1,520 outfit combinations. FastAPI owns the rules, TigerData supports house state, and Vultr hosts the application.” | Local copy of the ledger; retain benchmark scope on screen. |
| 2:20–2:30 | Wide fixture town. | “The next test is human: do our friends meet more often? Village gives the group chat a place, a shared goal, and a reason to show up.” | Preset town. |

## Failure handling and rehearsal

If the GPU is off, use cached or prepared media and preset avatars. Modal is an implemented remote route, but cold inference is not a dependable live-demo wait. If no personal media is cleared, show placeholders throughout; never label stock speech a teammate clone.

If production or the network is unavailable, use the already-started fixture tab and local prepared stills. The recorded production topology hosts the app on Vultr; a desktop tunnel is no longer its required path. Fixtures remain a simulation, not proof of production availability or shared persistence.

Rehearse with a stopwatch at approximately 150 spoken words per minute. Each slot includes navigation; skip an interaction instead of extending past 2:30. Opening the fixture Mayor must stay in mock mode. This documentation task did not record a new video, prove delivery or rehearse the running UI. The [earlier recording report](../submission/video/DEMO-002-REPORT.md) is historical, not an execution of this script.

## Before handing this to judges

Confirm the three proposed side challenges with the owner (D-002): Mercedes Best CV, Photon Agents in iMessage and MLH Best Use of ElevenLabs; AI/ML is the main track. Use the qualification paragraphs in [SUBMISSION.md](SUBMISSION.md). Keep the devnet and v2 deployment captions visible in the economy beat. A confirmed payment requires server verification; a mock preview is not a receipt.

If the live URL is unavailable, the mock server and Demo Lab cover this entire script. GPU/ElevenLabs/Photon outages use presets, silent or cached media and the labeled transport preview. No new voice clone, render, message or transaction is required to rehearse. The 150-second live script is separate from the 2:48 Devpost film, 1:30 short cut, 94-second original v4 and 39-second square. The team uploads the Devpost film; no hosted video URL is recorded. The trailer player may lack its ignored MP4 files in a fresh clone; use the separately delivered, permission-cleared files described in [TRAILER.md](video/TRAILER.md).
