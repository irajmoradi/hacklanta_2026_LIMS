"""Atomic coin bribes and a read-only scheduler handoff."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app import domain
from app.auth import member, require_member
from app.db import connection, many, one

router = APIRouter()


class Bribe(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    currency: Literal["coins"] = "coins"
    coins: int = Field(ge=1, le=10000, strict=True)
    wish: str = Field(min_length=1, max_length=1000)


async def pending_bribes(conn, vid):
    """No mutations/provider calls. Wishes are untrusted data; intents confer no benefit.

    Weight 1..11 and reward bonus 1..100 are bounded scheduler hints, not guarantees.
    API-009 may consume rows transactionally by setting status='consumed'.
    """
    return await many(
        conn,
        """SELECT *,1+LEAST(xp,1000)/100.0 AS selection_weight,
        LEAST(xp,100) AS reward_bonus_xp FROM mayor_bribes
        WHERE village_id=%s AND status='pending' AND currency='xp'
        ORDER BY created_at,id""",
        (vid,),
    )


@router.post("/villages/{vid}/mayor/bribe", status_code=201)
async def bribe(
    vid: UUID, data: Bribe, user=Depends(member), conn=Depends(connection, scope="function")
):
    await require_member(conn, vid, user["id"], lock=True)
    balance = await domain.coin_balance(conn, vid, user["id"])
    if data.coins > balance:
        raise HTTPException(409, "Not enough coins")
    row = await one(
        conn,
        """INSERT INTO mayor_bribes
        (village_id,user_id,currency,xp,wish,status) VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""",
        (
            vid,
            user["id"],
            "xp",  # Legacy storage label; public API and debits are coins.
            data.coins,
            data.wish,
            "pending",
        ),
    )
    if data.coins:
        await domain.coin_award(
            conn, vid, user["id"], -data.coins, "mayor_bribe", f"bribe:{row['id']}"
        )
    return {
        "bribe": {
            **{k: v for k, v in row.items() if k != "xp"},
            "coins": row["xp"],
            "currency": "coins",
        },
        "balance": balance - data.coins,
        "receipt": (
            "The Mayor has filed your coins under Highly Persuasive Paperwork. "
            "Your wish gets extra consideration, not a guarantee."
        ),
    }
