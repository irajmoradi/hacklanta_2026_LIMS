from fastapi import Request
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool


def make_pool(settings):
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is required; configure VILLAGE_ENV_FILE")
    return AsyncConnectionPool(
        settings.database_url,
        open=False,
        min_size=1,
        max_size=10,
        timeout=10,
        # Hot migrations can change SELECT * row shapes on existing pooled sessions.
        kwargs={"row_factory": dict_row, "connect_timeout": 5, "prepare_threshold": None},
    )


async def connection(request: Request):
    # Function-scoped dependencies commit/roll back before the HTTP response is sent.
    async with request.app.state.pool.connection() as conn:
        yield conn


async def one(conn, query, params=()):
    return await (await conn.execute(query, params)).fetchone()


async def many(conn, query, params=()):
    return await (await conn.execute(query, params)).fetchall()
