"""Read-only live HTTP smoke on an ephemeral port; leaves port 8010 alone."""

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx


def main():
    api_dir = Path(__file__).resolve().parents[1]
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    env = {
        **os.environ,
        "MAYOR_SCHEDULER": "0",
        "VILLAGE_BUILD": "API-003",
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
        cwd=api_dir,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=3) as client:
            for _ in range(40):
                if process.poll() is not None:
                    raise RuntimeError("Server exited")
                try:
                    response = client.get("/api/health")
                    response.raise_for_status()
                    health = response.json()
                    break
                except httpx.HTTPError:
                    time.sleep(0.25)
            else:
                raise RuntimeError("Server startup timeout")
            assert health["ok"] and health["db"] == "up" and health["build"] == "API-003"
            schema = client.get("/openapi.json").json()
            assert len(schema["paths"]) == 42
            assert "/api/villages/{vid}/weekly/current" in schema["paths"]
            print(f"HTTP smoke: SUCCESS; port={port}; db=up; build=API-003; 42 paths")
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"HTTP smoke FAILED ({type(exc).__name__})")
        sys.exit(1)
