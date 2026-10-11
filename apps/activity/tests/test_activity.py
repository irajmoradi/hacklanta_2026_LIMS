from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import discord
import httpx
import pytest

import main
from core import Account, Sessions, Signal, summary
from providers import DiscordClient, member_activities, parse_games, steam_once
from repository import Repository

NOW = datetime(2026, 10, 10, tzinfo=UTC)
ACCOUNT = Account("13370000-0000-4000-8000-000000000001", "123", NOW)


class FakeRepository:
    def __init__(self):
        self.linked = [ACCOUNT]
        self.signals = []

    async def accounts(self, provider):
        return self.linked

    async def record(self, account, provider, signal):
        self.signals.append(signal)


async def test_session_changes_duplicates_and_unlinked():
    repo = FakeRepository()
    sessions = Sessions(repo)
    observed = {"123": {("playing", "Minecraft")}, "999": {("playing", "Secret")}}
    await sessions.reconcile(observed, NOW)
    await sessions.reconcile(observed, NOW + timedelta(minutes=60))
    assert not repo.signals
    await sessions.reconcile({"123": {("listening", "Song")}}, NOW + timedelta(hours=2))
    assert repo.signals == [Signal("playing", "Minecraft", 120, NOW)]
    assert summary("Iraj", repo.signals[0]) == "Iraj played Minecraft for 2h"
    await sessions.reconcile({}, NOW + timedelta(hours=2, minutes=3))
    assert repo.signals[-1].minutes == 3


@pytest.mark.parametrize("change", ["optout", "relink", "disconnect"])
async def test_no_activity_across_consent_or_connection_gaps(change):
    repo = FakeRepository()
    sessions = Sessions(repo)
    observed = {"123": {("voice", "voice chat")}}
    await sessions.reconcile(observed, NOW)
    if change == "optout":
        repo.linked = []
    elif change == "relink":
        repo.linked = [Account(ACCOUNT.user_id, "123", NOW + timedelta(minutes=1))]
    else:
        sessions.disconnect()
    await sessions.reconcile({}, NOW + timedelta(minutes=10))
    assert repo.signals == []


async def test_successful_session_not_repeated_after_other_write_failure():
    repo = FakeRepository()
    sessions = Sessions(repo)
    await sessions.reconcile({"123": {("playing", "A"), ("online", "online")}}, NOW)
    original = repo.record

    async def fail_second(*args):
        if repo.signals:
            raise RuntimeError("database unavailable")
        await original(*args)

    repo.record = fail_second
    with pytest.raises(RuntimeError):
        await sessions.reconcile({}, NOW + timedelta(minutes=1))
    repo.record = original
    await sessions.reconcile({}, NOW + timedelta(minutes=1))
    assert len(repo.signals) == 2
    assert len({s.kind for s in repo.signals}) == 2


async def test_gateway_intents_and_cross_guild_dedup():
    repo = FakeRepository()
    async with DiscordClient(repo) as client:
        assert client.intents.presences and client.intents.members and client.intents.voice_states
        assert not client.intents.messages and not client.intents.message_content
        member = SimpleNamespace(
            id=123, status=discord.Status.online, activities=[discord.Game("Minecraft")], voice=None
        )
        client._connection._guilds = {
            n: SimpleNamespace(unavailable=False, members=[member]) for n in (1, 2)
        }
        client._ready.set()
        await client.snapshot()
        assert len(client.sessions.active) == 2  # online + game, each counted once
        await client.on_disconnect()
        assert not client.sessions.active


def test_voice_metadata_and_spotify():
    spotify = discord.Spotify(state="Artist", details="Song", session_id="fake")
    member = SimpleNamespace(
        status=discord.Status.online, activities=[spotify], voice=SimpleNamespace(channel=object())
    )
    assert member_activities(member) == {
        ("online", "online"),
        ("voice", "voice chat"),
        ("listening", "Song - Artist"),
    }


async def test_steam_network_fake_only_linked_and_safe_errors(caplog):
    repo = FakeRepository()
    repo.steam = AsyncMock()
    requests = []

    def handler(request):
        requests.append(request)
        assert request.url.params["steamid"] == "123"
        return httpx.Response(403)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        await steam_once(repo, client, "secret-test-key")
    assert len(requests) == 1
    repo.steam.assert_not_called()
    assert "secret-test-key" not in caplog.text


@pytest.mark.parametrize("payload", [{"response": {}}, {"response": {"games": []}}])
async def test_steam_private_or_empty_response(payload):
    repo = FakeRepository()
    repo.steam = AsyncMock()
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    ) as client:
        await steam_once(repo, client, "fake")
    assert repo.steam.await_args.args[1] == []


def test_invalid_steam_counter():
    with pytest.raises(ValueError):
        parse_games({"response": {"games": [{"appid": 1, "playtime_forever": -1, "name": "X"}]}})


class Cursor:
    def __init__(self, row=None):
        self.row = row

    async def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self):
        self.counters = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def execute(self, sql, params):
        if sql.startswith("SELECT * FROM external_steam_counters"):
            return Cursor(self.counters.get(params[1]))
        if sql.startswith("DELETE FROM external_steam_counters"):
            self.counters = {k: v for k, v in self.counters.items() if k in params[1]}
        if "INSERT INTO external_steam_counters" in sql:
            _, app_id, total, now, consent = params
            self.counters[app_id] = dict(
                lifetime_minutes=total, observed_at=now, consent_at=consent
            )
        return Cursor()


async def test_steam_persisted_deltas_reset_and_privacy_gap():
    repo = Repository("unused")
    connection = FakeConnection()
    repo.connect = AsyncMock(return_value=connection)
    repo.eligible = AsyncMock(return_value={"display_name": "Iraj"})
    repo.emit = AsyncMock()

    async def poll(total, minute):
        await repo.steam(
            ACCOUNT,
            [{"appid": 1, "name": "Game", "playtime_forever": total}],
            NOW + timedelta(minutes=minute),
        )

    await poll(500, 0)  # first observation: no historical import
    repo.emit.assert_not_called()
    await poll(530, 30)
    assert repo.emit.await_args.args[3].minutes == 30
    await poll(530, 60)  # no change
    await poll(20, 90)  # counter reset, not a negative signal
    assert repo.emit.await_count == 1
    await repo.steam(ACCOUNT, [], NOW + timedelta(minutes=120))
    await poll(100, 150)  # returning from private profile only establishes baseline
    assert repo.emit.await_count == 1
    repo.eligible.return_value = None
    await poll(200, 180)
    assert repo.emit.await_count == 1


async def test_record_rechecks_optout():
    repo = Repository("unused")
    repo.connect = AsyncMock(return_value=FakeConnection())
    repo.eligible = AsyncMock(return_value=None)
    repo.emit = AsyncMock()
    await repo.record(ACCOUNT, "discord", Signal("online", "online", 1, NOW))
    repo.emit.assert_not_called()


async def test_dry_run_never_connects(monkeypatch):
    monkeypatch.setattr(main, "load_environment", lambda: None)
    monkeypatch.setattr(main.Repository, "connect", AsyncMock(side_effect=AssertionError))
    assert await main.run(True) == 0


async def test_disabled_intents_exit_zero_and_cancel_steam(monkeypatch, caplog):
    monkeypatch.setattr(main, "load_environment", lambda: None)
    monkeypatch.setattr(main, "database_url", lambda: "unused")
    monkeypatch.setenv("DISCORD_BOT_TOKEN", "fake")
    monkeypatch.delenv("STEAM_API_KEY", raising=False)
    conn = FakeConnection()
    conn.execute = AsyncMock(return_value=Cursor({"locked": True}))
    conn.commit = AsyncMock()
    monkeypatch.setattr(main.Repository, "connect", AsyncMock(return_value=conn))
    monkeypatch.setattr(
        main, "discord_runner", AsyncMock(side_effect=discord.PrivilegedIntentsRequired(None))
    )
    assert await main.run() == 0
    assert "Presence Intent" in caplog.text


def test_link_requires_consent(monkeypatch):
    import link

    monkeypatch.setattr("sys.argv", ["link.py", "--user", ACCOUNT.user_id, "--discord", "123"])
    monkeypatch.setattr(link, "update", AsyncMock(side_effect=AssertionError))
    with pytest.raises(SystemExit) as error:
        link.main()
    assert error.value.code == 2
