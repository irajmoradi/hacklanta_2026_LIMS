"""Private conditional JSON reads, evaluated only after route authorization."""

import hashlib
import re

from starlette.datastructures import Headers, MutableHeaders


class ReadCacheMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or scope["method"] != "GET"
            or not re.fullmatch(r"/api/(?:me|villages(?:/[^/]+)*|houses(?:/[^/]+)*|heads(?:/[^/]+)*|avatars/[^/]+|jobs/[^/]+|voice/lines/[^/]+)", scope["path"])
        ):
            return await self.app(scope, receive, send)

        start = None
        chunks = []

        async def conditional(message):
            nonlocal start
            if (message["type"] == "http.response.start" and message["status"] == 200
                and Headers(raw=message["headers"]).get("content-type", "").startswith("application/json")
                and "no-store" not in Headers(raw=message["headers"]).get("cache-control", "")):
                start = message
                return
            if start is None or message["type"] != "http.response.body":
                return await send(message)
            chunks.append(message.get("body", b""))
            if message.get("more_body", False):
                return
            body = b"".join(chunks)
            # Weak because gzip may change the bytes while preserving the representation.
            etag = 'W/"' + hashlib.sha256(body).hexdigest() + '"'
            headers = MutableHeaders(scope=start)
            headers["etag"] = etag
            headers["cache-control"] = "private, no-cache"
            headers.add_vary_header("Authorization, X-Demo-User, Accept-Encoding")
            validators = Headers(scope=scope).get("if-none-match", "").split(",")
            if any(tag.strip().removeprefix("W/") in {etag[2:], "*"} for tag in validators):
                start["status"] = 304
                del headers["content-length"]
                body = b""
            await send(start)
            await send({"type": "http.response.body", "body": body})

        await self.app(scope, receive, conditional)
