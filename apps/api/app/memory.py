"""Deterministic bounded memory derived from durable village records."""

import json
from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth import member
from app.db import connection, one

router = APIRouter()
# UTF-8 byte ceiling is a conservative token bound (including JSON syntax).
MAX_BYTES = 1400


def compact(value):
    result = {key: list(value.get(key, [])) for key in ("weeks", "facts", "recent")}
    while len(json.dumps(result).encode("utf-8")) > MAX_BYTES:
        key = next((k for k in ("recent", "weeks", "facts") if len(result[k]) > 1), None)
        key = key or next(k for k in ("recent", "weeks", "facts") if result[k])
        result[key].pop()
    return result


async def read(conn, vid):
    row = await one(
        conn, "SELECT document,updated_at FROM mayor_memory WHERE village_id=%s", (vid,)
    )
    return {
        "village_id": vid,
        "document": compact(row["document"] if row else {}),
        "updated_at": row["updated_at"] if row else None,
        "max_bytes": MAX_BYTES,
        "source": "recorded-village-history-v1",
    }


@router.get("/villages/{vid}/mayor/memory")
async def get_memory(vid: UUID, user=Depends(member), conn=Depends(connection, scope="function")):
    return await read(conn, vid)


@router.get("/villages/{vid}/mayor/event-templates")
async def templates(vid: UUID, user=Depends(member)):
    from app.events_table import RECOVERY, TEMPLATES

    return {"templates": TEMPLATES, "recovery": RECOVERY, "version": 1}


@router.get("/villages/{vid}/mayor/effects")
async def effects(vid: UUID, user=Depends(member), conn=Depends(connection, scope="function")):
    from app import world
    from app.db import many

    state = await world.state(conn, vid)
    pending = await many(
        conn,
        """SELECT e.id AS event_id,r.id AS repair_event_id,e.penalty
        FROM mayor_events e JOIN mayor_events r ON r.repairs_event_id=e.id
        WHERE e.village_id=%s AND r.status<>'completed' ORDER BY e.created_at,e.id""",
        (vid,),
    )
    penalties = {row["penalty"] for row in pending}
    return {
        "weather": state["weather"],
        "crater": "crater" in penalties,
        "house_downgrade": "house_downgrade" in penalties,
        "pet_sad": "sad_pet" in penalties,
        "repairs": pending,
    }
