import asyncio
import time
from dataclasses import replace
from types import SimpleNamespace

import pytest
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect

from app.domain import SEED_USERS, VILLAGE_ID
from app.main import create_app
from app.realtime import Movement
from app.runtime import selector_loop

PATH = f'/api/villages/{VILLAGE_ID}/live'
DATA = dict(x=0., z=0., heading=0., moving=True, running=False)


@pytest.mark.parametrize('extra', [{'x': float('nan')}, {'z': float('inf')}, {'user_id': 'spoof'}, {'emote': 'award_xp'}, {'moving': 'yes'}])
def test_invalid_state(extra):
    with pytest.raises(ValidationError):
        Movement.model_validate({**DATA, **extra})


async def test_websocket_auth_membership_fanout(api, outsider):
    _, app = api

    def scenario():
        with TestClient(create_app(app.state.settings), backend_options={'loop_factory': selector_loop}) as http:
            for auth in ({}, outsider, {'Authorization': 'Bearer invalid'}):
                with http.websocket_connect(PATH) as ws:
                    ws.send_json(auth)
                    with pytest.raises(WebSocketDisconnect) as error:
                        ws.receive_json()
                    assert error.value.code == 1008
            with http.websocket_connect(PATH) as b:
                b.send_json({'X-Demo-User': str(SEED_USERS[1][0])})
                snapshot = b.receive_json()
                assert snapshot['type'] == 'world_snapshot'
                assert len(snapshot['avatars']) == 5
                with http.websocket_connect(PATH) as a:
                    a.send_json({'X-Demo-User': str(SEED_USERS[0][0])})
                    assert a.receive_json()['type'] == 'world_snapshot'
                    a.send_json(dict(type='intent',request_id='wave',action='emote',kind='wave'))
                    while True:
                        event = b.receive_json()
                        if any(s.get('emote') == 'wave' for s in event.get('avatars', [])): break
                    assert event['type'] == 'world_delta'
                    with http.websocket_connect(PATH) as c:
                        c.send_json({'X-Demo-User': str(SEED_USERS[2][0])})
                        assert any(s.get('emote') == 'wave' for s in c.receive_json()['avatars'])
                    a.send_json({'type':'resync'})
                    while a.receive_json()['type'] != 'world_snapshot': pass
            assert not http.app.state.world_rooms[str(VILLAGE_ID)].clients
            assert http.app.state.world_rooms[str(VILLAGE_ID)].task is None

    await asyncio.wait_for(asyncio.to_thread(scenario), 30)


async def test_websocket_rate_limit_and_flood(api):
    _, app = api

    def scenario():
        with TestClient(create_app(app.state.settings), backend_options={'loop_factory': selector_loop}) as http:
            with http.websocket_connect(PATH) as ws:
                ws.send_json({'X-Demo-User': str(SEED_USERS[0][0])})
                ws.receive_json()
                for _ in range(41):
                    ws.send_json(DATA)
                with pytest.raises(WebSocketDisconnect) as error:
                    while True: ws.receive_json()
                assert error.value.code == 1008

    await asyncio.wait_for(asyncio.to_thread(scenario), 30)


async def test_auth0_signed_member_token(api):
    _, app = api
    issuer = 'https://auth.test/'
    async with app.state.pool.connection() as conn:
        await conn.execute('UPDATE users SET auth_issuer=%s,auth_subject=%s WHERE id=%s',
                           (issuer, 'movement-member', SEED_USERS[0][0]))
    # Synthetic key exists only in this test process; no provider/network calls.
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = jwt.encode(dict(sub='movement-member', iss=issuer, aud='movement-test',
                            iat=int(time.time()), exp=int(time.time())+60), key, algorithm='RS256')

    def scenario():
        settings = replace(app.state.settings, demo_auth=False,
                           auth0_domain='auth.test', auth0_audience='movement-test')
        with TestClient(create_app(settings), backend_options={'loop_factory': selector_loop}) as http:
            http.app.state.jwks = SimpleNamespace(get_signing_key_from_jwt=lambda _: SimpleNamespace(key=key.public_key()))
            with http.websocket_connect(PATH) as ws:
                ws.send_json({'Authorization': f'Bearer {token}'})
                assert ws.receive_json()['type'] == 'world_snapshot'
            with http.websocket_connect(PATH) as ws:
                ws.send_json({'X-Demo-User': str(SEED_USERS[0][0])})
                with pytest.raises(WebSocketDisconnect):
                    ws.receive_json()

    await asyncio.wait_for(asyncio.to_thread(scenario), 30)
