"""Conditional asset responses; authorization must run before this helper."""

from fastapi.responses import FileResponse, Response
from starlette.middleware.gzip import GZipMiddleware


def cached_asset(path, request):
    revisioned = bool(request.query_params.get("rev"))
    # Private uploads/evidence remain uncacheable even if a caller adds ?rev.
    public = revisioned and request.path_params.get("key", "").startswith("avatars/")
    headers = {
        "Cache-Control": "public, max-age=31536000, immutable" if public else "private, no-store",
        "X-Content-Type-Options": "nosniff",
    }
    if not request.url.path.lower().endswith(".zip"):
        headers["Vary"] = "Accept-Encoding"
    response = FileResponse(path, stat_result=path.stat(), headers=headers)
    etag = response.headers["etag"]
    validators = request.headers.get("if-none-match", "").split(",")
    if public and any(tag.strip().removeprefix("W/") in {etag, "*"} for tag in validators):
        return Response(status_code=304, headers={**headers, "ETag": etag})
    return response


class AssetGZipMiddleware:
    """Compress API JSON and assets except already-compressed zip packages."""

    def __init__(self, app):
        self.app = app
        self.compressed = GZipMiddleware(app, minimum_size=1024, compresslevel=5)

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        compress = path.startswith("/api/") and not path.lower().endswith(".zip")
        await (self.compressed if compress else self.app)(scope, receive, send)
