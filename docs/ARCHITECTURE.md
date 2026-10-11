# Architecture and operating boundaries

This document describes source at `f80f5b7fe231af87a6c6f8d52a074f51e9bbe4a5`, the `main` revision when DOCS-012 was assigned. Later commits on other worktrees are not implied to be integrated here. The [README](../README.md) provides the system and sequence diagrams. Paths below are implementation evidence; measurements retain the limitations of their originating reports. No production endpoint was mutated or re-deployed to write this document.

## Ownership and contracts

| Boundary | Owner and contract | Consistency / failure behavior |
| --- | --- | --- |
| Browser → API | [HTTP contract](../packages/contracts/api.md), [client](../apps/web/src/api/client.ts), [models](../apps/api/app/models.py) | Browser submits intent; API authenticates, checks membership and validates inputs. Fixture client simulates responses. |
| API → primary DB | [schema](../packages/contracts/schema.sql), [domain](../apps/api/app/domain.py), [DB pools](../apps/api/app/db.py) | Transactions commit durable state. Balances and rewards are server-owned. |
| API → house DB | [houses](../apps/api/app/houses.py), [migration 050](../apps/api/migrations/050_house_interiors.sql), [052](../apps/api/migrations/052_house_floors.sql) | A room lock serializes furniture changes. Separate Tiger transactions cannot atomically commit primary-DB feed effects. |
| DB → GPU bridge | [bridge](../workers/gpu/bridge.py), [worker gateway](../workers/gpu/server.py) | Durable leased jobs; bounded retry. Artifact files and DB records do not form one distributed transaction. |
| API → provider | [Mayor](../apps/api/app/mayor.py), [voice](../apps/api/app/voice.py), [budget](../apps/api/app/budget.py) | Timeouts, schema validation, provenance and reservations. External requests cannot be rolled back with a DB transaction. |
| iMessage → API | [agent](../apps/imessage/src/agent.ts), [inbound](../apps/api/app/inbound.py) | Service authentication, sender mapping, receipts, lease/ack delivery. At-least-once transport. |
| Wallet → devnet | [pot client](../packages/pot-client/README.md), [program source](../programs/village-pot/) | Simulation/signature/intent are not proof of confirmed settlement. Owner-approved transactions only. |

`packages/contracts` is integrator-owned. Current code is the reference for the behavior described here; documentation does not silently amend its HTTP shapes. Additive migrations live under the API. The historical 001–055 range includes a consolidated baseline, missing numeric slots and 34 incremental SQL files in this snapshot; it must not be interpreted as 55 sequential scripts.

[migrate.py](../apps/api/scripts/migrate.py) checks whether `villages` exists before applying the baseline, avoiding restoration of obsolete checks on an established database. Incremental filenames are recorded in `api_migrations`. Editing an already-applied file is not a safe upgrade strategy. [tiger_migrate.py](../apps/api/scripts/tiger_migrate.py) separately applies house migrations 050–052 and the activity aggregate to configured databases. The production updater runs the primary migrator; changes to a separate Tiger schema require explicit operational coordination.

## Browser and assets

[React 18.3.1, R3F 8.18.0 and Three 0.170.0](../apps/web/package.json) separate DOM panels from the scene. [VillageScene](../apps/web/src/scene/VillageScene.tsx) composes the town, inhabitants, camera and interactions. Scene modules handle cinematic transitions, Colosseum and shop views, and house interiors. The browser imports neither Python models nor provider secrets. [Vite](../apps/web/vite.config.ts) exposes only public `VITE_*` settings; compiled builds freeze those flags.

[OptionalModel](../apps/web/src/scene/OptionalModel.tsx) provides procedural fallbacks when a GLB is absent. Generated heads attach to preset body rigs. Portrait playback uses [the LAM integration](../packages/lam-renderer/README.md); a head's presence does not prove valid expression data. Audio-only/approximate-motion fallbacks preserve interaction when expression jobs or portrait packages fail. Renderer lifecycle matters because upstream portrait resources are shared; chorus playback activates one speaker at a time rather than rendering an unbounded set of live Gaussian heads.

Assets are private filesystem objects addressed through [authorized asset routes](../apps/api/app/assets.py), not arbitrary URLs a client may read. API and bridge must agree on `ASSET_DIR`. Cached files let the village work with the GPU offline; they do not make the DB or asset disk optional in connected mode. Fixture mode is a separate browser simulation and is explicitly labeled as such.

## Progress, money and idempotency

`users` map identity; `village_members` map roles, homes and village membership. `goals`, `goal_stretches`, `check_ins` and `evidence_reviews` describe work and proof. `weekly_audits`, assignments, grades and votes implement human review. Competition tables hold membership, entries and scoring. Catalog definitions and inventory describe cosmetics; avatar assets/jobs and messaging tables describe asynchronous work.

[domain.py](../apps/api/app/domain.py) keeps XP and coins independent. XP awards reject negative deltas; lifetime balance sums positive awards and determines level. Coin balance sums credits and debits. Purchases check balance while holding the member lock, then write the ledger and inventory transactionally. A unique source key ensures a repeated award produces no second ledger row. This is idempotency of a particular effect, not a universal exactly-once claim for every HTTP route.

For a check-in, membership and idempotency checks occur before inserting the row. `check_in_keys` guards a logical request independently of the hypertable's time-inclusive uniqueness. Status XP is keyed by day; progress uses the request key. Evidence-backed progress holds its 25-XP award until verification; progress without an evidence asset follows the existing immediate-award path. Therefore the presence of progress XP is not proof that every update underwent vision review.

[main.py](../apps/api/app/main.py) schedules the image pre-check as an in-process background task after accepting the check-in. [auditor.py](../apps/api/app/auditor.py) reads the image through an asset key, calls Gemini with a 25-second timeout and structured `EvidenceReview`, then reacquires membership/locking and rechecks whether a review already exists. Concurrent reviews cannot double-award keyed XP, but can both consume provider work before their final deduplication. Provider failure stores an `error` verdict and owner-review explanation. A process exit can interrupt a background task; this is not a durable general-purpose task broker.

[weekly.py](../apps/api/app/weekly.py) restricts grading to the assigned auditor. AI suggestions are advisory. Human grades, finalization and contest rules are distinct from the photo relevance pre-check; the README sequence intentionally shows both. Ledger replay protects rewards, while process termination and client retries still require route-specific handling.

## Houses: transactional reducers across two stores

A house WebSocket accepts an initial authentication message within ten seconds, checks both visitor and house/village context, subscribes to a room-specific Postgres channel, and then snapshots room state under lock. Authentication is sent in the first frame rather than a token-bearing URL. A dedicated autocommit connection listens for the life of that socket; pooled connections perform reads and edits. This creates a real connection cost per visitor that SSE village presence does not have.

An edit identifies action, item, floor, coordinates, rotation and client sequence. The server enforces owner edits in personal homes; the Community Hall permits shared placement with creator/manager removal rules. Inventory and photo-object ownership still apply. Coordinates snap to quarter units and rotation to 15 degrees; room boundaries, overlaps, floor access and 256-item inventory limits are server-validated. Per-user/room move history enforces 30 edits per second and 20 additions per minute.

Within the house transaction, a locked `house_rooms` row supplies the next sequence. The reducer updates `house_items`, inserts before/after state into `house_item_moves` and emits the delta with `pg_notify`. PostgreSQL delivers NOTIFY after commit. A rejected WebSocket edit returns a fresh snapshot. `client_seq` must increase within a connection; reconnecting creates a new client/session ID. It is not a durable deduplication key for arbitrary retransmission across reconnects or HTTP edits.

LISTEN begins before snapshot acquisition so committed events can be filtered against the initial sequence. Notifications are transient; reconnect/snapshot is the recovery mechanism rather than a durable per-client event cursor. The move log supports recent history and hourly activity, but does not promise replay of every missed delta. [Migration 050](../apps/api/migrations/050_house_interiors.sql) converts moves to a hypertable when Timescale is installed and configures compression after seven days. Tiger setup uses a continuous aggregate with real-time aggregation; plain Postgres receives a conventional grouped view.

`TIGER_DATABASE_URL` configures a separate pool. Without it, houses use the primary pool; with it, an unavailable Tiger database causes failures rather than transparent failover. House identities deliberately lack foreign keys into the primary DB. Membership, owned furniture and creator context are checked in the primary DB, then used in a separate house transaction. Hall feed entries are written afterward. A house commit can succeed while its activity-feed write fails; there is no cross-database two-phase commit or reconciliation outbox here. Operators must also coordinate account deletion and schema changes across stores.

[House presence](../apps/api/migrations/051_house_presence.sql) stores session rows with 60-second expiration; pings renew them and recheck membership, and disconnect cleanup removes them when possible. In contrast, [village presence](../apps/api/app/presence.py) is in memory, expires after 30 seconds, and emits SSE snapshots every second. Its shared membership cache lasts at most 0.5 seconds. Multiple API replicas do not share village presence. The current [client heartbeat](../apps/web/src/api/client.ts) sends zero coordinates: remote walking synchronization is absent despite coordinates being accepted by the server.

## Inference, manifests and costs

[bridge.py](../workers/gpu/bridge.py) documents five-minute job leases and at most three attempts. Claims use row locking with `SKIP LOCKED`. Segment completion can publish colors/photo portrait and enqueue LAM; LAM completion publishes portrait/head-package references; body completion publishes the stylized mesh head on a preset body. Manifest insertion, next-job insertion, activity and completion occur in one DB transaction. Files may already exist when that transaction fails, so retries and cache identities matter; DB atomicity does not imply atomic filesystem writes.

Local inference isolates SAM 3, LAM, Audio2Expression and Hunyuan environments behind a gateway. [Modal](../workers/modal/app.py) supplies equivalent remote stages using multipart bytes and inline encoded artifacts. The bridge does Gemini stylization on the caller before remote meshing, avoiding a Gemini key inside Modal. API speech/video also uses [gpu_client.py](../apps/api/app/gpu_client.py). Local health decides fallback unless Modal is preferred or the local worker URL is empty. With neither route configured, fixture/preexisting avatars remain usable and generation may remain queued or video be skipped. Face enrollment/verification is CPU-local and is not ported to the Modal gateway.

A talking video starts with explicit TTS or existing audio, then Audio2Expression coefficients animate LAM's Gaussian head. [The worker contract](../workers/gpu/TALK_VIDEO.md) describes ARKit-52 inference, resampling and 512×512, 25-fps H.264/AAC output capped at 15 seconds. This is an offline video render, distinct from browser expression playback. [gram_video.py](../apps/api/app/gram_video.py) only accepts an MP4 next to the gram's audio and gates use on the persisted delivery deadline. Modal cold work can exceed the 120-second message window; completing later does not retroactively replace a sent fallback.

The [Modal report](../workers/modal/README.md) supplies historical cold/warm observations: short talk 170/12.3 seconds, LAM bake 180/52 seconds, and stylized head mesh 195/28 seconds. The code's L4 estimate uses $0.80/hour; this is a recorded assumption, not a fresh price quotation. Four GPU classes each allow one container. At that assumed rate, simultaneous saturation would be $3.20/hour for GPU alone, before CPU/RAM, gateway, volumes, warm grace periods and third-party generation. The report's older two-class ceiling and absolute zero-idle-cost statement should not be treated as budget guarantees.

[budget_guard.sh](../workers/modal/budget_guard.sh) stops the app when polled metered cycle spend reaches a default $25 threshold, allowing headroom against the $30 target. The documented cron cadence is 30 minutes. Delayed metering, a missing cron job or requests already admitted can overshoot; source alone does not prove the guard is currently installed. Its parser uses the first numeric metered field and treats an absent field as zero, so billing-format changes can defeat the intended stop. No inference or billable provider call was made during DOCS-012.

## LLM execution and security boundary

[Mayor](../apps/api/app/mayor.py) uses Pydantic response schemas, bounded output and 25-second requests. OpenRouter supports a bounded JSON repair attempt; Gemini uses structured output with SDK retries disabled beyond its configured attempt. Provider precedence is configurable and the code default is OpenRouter, despite Gemini being the named hackathon provider. The Gemini default model is 2.5 Flash-Lite; `GEMINI_MODEL` overrides it. Vision evidence bypasses provider alternation and calls Gemini directly.

Model context includes bounded memory and permitted event effects. User text, evidence and external activity are data, never system instructions. Model-proposed IDs/effects require application validation before mutation. Provider provenance is retained; deterministic fallback is distinguishable from a model response. [security.py](../apps/api/app/security.py) propagates daily denial rather than converting it into a free event. [budget.py](../apps/api/app/budget.py) reserves every physical LLM call in an independent DB transaction, so a later business rollback cannot refund it. The default hourly cap is 60; daily caps are documented in the README.

Daily limits use locked process-local UTC counters. Restarting resets them; extra workers multiply effective capacity. They meter operations, not dollars or tokens, and bridge retries/worker-side Gemini work are not a unified distributed billing ledger. Cached results avoid new generation charges; privacy deletion remains available. Public HTTP receives a 65-MiB request cap, with tighter feature-specific checks where implemented. This middleware does not impose the same request-body cap on WebSockets.

[Auth](../apps/api/app/auth.py) verifies JWT identity and membership; internal HTTP uses a service key. Demo mode separately permits impersonable seats. Public production builds currently retain demo-seat UI; do not claim Auth0 alone makes those seats private. The optional face matcher lacks liveness protection and cannot be presented as a secure identity replacement.

Debug routes require explicit enablement, an actual loopback peer and no forwarded header. Client-IP accounting trusts a header only from `127.0.0.1`, using the rightmost valid address; therefore the trusted proxy must append or overwrite reliably. [Production Uvicorn](../ops/deploy/village-prod-api.service) disables proxy-header rewriting. Remote ingress, the VM loopback proxy and any future proxy hop must be checked together before altering that trust model. A compromised trusted proxy or host is outside this boundary.

## Messaging and external activity

[Spectrum](../apps/imessage/src/index.ts) runs in Bun and talks only to API HTTP endpoints. The API maps phone senders and selects membership. Attachment downloads use the provider's authenticated stream, enforce MIME/size limits and upload to API evidence routes; arbitrary user-text URLs are not fetched. Inbound provider IDs protect durable effects, while hot caches reduce duplicate responses within a process.

The outbox is durable; transport is at-least-once. Claims expire, sends are acknowledged separately, and in-memory partial-send tracking cannot survive a crash. An ambiguous send followed by lease expiry can duplicate delivery. Consent is rechecked; STOP cancels pending/claimed proactive messages but cannot unsend content already handed to a provider. `PHOTON_SEND_ENABLED=false` is a delivery mode, not necessarily a read-only queue inspection: dry runs can consume rows. Use synthetic queues for tests. This task sent no messages.

[The optional activity collector](../apps/activity/README.md) records consented Discord/Steam signals for Mayor context. Those signals and all on-chain metadata are untrusted. Neither them nor inbound text can instruct the coding agent or grant authority to mutate the village.

## Deployment, scale and recovery

The [production layout](../ops/deploy/cutover.md) records the application on the Vultr front VM. Public Caddy forwards to the loopback web proxy on 8082, which serves the release's static assets and forwards API/WebSocket traffic to 8012. The production DB is Postgres 17/TimescaleDB; house state may be separate TigerData. Historical desktop tunnels remain in older reports, not in this topology's required production path.

[DEPLOY-002](infra/PRODUCTION-DEPLOYS.md) serializes preparation/activation, builds dependencies while the old release serves, runs compatible migrations, swaps the current symlink and restarts API/bridge/web with bounded shutdown. HTTP/DB/WebSocket probes gate success; failure restores old code and rechecks health. Three releases are retained. iMessage continues its existing process until an operator restarts it. The production build's current demo flag differs from the earlier DEPLOY-002 narrative; inspect the script rather than copying that historical claim.

This is online preparation plus a brief activation outage, not mathematically zero downtime. Scratch rehearsal reported 5.3–5.4 seconds with stubborn processes and about 15.3–15.5 seconds for failed-readiness recovery. Real production latency is not measured here. Schema rollback, host death/SIGKILL, asset restoration and irreversible writes are outside code rollback. Forced shutdown can interrupt background reviews, generation orchestration and live sockets. Additive migrations must remain compatible with both old and new code.

[Remote runners](infra/REMOTE_RUNNER.md) use isolated worktree paths, dependency caches, SSH and selective environment forwarding; no `.env` is uploaded. `--with-api` provisions a disposable DB and API and cleans them up. The runner is a shared trusted-agent machine, not a tenant isolation boundary. Task workers do not merge or push main; the integrator owns publication and live deployment.

[SCALE-001](perf/SCALE-001.md) attributes the largest API improvement to catalog validation caching, with indexes alone insufficient. Above 25 people, [crowd budgets](../apps/web/src/scene/crowdBudget.ts) reduce detailed bodies; labels share a bounded allocator and weekly review pages cap profile fan-out. Instancing batches trees and parts of the town. The 100-person benchmark used missing GLBs and SwiftShader; generated Gaussian-head costs, hardware-GPU frame rates, full-client concurrency, multi-replica presence and house-listener saturation remain unmeasured. The measured street frame time remained poor. Do not extrapolate a throughput SLA from sequential ASGI latency samples.

## Explicit limitations and publication

| Item | What is established | What remains unverified or simulated |
| --- | --- | --- |
| Offline village | Fixture API and procedural fallbacks exist; local startup checked for this task | Fixture state is not shared durable state |
| GPU | Local/Modal implementations and historical measurements | New production generation, current pricing/spend and installed budget cron not rechecked |
| Houses | Reducers, WebSocket and separate Tiger pool are implemented | No new live Tiger edit; no atomic main/Tiger transaction |
| Movement | Activity/online presence and local walking | Browser does not publish live walking coordinates |
| Delivery | Leases, acknowledgements, media/fallback code | This task establishes no real handset receipt |
| Solana | Program/client source; D-030 in [decisions](DECISIONS.md) records devnet deployment | Older SOL-001 README is predeployment; UI intent is not confirmed product payment |
| Production | Source and checked-in cutover/rehearsal records | No fresh live feature rehearsal or production downtime measurement |
| Security | Membership, consent, caps and debug restrictions in code | Demo seats, process-local budgets, host/proxy trust and media publication remain explicit risks |

Pretrained-model terms are separate from a project license. Existing [CV disclosures](cv/cv007.md) record gated SAM weights, noncommercial LAM weights and Hunyuan3D territory restrictions; these are project-recorded disclosures, not a new upstream legal review. Face/voice consent for demo use does not automatically authorize public Git history. [The audit](security/REPO-AUDIT.md) inventories historical media and credential candidates without exposing values. The owner should choose a project license only after reviewing third-party terms and publication rights; no LICENSE is added here.
