import asyncio
import time
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import jwt
import psycopg
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.claims import code_hash
from app.domain import SEED_USERS, VILLAGE_ID
from scripts.claim_codes import issue


@pytest.fixture
def tokens(api):
    client, app = api
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    app.state.settings.auth0_domain = 'claims.test'
    app.state.jwks = SimpleNamespace(get_signing_key_from_jwt=lambda _: SimpleNamespace(key=key.public_key()))

    def headers(subject='alice'):
        token = jwt.encode(dict(iss='https://claims.test/', sub=subject,
            aud=app.state.settings.auth0_audience, iat=int(time.time()), exp=int(time.time())+600),
            key, algorithm='RS256')
        return {'Authorization': f'Bearer {token}'}
    return headers


def new_code(app, seat=0):
    with psycopg.connect(app.state.settings.database_url) as conn:
        return issue(conn, VILLAGE_ID, SEED_USERS[seat][0])


async def claim(client, headers, code, village=VILLAGE_ID):
    return await client.post('/api/auth/claim-seat', headers=headers,
                             json={'village_id': str(village), 'code': code})


async def test_claim_mapping_single_use_demo_and_hall(api, tokens):
    client, app = api
    assert (await client.get('/api/me')).json()['user']['id'] == str(SEED_USERS[0][0])
    alice, bob = tokens(), tokens('bob')
    assert (await client.get('/api/me', headers=alice)).json()['villages'] == []
    code = new_code(app)
    async with app.state.pool.connection() as conn:
        stored = await (await conn.execute('SELECT * FROM seat_claim_codes')).fetchone()
        assert stored['code_hash'] == code_hash(code) and code not in str(stored)
        assert 71 < (stored['expires_at'].timestamp()-time.time())/3600 <= 72
    result = await claim(client, alice, code)
    assert result.status_code == 200, result.text
    for _ in range(2):
        me = (await client.get('/api/me', headers=alice)).json()
        assert me['user']['id'] == str(SEED_USERS[0][0]) and me['villages']
    assert (await claim(client, alice, code)).status_code == 409
    assert (await claim(client, bob, code)).status_code == 400
    with pytest.raises(ValueError):
        new_code(app)
    assert (await claim(client, bob, new_code(app, 1))).status_code == 200
    hall = f'/api/houses/{VILLAGE_ID}'
    placed = await client.post(hall+'/edit', params={'vid': str(VILLAGE_ID)}, headers=bob,
        json=dict(action='place_item', item_id='claim_fern', kind='plant_fern', x=0, z=0, floor=0, client_seq=1))
    assert placed.status_code == 200, placed.text
    assert placed.json()['item']['creator'] == str(SEED_USERS[1][0])
    snapshot = await client.get(hall, params={'vid': str(VILLAGE_ID)}, headers=alice)
    assert snapshot.status_code == 200 and 'claim_fern' in snapshot.text
    app.state.settings.demo_auth = False
    assert (await client.get('/api/me')).status_code == 401
    assert (await client.get('/api/me', headers=alice)).json()['user']['id'] == str(SEED_USERS[0][0])
    assert (await client.get('/api/me', headers={'Authorization': 'Bearer invalid'})).status_code == 401


async def test_invalid_expired_wrong_village_and_rotation(api, tokens):
    client, app = api
    code = new_code(app)
    assert (await claim(client, {}, code)).status_code == 401
    assert (await claim(client, tokens(), code, uuid4())).status_code == 400
    assert (await claim(client, tokens(), code+'wrong')).status_code == 400
    async with app.state.pool.connection() as conn:
        await conn.execute("UPDATE seat_claim_codes SET expires_at=now()-interval '1 second'")
    assert (await claim(client, tokens(), code)).status_code == 400
    old = new_code(app)
    fresh = new_code(app)
    assert (await claim(client, tokens(), old)).status_code == 400
    assert (await claim(client, tokens(), fresh)).status_code == 200


async def test_migration_repeat_and_cli_rejects_wrong_seat(api):
    _, app = api
    migration = Path('migrations/059_claim_codes.sql').read_text()
    with psycopg.connect(app.state.settings.database_url) as conn:
        conn.execute(migration)
        conn.execute(migration)
        with pytest.raises(ValueError):
            issue(conn, uuid4(), SEED_USERS[0][0])
        with pytest.raises(ValueError):
            issue(conn, VILLAGE_ID, uuid4())


async def test_concurrent_claim_only_one_winner(api, tokens):
    client, app = api
    code = new_code(app)
    results = await asyncio.gather(claim(client, tokens('one'), code), claim(client, tokens('two'), code))
    assert sorted(r.status_code for r in results) == [200, 400]


async def test_member_cannot_abandon_existing_identity(api, tokens):
    client, app = api
    headers = tokens()
    made = await client.post('/api/villages', headers=headers, json={'name': 'Existing home'})
    assert made.status_code in (200, 201), made.text
    assert (await claim(client, headers, new_code(app))).status_code == 409


async def test_linked_accounts_realtime_and_independent_connections(api, tokens):
    from fastapi.testclient import TestClient
    from app.main import create_app
    from app.runtime import selector_loop

    client, app = api
    alice, bob = tokens(), tokens('bob')
    assert (await claim(client, alice, new_code(app))).status_code == 200
    assert (await claim(client, bob, new_code(app, 1))).status_code == 200

    def receive(ws, kind):
        for _ in range(100):
            event = ws.receive_json()
            if event['type'] == kind:
                return event
        raise AssertionError(f'Missing {kind}')

    def scenario():
        with TestClient(create_app(app.state.settings), backend_options={'loop_factory': selector_loop}) as http:
            http.app.state.jwks = app.state.jwks
            world = f'/api/villages/{VILLAGE_ID}/live'
            with http.websocket_connect(world) as a, http.websocket_connect(world) as b:
                a.send_json(alice)
                receive(a, 'world_snapshot')
                b.send_json(bob)
                receive(b, 'world_snapshot')
                with http.websocket_connect(world) as duplicate:
                    duplicate.send_json(alice)
                    receive(duplicate, 'world_snapshot')
                    assert len(http.app.state.world_rooms[str(VILLAGE_ID)].clients) == 3
                a.send_json(dict(type='intent', request_id='signed-wave', action='emote', kind='wave'))
                while True:
                    event = receive(b, 'world_delta')
                    waved = [s for s in event['avatars'] if s.get('emote') == 'wave']
                    if waved:
                        assert waved[0]['user_id'] == str(SEED_USERS[0][0])
                        break
            hall = f'/api/houses/{VILLAGE_ID}/live?vid={VILLAGE_ID}'
            with http.websocket_connect(hall) as a, http.websocket_connect(hall) as b:
                a.send_json(alice)
                first = receive(a, 'snapshot')
                b.send_json(bob)
                second = receive(b, 'snapshot')
                assert first['client_id'] != second['client_id']
                assert first['can_edit'] and second['can_edit']
                b.send_json(dict(type='movement', x=1, z=2, heading=0, moving=True,
                                 running=False, floor=0, user_id=str(SEED_USERS[0][0])))
                movement = receive(a, 'movement')
                assert movement['user_id'] == str(SEED_USERS[1][0])
    await asyncio.wait_for(asyncio.to_thread(scenario), 30)
