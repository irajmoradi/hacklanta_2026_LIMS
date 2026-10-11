# Village iMessage Mayor

The cloud Spectrum entry point is `src/index.ts`. `src/agent.ts` contains the same handlers
used by unit tests and the local simulation. SDK version remains locked at 12.10.1.

## Runtime configuration

Use the existing external environment file; credentials are read into process memory only:

```powershell
$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'
$env:VILLAGE_API_URL='http://127.0.0.1:8016/api'
bun install
bun start
```

`bun start` connects to real Spectrum and can deliver real messages. Run the simulation below
for a transport-free trial. `SERVICE_KEY`, `PROJECT_ID`, and `PROJECT_SECRET` must be nonempty.
`VILLAGE_API_URL` must be an HTTP(S) API base without embedded credentials, query or fragment.
`OUTBOX_POLL_MS` defaults to 15000; allowed integer range is 100..60000. Explicit process
variables override `VILLAGE_ENV_FILE`; Git Bash `/c/...` paths also work on native Windows.
Apply API migrations through 020 before using these handlers against a deployment.

## Commands

- `checkin: <text>` records a status check-in and reacts with a thumbs-up on success.
- `progress: <text>` records progress on the sender's active current-week goal.
- `goal: <text>` sets/edits this week's goal (title at most 200 characters).
- `status` returns XP, level, streak and the village's current XP leader.
- `my goals`, `competitions` / `what am I in`, `standings` / `rank`, `XP`, `level`,
  `streak`, and `help` return short answers backed by database records.
- Photos (JPEG/PNG/WebP, up to 10 MiB each) become evidence for the one joined open audited
  competition, or progress on the active goal when there is no such competition. Multiple
  competitions prompt for `1`, `2`, etc.; the choice expires after ten minutes. `cancel`
  clears it. Up to 20 photos can wait for one choice. Captions, including `checkin: ...`,
  become the evidence body. Each photo triggers the existing evidence review.
- `pray: <text>` explicitly asks the Mayor for an event proposal.
- Other text gets a short AI reply with the sender's week as context; it creates no event.
- `STOP` turns off proactive Mayor messages and cancels pending/claimed outbox items. Replies
  to subsequent user-initiated commands still work; profile settings can re-enable outreach.

Commands use the sender's oldest membership (join timestamp, then village ID). Unknown,
ambiguous or unjoined senders get the same invite guidance. Every Mayor reply is AI-labeled.
Keyword questions require no LLM. Other user text uses the existing provider for intent
classification before chat; prayer and photo review also use their existing providers.
All test providers are mocked. Competition deadlines/team targets are absent from the current
schema: replies report ranks and say no deadline is set, rather than guessing days or percentages.

## Verification without iMessage

From the repository root:

```powershell
$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'
bun test --cwd apps/imessage
bun run --cwd apps/imessage typecheck
bun run --cwd apps/imessage simulate
```

Simulation requires Python, uv, Bun and PostgreSQL/TimescaleDB from the runtime environment.
It uses only `village_test`, creates a random schema, applies migrations twice, seeds fixtures,
and adds a **new** synthetic user with phone `+15555550101`. A temporary Uvicorn port serves
these isolated tables. The fake Spectrum stream drives the production handlers and verifies
one check-in, 10 XP, a durable inbound receipt and outbox `sent`. The server and schema are
removed in `finally`. Existing villagers, shared API :8010, and real messaging are untouched.
No Photon credentials or paid-provider access are required by the simulation.

## Delivery behavior and limits

Outbound echoes and unrelated non-text messages are ignored. Spectrum attachments and grouped
text/photo messages are handled using authenticated `attachment.stream()` downloads; the agent
enforces MIME/byte limits and cancels oversized streams before uploading multipart evidence.
No URL in user text is fetched. A bounded hot cache and an in-flight map
suppress repeats; provider-prefixed message IDs also dedupe API effects transactionally across
restarts. Retried responses are cached while the agent lives. API/network failures use capped
exponential backoff (maximum 60 seconds); requests time out and outbox polls cannot overlap.
Permanent API errors produce command guidance or terminal outbox failure, without raw error
logging. JSON logs contain event names, timing and numeric status, never message bodies,
phone numbers, URLs or credentials.

The agent claims one outbox item per poll. Audio must come from the configured API's
`/internal/assets/` path, with `X-Service-Key`, no redirects and an audio content type. A failed
audio fetch cannot silently mark the message sent. Content uses Spectrum's `voice()` builder.
Successful text/audio stages survive ack retries in memory; failed claims become retryable
after the existing two-minute API lease. Cloud iMessage supports thumbs-up tapbacks; a failed
reaction is logged without replaying a successful reply.

Delivery remains at-least-once: a process crash, ambiguous transport outcome or expired lease
can cause duplicates, and STOP cannot retract a transport send already in flight. Claim tokens,
lease renewal and durable transport idempotency would be needed for stronger guarantees.
The inbound stream processes messages serially; a long API outage delays subsequent commands.
SIGINT/SIGTERM stop Spectrum and interrupt backoff; a current HTTP request may finish or time out.
Shared-plan proactive recipients must be allowlisted in Photon; this was not exercised live.
# Delivery switch (FEAT-002)

`PHOTON_SEND_ENABLED` defaults to false. With it unset (or any value except `true`),
outbox rows are acknowledged as `dry_run`, logs include only their IDs, and the agent
does not open recipient spaces, fetch outbound attachments, send replies or send reactions.
Inbound commands and photo uploads still reach the API while replies are disabled.
Villager-grams support authenticated audio and portrait attachments using Spectrum
[`voice` and `attachment` builders](https://photon.codes/docs/spectrum-ts/content).
The agent rechecks consent just before handing a gram to Photon.

Only after the owner approves live delivery in their terminal, run in PowerShell:

```powershell
$env:VILLAGE_ENV_FILE = 'C:/Users/mourn/Downloads/hacklanta/.env'
$env:PHOTON_SEND_ENABLED = 'true'
bun run --cwd apps/imessage start
```

This runtime override loads credentials from the existing external env file without
copying them. Restart the agent with `$env:PHOTON_SEND_ENABLED = 'false'` to disable
delivery again. Dry-run rows are terminal and never automatically resent. Enabling
this switch affects all agent delivery, including pending Mayor messages; inspect
the pending outbox first. Each recipient must set their own number and opt in in
Settings. Photon project recipient/line access must also be configured by the owner.

The local simulator passes an explicit live flag only to its fake transport; it sends
no real iMessages. Revocation cannot recall provider-accepted messages, and existing
lease recovery can duplicate transport after a crash between sending and acknowledgement.

## Try FEAT-011 from a phone

Apply migrations from `apps/api` with `python -m scripts.migrate` using `VILLAGE_ENV_FILE`,
then start the API and this agent against the same API base/service key. Use an already
configured Photon line with live delivery enabled as described above. Register your phone
in Village Settings and join the village. Text `goal: Run 20 miles`, then `my goals`, `XP`,
`streak`, and `help`. Send a photo with caption `checkin: Ran three miles`; the reply names
the goal and its progress check-in appears in the app. Join one audited competition and
send another photo to create an entry. Join a second and send a photo: reply `2` to the
numbered list within ten minutes. Text `competitions` or `rank` to see confirmed points.
Unknown numbers get invite guidance. No live Photon messages are sent by automated tests.
