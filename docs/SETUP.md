# Village setup

Start with the browser-only town, then add a scratch API and the services you need. These instructions describe the DOCS-015 source review of production baseline 86bc24e on October 11, 2026. Provider prices below are recorded hackathon estimates, not quotes. No account credentials are needed for mock mode. Never use the shared API on port 8010 for migrations, seeds, disaster rehearsals or tests.

## Local in five minutes: mock mode

Install Git, [Bun](https://bun.sh/), and Node 22.12+ with npm (the nested wallet package uses npm during postinstall). Clone the repository using its Git URL and enter the checkout. Use Bash on Linux/macOS or Git Bash on Windows:

```bash
git clone YOUR_REPOSITORY_URL village
cd village
cd apps/web
bun install --frozen-lockfile
VITE_MOCK=1 VITE_DEMO_AUTH=1 VITE_AUTH0_ENABLED=0 VILLAGE_API_URL=http://127.0.0.1:9 bun run dev --host 127.0.0.1 --port 4174
```

Open `http://127.0.0.1:4174`. Choose a demo seat, open Friends, make a fixture check-in, visit Shop and Compete. Open `http://127.0.0.1:4174/lab` for the hidden Demo Lab: Big town, Disasters & repair, Village futures, Your first day and Avatar studio. Lab world edits stay in the browser and reset on reload. Avatar studio can read permitted cached media in connected mode; missing assets use labeled placeholders. Ordinary mock API flows store no shared progress and cannot prove multiplayer or payment settlement. **Exception:** “Ask the Mayor” calls `/api/lab/repair-plan` directly, even in mock mode. The command above directs its proxy to unused loopback port 9, so it returns a labeled offline example without reaching the shared API. Keep that port unused; its expected proxy connection error is harmless. With a configured API, that explicit click may make a capped LLM call, but the endpoint writes no village state.

Smoke test in another terminal: `curl --fail http://127.0.0.1:4174/`. Expect HTML; then check the town in a browser. First dependency downloads may take longer than five minutes. If a remote runner is configured, use it for heavy checks as described below; this dev server is for your local browser.

### Repair rehearsal and latest UI

In Disasters & repair, select a disaster, click **Ask the Mayor**, expand **Why the Mayor chose these**, simulate each task until its target is met, then click **Repair**. Status text summarizes selection steps and identifies the model/example; it is not private model reasoning. Connected repairs require tagged photo evidence with a latest verified review; ordinary check-ins only advance legacy disasters. New plans choose 2–3 distinct activities with targets of 1–6. Missing providers use bounded examples.

The five scenes are Big town (`#town`), Disasters & repair (`#disasters`), Village futures (`#futures`), Your first day (`#onboarding`) and Avatar studio (`#pipeline`). WEB-058 improves mobile navigation/Colosseum layout, label/sign hit targets, competition ordering, feed destinations, badge labels and Gazette text. `VITE_DEMO_DEBUG=1` opts into the debug probe; keep it off for shared deployments. It does not replace API `DEMO_DEBUG` or its loopback restrictions.

## Configuration rules

[.env.example](../.env.example) inventories names and readers, including optional worker, deployment and test controls. Its active values select a safe rehearsal; commented assignments are optional. Do not uncomment every blank setting: blank numeric values can fail parsing and blank paths can disable useful defaults.

For a new installation, create a private environment file outside Git and enter only the services you enable. Existing teammates use the existing file via `VILLAGE_ENV_FILE`; never copy it into this worktree. API `app/config.py` and activity `config.py` use python-dotenv without overwriting process values. iMessage `src/config.ts` reads the selected file into memory. The CPU bridge has its own loader: use a native absolute path, and set `ASSET_DIR` explicitly to the same directory as the API. Its fallback asset path is relative to the environment file, unlike the API default.

Vite reads only public `VITE_*` settings from the directory of `VILLAGE_ENV_FILE`, using Vite's normal `.env` filenames; an arbitrarily named private file is not loaded by filename. Export the public settings in the process if necessary. `VILLAGE_API_URL` must be exported before starting Vite; its default targets the shared 8010 API. Never put secrets in `VITE_*`. Web flags are compiled into a build. `GEMINI_MODEL` and `GRAM_VIDEO_MODAL_WAIT_S` are read at module import: export overrides before starting Python rather than relying on later dotenv loading.

## Connected local stack, without paid providers

Install Docker and Python 3.12 with [uv](https://docs.astral.sh/uv/). Use a new local container/volume and a free port. This passwordless container is for trusted local scratch data only; it binds loopback and is not the production database.

```bash
# Repository root; do not reuse an existing village database.
docker run -d --name village-docs-scratch \
  -p 127.0.0.1:55434:5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=village_scratch \
  -v village-docs-scratch:/var/lib/postgresql/data \
  timescale/timescaledb:latest-pg17
docker exec village-docs-scratch pg_isready -U postgres -d village_scratch
# Repeat readiness until accepting connections, then:
export VILLAGE_ENV_FILE=/dev/null
export DATABASE_URL=postgresql://postgres@127.0.0.1:55434/village_scratch
export TIGER_DATABASE_URL= GOOGLE_API_KEY= OPENROUTER_API_KEY= ELEVENLABS_API_KEY=
export GPU_WORKER_URL= GPU_WORKER_BASE= GPU_FALLBACK_URL= GPU_FALLBACK_KEY=
export DEMO_AUTH=1 DEMO_DEBUG=0 MAYOR_SCHEDULER=0 MAYOR_VOICE=0
export LLM_MAX_CALLS_PER_HOUR=0 PHOTON_SEND_ENABLED=false
export ASSET_DIR="$(pwd)/apps/api/.runtime/docs-scratch-assets"
cd apps/api
python -m uv sync --frozen --python 3.12
python -m uv run python scripts/migrate.py
python -m uv run python scripts/seed.py
# Windows native Python only: export UVICORN_LOOP=app.runtime:selector_loop
python -m uv run uvicorn app.main:app --host 127.0.0.1 --port 8016 --no-proxy-headers
```

On Windows use an absolute native path to an empty private file instead of `/dev/null` if your Python cannot resolve it. The explicit empty provider overrides still apply. Set the Windows loop override before Uvicorn starts.

In another terminal, from `apps/web`:

```bash
VITE_MOCK=0 VITE_DEMO_AUTH=1 VITE_AUTH0_ENABLED=0 VILLAGE_API_URL=http://127.0.0.1:8016 \
  bun run dev --host 127.0.0.1 --port 4174
curl --fail http://127.0.0.1:8016/api/health
```

Expect `db=up`; GPU down is fine. Open `/docs` on port 8016 for API shapes. Seeded seats should load. Two browsers against this scratch API can demonstrate overworld movement and furniture updates; two mock tabs cannot. Stop Uvicorn/Vite with Ctrl-C and `docker stop village-docs-scratch` when finished. The named volume preserves scratch data. The connected API requires Postgres; only browser mock mode runs with no DB.

## Service credentials, readers and smoke tests

Tests below use mocks unless explicitly labeled live. Run package tests through `ops/remote_run.sh` when configured. They verify integration behavior, not whether a provider account is funded. Costly credential tests are deliberate user actions on a test village, never a generation loop.

### PostgreSQL and TimescaleDB

The main database owns membership, goals, evidence, coins, XP, payment receipts and jobs. Run the migrator through **059**: 056 adds overworld state, 057 Solana payment/Treasury state, 058 repair tags and 059 single-use seat claims. Earlier numbers have gaps; do not infer the file count from the last number. Docker needs no provider account for the scratch image. `DATABASE_URL` is read by API `app/config.py`, activity `config.py` and GPU `bridge.py`; `ASSET_DIR` selects the API/bridge shared artifact disk. Docker's `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` or `POSTGRES_PASSWORD_FILE` configure the container, not FastAPI. Production `ops/deploy/prod-db.sh` pins the image digest and stores a generated password in a root-only file; never use local trust authentication there.

Smoke: `docker exec village-docs-scratch psql -U postgres -d village_scratch -Atc 'SELECT extname FROM pg_extension ORDER BY extname'`, then the API health command above. Local Docker has no hosted database bill. VM disk/backup costs remain. Missing DB means connected startup/readiness fails; mock mode still works.

### TigerData: live house interiors

Sign up at [Tiger Cloud](https://console.cloud.timescale.com/), create a Timescale service and use its connection details with TLS. The recorded service used a **free shared DEV tier in us-east-1** (D-036); current availability must be checked in the console. Keep the connection string in `TIGER_DATABASE_URL`. API `app/config.py`, `app/main.py` and `app/houses.py` use the separate pool for transactional room reducers, move history, LISTEN/NOTIFY and WebSocket fan-out. Main application state remains in the main DB. See [service setup](https://www.tigerdata.com/docs/getting-started/latest/services).

On a new test service, from `apps/api`: `python -m uv run python scripts/tiger_migrate.py`. It updates **both** configured databases, so verify both are scratch targets first. Smoke: `../../ops/remote_run.sh python -m uv run pytest -q tests/test_feat019.py` (mock/scratch integration), followed by two authenticated browsers moving furniture on your test service. With `TIGER_DATABASE_URL` omitted, rooms use the main DB. A configured Tiger outage does not silently switch to another writable database.

### Gemini through Vertex AI express; OpenRouter fallback

[Google Cloud express signup](https://console.cloud.google.com/vertex-ai/studio) supplies the Vertex API-key flow; [Google's express FAQ](https://cloud.google.com/resources/cloud-express-faqs) explains the console transition and key location. Village used **Vertex AI express**, not an AI Studio key on the disabled Generative Language API (D-009). Export `GOOGLE_API_KEY`, `GOOGLE_GENAI_USE_VERTEXAI`, `GEMINI_MODEL` and `LLM_PROVIDER`. `app/config.py` reads credentials/provider choice; `app/mayor.py` reads the model and implements schema-constrained calls. The checked-in Gemini default is `gemini-3.5-flash-lite` (R-171); this is a project configuration claim, not a promise that every new Google account has that model. Evidence review uses Gemini directly. GPU caller-side image stylization uses a separate `STYLIZE_MODEL` in `workers/gpu/stylize.py`.

For OpenRouter, sign up and create a scoped key in [Keys](https://openrouter.ai/settings/keys), then fund the account if required. Set `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `LLM_PROVIDER`; see the [official quickstart](https://openrouter.ai/docs/quickstart). Code defaults to OpenRouter first; choose Gemini explicitly for the intended demo, with OpenRouter second. D-018 records `deepseek/deepseek-v4-flash` and an approximate $0.01/M input-token development estimate. No Google billing tier or total LLM bill is recorded; inspect account quotas before enabling work.

Smoke: from `apps/api`, `../../ops/remote_run.sh python -m uv run pytest -q tests/test_providers_auth.py`. For a real credential check, make one explicit Mayor request in your scratch village, inspect returned provenance, then stop; fallback text alone does not prove Gemini worked. Do not use the historical `scripts/smoke_providers.py` as a current model check: it expects an old Gemini model prefix and also creates an event and requests paid TTS. Without keys, deterministic Mayor fallbacks remain labeled; vision review reports an error for human review. Disable `MAYOR_SCHEDULER` and `MAYOR_VOICE` for rehearsal.

### ElevenLabs: voice cloning and speech

Create an account at [ElevenLabs](https://elevenlabs.io/), then create an API key under Developers/API Keys with the voice/TTS permissions you need. Voices → Add voice → Instant Voice Clone is the IVC flow; [the official guide](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning) explains sample quality and rights confirmation. IVC requires a paid eligible plan; [the recorded project status](STATUS.md) identifies the team's **Creator tier with IVC allowed**, but records no subscription price. It uses IVC, not Professional Voice Cloning. Use only a speaker's consented samples and retain their permission for friend-generated speech separately.

`ELEVENLABS_API_KEY` is read by `app/config.py`; `app/voice.py` owns clone/TTS requests, stored voice IDs and stock alternatives. Voice IDs are DB data, not additional env settings. `MAYOR_VOICE` enables optional Mayor narration. Missing key leaves text and existing cached media usable; new voice requests are unavailable. Stock voices still require a provider key for new speech. The shared durable voice budget lives in `ASSET_DIR`.

Smoke: `../../ops/remote_run.sh python -m uv run pytest -q tests/test_providers_auth.py` from `apps/api`. A real smoke is one user-requested short stock line on scratch, or one consented clone through onboarding; neither is part of ordinary setup validation. Sound effects and trailer audio are prepared assets, not a background generation loop.

### Modal GPU, local models and the CPU bridge

Sign up at [Modal](https://modal.com/), install the CLI (`uv tool install modal==1.6.1`) and authenticate with `modal token new`. The [Modal guide](https://modal.com/docs/guide) covers account setup. The project used credit-backed, scale-to-zero **L4** workers; its paid subscription tier is not recorded. Create the `village-gpu-key` secret in the Modal dashboard with the name `GPU_KEY`. Store its matching caller credential as `GPU_FALLBACK_KEY` in the API/bridge private environment (or use `GPU_FALLBACK_KEY_FILE`). Do not paste secret values into shell history. Modal's secret API is documented [here](https://modal.com/docs/cli/latest/secret).

The app needs the `village-weights` volume. Obtain model access at [Hugging Face](https://huggingface.co/settings/tokens), accept SAM 3's gated terms, and use `HF_TOKEN` for downloads. Run the isolated setup scripts in [workers/gpu/README.md](../workers/gpu/README.md): SAM 3, LAM, Audio2Expression and export setup, plus `scripts/setup_hy3d.sh` for Hunyuan3D. Use WSL/Linux with conda and CUDA for local inference. Override `VILLAGE_REPO`, `VILLAGE_DATA_DIR`, `VCV_ROOT` before those scripts: their historical default paths belong to the original workstation. `scripts/env.sh` looks for `HF_TOKEN` in the process or `VILLAGE_REPO/.env`, not `VILLAGE_ENV_FILE`; supply it in the process when using an external file. Never copy weights or personal inputs into Git.

From repository root in the authenticated Linux/WSL environment:

```bash
modal volume create village-weights
# Populate these paths from your consent/license-cleared local model caches:
modal volume put village-weights "$LAM_ROOT/model_zoo" /lam/model_zoo
modal volume put village-weights "$LAM_ROOT/assets" /lam/assets
modal volume put village-weights "$A2E_ROOT/pretrained_models" /a2e/pretrained_models
modal volume put village-weights "$HF_HOME/hub" /hf/hub
modal volume put village-weights "$HOME/.cache/torch/hub" /torch/hub
modal deploy workers/modal/app.py
modal app list
```

Inspect `workers/modal/app.py` for the exact mounted paths and model requirements before deploying; LAM export also uses Blender/FBX assets and Hunyuan may download additional weights. The WSL wrapper in [workers/modal/README.md](../workers/modal/README.md) selects the historical local profile; new users should use their own authenticated profile. `MODAL_CONFIG_PATH` and `MODAL_PROFILE` are CLI/wrapper controls, not API credentials.

Set `GPU_FALLBACK_URL` to your deployed gateway, `GPU_PREFER` to Modal, and leave `GPU_WORKER_URL` empty for cloud-only inference. API `app/config.py` and bridge `workers/gpu/bridge.py` read these settings. `GPU_KEY` is read only inside the gateway. For local inference set `GPU_WORKER_URL` to the local worker and optionally `GPU_WORKER_BASE` for the bridge. Local worker paths and controls are catalogued in `.env.example`. Face login remains local CPU worker functionality; the Modal gateway does not implement it.

Gateway smoke: `curl --fail "$GPU_FALLBACK_URL/health"` (CPU cold start may take time; it does not prove a GPU render). Local smoke: `curl --fail http://127.0.0.1:8100/health`. The gateway runs SAM 3 segmentation, LAM head/export and talking-video rendering, Audio2Expression and Hunyuan3D head/object mesh stages. Gemini stylization stays on the caller, so its key need not enter Modal.

The **CPU bridge** runs beside the API, uses its Python dependencies, `DATABASE_URL` and the identical `ASSET_DIR`, claims durable jobs and publishes artifacts. Start from root with `python -m uv run --project apps/api python workers/gpu/bridge.py`. It has no GPU requirement. Smoke against an **empty scratch queue**: append `--once`; exit 0 means the queue drained, not that a model ran. With pending jobs, this command performs work and can incur charges. `NO_NEW_GEMINI` prohibits new stylization calls. `GRAM_VIDEO_MODAL_WAIT_S` controls the API's Modal wait; the separate delivery deadline can cause audio/portrait fallback before a render completes. Offline workers leave jobs queued and fixture/preset avatars usable.

Recorded GPU estimates: short talking clip $0.034 cold/$0.002 warm, LAM bake $0.038/$0.011, stylized head $0.04/$0.006. Four classes each permit one L4 with zero minimum containers, 120-second scale-down and 600-second calls. At the recorded $0.80/L4-hour, four continuously active classes alone can cost $3.20/hour. Idle grace time, CPU, storage and provider calls add costs. The historical README's two-class ceiling is stale. `bash workers/modal/budget_guard.sh 25` polls spend and stops `village-gpu` at the recorded $25 threshold against a $30 budget; schedule it only for your own app. Delayed metering can overshoot. `modal app stop village-gpu` stops your deployment when finished.

### Photon Spectrum iMessage

Sign up at [Photon](https://app.photon.codes/). Create a project, open **Settings** and obtain the project ID and project secret (some SDK guidance calls this `SECRET_KEY`; Village expects `PROJECT_SECRET`). Configure an iMessage line and permitted recipients. The app README describes shared-plan recipient allowlisting; the exact purchased plan is not recorded. Shared/dedicated line capabilities and billing must be checked in your project. See [Spectrum setup](https://photon.codes/docs/spectrum-ts/getting-started).

`apps/imessage/src/config.ts` and `src/index.ts` read `PROJECT_ID`, `PROJECT_SECRET`, `SERVICE_KEY`, `VILLAGE_API_URL`, `OUTBOX_POLL_MS`, `PHOTON_SEND_ENABLED` and `VILLAGE_ENV_FILE`. The API must use the same `SERVICE_KEY`. Unlike Vite's proxy URL, this agent's `VILLAGE_API_URL` **includes `/api`**. The cloud agent uses pinned `spectrum-ts` 12.10.1; no Mac Messages database is required. It accesses FastAPI over HTTP and never the DB directly.

Smoke without transport: from `apps/imessage`, `../../ops/remote_run.sh bun test` and `../../ops/remote_run.sh bun run typecheck`. The `simulate` script additionally requires the isolated test DB described in [the app README](../apps/imessage/README.md). To connect your configured project, `bun install --frozen-lockfile`, then `bun start`. `PHOTON_SEND_ENABLED=false` suppresses replies, reactions and outbound delivery, but inbound commands can still change API state. Use a test village. Only enable actual delivery for an explicitly authorized test with opted-in recipients and speaker consent. STOP cancels future proactive outreach, not already accepted sends. Without credentials, leave the agent stopped; the browser and check-ins still work. No per-message price is recorded.

### Auth0 and demo auth

Sign up at [Auth0](https://auth0.com/signup). In Dashboard → Applications → Applications, create a Single Page Application; copy Domain and Client ID from Settings. Create an API with an identifier/audience, and enable a login connection for the SPA. [Auth0's SPA guide](https://auth0.com/docs/get-started/auth0-overview/create-applications/single-page-web-apps) describes registration. Add your localhost origin and production HTTPS origin to allowed callbacks, logout URLs and web origins. The repository does not record the team's billing tier; a development tenant is sufficient for configuration testing subject to current quotas.

API `app/config.py`/`app/auth.py` read `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `DEMO_AUTH`; browser `src/Auth.tsx` reads `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_AUTH0_ENABLED`, `VITE_DEMO_AUTH`, `VITE_MOCK`. Browser `src/api/client.ts` also reads optional `VITE_DEMO_USER`. Keep audiences aligned; the browser needs no client secret. Smoke: log in to your scratch application and inspect an authenticated village read, then log out. `../../ops/remote_run.sh python -m uv run pytest -q tests/test_providers_auth.py` checks mocked JWT handling.

Production deployment defaults `VITE_AUTH0_ENABLED=0`; Sign in stays hidden. For an approved combined demo build, export `VITE_AUTH0_ENABLED=1` in the deployment process and rebuild with all three public Auth0 settings. Keep `DEMO_AUTH=1` and `VITE_DEMO_AUTH=1` for Play as alongside Sign in. Raw Vite source treats an unset enable flag as enabled when all three settings exist and mock mode is off, so set it explicitly for predictable local behavior. Hiding Sign in does not revoke sessions or disable API JWT validation.

After migration 059, an operator issues a private single-use code for an existing demo seat with `python -m uv run python -m scripts.claim_codes --village VILLAGE_UUID --seat SEAT_UUID` from `apps/api`, reading the existing runtime env file. The CLI prints the code once after commit; never log or publish it. Codes expire after 72 hours; reissue revokes prior codes. Signed-in users enter the code on **Claim your villager**, preserving the seat's UUID, house, avatar and progress. Existing members/linked seats cannot be merged or reassigned this way. No-code users can create/join a village normally. See [two-laptop sign-in](auth/JUDGE_LOGIN.md) for tenant origins and rehearsal; real tenant login and code issuance remain operator actions.

Without Auth0, deliberately select both API/browser demo flags for a scratch deployment, or use browser mock mode. A demo seat is impersonable. The current `ops/deploy/prod-build.sh` hardcodes `VITE_DEMO_AUTH=1`; exporting zero when calling that script does not override it. An Auth0-only production build needs an integrator-reviewed change to that script as well as `DEMO_AUTH=0` on the API.

### Solana devnet, wallets and Treasury

No paid RPC account is required for the public devnet endpoint. Install a Wallet Standard compatible wallet, select devnet and use test SOL from the [Solana faucet](https://faucet.solana.com/). Wallet seed phrases/private keys never enter Village. [FEAT-027](solana/FEAT-027.md) is the current program runbook; older sections in `solana/README.md` describe v1.

API `app/config.py` reads `SOLANA_RPC_URL`, `SOLANA_PROGRAM_ID`, `SOLANA_TREASURY_ADDRESS`. The current frontend consumes server-prepared intents; historical `VITE_SOLANA_PROGRAM_ID` is no longer read. Missing program/treasury configuration disables the respective paid action while free/coin competitions work. SOL purchases require wallet review, explicit signing/sending and server-verified receipts. Treasury converts devnet SOL to personal XP (100,000 lamports/XP, 1,000 XP/account/day); it does not grant coins or village XP. Competition payout terms are fixed at creation: winner-take-all, proportional or ranked split. The auditor attests scores and the program enforces distribution.

Safe local smoke, WSL/Linux from repository root: `bash programs/check.sh all` (build + LiteSVM tests with synthetic signers). Requires Anchor 1.2.1, Solana CLI 4.1.2, Rust 1.91.0 and Node 22.12+ per recorded toolchain. This neither requests an airdrop nor sends transactions. Remote runners may lack Anchor; follow their failure guidance rather than treating a failed program build as a pass.

The recorded **v1** devnet program ID is `4m7xFhBQcWfa7u3kP8i78QaTYjkQXSxt5iUfj2689Ehu` (D-030). FEAT-027 keeps that source ID but changes the account ABI from 361 to 386 bytes; this checkout provides no evidence that v2 was deployed. Do not upgrade over funded v1 pots. After owner approval, create a new v2 deployment keypair/address using the owner's normal CLI, then from `programs`:

```bash
export NO_DNA=1
anchor keys list
anchor keys sync
anchor build
cp target/idl/village_pot.json ../packages/pot-client/idl/village_pot.json
(cd ../packages/pot-client && bun run generate && bun run typecheck)
npm test
# Only after reviewing the new ID, fee payer, rent and upgrade authority:
anchor deploy --provider.cluster devnet
```

Synchronize program/client IDs, rerun local tests with the new ID, and configure the API program and treasury public addresses. Retain v1 so existing pots can settle/refund. D-030 records approximately 0.92 **test SOL** for the prior deployment, not a fiat cost. Live deployment, airdrops, joins, Treasury purchases and settlement are separate owner-authorized actions; none are setup validation steps in this documentation task.

### Optional Discord and Steam activity

The collector records consented activity metadata; it does not read messages or award XP. Create a bot at the [Discord Developer Portal](https://discord.com/developers/applications), enable Presence and Server Members intents under Bot, and add it to the relevant server. Obtain a Steam key at [Steam Web API registration](https://steamcommunity.com/dev/apikey). `apps/activity/main.py` reads `DISCORD_BOT_TOKEN`, `STEAM_API_KEY`; `config.py` reads `DATABASE_URL` and `VILLAGE_ENV_FILE`. No purchased tier/cost is recorded. Missing keys skip those providers.

Smoke: from `apps/activity`, `python -m uv run main.py --dry-run` (no DB/network). Apply the separate `sql/001_activity.sql` to your scratch Timescale DB and use the consented account-link CLI in [apps/activity/README.md](../apps/activity/README.md) before real collection. Account linking requires ownership verification outside that CLI.

## Cost caps and unattended work

API `app/security.py` reads every `COST_<KIND>_<SCOPE>_DAILY` combination below; all 15 concrete names are in `.env.example`. Zero prevents new work. These caps count calls, not dollars, and do not replace provider billing limits.

| KIND | GLOBAL | IP | SEAT |
| --- | ---: | ---: | ---: |
| LLM | 300 | 60 | 40 |
| ELEVENLABS | 60 | 15 | 10 |
| GPU | 40 | 10 | 8 |
| PHOTON | 30 | 30 | 10 |
| PHOTON_QUEUE | 30 | 10 | 6 |

Most daily counters are process-local; ElevenLabs uses SQLite under `ASSET_DIR` to share budgets across API/CLI processes. `LLM_MAX_CALLS_PER_HOUR` adds a durable hourly cap. `MAYOR_SCHEDULER`, `MAYOR_TICK_SECONDS`, `MAYOR_VOICE` control background work; explicitly disable scheduling for local demo auth because enabling `DEMO_AUTH` otherwise enables the scheduler by default. `DEMO_DEBUG` is separately gated by a loopback peer and absence of forwarded headers. Keep Uvicorn `--no-proxy-headers`. Direct provider tools/worker calls may bypass API caps. See [SEC-001](security/SEC-001.md) and the Modal budget guard above.

## Vultr, Caddy, systemd and production deploy

Create an account at [Vultr](https://my.vultr.com/), add your public SSH key under SSH Keys, and provision an Ubuntu 24.04 CPU instance only with owner approval. API automation can use `VULTR_API_KEY` from Account → API, but `prod-deploy.py` itself uses SSH and does not read it. D-037 records **vc2-4c-8gb, ewr, about $0.055/hour**; D-019 records $100 credit. The separate runners used **voc-g-16c-64gb**, about $15.8/day each. These are historical costs. Destroy approved disposable instances after use; stopping is not a billing shutdown.

The domain is [thefriendshipvillage.vodka](https://thefriendshipvillage.vodka), registered through [Porkbun](https://porkbun.com/) (D-043). For your own domain, set its A record to your public front VM and configure Caddy's public HTTPS site to proxy loopback 8082; redirect `www` to the apex if desired. Allow inbound 80/443 for HTTPS and SSH only as needed. No DNS API key is read by Village. Add that exact origin to Auth0. Public Caddy terminates TLS; `ops/deploy/prod.Caddyfile` is a **private HTTP** server at 8082, serving the SPA and proxying `/api/*` including WebSockets to 8012. Do not replace the public TLS configuration with that private file.

### First installation versus updates

`ops/deploy/prod-deploy.py` is an **updater for an already provisioned production VM**. It cannot bootstrap an empty machine. For a new machine, an operator must prepare the layout below before the first update; [the cutover runbook](../ops/deploy/cutover.md) explains migrating an existing village with a write freeze. Its original historical state and old demo-auth claims are superseded by the current code notes here.

1. Install Docker, Caddy, Python 3.12, Node 22, Bun and uv. `ops/deploy/provision.sh` prepares staging tools under `/var/lib/village/tools` and a scratch staging DB; it does **not** install the production layout. Provision a `village-prod` system user and production tool paths `/opt/village/prod-tools/{node,bun,uv}` required by `prod-build.sh` (Node and Bun have `bin/`, uv is the executable directory).
2. Create `/opt/village/prod-releases`, `/var/lib/village-prod/assets` owned by `village-prod`, and `/etc/village`. Run `bash ops/deploy/prod-db.sh` as root for the pinned loopback 55433 DB. Populate `/etc/village/prod.env` through your approved secret-management channel, root:root mode 0600, using the names in `.env.example`. Never upload the workstation environment file. Set `ASSET_DIR` to the shared production asset directory and `VILLAGE_ENV_FILE` to `/dev/null`; the agent URL is loopback 8012 with `/api`. Start with providers/scheduler/sends disabled.
3. Extract a reviewed, committed Git archive into `/opt/village/prod-releases/<sha>`, make it writable by `village-prod` for the initial dependency/build step, and supply the three **public** Auth0 build settings followed by a fourth line, `VITE_AUTH0_ENABLED` (`0` to keep Sign in hidden), on stdin to `bash ops/deploy/prod-build.sh /opt/village/prod-releases/<sha>`. Set `prod-current` to that initial release. Run `scripts/migrate.py` in the API venv using a transient systemd unit with the protected `EnvironmentFile`, as in cutover step 7. For a genuinely new empty village, run the seed script in the same protected environment if demo fixtures are wanted; never seed an existing production village.
4. Install the four `ops/deploy/village-prod-*.service` files into `/etc/systemd/system`, run `systemctl daemon-reload`, and enable/start API and web. Bridge and iMessage stay stopped until their credentials, assets and intended workload are ready. Test the private health endpoint before installing/reloading your public Caddy site. Back up DB/assets and record the initial SHA. Use a coordinated write freeze and the cutover runbook if moving existing data; do not mix the fresh-install seed path with migration of a live village.

Current unit paths are API 8012, web 8082, DB 55433, `village-prod-api`, `village-prod-web`, `village-prod-bridge`, `village-prod-imessage`. Missing VM/domain configuration does not affect local development. Missing GPU credentials should not prevent web/API readiness.

### Routine production update

From the integrated checkout in Git Bash, with `VILLAGE_ENV_FILE` pointing to the existing private file:

```bash
python ops/deploy/prod-deploy.py INTEGRATED_COMMIT_SHA \
  --host root@YOUR_PUBLIC_FRONT_HOST --key SSH_KEY_PATH
```

The host override avoids the script's historical default VM. Source, three public Auth0 settings and the process enable flag (default `0`) transfer; secrets do not. The updater locks, builds while the old release serves, migrates, swaps `prod-current`, restarts API/bridge/web, probes health and a house WebSocket, and rolls code back on failed readiness. It retains three releases. It starts the bridge even if previously stopped; account for pending work before deploying. iMessage keeps its old process until an operator separately restarts it. Schema changes are not rolled back, so migrations must work with the previous release. See [PRODUCTION-DEPLOYS.md](infra/PRODUCTION-DEPLOYS.md).

Read-only smoke on the VM: `curl --fail http://127.0.0.1:8082/api/health` and `systemctl is-active village-prod-api village-prod-web`. Public smoke: `curl --fail https://<your-domain>/api/health`, then login and open the town. Do not run debug events to prove deployment. Review service state and sanitized logs on failure; do not print environment files or connection strings. Code rollback and DB recovery are different procedures.

## Remote test runners

The wrapper reads `RUNNER_IP` from the process or local `docs/infra/runner.env`, with `RUNNER_SSH_KEY`, optional `RSYNC` and `RUNNER_ARTIFACT_DIR`; never publish runner addresses. [REMOTE_RUNNER.md](infra/REMOTE_RUNNER.md) covers provisioning, SSH fingerprint verification and Windows rsync bootstrap. No runner means local tests are allowed against mocks/scratch data. An unreachable SSH host permits a reported local fallback; a failed remote test does not.

```bash
cd apps/web
../../ops/remote_run.sh bun run test
../../ops/remote_run.sh bun run build
../../ops/remote_run.sh bunx playwright test --config tests/lab.config.ts
cd ../api
../../ops/remote_run.sh python -m uv run pytest -q
```

For browser tests needing an API, pass `--with-api` and a config honoring `VILLAGE_API_URL`; the wrapper creates/cleans a disposable API/database. Only forward required names with `--env NAME`. It never copies `.env` and reserves DB/scheduler safety overrides. Dependencies persist remotely and artifacts download locally. `RUNNER_WEB_PORT` controls the supplied runner Playwright config. Smoke for a newly provisioned runner: from `apps/web`, `../../ops/remote_run.sh bun --version`. Historical runner cost is above; coordinate teardown with all teammates.

## Troubleshooting and evidence boundaries

- API down: check scratch DB readiness, migrations, a free port and Windows selector-loop configuration. Do not redirect to 8010 to bypass a failure.
- Auth fails: align API/browser demo flags or Auth0 audience/origins. Rebuild after changing browser flags. Missing membership is distinct from successful login.
- Houses fail while town works: check the configured Tiger connection and migrations; there is no outage failover to the main writable pool.
- No head/video: confirm the API and bridge share DB/assets, inspect queue status, and check gateway health. Health alone does not load all weights. Cold renders can miss the message deadline.
- Wallet fails: confirm devnet, the deployed v2 ABI/address and treasury configuration. Do not repeatedly sign to retry receipt verification.
- Trailer links: [the trailer handoff](devpost/video/TRAILER.md) lists ignored media delivered separately. A fresh clone includes the player and poster, not private face/voice recordings or the MP4s.

Documentation checks and limitations for this task are recorded in [DOCS-015-REPORT.md](infra/DOCS-015-REPORT.md). Instructions above are operator runbooks, not claims that this task provisioned accounts, sent messages, deployed programs or exercised paid inference.
