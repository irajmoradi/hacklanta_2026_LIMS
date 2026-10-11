"""Read-only live HTTP smoke on an OS-selected temporary port."""

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx


def test_temporary_http(test_database):
    settings, _ = test_database
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    env = {
        **os.environ,
        "DATABASE_URL": settings.database_url,
        "MAYOR_SCHEDULER": "0",
        "DEMO_AUTH": "1",
        "UVICORN_LOOP": "app.runtime:selector_loop",
    }
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=Path(__file__).parents[1],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=1) as client:
            for _ in range(100):
                assert process.poll() is None, "Temporary HTTP server exited"
                try:
                    response = client.get("/api/health")
                    if response.status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                time.sleep(0.1)
            else:
                raise AssertionError("Temporary HTTP server did not start")
            assert response.json()["ok"]
            paths = client.get("/openapi.json").json()["paths"]
            # API-010 and later features can add routes; this smoke owns API-009's
            # required paths, not the total size of the application's OpenAPI schema.
            for suffix in (
                "mayor/memory",
                "mayor/event-templates",
                "mayor/effects",
                "gazette",
                "gazette/latest",
            ):
                assert "/api/villages/{vid}/" + suffix in paths
            print(f"Temporary HTTP smoke: port={port}, paths={len(paths)}, health=ok")
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
