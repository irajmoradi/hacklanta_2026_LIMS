import asyncio
import logging
from datetime import UTC, datetime

import discord
import httpx

from core import Sessions

log = logging.getLogger(__name__)
STEAM_URL = "https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/"


def member_activities(member):
    result = set()
    if member.status != discord.Status.offline:
        result.add(("online", "online"))
        for activity in member.activities:
            if isinstance(activity, discord.Spotify):
                result.add(("listening", f"{activity.title} - {activity.artist}"))
            elif activity.type == discord.ActivityType.playing and activity.name:
                result.add(("playing", activity.name))
    if member.voice and member.voice.channel:
        result.add(("voice", "voice chat"))
    return result


class DiscordClient(discord.Client):
    def __init__(self, repository):
        intents = discord.Intents.none()
        intents.guilds = intents.members = intents.presences = intents.voice_states = True
        super().__init__(intents=intents, max_messages=None)
        self.sessions = Sessions(repository)
        self.lock = asyncio.Lock()

    async def snapshot(self):
        async with self.lock:
            if not self.is_ready():
                return
            observed = {}
            linked = {a.external_id for a in await self.sessions.repository.accounts("discord")}
            for guild in self.guilds:
                if guild.unavailable:
                    continue
                for member in guild.members:
                    external_id = str(member.id)
                    if external_id in linked:
                        observed.setdefault(external_id, set()).update(member_activities(member))
            await self.sessions.reconcile(observed, datetime.now(UTC))

    async def on_presence_update(self, before, after):
        await self.snapshot()

    async def on_voice_state_update(self, member, before, after):
        await self.snapshot()

    async def on_ready(self):
        await self.snapshot()

    async def on_disconnect(self):
        async with self.lock:
            self.sessions.disconnect()

    async def on_error(self, event_method, *args, **kwargs):
        # Default Discord tracebacks may contain third-party data. Keep logs metadata-only.
        log.error("Discord activity update failed; reconciliation will retry")


async def discord_runner(repository, token):
    async with DiscordClient(repository) as client:

        async def refresh():
            while True:
                await asyncio.sleep(15)
                try:
                    await client.snapshot()
                except Exception:
                    log.error("Discord reconciliation failed; retrying in 15 seconds")

        task = asyncio.create_task(refresh())
        try:
            await client.start(token)
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


def parse_games(payload):
    games = payload.get("response", {}).get("games", [])
    if not isinstance(games, list):
        raise ValueError("Invalid games response")
    result = {}
    for game in games:
        if (
            not isinstance(game, dict)
            or type(game.get("appid")) is not int
            or type(game.get("playtime_forever")) is not int
            or game["appid"] <= 0
            or game["playtime_forever"] < 0
            or not isinstance(game.get("name"), str)
        ):
            raise ValueError("Invalid game")
        result[game["appid"]] = game
    return list(result.values())


async def steam_once(repository, client, key):
    for account in await repository.accounts("steam"):
        try:
            response = await client.get(
                STEAM_URL, params={"key": key, "steamid": account.external_id, "format": "json"}
            )
            response.raise_for_status()
            games = parse_games(response.json())
            await repository.steam(account, games, datetime.now(UTC))
        except (httpx.HTTPError, ValueError, TypeError, AttributeError):
            # Exception URLs contain the API key. Never print them.
            log.warning("Steam profile unavailable or invalid; skipping this poll")


async def steam_runner(repository, key):
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        while True:
            try:
                await steam_once(repository, client, key)
            except Exception:
                log.error("Steam poll failed; retrying at next interval")
            await asyncio.sleep(1800)
