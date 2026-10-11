"""Two independent websocket clients; run only against the isolated QA server."""

import asyncio
import json
import sys
import time
from pathlib import Path

from websockets.asyncio.client import connect


async def measure(base, output):
    uid = "13370000-0000-4000-8000-000000000003"
    vid = "13370000-0000-4000-8000-000000000000"
    url = base.replace("http", "ws", 1) + f"/api/houses/{uid}/live?vid={vid}"

    async def until(ws, kind, seq=None):
        async with asyncio.timeout(15):
            while True:
                event = json.loads(await ws.recv())
                if event["type"] == kind and (seq is None or event.get("client_seq") == seq):
                    return event

    async with connect(url) as sender, connect(url) as receiver:
        for ws in (sender, receiver):
            await ws.send(json.dumps({"X-Demo-User": uid}))
            await until(ws, "snapshot")
        samples = []
        for n in range(30):
            start = time.perf_counter()
            await sender.send(
                json.dumps(
                    dict(
                        action="move_item",
                        item_id="sofa",
                        x=-2 if n % 2 else -1.75,
                        z=-2,
                        rot=0,
                        client_seq=100000 + n,
                    )
                )
            )
            await until(receiver, "delta", 100000 + n)
            samples.append(round((time.perf_counter() - start) * 1000, 2))
            await until(sender, "ack", 100000 + n)
            await asyncio.sleep(0.05)
        values = sorted(samples)
        result = {
            "path": "Cloudflare -> API -> Tiger -> NOTIFY -> second client"
            if base.startswith("https:")
            else "local API -> Tiger -> NOTIFY -> second client",
            "samples_ms": samples,
            "p50_ms": values[14],
            "p95_ms": values[28],
            "under_250_ms": sum(v <= 250 for v in values),
        }
        Path(output).write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result))
        return 0 if result["p95_ms"] <= 250 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(measure(sys.argv[1], sys.argv[2])))
