"""One-time operator-issued seat claims. Raw codes are never stored."""
import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth import current_user
from app.db import connection, one

router = APIRouter()


def code_hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


class Claim(BaseModel):
    village_id: UUID
    code: str = Field(min_length=20, max_length=200)


@router.post('/auth/claim-seat')
async def claim_seat(body: Claim, request: Request, user=Depends(current_user),
                     conn=Depends(connection, scope='function')):
    if not getattr(request.state, 'auth0_account_id', None):
        raise HTTPException(401, 'Sign in to claim a villager')
    account = request.state.auth0_account_id
    # current_user's upsert serializes claims for the same account.
    if await one(conn, 'SELECT 1 FROM auth_seat_links WHERE account_id=%s OR seat_id=%s',
                 (account, account)) or await one(
                     conn, 'SELECT 1 FROM village_members WHERE user_id=%s', (account,)):
        raise HTTPException(409, 'This account already has a villager')
    claim = await one(conn, '''SELECT * FROM seat_claim_codes WHERE code_hash=%s
        AND village_id=%s AND consumed_at IS NULL AND expires_at>clock_timestamp()''',
        (code_hash(body.code.strip()), body.village_id))
    if not claim:
        raise HTTPException(400, 'Invalid or expired claim code')
    seat = await one(conn, 'SELECT * FROM users WHERE id=%s FOR UPDATE', (claim['seat_id'],))
    # Same lock order as the operator CLI: seat first, then codes. Recheck after
    # waiting so concurrent redemption, rotation, or expiry cannot reuse a code.
    claim = await one(conn, '''SELECT * FROM seat_claim_codes WHERE code_hash=%s
        AND consumed_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE''',
        (code_hash(body.code.strip()),))
    if not claim:
        raise HTTPException(400, 'Invalid or expired claim code')
    if seat['auth_issuer'] != 'demo' or await one(
        conn, 'SELECT 1 FROM auth_seat_links WHERE seat_id=%s', (seat['id'],)
    ):
        raise HTTPException(409, 'This villager is already linked')
    await conn.execute('INSERT INTO auth_seat_links(account_id,seat_id) VALUES (%s,%s)',
                       (account, seat['id']))
    await conn.execute('UPDATE seat_claim_codes SET consumed_at=now() WHERE seat_id=%s',
                       (seat['id'],))
    return {'user_id': seat['id'], 'village_id': body.village_id}
