"""Optional pitch server: serve local synthetic evidence alongside existing assets.

uvicorn scripts.demo_server:create_demo_app --factory --port 8015
Use UVICORN_LOOP=app.runtime:selector_loop on Windows. No automatic paid scheduling.
"""

from dataclasses import replace
from typing import Literal

from fastapi import Depends
from fastapi.responses import FileResponse
from fastapi.routing import APIRoute

from app.assets import asset_path
from app.auth import current_user, require_member
from app.config import Settings
from app.db import connection
from app.domain import VILLAGE_ID
from app.main import create_app
from scripts.demo_story import ASSET_DIR


def add_demo_evidence(application, root=ASSET_DIR):
    """Narrow authenticated route takes precedence over the generic asset route."""

    async def evidence(
        name: Literal["steps.png", "canvas.png", "notes.png"],
        user=Depends(current_user),
        conn=Depends(connection, scope="function"),
    ):
        await require_member(conn, VILLAGE_ID, user["id"])
        settings = replace(application.state.settings, asset_dir=root)
        path = asset_path(settings, f"evidence/{VILLAGE_ID}/demo-story/{name}")
        return FileResponse(path, media_type="image/png")

    application.router.routes.insert(
        0,
        APIRoute(
            f"/api/assets/evidence/{VILLAGE_ID}/demo-story/{{name}}", evidence, methods=["GET"]
        ),
    )


def create_demo_app():
    application = create_app(replace(Settings.from_env(), mayor_scheduler=False))
    add_demo_evidence(application)
    return application
