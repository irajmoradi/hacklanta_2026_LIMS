import argparse
import asyncio
from uuid import UUID

from config import configure_event_loop, database_url, load_environment
from repository import Repository


def parser():
    result = argparse.ArgumentParser(description="Operator CLI: link with the user's consent")
    result.add_argument("--user", required=True, type=UUID)
    group = result.add_mutually_exclusive_group(required=True)
    group.add_argument("--discord")
    group.add_argument("--steam")
    group.add_argument("--opt-out", action="store_true")
    group.add_argument("--opt-in", action="store_true")
    group.add_argument("--unlink", choices=["discord", "steam"])
    result.add_argument("--consent", action="store_true")
    return result


async def update(args):
    load_environment()
    async with await Repository(database_url()).connect() as conn:
        user = await (
            await conn.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (args.user,))
        ).fetchone()
        if not user:
            raise ValueError("Unknown user")
        if args.opt_out or args.opt_in:
            await conn.execute(
                """INSERT INTO external_activity_preferences(user_id,opted_out) VALUES (%s,%s)
                ON CONFLICT(user_id) DO UPDATE SET opted_out=EXCLUDED.opted_out""",
                (args.user, args.opt_out),
            )
            # Rotate consent epoch to discard open sessions and reset Steam baselines.
            await conn.execute(
                "UPDATE external_accounts SET consent_at=clock_timestamp() WHERE user_id=%s",
                (args.user,),
            )
            await conn.execute("DELETE FROM external_steam_counters WHERE user_id=%s", (args.user,))
        elif args.unlink:
            await conn.execute(
                "DELETE FROM external_accounts WHERE user_id=%s AND provider=%s",
                (args.user, args.unlink),
            )
        else:
            provider = "discord" if args.discord else "steam"
            await conn.execute(
                """INSERT INTO external_accounts(user_id,provider,external_id) VALUES (%s,%s,%s)
                ON CONFLICT(user_id,provider) DO UPDATE SET
                external_id=EXCLUDED.external_id,consent_at=clock_timestamp()""",
                (args.user, provider, args.discord or args.steam),
            )
    print("Activity preference/account updated")


def main():
    configure_event_loop()
    cli = parser()
    args = cli.parse_args()
    if (args.discord or args.steam or args.opt_in) and not args.consent:
        cli.error("--consent is required for linking or opting in")
    external_id = args.discord or args.steam
    if external_id and (
        not external_id.isascii()
        or not external_id.isdigit()
        or not 0 < int(external_id) < 2**64
        or (args.steam and len(external_id) != 17)
    ):
        cli.error("External ID must be a Discord snowflake or 17-digit SteamID64")
    try:
        asyncio.run(update(args))
    except Exception:
        print("Update failed: verify user, unique account ownership, database and migration")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
