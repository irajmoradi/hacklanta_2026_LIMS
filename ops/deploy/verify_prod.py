"""GET probes and an unauthenticated WebSocket handshake; never send an edit."""
import argparse
import asyncio
import os
import uuid

import httpx
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--village', required=True, type=uuid.UUID)
p.add_argument('--house', required=True, type=uuid.UUID)
p.add_argument('--asset', required=True, help='Existing /api/assets/... path accessible to this user')
p.add_argument('--rehearsal-user', type=uuid.UUID, help='Scratch API ONLY, demo authentication')
a = p.parse_args()
base = 'http://127.0.0.1:8082'
if not a.asset.startswith('/api/assets/') or '?' in a.asset or '#' in a.asset:
    raise SystemExit('Require a plain /api/assets/ path')
headers = {'X-Demo-User': str(a.rehearsal_user)} if a.rehearsal_user else {'Authorization': 'Bearer ' + os.environ.get('VERIFY_BEARER_TOKEN', '')}
if not a.rehearsal_user and not os.environ.get('VERIFY_BEARER_TOKEN'):
    raise SystemExit('Set VERIFY_BEARER_TOKEN in memory to an existing village member Auth0 token')
with httpx.Client(base_url=base, timeout=15) as client:
    assert client.get('/').status_code == 200, 'static web'
    health = client.get('/api/health'); health.raise_for_status()
    assert health.json()['ok'] and health.json()['db'] == 'up', 'DB health'
    path = f'/api/villages/{a.village}'
    assert client.get(path).status_code == 401, 'anonymous auth gate'
    if not a.rehearsal_user:
        assert client.get(path, headers={'X-Demo-User': str(a.house)}).status_code == 401, 'demo auth must be disabled'
    village = client.get(path, headers=headers); village.raise_for_status()
    assert village.json()['id'] == str(a.village), 'village identity'
    asset = client.get(a.asset, headers=headers); asset.raise_for_status()
    assert len(asset.content) > 0 and 'text/html' not in asset.headers.get('content-type', ''), 'asset bytes'

async def websocket():
    # Real 101 upgrade through :8082. Empty auth is rejected before any presence/edit writes.
    async with connect(f'ws://127.0.0.1:8082/api/houses/{a.house}/live?vid={a.village}', open_timeout=10) as ws:
        await ws.send('{}')
        try:
            await asyncio.wait_for(ws.recv(), timeout=10)
        except ConnectionClosed as exc:
            assert exc.rcvd and exc.rcvd.code == 1008, 'WebSocket auth must reject anonymous users'
        else:
            raise AssertionError('Unexpected anonymous WebSocket access')

asyncio.run(websocket())
print('PASS: static web, DB health, auth rejection, village read, asset bytes, WebSocket 101 + auth rejection')
