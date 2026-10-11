"""Reserve each physical model request, including repairs and fallback attempts."""

from contextvars import ContextVar

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from app.db import one

village_context = ContextVar("llm_village", default=None)
stateless_context = ContextVar("llm_stateless", default=False)


class BudgetExceeded(RuntimeError):
    pass


async def reserve(settings):
    from app.security import charge

    if stateless_context.get():
        # Lab proposals use SEC-001 global/IP/seat caps without database writes.
        charge(settings, "llm")
        return
    charge(settings, "llm", consume=False)
    # Independent transaction: failures/rollbacks must not refund a paid request.
    async with await AsyncConnection.connect(
        settings.database_url, row_factory=dict_row, connect_timeout=5
    ) as conn:
        row = await one(
            conn,
            """INSERT INTO llm_hourly_budget (hour,calls)
            SELECT date_trunc('hour',now()),1 WHERE %s > 0
            ON CONFLICT (hour) DO UPDATE SET calls=llm_hourly_budget.calls+1
            WHERE llm_hourly_budget.calls < %s RETURNING calls""",
            (settings.llm_max_calls_per_hour, settings.llm_max_calls_per_hour),
        )
        if not row:
            vid = village_context.get()
            if vid:
                from app.domain import activity

                await activity(
                    conn,
                    vid,
                    None,
                    "agent_decision",
                    {
                        "agent": "budget",
                        "action": "throttled",
                        "model": "server",
                        "reason": "Global hourly LLM call budget exhausted",
                    },
                )
    if not row:
        raise BudgetExceeded("Global hourly LLM call budget exhausted")
    charge(settings, "llm")
