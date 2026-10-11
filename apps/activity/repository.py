import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from core import Account, Signal, summary


class Repository:
    def __init__(self, url):
        self.url = url

    async def connect(self):
        return await psycopg.AsyncConnection.connect(
            self.url, row_factory=dict_row, connect_timeout=5
        )

    async def accounts(self, provider):
        async with await self.connect() as conn:
            rows = await (
                await conn.execute(
                    """SELECT a.user_id,a.external_id,a.consent_at FROM external_accounts a
                LEFT JOIN external_activity_preferences p USING(user_id)
                WHERE a.provider=%s AND NOT coalesce(p.opted_out,false)""",
                    (provider,),
                )
            ).fetchall()
            return [Account(str(r["user_id"]), r["external_id"], r["consent_at"]) for r in rows]

    async def eligible(self, conn, account, provider):
        # Serialize writes with link/opt-out CLI through the user row.
        await conn.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (account.user_id,))
        return await (
            await conn.execute(
                """SELECT u.display_name FROM external_accounts a JOIN users u ON u.id=a.user_id
            LEFT JOIN external_activity_preferences p ON p.user_id=u.id
            WHERE a.user_id=%s AND a.provider=%s AND a.external_id=%s AND a.consent_at=%s
            AND NOT coalesce(p.opted_out,false)""",
                (account.user_id, provider, account.external_id, account.consent_at),
            )
        ).fetchone()

    async def emit(self, conn, account, provider, signal, name):
        rows = await (
            await conn.execute(
                "SELECT village_id FROM village_members WHERE user_id=%s", (account.user_id,)
            )
        ).fetchall()
        for row in rows:
            await conn.execute(
                """INSERT INTO activity_signals
                (user_id,village_id,provider,kind,title,minutes,started_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                (
                    account.user_id,
                    row["village_id"],
                    provider,
                    signal.kind,
                    signal.title,
                    signal.minutes,
                    signal.started_at,
                ),
            )
            await conn.execute(
                """INSERT INTO activity_events(village_id,user_id,type,payload)
                VALUES (%s,%s,'external_activity',%s)""",
                (
                    row["village_id"],
                    account.user_id,
                    Jsonb(
                        {
                            "body": summary(name, signal),
                            "provider": provider,
                            "kind": signal.kind,
                            "title": signal.title,
                            "minutes": signal.minutes,
                            "started_at": signal.started_at.isoformat(),
                            "untrusted": True,
                        }
                    ),
                ),
            )

    async def record(self, account, provider, signal):
        async with await self.connect() as conn:
            user = await self.eligible(conn, account, provider)
            if user:
                await self.emit(conn, account, provider, signal, user["display_name"])

    async def steam(self, account, games, now):
        async with await self.connect() as conn:
            user = await self.eligible(conn, account, "steam")
            if not user:
                return
            # Missing/private data breaks observation continuity; never backfill that gap.
            await conn.execute(
                "DELETE FROM external_steam_counters WHERE user_id=%s AND NOT (app_id=ANY(%s))",
                (account.user_id, [game["appid"] for game in games]),
            )
            for game in games:
                app_id, total = game["appid"], game["playtime_forever"]
                previous = await (
                    await conn.execute(
                        "SELECT * FROM external_steam_counters WHERE user_id=%s AND app_id=%s",
                        (account.user_id, app_id),
                    )
                ).fetchone()
                if previous and previous["observed_at"] >= now:
                    continue
                if previous and previous["consent_at"] == account.consent_at:
                    delta = total - previous["lifetime_minutes"]
                    if delta > 0:
                        await self.emit(
                            conn,
                            account,
                            "steam",
                            Signal("playing", game["name"][:256], delta, previous["observed_at"]),
                            user["display_name"],
                        )
                await conn.execute(
                    """INSERT INTO external_steam_counters
                    (user_id,app_id,lifetime_minutes,observed_at,consent_at) VALUES (%s,%s,%s,%s,%s)
                    ON CONFLICT(user_id,app_id) DO UPDATE SET
                    lifetime_minutes=EXCLUDED.lifetime_minutes,observed_at=EXCLUDED.observed_at,
                    consent_at=EXCLUDED.consent_at""",
                    (account.user_id, app_id, total, now, account.consent_at),
                )
