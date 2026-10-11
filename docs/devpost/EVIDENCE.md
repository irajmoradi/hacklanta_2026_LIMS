# Village submission evidence ledger

Scope: documentation only, inspected October 10, 2026 against local `main` and task HEAD at `b17dddabc68d9012b12f563c04803f6824ec8a25`. [ARCHITECTURE](../ARCHITECTURE.md) supplies operating boundaries; current source and checked-in reports establish the claims below. No new runtime, billing, provider, handset or production test is claimed. No secrets were needed. Owner framing comes from [DOCS-013](../tasks/DOCS-013.md) and R-138 in [REQUESTS](../REQUESTS.md).

This supersedes DOCS-010's stale “Modal absent,” “houses pending,” and desktop-dependent production descriptions. Earlier measurements remain historical. Side challenges are targets, not verified eligibility or awards. The narrative's hoped-for social benefit is a hypothesis, not a measured behavioral result.

## DOCS-015 update

Source review against production baseline 86bc24e on October 11, 2026 supersedes the older model, overworld and payment descriptions below. No new provider, production or wallet execution is claimed. [Setup and validation report](../infra/DOCS-015-REPORT.md) records this documentation update. Source takes precedence where the older architecture narrative differs.

## Verified claim inventory

Every factual product/stack/result claim in the submission and demo is grouped below with the files checked. “Implemented” means source evidence, not a new live rehearsal. The original DOCS-013 rows were checked against ARCHITECTURE; DOCS-015 updates use the current source links.

| Claim in submission / demo | Files checked | Scope / boundary |
| --- | --- | --- |
| Browser 3D town; React, TypeScript, Vite, Three.js, R3F, Bun | [web package](../../apps/web/package.json), [App](../../apps/web/src/App.tsx), [architecture](../ARCHITECTURE.md) | Implemented browser stack |
| Live multiplayer: shared progress, online presence, and real-time walking (other players' villagers move as they walk) | [movement relay](../../apps/api/app/realtime.py), [client sync](../../apps/web/src/api/townLive.ts), [interpolation](../../apps/web/src/api/movement.ts), [presence](../../apps/api/app/presence.py) | Authenticated village WebSocket, rate-limited, ~10 Hz; two-browser Playwright test (FEAT-021). FEAT-023 now adds server-authoritative activities, seats and attractions through [overworld reducers](../../apps/api/app/overworld.py); single-process authority with persisted snapshots |
| Friends hub: goals, daily check-ins, accomplishments, cheer/message/visit | [Friends](../../apps/web/src/components/Friends.tsx) | Implemented actions; no new message sent |
| Check-ins, weekly goals, spendable coins, lifetime XP, cosmetics/home upgrades | [domain](../../apps/api/app/domain.py), [FEAT-007](../../apps/api/FEAT-007-REPORT.md), [architecture](../ARCHITECTURE.md) | Transactional game ledger, separate from SOL |
| Colosseum payout modes and receipt-verified wallet flow | [Colosseum](../../apps/web/src/components/Colosseum.tsx), [FEAT-027](../solana/FEAT-027.md), [receipt verification](../../apps/api/app/solana_rpc.py) | Implemented winner-take-all, proportional and ranked terms; v2 deployment not established |
| Treasury exchanges test SOL for personal XP | [Treasury](../../apps/web/src/components/Treasury.tsx), [Solana API](../../apps/api/app/solana.py), [FEAT-027](../solana/FEAT-027.md) | Confirmed receipts required; fixed rate/daily cap; no coins or village XP |
| Hidden Demo Lab and avatar pipeline demonstration | [Lab scenes](../../apps/web/src/lab/scenes.ts), [cached media](../../apps/web/src/lab/pipeline/runtimeMedia.tsx) | Local world edits reset; permitted cached media or labeled placeholders; no new inference |
| Solana devnet deployment; Anchor, Codama, Solana Kit; review/signing distinct from settlement | [D-030](../DECISIONS.md), [client report](../solana/SOL-002.md), [pot client](../../packages/pot-client/README.md) | D-030 records v1; FEAT-027 changes the ABI and needs a separately approved v2 deployment. No live v2 settlement asserted |
| Cinematic check-in and Mayor; opening can request speech | [CinematicScene](../../apps/web/src/components/CinematicScene.tsx), [App](../../apps/web/src/App.tsx), [scene voice](../../apps/api/app/voice.py) | Use fixture/prepared shots; no connected scene generation |
| Mayor nudges/challenges/news from recorded activity; bounded structured proposals and server validation | [Mayor adapter](../../apps/api/app/mayor.py), [architecture](../ARCHITECTURE.md) | Configurable model path; provenance/fallback retained |
| Gemini 3.5 Flash-Lite via Vertex AI express; OpenRouter code default | [mayor MODEL/client](../../apps/api/app/mayor.py), [config](../../apps/api/app/config.py) | Defaults are configurable; no runtime env assertion |
| Mayor-selected disaster repair tasks | [planner](../../apps/api/app/repair_plans.py), [progress](../../apps/api/app/disasters.py), [Lab request](../../apps/web/src/lab/repairPlan.ts) | 2–3 distinct bounded tasks, public rationale and tagged verified evidence; legacy check-ins retained. Lab simulation is local but Ask the Mayor can call the API even in mock mode. No disaster triggered here |
| Gemini photo relevance review; human final weekly grades | [auditor](../../apps/api/app/auditor.py), [weekly](../../apps/api/app/weekly.py), [architecture](../ARCHITECTURE.md) | Advisory vision, not authenticity detection |
| Photo → SAM segmentation → LAM portrait; Gemini/Hunyuan head on preset body; versioned assets | [GPU bridge](../../workers/gpu/bridge.py), [CV-004](../cv/cv004.md), [architecture](../ARCHITECTURE.md) | Pretrained pipeline; no new inference |
| ElevenLabs consent-gated clone/TTS and stock alternatives; A2E motion | [voice](../../apps/api/app/voice.py), [API-004](../../apps/api/API-004-REPORT.md), [talk-video contract](../../workers/gpu/TALK_VIDEO.md) | Permitted voice required; no new clone or audio |
| Generated sound effects/ambience | [AUDIO-001](../../assets/audio/AUDIO-001-REPORT.md), [AUDIO-002](../../assets/audio/AUDIO-002-REPORT.md) | Historical generated assets, no usage totals claimed |
| Wardrobe, personal house interiors, collaborative Community Hall | [Wardrobe](../../apps/web/src/components/Wardrobe.tsx), [HouseInterior](../../apps/web/src/components/HouseInterior.tsx), [houses](../../apps/api/app/houses.py), [App](../../apps/web/src/App.tsx) | Hall placement has permission rules |
| Shared reading list and takeaways | [ReadingList](../../apps/web/src/components/ReadingList.tsx) | UI and API integration; fixture shot does not prove live sync |
| Photo garment pattern / object decoration | [CV-006](../cv/cv006.md), [Modal stages](../../workers/modal/app.py) | Implemented pretrained generation paths |
| Modal L4 SAM 3/LAM/A2E/Hunyuan stages; local RTX 5090 route | [Modal app](../../workers/modal/app.py), [Modal report](../../workers/modal/README.md), [architecture](../ARCHITECTURE.md) | Implemented remote stages, not merely planned; no fresh deployment check |
| FastAPI/Python; PostgreSQL/TimescaleDB; TigerData house pool | [architecture](../ARCHITECTURE.md), [houses](../../apps/api/app/houses.py), [house migration](../../apps/api/migrations/050_house_interiors.sql) | Separate Tiger pool when configured; no transparent failure fallback |
| House transactions, WebSocket, LISTEN/NOTIFY and reconnect snapshots | [houses](../../apps/api/app/houses.py), [architecture house section](../ARCHITECTURE.md#houses-transactional-reducers-across-two-stores) | Implemented sync; no new two-browser or latency measurement |
| Optional Auth0 and single-use seat claims | [auth](../../apps/api/app/auth.py), [claims](../../apps/api/app/claims.py), [operator guide](../auth/JUDGE_LOGIN.md) | 72-hour hashed codes preserve seats. Production build defaults Sign in off; Play as remains impersonable. No fresh tenant login tested |
| WEB-058 judge usability fixes | [implementation report](../../apps/web/tests/WEB-058-REPORT.md) | Mobile controls/Colosseum, sign hit targets, ordering, Gazette copy, feed destinations and debug opt-in; prior QA evidence, not rerun by DOCS-015 |
| Trailer cuts | [v4](video/TRAILER.md), [long/short](video/TRAILER-005.md) | 94 s original, 2:48 Devpost, 1:30 short, 39 s square. Prior capture/export evidence; ignored MP4s supplied and uploaded by team, no publication URL verified |
| Vultr hosts application/DB/HTTPS; Caddy; desktop tunnel no longer required | [cutover](../../ops/deploy/cutover.md), [architecture deployment section](../ARCHITECTURE.md#deployment-scale-and-recovery) | Recorded production layout, no fresh uptime probe |
| Photon Spectrum Bun/TS agent over HTTP; inbound goals/check-ins/photo evidence | [agent](../../apps/imessage/src/agent.ts), [entry point](../../apps/imessage/src/index.ts), [FEAT-011](../../apps/api/FEAT-011-REPORT.md) | Implemented transport/API path; no live send |
| Villager-grams: AI disclosure, permitted friend voice/avatar, video/audio/portrait fallback | [FEAT-010](../../apps/api/FEAT-010-REPORT.md), [gram video](../../apps/api/app/gram_video.py), [architecture](../ARCHITECTURE.md) | Simulated transport evidence; handset video receipt unverified |
| Durable outbox, retries, consent recheck, STOP, at-least-once delivery | [agent](../../apps/imessage/src/agent.ts), [architecture messaging section](../ARCHITECTURE.md#messaging-and-external-activity) | Crash/ambiguous send can duplicate delivery |
| Preset avatars/cached assets work GPU-off; fixture simulation resets | [OptionalModel](../../apps/web/src/scene/OptionalModel.tsx), [README](../../README.md), [architecture](../ARCHITECTURE.md) | Connected mode still needs API/DB/assets; fixture mode separate |
| Village GET p95 635.16 → 114.48 ms | [FIX-006 report](../../apps/api/FIX-006-REPORT.md), [raw timings](../../apps/api/fix006-timings.json) | Five villagers, isolated PostgreSQL, ASGI, one cold + 20 warm requests; excludes network/render time |
| Outfit QA: 1,520 combinations, 3,040 views, 606 → 0 geometric failures | [FIX-008 report](../../apps/web/artifacts/fix008/README.md) | Pairwise combinations, not exhaustive animations |
| Short Modal talk clip: 170 s cold / 12.3 s warm | [Modal measurements](../../workers/modal/README.md) | Historical 2.2-second audio sample, not latency guarantee |
| Pretrained models; publication/model-rights review remains | [CV-007 disclosures](../cv/cv007.md), [architecture disclosures](../ARCHITECTURE.md#explicit-limitations-and-publication), [architecture](../ARCHITECTURE.md) | Project-recorded disclosures, not fresh upstream legal review |
| Demo fixture launch; previous recording is historical | [README](../../README.md), [DEMO-002](../submission/video/DEMO-002-REPORT.md) | DOCS-013 made no recording and ran no UI rehearsal |

## Excluded claims and publication gates

- No proven live v2 settlement, mainnet use, verified in-person attendance, or measured increase in meetups. Server-synchronized idle activities/attractions are now implemented, without a new runtime rehearsal here.
- No 159 ms house-sync latency or 124–204 fps claim: those prior requested numbers lack supporting measurements here. Crowded rendering remains a stated next step.
- No fresh handset video receipt, interactive Auth0 login, production feature rehearsal or two-client TigerData validation.
- No current provider pricing, billing totals, installed budget-guard guarantee or licensing/eligibility certification. Historic cost subsets are omitted from the pitch rather than promoted into project totals.
- Public face/voice permissions and official challenge eligibility still need owner review. This is an honest submission draft, not a record of publication.

## DOCS-013 validation

Documentation checks cover required headings, 900–1,400 submission words, eight contiguous demo beats totaling 150 seconds, narration length, local Markdown file/heading targets, whitespace and the three-file allowed-path boundary. Historical application tests are cited, not rerun or represented as this task's results. No application code or contracts changed; no contract changes proposed. See the task's final report for actual check results and commit.

Validation results: inline `python -` documentation assertions exited **0**: **1,286** whitespace-delimited submission words (entire file), all eight required headings, **83** local links with valid file/heading targets, **8** contiguous beats totaling **150 seconds**, **278** primary narration words, and only the three allowed files modified. Initial checks found an obsolete README disclosure anchor (fixed); a later timing-check failure came from PowerShell stdin encoding of the en dash (checker corrected to a Unicode escape). An attempted PowerShell link replacement failed before writing; Python applied the fix. Application tests and browser rehearsal were not run for this prose-only change.
