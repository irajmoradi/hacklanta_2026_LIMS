"""Public websocket latency on runner scratch data, never on the live village.

Run with ops/remote_run.sh --with-api python -m uv run python scripts/feat019_public_probe.py.
The temporary tunnel and its synthetic seed database are removed after the run.
"""

import asyncio
import json
import os
import re
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from contextlib import AsyncExitStack, asynccontextmanager, suppress
from pathlib import Path
from uuid import uuid4

import httpx
import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from websockets.asyncio.client import connect


async def measure(base, local, tiger):
    actors = ["13370000-0000-4000-8000-000000000002", "13370000-0000-4000-8000-000000000003"]
    async with httpx.AsyncClient(timeout=20) as http:
        # A new UUID also isolates PostgreSQL NOTIFY channels when testing hosted Tiger.
        created = await http.post(
            local + "/api/villages",
            headers={"X-Demo-User": actors[0]},
            json={"name": "QA-FEAT019-latency"},
        )
        created.raise_for_status()
        village = created.json()["village"]
        vid = village["id"]
        joined = await http.post(
            local + "/api/villages/join",
            headers={"X-Demo-User": actors[1]},
            json={"invite_code": village["invite_code"]},
        )
        joined.raise_for_status()
        result = await http.post(
            local + f"/api/houses/{vid}/edit?vid={vid}",
            headers={"X-Demo-User": actors[0]},
            json=dict(
                action="place_item",
                item_id="latency_fern",
                kind="plant_fern",
                floor=1,
                x=0,
                z=0,
                client_seq=1,
            ),
        )
        result.raise_for_status()
    url = base.replace("https:", "wss:") + f"/api/houses/{vid}/live?vid={vid}"

    async def until(ws, kind, seq=None):
        async with asyncio.timeout(20):
            while True:
                event = json.loads(await ws.recv())
                if event["type"] == "rejected":
                    raise RuntimeError(event["detail"])
                if event["type"] == kind and (seq is None or event.get("client_seq") == seq):
                    return event

    async with AsyncExitStack() as stack:

        async def authenticated(actor):
            # Quick-tunnel DNS can briefly return NXDOMAIN after the first health response.
            # Retry setup only; never discard or retry measured movement samples.
            async with asyncio.timeout(45):
                while True:
                    try:
                        ws = await stack.enter_async_context(
                            connect(url, open_timeout=5, close_timeout=1)
                        )
                        await ws.send(json.dumps({"X-Demo-User": actor}))
                        await until(ws, "snapshot")
                        return ws
                    except OSError:
                        await asyncio.sleep(1)

        sender, receiver = await asyncio.gather(*(authenticated(actor) for actor in actors))
        samples = []
        for n in range(35):
            start = time.perf_counter()
            await sender.send(
                json.dumps(
                    dict(
                        action="move_item",
                        item_id="latency_fern",
                        floor=1,
                        x=(n % 2) * 0.25,
                        z=0,
                        client_seq=n + 10,
                    )
                )
            )
            event = await until(receiver, "delta", n + 10)
            assert event["item"]["floor"] == 1
            elapsed = (time.perf_counter() - start) * 1000
            if n >= 5:
                samples.append(round(elapsed, 2))
            await until(sender, "ack", n + 10)
            await asyncio.sleep(0.1)
    ordered = sorted(samples)
    result = dict(
        path="Public Cloudflare -> scratch API -> "
        + ("isolated Tiger" if tiger else "Postgres")
        + " -> NOTIFY -> second member",
        samples_ms=samples,
        warmup=5,
        p50_ms=ordered[14],
        p95_ms=ordered[28],
        passes=ordered[28] <= 250,
        tiger=tiger,
    )
    filename = "public-latency-tiger.json" if tiger else "public-latency.json"
    output = Path(__file__).resolve().parents[1] / "artifacts/feat019" / filename
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result), flush=True)
    return 0 if result["passes"] else 1


@asynccontextmanager
async def isolated_backend(target):
    dsn = os.environ.get("FEAT019_TIGER_DSN")
    if not dsn:
        yield target, False
        return
    schema = "feat019_qa_" + uuid4().hex
    assert re.fullmatch(r"feat019_qa_[a-f0-9]{32}", schema)
    created = False
    api = None
    root = Path(__file__).resolve().parents[1]
    try:
        with psycopg.connect(dsn, connect_timeout=3) as conn:
            conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        created = True
        print(f"Isolated Tiger schema: {schema}", flush=True)
        scoped = make_conninfo(dsn, options=f"-csearch_path={schema},public")
        with psycopg.connect(scoped, connect_timeout=3) as conn:
            assert conn.execute("SELECT current_schema()").fetchone()[0] == schema
            for migration in (
                "050_house_interiors.sql",
                "051_house_presence.sql",
                "052_house_floors.sql",
            ):
                conn.execute((root / "migrations" / migration).read_text())
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        api = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            cwd=root,
            env={
                **os.environ,
                "TIGER_DATABASE_URL": scoped,
                "MAYOR_SCHEDULER": "0",
                "MAYOR_VOICE": "0",
            },
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        target = f"http://127.0.0.1:{port}"
        async with httpx.AsyncClient(timeout=2) as http:
            for _ in range(40):
                if api.returncode is not None:
                    raise RuntimeError("Isolated Tiger API stopped during startup")
                try:
                    response = await http.get(target + "/api/health")
                    if response.is_success:
                        break
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.5)
            else:
                raise RuntimeError("Isolated Tiger API readiness timed out")
        yield target, True
    finally:
        if api and api.returncode is None:
            with suppress(ProcessLookupError):
                api.terminate()
                try:
                    await asyncio.wait_for(api.wait(), 1)
                except TimeoutError:
                    api.kill()
                    await api.wait()
        if created:
            with psycopg.connect(
                dsn, connect_timeout=3, options="-cstatement_timeout=3000"
            ) as conn:
                conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))
            print("Isolated Tiger schema removed.", flush=True)


async def tunnel_probe(target, tiger):
    executable = Path(__file__).resolve().parents[1] / ".runtime/cloudflared"
    executable.parent.mkdir(exist_ok=True)
    if not executable.exists():
        urllib.request.urlretrieve(
            "https://github.com/cloudflare/cloudflared/releases/download/2026.10.0/cloudflared-linux-amd64",
            executable,
        )
        executable.chmod(0o700)
    process = await asyncio.create_subprocess_exec(
        str(executable),
        "tunnel",
        "--no-autoupdate",
        "--url",
        target,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    try:
        async with asyncio.timeout(90):
            while True:
                line = await process.stdout.readline()
                if not line:
                    raise RuntimeError("Tunnel exited before it was ready")
                found = re.search(rb"https://[a-z0-9-]+\.trycloudflare\.com", line)
                if found:
                    base = found.group().decode()
                    break
        async with httpx.AsyncClient(timeout=5) as client:
            for _ in range(30):
                try:
                    health = await client.get(base + "/api/health")
                    if health.is_success:
                        break
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(1)
            else:
                raise RuntimeError("Public scratch API did not become ready")
        return await measure(base, target, tiger)
    finally:
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), 1)
        except TimeoutError:
            process.kill()
            await process.wait()


async def main():
    task = asyncio.current_task()
    asyncio.get_running_loop().add_signal_handler(signal.SIGTERM, task.cancel)
    target = os.environ.get("VILLAGE_API_URL", "")
    database = conninfo_to_dict(os.environ.get("DATABASE_URL", ""))
    if not target.startswith("http://127.0.0.1:") or not database.get("dbname", "").startswith(
        "run_"
    ):
        raise RuntimeError("Only a runner-owned disposable API/database is permitted")
    async with isolated_backend(target) as (local, tiger):
        return await tunnel_probe(local, tiger)


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except Exception as exc:
        # Connection exceptions must never include a credential-bearing DSN in test logs.
        print(f"Public latency probe failed ({type(exc).__name__}).", file=sys.stderr)
        raise SystemExit(1) from None
