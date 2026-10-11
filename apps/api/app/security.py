"""UTC budgets for new external work; voice counters persist across API/CLI processes."""

import ipaddress
import os
import sqlite3
import threading
import time
from collections import Counter
from contextlib import closing
from contextvars import ContextVar
from dataclasses import dataclass

from fastapi import HTTPException
from starlette.datastructures import Headers
from starlette.responses import JSONResponse

# (global, IP, authenticated seat). Zero disables new work, not protection.
DEFAULT_CAPS = {
    "llm": (300, 60, 40),
    "elevenlabs": (60, 15, 10),
    "gpu": (40, 10, 8),
    "photon": (30, 30, 10),
    "photon_queue": (30, 10, 6),
}


class LimitExceeded(HTTPException):
    def __init__(self, retry):
        super().__init__(
            429,
            "The village has reached its daily generation or messaging limit. "
            "Cached content still works. Please try again after midnight UTC.",
            headers={"Retry-After": str(retry)},
        )


@dataclass
class Identity:
    ip: str
    seat: str = "anonymous"
    settings: object = None


identity = ContextVar("cost_identity", default=None)


class DailyLimiter:
    def __init__(self, caps=None, clock=time.time):
        self.caps = dict(DEFAULT_CAPS if caps is None else caps)
        self.clock = clock
        self.day = None
        self.counts = {}
        self.lock = threading.Lock()

    @classmethod
    def from_env(cls):
        return cls(
            {
                kind: tuple(
                    max(0, int(os.getenv(f"COST_{kind.upper()}_{scope}_DAILY", default)))
                    for scope, default in zip(("GLOBAL", "IP", "SEAT"), caps)
                )
                for kind, caps in DEFAULT_CAPS.items()
            }
        )

    def reserve(self, kind, *, ip="background", seat="background", count=1, consume=True):
        if count <= 0:
            return
        self.reserve_batch(kind, [(ip, seat)] * count, consume=consume)

    def reserve_batch(self, kind, actors, *, consume=True):
        increments = Counter()
        for ip, seat in actors:
            increments.update(((kind, "global", "*"), (kind, "ip", ip), (kind, "seat", str(seat))))
        with self.lock:
            now = self.clock()
            day = int(now // 86400)
            if self.day != day:
                self.day, self.counts = day, {}
            caps = dict(zip(("global", "ip", "seat"), self.caps[kind]))
            for key, count in increments.items():
                cap = caps[key[1]]
                if self.counts.get(key, 0) + count > cap:
                    raise LimitExceeded(max(1, int((day + 1) * 86400 - now)))
            if consume:
                for key, count in increments.items():
                    self.counts[key] = self.counts.get(key, 0) + count


def charge(settings, kind, *, count=1, seat=None, consume=True):
    actor = identity.get()
    settings = settings or (actor.settings if actor else None)
    if settings is None:
        raise RuntimeError("Cost reservation requires settings")
    reserve = settings.cost_limiter.reserve
    if kind == "elevenlabs":

        def reserve(kind, **kwargs):
            return durable_voice_reserve(settings, **kwargs)

    reserve(
        kind,
        ip=actor.ip if actor else "background",
        seat=seat if seat is not None else (actor.seat if actor else "background"),
        count=count,
        consume=consume,
    )


def durable_voice_reserve(settings, *, ip, seat, count=1, consume=True):
    """Share SEC-001 voice budgets between API workers and explicit CLI runs.

    All processes must use the same asset directory (as they do for cached audio).
    Only hashed actor IDs and counters are stored, never credentials or text.
    """
    import hashlib

    if count <= 0:
        return
    settings.asset_dir.mkdir(parents=True, exist_ok=True)
    limiter = settings.cost_limiter
    now = limiter.clock()
    day = int(now // 86400)
    actors = ["*", ip, str(seat)]
    with (
        closing(sqlite3.connect(settings.asset_dir / ".voice-budget.sqlite3", timeout=10)) as db,
        db,
    ):
        db.execute(
            "CREATE TABLE IF NOT EXISTS counts (day INTEGER, scope INTEGER, actor TEXT, "
            "n INTEGER, PRIMARY KEY(day,scope,actor))"
        )
        db.execute("BEGIN IMMEDIATE")
        keys = [hashlib.sha256(actor.encode()).hexdigest() for actor in actors]
        for scope, (actor, cap) in enumerate(zip(keys, limiter.caps["elevenlabs"])):
            row = db.execute(
                "SELECT n FROM counts WHERE day=? AND scope=? AND actor=?", (day, scope, actor)
            ).fetchone()
            if (row[0] if row else 0) + count > cap:
                raise LimitExceeded(max(1, int((day + 1) * 86400 - now)))
        if consume:
            for scope, actor in enumerate(keys):
                db.execute(
                    "INSERT INTO counts VALUES (?,?,?,?) ON CONFLICT(day,scope,actor) "
                    "DO UPDATE SET n=n+excluded.n",
                    (day, scope, actor, count),
                )
            db.execute("DELETE FROM counts WHERE day < ?", (day,))
    # Preserve the existing process diagnostics; SQLite is the authoritative cap.
    if consume:
        with limiter.lock:
            if limiter.day != day:
                limiter.day, limiter.counts = day, {}
            for scope, actor in zip(("global", "ip", "seat"), actors):
                key = ("elevenlabs", scope, actor)
                limiter.counts[key] = limiter.counts.get(key, 0) + count


def set_seat(uid):
    actor = identity.get()
    if actor:
        actor.seat = str(uid)


def client_ip(scope):
    peer = (scope.get("client") or ("unknown", 0))[0]
    forwarded = Headers(scope=scope).get("x-forwarded-for")
    if peer == "127.0.0.1" and forwarded:
        # The single trusted proxy must append/overwrite; never trust the client-supplied prefix.
        try:
            return str(ipaddress.ip_address(forwarded.rsplit(",", 1)[-1].strip()))
        except ValueError:
            return "invalid-proxy-client"
    return peer


def local_debug(request):
    peer = request.client.host if request.client else ""
    return (
        request.app.state.settings.demo_debug
        and peer in {"127.0.0.1", "::1"}
        and "x-forwarded-for" not in request.headers
    )


class SecurityMiddleware:
    def __init__(self, app, settings):
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = Headers(scope=scope)
        maximum = 65 * 1024 * 1024  # Existing 64 MiB images plus multipart framing.
        try:
            length = int(headers.get("content-length", "0"))
        except ValueError:
            length = maximum + 1
        if length < 0 or length > maximum:
            return await JSONResponse({"detail": "Upload exceeds 65 MiB request limit"}, 413)(
                scope, receive, send
            )
        size = 0

        async def bounded_receive():
            nonlocal size
            message = await receive()
            size += len(message.get("body", b""))
            if size > maximum:
                raise HTTPException(413, "Upload exceeds 65 MiB request limit")
            return message

        token = identity.set(Identity(client_ip(scope), settings=self.settings))
        try:
            await self.app(scope, bounded_receive, send)
        finally:
            identity.reset(token)
