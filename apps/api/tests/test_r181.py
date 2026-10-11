import pytest
from psycopg.types.json import Jsonb

from app.domain import VILLAGE_ID

BASE = f"/api/villages/{VILLAGE_ID}"
pytestmark = pytest.mark.asyncio


async def test_scheduler_noops_do_not_crowd_out_the_feed(api):
    client, app = api
    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO activity_events(village_id,user_id,type,payload) VALUES (%s,NULL,'agent_decision',%s)",
            (VILLAGE_ID, Jsonb({"agent": "mayor", "action": "recap", "reason": "weekly"})),
        )
        for _ in range(60):
            await conn.execute(
                "INSERT INTO activity_events(village_id,user_id,type,payload) VALUES (%s,NULL,'agent_decision',%s)",
                (VILLAGE_ID, Jsonb({"agent": "scheduler", "action": "none", "reason": "tick"})),
            )
    rows = (await client.get(BASE + "/feed?limit=30")).json()
    assert rows
    assert not any(r["type"] == "agent_decision" and r["payload"].get("action") == "none" for r in rows)
    assert any(r["type"] == "agent_decision" and r["payload"].get("action") == "recap" for r in rows)
