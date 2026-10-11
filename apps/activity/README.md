# Village external activity collector

Independent Python 3.12 service. Reads Discord gateway metadata and public Steam game
activity; writes signals and `external_activity` feed events into the existing database.
No messages, audio, generated assets, XP awards, or paid model calls. No API changes.

## Setup and run

From the repository root, the integrator applies the shared schema first, then
`apps/activity/sql/001_activity.sql` using their normal migration process. The migration
is additive, transactional, idempotent, UTF-8 without BOM, and requires TimescaleDB.
The collector never applies migrations automatically.

```powershell
cd apps/activity
$env:VILLAGE_ENV_FILE = '/c/Users/mourn/Downloads/hacklanta/.env'
python -m uv sync --locked
python -m uv run main.py --dry-run
python -m uv run pytest -q
python -m uv run ruff check .
```

On systems with `uv` on PATH, `uv` can replace `python -m uv`.
`VILLAGE_ENV_FILE` points to the existing secret file; values are loaded at runtime and
never copied. Existing process environment wins. Git Bash `/c/...` paths work on Windows.
Fallback is this checkout's root `.env`. Required for collection: `DATABASE_URL`.
Optional: `DISCORD_BOT_TOKEN`, `STEAM_API_KEY`; a missing provider key logs a skip.
Dry-run constructs/closes the Discord client and exits 0 without DB or network access,
even when real credentials are configured. It does not verify credentials or migrations.

After migration, link an existing Village user with their explicit consent:

```powershell
python -m uv run link.py --user 13370000-0000-4000-8000-000000000001 --discord 123456789012345678 --consent
python -m uv run link.py --user 13370000-0000-4000-8000-000000000001 --steam 76561198000000000 --consent
python -m uv run main.py
```

IDs above are examples. This is an operator CLI, not proof of account ownership or an
OAuth linking flow. Verify account ownership out of band before linking. Each provider ID
can belong to only one Village user. Relinking rotates the consent timestamp.
Only run one collector against a DB; a PostgreSQL advisory lock rejects a second instance.
Stop with Ctrl+C. The CLI and service print sanitized failures without DSNs or API keys.

## Consent and opt-out

```powershell
python -m uv run link.py --user 13370000-0000-4000-8000-000000000001 --opt-out
python -m uv run link.py --user 13370000-0000-4000-8000-000000000001 --opt-in --consent
python -m uv run link.py --user 13370000-0000-4000-8000-000000000001 --unlink discord
```

`external_activity_preferences.opted_out` is per user, independent of Mayor message/roast
preferences. Default false does not itself authorize tracking: a consented account link is
also required. Opt-out prevents both new signals and feed events. It resets Steam baselines
and discards open Discord sessions on the next reconciliation (at most 15 seconds).
Writes recheck current consent/opt-out in the same transaction, serialized with CLI updates.
Opt-in never backfills the gap. Existing history is retained; this is not a deletion command.
Use the CLI for preference changes so consent epochs and counters are reset together.

## Provider behavior and limitations

Discord needs **Presence Intent** and **Server Members Intent** enabled in Developer Portal
under Bot. A privileged-intent rejection logs that instruction and exits the entire service
with status 0, canceling Steam too. Restart after enabling the intents, or omit Discord's
token to run Steam alone. No message intents, handlers, voice connections or bot messages
are used. This is a second gateway session and does not modify the existing bot/plugin.
The bot must already belong to the linked user's server. Read-only metadata collection does
not request invites or change server permissions.

Games, Spotify tracks, voice presence, and online presence aggregate independently using
UTC observed start/stop times. Identical activities across guilds count once; voice channel
names are not stored. Changing songs/games closes the prior session. Reconciliation also
picks up new links and opt-outs. Session times are observational, not authoritative usage.
Open sessions live in memory: disconnect/restart/shutdown discards them to avoid attributing
unknown offline time. Abrupt disconnects can therefore undercount; no historical backfill.

Steam uses `GetRecentlyPlayedGames` every 1,800 seconds for linked, enabled accounts only.
The first successful observation establishes a durable baseline; subsequent observations
record positive **lifetime** `playtime_forever` deltas, not rolling two-week totals.
Counter resets establish a new baseline. Missing games/private responses clear baselines
so returning visibility does not import private-period activity. HTTP failures retain the
last baseline for retry. Signals use the previous successful observation as `started_at`:
Steam cannot provide exact session start/stop through this endpoint. Counter updates,
signals, and feed events commit atomically, preventing restart/retry double counting.

Each signal/event is copied to every current village membership of the linked user.
Payload: `body`, `provider`, `kind`, `title`, `minutes`, ISO `started_at`, `untrusted: true`.
Example body: `Iraj played Minecraft for 2h`. Titles are limited to 256 characters. Provider
titles and display names remain untrusted data; Mayor consumers must not treat them as
instructions. Discord and Steam observations remain separate and may describe the same
game time; consumers should not blindly sum across providers or overlapping kinds.

Official references: [Discord intents](https://discordpy.readthedocs.io/en/stable/intents.html),
[Steam IPlayerService](https://partner.steamgames.com/doc/webapi/IPlayerService).

## Integration handoff

All files are confined to `apps/activity/`. The integrator must apply the SQL and can expose
the preferences through an authenticated API/UI later. Existing feed/Mayor reads already
accept arbitrary event types. No shared contract changes are required for DB ingestion;
documenting this event payload and adding a future preference endpoint are suggested.
No live provider collection is needed for verification; tests use fake repositories,
fake DB connections, and HTTP mock transports. Real gateway/Steam credentials are not tested.

An optional integration test creates a uniquely named `activity_test_*` schema in the
configured TimescaleDB database, uses synthetic users, replays the migration, verifies
transaction rollback and feed fan-out, then drops only that schema in `finally`:

```powershell
$env:ACTIVITY_TEST_DB = '1'
python -m uv run pytest -q --tb=no
Remove-Item Env:ACTIVITY_TEST_DB
```

Use `--tb=no` for tests with real configuration: third-party connection tracebacks can
include connection strings. The normal fake suite needs no credentials or database.
