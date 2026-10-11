# Village - Devpost submission draft

DOCS-003 snapshot: `77b382b`, October 10, 2026. [README](../../README.md) separates implemented features, historical test evidence and pending integration. This task observed 60 live API paths, DB/GPU up and build label API-004; that label is not a deployed revision. Memory/Gazette reads succeeded, with the latest Gazette marked `fallback:gazette-v1`.

## Project title and tagline

**Village - A little village for the people you want to keep up with.**

## Inspiration

Small wins disappear into busy group chats. One friend ends up remembering everyone's goals, asking for updates and organizing shared activities. We wanted to give that work a warmer home: a tiny village where progress changes the world and an AI Mayor helps friends stay connected.

## What it does

Friends live in a browser 3D festival village. They set weekly goals, check in, share evidence, earn XP and dress their avatars. The Week panel supports AI pre-grading followed by editable human grades, an auditor who sits out, and a crown and completion stars. Compete supports friendly challenges or audited photo entries with fixed terms. Shop and Wardrobe support rig-attached outfits, pets, home upgrades and talking styles. Collective XP unlocks buildings; weather, festival nights and recoverable cosmetic consequences give the world a shared history.

Consented photos become SAM 3 person/garment masks and body colors, LAM talking heads in profiles, and Gemini-stylized Hunyuan3D heads on village bodies. Group-photo upload and self-claim code is integrated; its full live browser pipeline still needs rehearsal after QA fixes. CV-006 additionally produces garment swatches and 3D decorations from photos in the worker; reward-token, inventory and browser integration is pending.

The scheduled Mayor uses bounded memory of recorded village history, chooses nudges, validated event templates, weather changes or no action, and records reasons and model provenance. Daily Gazette publication selects grounded stories and consent-aware gossip. API routes work, but the current web memory/Gazette adapters expect incompatible shapes; demonstrate API data or clearly labeled fixtures until that seam is fixed. The latest inspected live paper used the labeled fallback, not a successful fresh model edition.

Private messages, pokes/cheers, XP bribes, presence and account deletion are implemented server-side; their social UI is pending. Bribes can influence bounded event proposals and appear in Gazette attribution, without guaranteeing a requested outcome. A separate consent-gated Discord/Steam collector writes read-only activity signals; live collection is unverified. Photon connects the API's outbox and inbound commands to iMessage, with full phone delivery still unverified.

The pitch story uses synthetic evidence and **simulated** review/agent history. SOL amounts are **intent only**. These are separate from historical live CV and provider samples.

## How we built it

React, Vite, TypeScript and React Three Fiber render the world. FastAPI owns authorization, provider adapters and transactional XP. PostgreSQL 17/TimescaleDB stores state and activity. Auth0 SPA/JWT code is implemented. Gemini/OpenRouter produce validated structured decisions; evidence vision uses Gemini. ElevenLabs supplies TTS and consent-gated voice cloning, plus a generated static pack of 18 sounds whose UI playback hooks are pending. Spectrum is a separate Bun service over HTTP.

The shared [content registry](../../packages/catalog/catalog.json) has 105 entries and 101 GLB references; 134 GLBs are shipped in total. API catalog, progression and requirements consume the registry. Current scene adapters are still hardcoded after the rectangular redesign was reverted; registry-driven scene/event-pack integration remains pending. The larger round festival town is the actual snapshot.

A Windows GPU bridge claims database jobs and calls serial WSL SAM 3, LAM, A2E and Hunyuan3D processes on an RTX 5090. It commits manifests and item-job artifacts for authorized asset loading. The activity collector is another deliberate direct database writer. [Architecture](../architecture/overview.md) shows these boundaries.

Claude Code integrated contracts, migrations and merges. Codex gpt-6-astra workers built scoped tasks in separate worktrees; a Claude CV subagent handled GPU work. Later waves split scene/UI paths to reduce conflicts. Small commits, task ownership, additive migrations, test reports and the [decision log](../DECISIONS.md) coordinated the team. We integrated pretrained models; we did not train them from scratch.

## Challenges and accomplishments

Separate GPU environments and serial scheduling kept incompatible models usable on one device. Authenticated Gaussian loading, per-clone head/cosmetic attachments and procedural fallbacks made generated assets optional. Atomic XP and replay keys mattered as much as model output. Integration exposed stale assumptions: QA found group-photo owner/status mismatches (now fixed in source), while memory/Gazette response adaptation is still outstanding.

[CV-004](../cv/cv004.md) reports five placeholder cast avatars baked in 451 seconds and ten stock-voice expression tracks. [CV-006](../cv/cv006.md) reports warm garment extraction around 0.7-1.0 seconds and 3,000-triangle decoration outputs, with substantially longer cold model loads. These are historical RTX 5090 samples, not latency guarantees. [WEB-010](../../apps/web/WEB-010-REPORT.md) reports 35 browser tests and a live outfit read check. [ACT-001](../../apps/activity/ACT-001-REPORT.md) reports 17 fake/isolated-DB tests. Application suites were not rerun by DOCS-003.

## What we learned and what's next

Agents need bounded actions, visible reasons and human decisions for ambiguous evidence. A model choosing no action can be useful. A fallback keeps the village working but must remain visibly labeled. Next: adapt memory/Gazette responses, verify real publication, rehearse group photos and phone delivery, finish social/sound and photo-item UI, and validate Auth0 login and deployment. The optional Solana panel can simulate and separately request a signature; it cannot broadcast or reconcile payment. Deployment and pot mapping remain outstanding.

## Team

**Iraj Moradi, Lance, Stefanny.** Individual profile URLs and contribution statements await team confirmation.

## Tracks and prize evidence

| Entry | Concrete implementation / evidence | Honest boundary |
| --- | --- | --- |
| Main: **AI/ML** | [apps/api/app/scheduler.py](../../apps/api/app/scheduler.py), [memory.py](../../apps/api/app/memory.py), [newspaper.py](../../apps/api/app/newspaper.py), [auditor.py](../../apps/api/app/auditor.py); [API-009 report/tests](../../packages/contracts/proposals/API-009.md) | Validated agent loop, memory, VLM review and grounded paper; seeded reviews are simulated, live paper observed fallback. |
| **Mercedes Best Computer Vision** | [workers/gpu/segment.py](../../workers/gpu/segment.py), [head.py](../../workers/gpu/head.py), [headmesh.py](../../workers/gpu/headmesh.py), [items.py](../../workers/gpu/items.py); [CV-004](../cv/cv004.md), [CV-005](../cv/cv005.md), [CV-006](../cv/cv006.md); [LamHead.tsx](../../apps/web/src/components/LamHead.tsx), [GeneratedHead.tsx](../../apps/web/src/scene/GeneratedHead.tsx) | Real historical segmentation, talking/stylized heads and photo-item worker results. Group self-claim is not face recognition; full new onboarding and product photo-items remain unverified/incomplete. |
| **Photon Agents in iMessage** | [apps/imessage/src/agent.ts](../../apps/imessage/src/agent.ts), [app/inbound.py](../../apps/api/app/inbound.py), [simulate.ts](../../apps/imessage/scripts/simulate.ts); [API-006 report](../../apps/api/API-006-REPORT.md) | Commands, STOP, provider-ID dedupe, consent-aware outbox, voice attachments and fake-transport integration test. Echo connectivity is not full Village text/audio delivery; live E2E unverified. |
| **MLH Best Use of ElevenLabs** | [apps/api/app/voice.py](../../apps/api/app/voice.py), [SettingsPanel.tsx](../../apps/web/src/components/SettingsPanel.tsx), [workers/gpu/expr.py](../../workers/gpu/expr.py); [CV-004 stock speech](../cv/cv004.md), [assets/sfx/README.md](../../assets/sfx/README.md), [SFX manifest](../../apps/web/public/sfx/manifest.json) | TTS plus A2E/amplitude playback; 18 generated SFX/36 MP3+OGG files. Real teammate cloning unverified; static SFX not yet wired to app events. |

These are the task's three intended side challenges. D-002 leaves final selections for the team; use the organizer's actual form labels. Event requirements are taken from supplied project documents, not independently audited rules. No external submission was made.

## Built with

React, Vite, TypeScript, Three.js/React Three Fiber, Bun, Python 3.12, FastAPI, Pydantic, Psycopg, PostgreSQL 17, TimescaleDB, Docker, Auth0, Gemini/Vertex AI express, OpenRouter, ElevenLabs, Photon Spectrum, SAM 3, LAM, Audio2Expression, Hunyuan3D-2mini, CUDA/WSL, Blender, Discord/Steam adapters, Anchor, Codama and Solana Kit. Vultr is a deployment kit; hosted Tiger Data is not in use. Solana is locally tested with a flag-gated sign-only browser integration, not deployed payments.

## Public GitHub / source code URL

**Pending publication verification.** The infrastructure report describes a private repository. Enter the actual public URL after a signed-out access check; this task does not publish or change visibility.

## Try it out / demo URL

**Hosted URL pending.** Use the [local guide](../../README.md#local-run): API 8010, web 5173, existing preview potentially 4173. Auth0 interactive login and Vultr deployment are **not yet verified live**. Localhost is not a hosted submission URL.

## Video URL and image gallery

**Final public video URL pending.** [DEMO-001](video/DEMO-001-REPORT.md) reports a local 152-second draft at `docs/submission/video/data/demo/village_demo_draft.mp4`; ignored artifacts are not guaranteed to exist in another worktree. It predates new features and shows amplitude lip-sync, a DeepSeek pre-grade and a live prayer. The [updated 150-second plan](demo-video.md) adds memory, Gazette, group photos and wardrobe. No new capture/upload was performed here.

Suggested gallery: village, head, evidence, Week, wardrobe and a permitted CV-006 contact sheet. Preserve original media provenance/consent. Do not commit personal photos or voices; historical screenshot paths in reports are not new evidence.

## Pre-existing work and AI assistance

> We used supplied product/build plans and a CV plan dated October 9, 2026, pretrained models, third-party SDKs and a Spectrum scaffold. Claude Code and Codex assisted implementation, integration and documentation. We did not train the underlying models. Final pre-event code and asset inventory must be reconciled against the official event start; we do not claim every line or asset began during the event.

CV reports identify CC0 stand-ins rather than teammate likenesses; confirm source permissions before public capture. Stock synthetic voices are not teammate clones. Project decisions identify LAM weights as noncommercial and Hunyuan3D 2.0 territory exclusions (EU/UK/South Korea); verify upstream terms before distribution. ElevenLabs sound rights depend on the owner's subscription/terms. No root project LICENSE or blanket commercial/public-domain claim is made. Account deletion covers documented local data/assets, not all external backups, identities or delivered messages.

## Judge test instructions

1. Follow the README; keep `MAYOR_SCHEDULER=0`. Use local demo authentication or explicitly labeled `VITE_MOCK=1` fixtures. The mock world is separate from the full seeded database story.
2. Run the read-only `scripts/demo_check.py`; prepare the evidence-serving wrapper if required. Do not reset shared history during a tour.
3. Follow [pitch.md](pitch.md): village, profile LAM head, evidence AI verdict, AI at work plus Mayor memory, Gazette, Week grading, Compete plus pot, group-photo onboarding, Shop/Wardrobe.
4. At this snapshot, use pre-opened authenticated API responses for memory and Gazette, or switch to a clearly labeled fixture tab. Their live web adapters need repair. Keep `fallback:gazette-v1` visible when using the observed live paper. Group photos use prepared crops or an explicitly simulated flow unless separately rehearsed live.
5. Show existing Week/Compete state without generating suggestions, grading, settling or signing. The pot may show coming soon; even the enabled flow only signs, never broadcasts. Use stock prerecorded speech only with its provenance, or explicitly request a new line once outside this documentation task.
6. Photon full delivery, Solana devnet deployment, real Auth0 login and Vultr hosting remain unverified. Show those boundaries instead of invented delivery/payment screenshots.

For API views use `/docs`, `X-Demo-User: 13370000-0000-4000-8000-000000000001`, village `13370000-0000-4000-8000-000000000000`. GET memory/Gazette is provider-free; route presence alone proves neither successful rendering nor generation.

## Final submission checklist / outstanding fields

The supplied decision log lists Sunday October 11, 2026, 09:00 ET for Devpost plus an organizer Google Form; no form URL is supplied. Confirm requirements, public source, video/hosted URLs, media rights, team profiles, side selections and pre-event inventory. Rehearse against the final integrated commit, especially memory/Gazette and group photos. No external publication was performed.
