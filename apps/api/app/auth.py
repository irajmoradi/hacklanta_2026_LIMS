import asyncio
import hmac
from uuid import UUID

import jwt
from fastapi import Depends, Header, HTTPException, Request
from jwt import PyJWKClient

from app.budget import village_context
from app.db import connection, many, one


async def current_user(
    request: Request,
    conn=Depends(connection, scope="function"),
    authorization: str | None = Header(default=None),
    x_demo_user: str | None = Header(default=None),
):
    settings = request.app.state.settings
    if settings.demo_auth and x_demo_user and not authorization:
        try:
            uid = UUID(x_demo_user)
        except ValueError:
            raise HTTPException(401, "Invalid demo user") from None
        user = await one(conn, "SELECT * FROM users WHERE id = %s", (uid,))
        if user:
            from app.security import set_seat

            set_seat(user["id"])
            return user
        raise HTTPException(401, "Unknown demo user")
    if not settings.auth0_domain or not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    token = authorization[7:]
    issuer = f"https://{settings.auth0_domain}/"
    if not getattr(request.app.state, "jwks", None):
        request.app.state.jwks = PyJWKClient(
            issuer + ".well-known/jwks.json", cache_jwk_set=True, lifespan=300, timeout=5
        )
    try:
        key = await asyncio.to_thread(request.app.state.jwks.get_signing_key_from_jwt, token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            audience=settings.auth0_audience,
            issuer=issuer,
            options={"require": ["exp", "iat", "iss", "sub", "aud"]},
        )
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(401, "Invalid access token") from None
    user = await one(
        conn,
        """INSERT INTO users (auth_issuer, auth_subject, display_name) VALUES (%s,%s,%s)
        ON CONFLICT (auth_issuer,auth_subject) DO UPDATE SET auth_subject=EXCLUDED.auth_subject
        RETURNING *""",
        (issuer, claims["sub"], str(claims.get("name") or "Villager")[:100]),
    )
    request.state.auth0_account_id = user["id"]
    linked = await one(conn, "SELECT u.* FROM auth_seat_links l JOIN users u ON u.id=l.seat_id WHERE l.account_id=%s", (user["id"],))
    if linked:
        user = linked
    from app.security import set_seat

    set_seat(user["id"])
    return user


async def require_member(conn, vid, uid, *, lock=False):
    row = await one(
        conn,
        "SELECT * FROM village_members WHERE village_id=%s AND user_id=%s"
        + (" FOR UPDATE" if lock else ""),
        (vid, uid),
    )
    if not row:
        raise HTTPException(403, "Village membership required")
    return row


async def member(vid: UUID, user=Depends(current_user), conn=Depends(connection, scope="function")):
    await require_member(conn, vid, user["id"])
    village_context.set(vid)
    return user


async def require_peer(conn, actor, target):
    if actor == target:
        return
    shared = await one(
        conn,
        """SELECT 1 FROM village_members a JOIN village_members b USING (village_id)
        WHERE a.user_id=%s AND b.user_id=%s LIMIT 1""",
        (actor, target),
    )
    if not shared:
        raise HTTPException(403, "Shared village required")


async def service_auth(request: Request, x_service_key: str | None = Header(default=None)):
    expected = request.app.state.settings.service_key
    if (
        not expected
        or not x_service_key
        or not hmac.compare_digest(x_service_key.encode(), expected.encode())
    ):
        raise HTTPException(401, "Service authentication required")


async def attribute_phone(conn, phone):
    """Attribute cached service replies to the same verified seat as fresh commands."""
    from app.security import set_seat

    users = await many(conn, "SELECT id FROM users WHERE phone_e164=%s LIMIT 2", (phone,))
    if len(users) == 1:
        set_seat(users[0]["id"])
