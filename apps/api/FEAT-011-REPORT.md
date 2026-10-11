# FEAT-011 — iMessage questions and photo evidence

Branch: `feat/FEAT-011`. Implementation milestone: `80e2950`.
The final task commit adds regression coverage and this report; see branch HEAD.

## Delivered

- Keyword-first questions for goals, competitions, standings/rank, XP/level/streak and help.
  Other phrasing is classified through the existing Mayor provider using a constrained schema;
  factual answers come from SQL, never model-generated numbers. Existing commands/chat remain.
- Service-authenticated multipart `/api/internal/inbound/evidence` accepts registered senders,
  validates actual JPEG/PNG/WebP images and enforces a 10 MiB limit. Photo captions, including
  `checkin:` and `progress:`, become the evidence body.
- Exactly one joined open audited competition gets an entry. Several prompt for a numbered
  choice, persisted for ten minutes and revalidated on selection. Up to 20 photos share that
  choice; invalid choices, cancellation, expiry and closed competitions have explicit replies.
  No eligible competition routes to the active weekly goal and its existing AI review.
- Spectrum authenticated attachment streams and grouped text/photos feed the new endpoint.
  Download limits cancel oversized streams; stable per-photo IDs deduplicate API effects.
  Unknown senders receive invite guidance without stored evidence. New logs contain no PII.
- Background review uses the existing competition/check-in workflows and works with provider
  fallback and the GPU worker offline. Replies promise review, not unearned XP or acceptance.

## Changed files

- `apps/api/app/inbound.py`, `main.py`: dispatch, background tasks and service endpoint.
- `apps/api/app/inbound_queries.py`, `inbound_evidence.py`: factual replies and evidence routing.
- `apps/api/migrations/025_inbound_evidence.sql`: durable pending choices without phone strings.
- `apps/api/tests/test_feat011.py`: intent, API, review, concurrency, authorization and routing tests.
- `apps/imessage/src/agent.ts`, `agent.test.ts`, `evidence.test.ts`: Spectrum handling and tests.
- `apps/imessage/README.md`, `packages/contracts/api.md`: runtime, phone trial and HTTP contract.
- `apps/api/FEAT-011-REPORT.md`: this report.

## Validation

Python tests use the external `VILLAGE_ENV_FILE` at runtime and an isolated schema in
`village_test`. LLM/vision/voice and Spectrum transport are mocked. No secrets were copied,
no live messages sent, and no paid generation performed. No UI was changed; screenshot: N/A.

Initial checks exposed TypeScript fixture/signature issues and an old test expecting photos
to be ignored; these were corrected. Final commands and results are recorded below.

| Working directory | Command | Result |
| --- | --- | --- |
| `apps/api` | `.venv/Scripts/python -m pytest tests/test_feat011.py tests/test_api006.py tests/test_v2.py -q` | Exit 0; 44 passed |
| `apps/api` | `.venv/Scripts/python -m ruff check app/inbound.py app/inbound_queries.py app/inbound_evidence.py tests/test_feat011.py` | Exit 0; all checks passed |
| `apps/imessage` | `bun test` | Exit 0; 20 passed, 99 assertions |
| `apps/imessage` | `bun run typecheck` | Exit 0 |
| repository root | `git diff --check` | Exit 0 |

Dependencies installed successfully with `python -m uv sync --frozen` and
`bun install --frozen-lockfile` (both exit 0). Earlier targeted runs also passed:
`pytest tests/test_api006.py -q` (6 tests) and
`pytest tests/test_feat011.py tests/test_api006.py -q` (24 tests before added regressions).

## Try from a phone

1. From `apps/api`, set `VILLAGE_ENV_FILE` to the existing external env path, install dependencies
   (`python -m uv sync --frozen`), then apply migrations with `python -m scripts.migrate` and
   run the API using the project's normal startup command.
2. From `apps/imessage`, run `bun install --frozen-lockfile`; set `VILLAGE_API_URL` to the API
   base ending in `/api`. Use the existing configured Photon line and delivery settings in
   its README (`PHOTON_SEND_ENABLED=true` for visible replies), then `bun start`.
3. Register your phone in Village Settings, join the village, and text `goal: Run 20 miles`.
   Ask `my goals`, `XP`, `level`, `streak`, and `help`.
4. Send a PNG/JPEG/WebP photo with `checkin: Ran three miles` as its caption. With no audited
   competition joined, inspect the goal's evidence check-in and review in Village.
5. Join one audited competition and send another photo: inspect its new entry. Join a second,
   send a photo, and reply `2` within ten minutes. Ask `competitions` or `rank` to see standings.
   `cancel` clears a pending selection; an expired selection asks for a fresh photo.

## Choices and limitations

- Preserved the existing oldest-village-membership routing and current UTC weekly goal model.
- “Needs evidence” means joined, open, non-friendly competitions, matching existing entry rules.
- Rank uses confirmed points with shared rank for ties. Progress count counts progress check-ins;
  it is not a fabricated percentage. Weekly goals include actual days remaining.
- Competition deadlines and team targets do not exist in the current schema. Replies explicitly
  say “no deadline set.” Proposed integrator extension: optional competition `ends_at` plus
  team membership/target/progress fields before promising competition days-left or team percent.
  No schema-contract file was changed; the new endpoint is documented in the allowed `api.md`.
- Supported image formats match the existing image validator; HEIC must be sent/exported as
  JPEG/PNG/WebP. Pending choices survive process restarts. Already uploaded assets use the
  existing evidence retention behavior even after cancellation or expiry.
- Live Photon delivery was not exercised. Transport remains at-least-once; durable API receipts
  prevent duplicate domain writes when the agent supplies the same message IDs.
- No implementation blockers remain. Deploy migration 020 before starting the updated handlers.
