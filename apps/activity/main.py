import argparse
import asyncio
import logging
import os

import discord

from config import configure_event_loop, database_url, load_environment
from providers import DiscordClient, discord_runner, steam_runner
from repository import Repository

log = logging.getLogger(__name__)


async def run(dry_run=False):
    load_environment()
    token, key = os.getenv("DISCORD_BOT_TOKEN"), os.getenv("STEAM_API_KEY")
    if not token:
        log.info("DISCORD_BOT_TOKEN missing; skipping Discord")
    if not key:
        log.info("STEAM_API_KEY missing; skipping Steam")
    if dry_run:
        async with DiscordClient(None) as client:
            assert not client.intents.message_content and not client.intents.messages
        log.info(
            "Dry run complete: configuration loaded, client constructed/closed; no network or DB"
        )
        return 0
    if not token and not key:
        return 0
    repository = Repository(database_url())
    # Only one collector writes at a time. Held on its own connection for process lifetime.
    async with await repository.connect() as lease:
        row = await (
            await lease.execute("SELECT pg_try_advisory_lock(741001) AS locked")
        ).fetchone()
        await lease.commit()
        if not row["locked"]:
            log.error("Another activity collector is already running")
            return 1
        tasks = []
        if token:
            tasks.append(asyncio.create_task(discord_runner(repository, token)))
        if key:
            tasks.append(asyncio.create_task(steam_runner(repository, key)))
        try:
            await asyncio.gather(*tasks)
        except discord.PrivilegedIntentsRequired:
            log.warning(
                "Discord privileged intents disabled: owner must enable Presence Intent "
                "and Server Members Intent in Developer Portal > Bot. Exiting cleanly."
            )
            return 0
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
    return 0


def main():
    configure_event_loop()
    parser = argparse.ArgumentParser(description="Village read-only external activity collector")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    try:
        return asyncio.run(run(args.dry_run))
    except KeyboardInterrupt:
        return 0
    except Exception:
        log.error(
            "Activity service failed; check credentials, database and migration configuration"
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
