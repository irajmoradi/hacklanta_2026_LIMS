import asyncio
import json
import time

from fastapi.testclient import TestClient
from starlette.websockets import WebSocket

from app.domain import SEED_USERS, VILLAGE_ID
from app.main import create_app
from app.runtime import selector_loop
from app.realtime import committed_event


def test_committed_queue_preserves_topology_and_newer_states():
    snapshot = dict(type='world_snapshot', world_seq=10, server_time=1,
                    avatars=[dict(user_id='a', seq=9), dict(user_id='b', seq=8)])
    queue = {None: snapshot, 'removed': dict(user_id='removed', seq=7),
             'a': dict(user_id='a', seq=11), 'b': dict(user_id='b', seq=6)}
    event = committed_event(queue, 5)
    assert queue == {}
    assert event['world_seq'] == 11
    assert event['avatars'] == [dict(user_id='a', seq=11), dict(user_id='b', seq=8)]
    # An uncommitted world sequence must never enter the wire cursor.
    assert committed_event({'a': dict(user_id='a', seq=12)}, 11)['world_seq'] == 12


async def test_receive_to_fanout_with_shared_seat_tabs(api, monkeypatch):
    """Measure the actual receive->peer send path, including membership/DB/lock."""
    _, app = api
    received = {}
    samples = []
    original_receive, original_send = WebSocket.receive_text, WebSocket.send_json

    async def receive(ws):
        raw = await original_receive(ws)
        data = json.loads(raw)
        if data.get('action') == 'move':
            received[round(data['heading'], 4)] = time.monotonic()
        return raw

    async def send(ws, data, *args, **kwargs):
        await original_send(ws, data, *args, **kwargs)
        for state in data.get('avatars', []):
            if state['user_id'] != str(SEED_USERS[0][0]):
                continue
            started = received.get(round(state['heading'], 4))
            if started is not None:
                samples.append((time.monotonic()-started)*1000)

    monkeypatch.setattr(WebSocket, 'receive_text', receive)
    monkeypatch.setattr(WebSocket, 'send_json', send)

    def scenario():
        with TestClient(create_app(app.state.settings), backend_options={'loop_factory': selector_loop}) as http:
            path = f'/api/villages/{VILLAGE_ID}/live'
            with http.websocket_connect(path) as a, http.websocket_connect(path) as b:
                for ws in (a, b):
                    ws.send_json({'X-Demo-User': str(SEED_USERS[0][0])})
                    snapshot = ws.receive_json()
                state = next(s for s in snapshot['avatars'] if s['user_id'] == str(SEED_USERS[0][0]))
                for i in range(30):
                    time.sleep(.11)
                    heading = (i+1)/100
                    a.send_json(dict(type='intent', request_id=f'latency-{i}', action='move',
                                     x=state['x'], z=state['z'], heading=heading, moving=True))
                    while True:
                        event = b.receive_json()
                        if any(s['user_id']==state['user_id'] and abs(s['heading']-heading)<.00001 for s in event.get('avatars', [])):
                            break
                assert len(http.app.state.world_rooms[str(VILLAGE_ID)].clients) == 2

    await asyncio.wait_for(asyncio.to_thread(scenario), 30)
    samples.sort()
    p95 = samples[int((len(samples)-1)*.95)]
    print(f'RECEIVE_TO_FANOUT samples={len(samples)} p50={samples[len(samples)//2]:.2f}ms p95={p95:.2f}ms')
    assert p95 < 20
