import copy
import asyncio
import math
import pytest
from app.overworld import World, Intent, WorldRoom, load_rooms
from app.domain import VILLAGE_ID, SEED_USERS


def world(n=30):
    w = World(1337, [dict(user_id=str(i), house_slot=i, idle_activity='dancing') for i in range(n)])
    w.world = dict(level=100, unlocked=[e['entry']['id'] for e in w.buildings.values() if 'entry' in e])
    return w


def intent(action, **kw):
    return Intent(request_id='test', action=action, **kw)


def test_capacity_seats_ownership_and_release():
    w = world()
    for i in range(24): w.reduce(str(i), intent('drop', attraction_id='festival_stage'), 100)
    assert len({s['slot'] for s in w.avatars.values() if s['mode']=='attraction'}) == 24
    with pytest.raises(ValueError, match='free'): w.reduce('24', intent('drop', attraction_id='festival_stage'), 100)
    w.reduce('0', intent('leave_attraction'), 101)
    assert w.reduce('24', intent('drop', attraction_id='festival_stage'), 101)['slot'] == 0
    w.reduce('0', intent('sit', seat_id='storefront_cafe:0'), 102)
    with pytest.raises(ValueError, match='free'): w.reduce('1', intent('sit', seat_id='storefront_cafe:0'), 102)
    with pytest.raises(ValueError, match='own'): w.reduce('1', intent('drop', user='0', attraction_id='festival_stage'), 102)


def test_bounds_speed_rate_and_locks():
    w = world(2); p = w.avatars['0']
    s = w.reduce('0', intent('move', x=0., z=0., heading=0., moving=True), 100)
    assert math.hypot(s['x']-p['x'], s['z']-p['z']) <= .951
    with pytest.raises(ValueError, match='Rate'): w.reduce('0', intent('emote', kind='wave'), 100.01)
    with pytest.raises(ValueError, match='bounds'): w.reduce('0', intent('move', x=999., z=0., heading=0.), 101)
    w.world['level'] = 1
    with pytest.raises(ValueError, match='locked'): w.reduce('0', intent('drop', attraction_id='ferris_wheel'), 101)
    w.world.update(level=100, disaster={'closed_building':'storefront_cafe'})
    with pytest.raises(ValueError, match='closed'): w.reduce('0', intent('sit', seat_id='storefront_cafe:0'), 101)


def test_tick_deterministic_and_no_unchanged_deltas():
    a = world(100); b = copy.deepcopy(a)
    b.members = dict(reversed(list(b.members.items())))
    for now in (100,101,450,520,601,700):
        assert a.tick(now) == b.tick(now)
        assert a.tick(now) == []
    a.reduce('0', intent('emote', kind='cheer'), 1000)
    a.tick(1001)
    assert a.avatars['0']['mode'] == 'emote'
    a.tick(1004)
    assert a.avatars['0']['mode'] != 'emote'


async def test_persistence_idempotency_restart(api):
    _, app = api
    rooms = await load_rooms(app.state.pool)
    room = rooms[str(VILLAGE_ID)]; uid = str(SEED_USERS[0][0])
    data = dict(type='intent', request_id='stable', action='emote', kind='wave')
    result = await room.intent(uid, data)
    seq = room.world.seq
    assert await room.intent(uid, data) == result
    assert room.world.seq == seq
    with pytest.raises(ValueError, match='different'): await room.intent(uid, {**data, 'kind':'spin'})
    rooms2 = await load_rooms(app.state.pool)
    assert rooms2[str(VILLAGE_ID)].world.avatars == room.world.avatars
    assert await rooms2[str(VILLAGE_ID)].intent(uid, data) == result


def test_queue_coalesces_for_every_client_including_sender():
    room = WorldRoom(None, 'test', world())
    a, b = {}, {}
    room.clients = {'a': (a, asyncio.Event()), 'b': (b, asyncio.Event())}
    for seq in range(1000): room.broadcast([dict(user_id='0', seq=seq)])
    assert a == b == {'0': {'user_id':'0', 'seq':999}}


def test_follow_expiry_closed_seat_and_server_walking():
    w = world(3)
    w.reduce('0', intent('follow', user='1'), 100)
    old = w.avatars['0'].copy()
    w.tick(101)
    assert 0 < math.hypot(w.avatars['0']['x']-old['x'], w.avatars['0']['z']-old['z']) <= 3.501
    with pytest.raises(ValueError, match='target'): w.reduce('1', intent('follow', user='1'), 101)
    w.reduce('0', intent('sit', seat_id='storefront_cafe:0'), 102)
    w.world['disaster'] = {'closed_building':'storefront_cafe'}
    w.tick(103)
    assert w.avatars['0'].get('seat_id') is None
    w.world['disaster'] = None
    before = copy.deepcopy(w.avatars)
    w.tick(104)
    for u in ('1','2'):
        assert math.hypot(w.avatars[u]['x']-before[u]['x'], w.avatars[u]['z']-before[u]['z']) <= 2.801


@pytest.mark.parametrize('error_type', [RuntimeError, asyncio.CancelledError])
async def test_failed_commit_does_not_publish_or_advance(api, monkeypatch, error_type):
    _, app = api
    room = (await load_rooms(app.state.pool))[str(VILLAGE_ID)]
    before = copy.deepcopy(room.world.avatars)
    queue = {}; room.clients['test'] = (queue, asyncio.Event())
    async def fail(_): raise error_type('simulated database failure or disconnect')
    monkeypatch.setattr(room, 'persist', fail)
    with pytest.raises(error_type):
        await room.intent(str(SEED_USERS[0][0]), dict(request_id='rollback', action='emote', kind='wave'))
    assert room.world.avatars == before
    assert queue == {}


def test_pet_walk_loop_keeps_moving_and_stays_on_the_block():
    from app.overworld import pet_loop, PET_WALK_SPEED
    points = [pet_loop(t*PET_WALK_SPEED) for t in range(0, 240, 5)]
    for (x0, z0, _), (x1, z1, _) in zip(points, points[1:]):
        assert math.hypot(x1-x0, z1-z0) > 1  # never parked at a corner
    assert all(abs(x) <= 21 and abs(z) <= 21 and (abs(x) == 21 or abs(z) == 21) for x, z, _ in points)
