"""Single-process authoritative overworld; reducers never call paid providers.

Geometry and schedule mirror WEB-024. Layout metadata is a reviewed catalog snapshot;
the parity test catches drift. All times on the wire are Unix seconds.
"""
import asyncio
import copy
import json
import math
import time
from collections import OrderedDict, deque
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from psycopg.types.json import Jsonb
from app.db import many, one

ENTRIES = json.loads(Path(__file__).with_name('overworld_layout.json').read_text())
KINDS = {'storefront_cafe': ('cafe', 6), 'study_nook': ('study', 12),
         'fountain': ('sit', 3), 'festival_stage': ('dance', 24),
         'ferris_wheel': ('sit', 10), 'fitness_corner': ('workout', 8),
         'garden': ('kneel', 12), 'food_truck': ('eat', 12),
         'pet_shelter': ('kneel', 12), 'shop': ('gather', 12),
         'farm_store': ('gather', 12), 'colosseum': ('gather', 12), 'mayor_podium': ('gather', 100)}
SEATED = {'storefront_cafe', 'study_nook', 'fountain'}
PET_WALK_SPEED = 1.6  # m/s, a stroll; below the 2.8 m/s travel budget so the walker keeps up smoothly
PET_LOOP = [(-21., -21.), (21., -21.), (21., 21.), (-21., 21.)]  # road block around the plaza


def pet_loop(distance):
    """Point and heading `distance` metres along the square pet-walk loop."""
    side = 42.
    distance %= side*4
    i = int(distance//side)
    (ax, az), (bx, bz) = PET_LOOP[i], PET_LOOP[(i+1) % 4]
    f = (distance % side)/side
    return ax+(bx-ax)*f, az+(bz-az)*f, math.atan2(bx-ax, bz-az)


def randoms(seed):
    value = seed & 0xffffffff
    while True:
        value = (value + 0x6d2b79f5) & 0xffffffff
        t = ((value ^ (value >> 15)) * (1 | value)) & 0xffffffff
        t ^= (t + (((t ^ (t >> 7)) * (61 | t)) & 0xffffffff)) & 0xffffffff
        yield ((t ^ (t >> 14)) & 0xffffffff) / 4294967296


def layout(seed, slots):
    lots = []
    rows = 6 + max(0, math.ceil((max(slots, default=-1) + 1 - 6) / 12) * 2)
    for row in range(rows):
        for col in range(6):
            district = ('residential' if row == 0 or row >= 6 else 'commercial' if row == 1
                        else ('commercial' if col in (0, 5) else 'plaza') if row == 2
                        else 'park' if col < 3 else 'festival')
            x, z, yaw = (col - 2.5)*21, (row - 2.5)*21, 0
            if district == 'residential' and seed not in (1337, 24109):
                r = randoms(seed + row*8191 + col*131)
                yaw = (next(r)-.5)*.07
                x += (next(r)-.5)*.8
                z -= next(r)*.7
            lots.append(dict(id=f'{row}:{col}', x=x, z=z, yaw=yaw, district=district))
    residential = [l for l in lots if l['district'] == 'residential']
    offset = math.floor(next(randoms(seed))*6)
    homes = {s: residential[s//6*6+(s%6+offset)%6] for s in range(max(slots, default=-1)+1)}
    reserved = {l['id'] for l in homes.values()}
    buildings = {}
    for e in ENTRIES:
        district = e.get('placement', {}).get('district', 'commercial')
        if district in ('lake', 'shelter'):
            district = 'park'
        vacant = [l for l in lots if l['id'] not in reserved and 'entry' not in l]
        candidates = [l for l in vacant if l['district'] == district]
        def rank(l):
            row, col = map(int, l['id'].split(':'))
            return math.hypot(col-2.5, row-2.5)+next(randoms(seed+row*8191+col*131))*1.8
        candidates.sort(key=rank)
        if e['id'] == 'farm_store':
            candidates.sort(key=lambda l: not l['id'].endswith(':5'))
        lot = candidates[0] if candidates else next(l for l in vacant if l['district'] != 'residential')
        lot['entry'] = e
        buildings[e['id']] = lot
    for lot in lots:
        if lot['district'] == 'park' and 'entry' not in lot:
            buildings['garden:'+lot['id']] = lot
    buildings['colosseum'] = dict(x=63., z=(rows/2-3)*21, yaw=0.)
    return homes, buildings, (-69.7, 65.6, -65.6, (rows-3)*21+2.6)


class Intent(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, allow_inf_nan=False)
    type: Literal['intent'] = 'intent'
    request_id: str = Field(min_length=1, max_length=96)
    action: Literal['move', 'join_attraction', 'leave_attraction', 'sit', 'emote', 'follow', 'drop']
    x: float | None = None
    z: float | None = None
    heading: float | None = None
    moving: bool = False
    running: bool = False
    attraction_id: str | None = Field(default=None, max_length=100)
    seat_id: str | None = Field(default=None, max_length=120)
    kind: Literal['wave', 'cheer', 'spin'] | None = None
    user: str | None = Field(default=None, max_length=36)
    # Sent by the FEAT-024 bark client; ignored here (the server derives activity from state).
    activity: Literal['cafe', 'attraction'] | None = None


class World:
    def __init__(self, seed, members, seq=0, avatars=None):
        self.members = {str(m['user_id']): m for m in members}
        self.homes, self.buildings, self.bounds = layout(seed, [m['house_slot'] for m in members])
        self.seq = seq
        self.avatars = {u: s for u, s in (avatars or {}).items() if u in self.members}
        self.world = {}
        self.event = False
        self.last = {}
        self.tick_at = None
        for uid in self.members:
            if uid not in self.avatars:
                self.avatars[uid] = dict(user_id=uid, **self.home(uid), since=0., seq=0)

    def home(self, uid):
        lot = self.homes[self.members[uid]['house_slot']]
        return dict(mode='home', x=round(lot['x']+math.sin(lot['yaw'])*7.8, 5),
                    z=round(lot['z']+math.cos(lot['yaw'])*7.8, 5), heading=lot['yaw'], activity='wander')

    def opened(self, ident):
        lot = self.buildings.get(ident)
        if not lot:
            return False
        e = lot.get('entry', {})
        unlock = e.get('unlock', {})
        d = self.world.get('disaster') or {}
        return (d.get('closed_building') != ident
                and not (d.get('kind') == 'outbreak' and ident == 'pet_shelter')
                and not (d.get('kind') == 'blackout' and ident == 'festival_stage')
                and not (d.get('kind') == 'blight' and ident.startswith('garden'))
                and self.world.get('level', 1) >= unlock.get('village_level', 1)
                and all(i in self.world.get('unlocked', []) for i in [*e.get('requires', []), *([unlock['id']] if unlock.get('id') else [])]))

    def attraction(self, uid, ident, seat=None):
        if ident == 'home':
            return self.home(uid)
        if not ident or not self.opened(ident):
            raise ValueError('Attraction locked or closed')
        kind = 'garden' if ident.startswith('garden:') else ident
        if kind not in KINDS:
            raise ValueError('Unknown attraction')
        activity, capacity = KINDS[kind]
        occupied = {s.get('slot') for u, s in self.avatars.items() if u != uid and s.get('attraction_id') == ident}
        slot = seat if seat is not None else next((i for i in range(capacity) if i not in occupied), None)
        if slot is None or slot not in range(capacity) or slot in occupied:
            raise ValueError('No free seat or attraction slot')
        x, z, heading = self.buildings[ident]['x'], self.buildings[ident]['z'], 0.
        if kind == 'storefront_cafe':
            x += [-3, 0, 3][slot//2]; z += 4.6 + (-1 if slot%2 == 0 else 1)
            heading = 0. if slot%2 == 0 else math.pi
        elif kind == 'study_nook':
            x += [-2.8, 0, 2.8][slot//4] + (-.55 if slot%2 == 0 else .55)
            z += -1 if slot%4 < 2 else 1
            heading = 0. if slot%4 < 2 else math.pi
        elif kind == 'fountain':
            x += [-3, 0, 3][slot]; z += 6.5; heading = math.pi
        elif kind == 'festival_stage':
            x += (slot%6-2.5)*1.25; z += 1+(slot//6)*1.1
        elif kind == 'fitness_corner':
            x += -3+(slot%4)*2; z += 3+(slot//4)*2
        elif kind == 'mayor_podium':
            x += (slot%10-4.5)*1.1; z += 4+(slot//10)*.8
        else:
            z += 3 if activity == 'kneel' else 6
        return dict(mode='seated' if kind in SEATED else 'attraction', x=x, z=z, heading=heading,
                    attraction_id=ident, slot=slot, seat_id=f'{ident}:{slot}' if kind in SEATED else None,
                    activity=activity, elevation=.8 if kind == 'festival_stage' else 0.)

    def change(self, uid, state, now, restart=False):
        previous = self.avatars[uid]
        if all(previous.get(k) == v for k, v in state.items()) and set(previous)-{'user_id','since','seq'} == set(state):
            return None
        self.seq += 1
        same = all(previous.get(k) == state.get(k) for k in ('mode','attraction_id','slot','emote','activity'))
        result = dict(user_id=uid, **state, since=previous['since'] if same and not restart else now, seq=self.seq)
        self.avatars[uid] = result
        return result

    def reduce(self, uid, intent, now):
        if uid not in self.members:
            raise ValueError('Not a village member')
        if now-self.last.get(uid, -1e20) < .095:
            raise ValueError('Rate limit: 10 intents per second')
        previous = self.avatars[uid]
        action = intent.action
        if action == 'move':
            if None in (intent.x, intent.z, intent.heading):
                raise ValueError('Missing movement coordinates')
            x, z = intent.x, intent.z
            if not (self.bounds[0] <= x <= self.bounds[1] and self.bounds[2] <= z <= self.bounds[3]):
                raise ValueError('Outside village bounds')
            dt = min(max(now-self.last.get(uid, now-.1), .1), 1.)
            dx, dz = x-previous['x'], z-previous['z']
            distance = math.hypot(dx, dz)
            limit = 7*dt+.25
            if distance > limit:
                x, z = previous['x']+dx/distance*limit, previous['z']+dz/distance*limit
            state = dict(mode='walking' if intent.moving else 'idle', x=x, z=z,
                         heading=math.atan2(math.sin(intent.heading), math.cos(intent.heading)),
                         running=intent.running, activity='wander', until=now+20)
        elif action in ('join_attraction', 'drop', 'sit'):
            if intent.user and intent.user != uid:
                raise ValueError('Only your own villager can be dropped')
            ident, seat = intent.attraction_id, None
            if action == 'sit':
                try:
                    ident, number = intent.seat_id.rsplit(':', 1)
                    seat = int(number)
                except (AttributeError, ValueError):
                    raise ValueError('Invalid seat id') from None
                if ident not in SEATED:
                    raise ValueError('Invalid seating attraction')
            state = self.attraction(uid, ident, seat)
            state['until'] = now+(4*math.pi/.12 if ident == 'ferris_wheel' else 120)
        elif action == 'emote':
            if not intent.kind:
                raise ValueError('Missing emote kind')
            state = dict(mode='emote', x=previous['x'], z=previous['z'], heading=previous['heading'],
                         emote=intent.kind, activity='wander', until=now+3)
        elif action == 'follow':
            if intent.user == uid or intent.user not in self.members:
                raise ValueError('Invalid follow target')
            state = dict(mode='following', x=previous['x'], z=previous['z'], heading=previous['heading'],
                         target_user=intent.user, activity='wander', until=now+120)
        else:
            state = dict(mode='idle', x=previous['x'], z=previous['z'], heading=previous['heading'],
                         activity='wander', until=now+20)
        self.last[uid] = now
        return self.change(uid, state, now, restart=action != 'move')

    def scheduled(self, uid, now):
        m = self.members[uid]; slot = m['house_slot']; phase = (now+slot*137)%600
        idle = m.get('idle_activity', 'home')
        if self.world.get('weather') == 'festival_night':
            return 'festival_stage'
        if self.event and phase < 120:
            return 'mayor_podium'
        if (now-420-(slot//6%10)*60)%600 < 60:
            return 'storefront_cafe'
        if phase >= 510:
            return 'home'
        if idle == 'gardening':
            return 'garden' if self.opened('garden') else next((i for i in self.buildings if i.startswith('garden:')), 'home')
        return {'dancing':'festival_stage','working_out':'fitness_corner','studying':'study_nook',
                'reading':'fountain','food':'food_truck'}.get(idle, 'home')

    def tick(self, now):
        dt = min(1., max(0., now-(self.tick_at if self.tick_at is not None else now-1)))
        if not dt: return []
        self.tick_at = now
        changed = []
        # Stable member order makes allocation deterministic, independent of socket order.
        for uid in sorted(self.members, key=lambda u: self.members[u]['house_slot']):
            old = self.avatars[uid]
            if old.get('until', 0) > now:
                if old.get('attraction_id') and not self.opened(old['attraction_id']):
                    state = self.home(uid)
                elif old['mode'] == 'following':
                    target = self.avatars.get(old['target_user'])
                    if not target:
                        state = self.home(uid)
                    else:
                        state = {k:v for k,v in old.items() if k not in ('seq','since','user_id')}
                        dx, dz = target['x']-old['x'], target['z']-old['z']; d = math.hypot(dx,dz)
                        step = min(3.5, max(0., d-2))
                        if d:
                            state.update(x=old['x']+dx/d*step, z=old['z']+dz/d*step, heading=math.atan2(dx,dz))
                else:
                    continue
            else:
                ident = self.scheduled(uid, now)
                try:
                    state = self.attraction(uid, ident, old.get('slot') if old.get('attraction_id') == ident else None)
                except ValueError:
                    state = self.home(uid)
                m = self.members[uid]
                if ident == 'home' and (now+m['house_slot']*137)%600 < 510:
                    if m.get('idle_activity') == 'gaming': state['activity'] = 'gaming'
                    if m.get('idle_activity') == 'walk_pet' and m.get('has_pet'):
                        # Stroll continuously around the central block (R-174): a target that keeps moving, so the
                        # walker never stands at a corner in walking mode, animating in place.
                        x, z, heading = pet_loop((now+m['house_slot']*137)*PET_WALK_SPEED)
                        state.update(mode='walking', activity='walk_pet', x=x, z=z, heading=heading)
                # Already strolling the loop: follow it directly. Re-routing via roads every tick snapped the
                # walker back to the nearest road column, so it bounced in place (R-187).
                if state.get('activity') == 'walk_pet'                         and math.hypot(old['x']-state['x'], old['z']-state['z']) < 4:
                    state.update(elevation=0., destination=None, route=[])
                else:
                    state = self.travel(old, state, dt)
            result = self.change(uid, state, now)
            if result: changed.append(result)
        return changed

    @staticmethod
    def travel(old, target, dt):
        """Walk the grid roads between civic/home visits; reserve the destination slot.

        The route is persisted with the avatar, so restart/reconnect cannot pick a
        different journey. Explicit drops still place the avatar immediately.
        """
        if math.hypot(old['x']-target['x'], old['z']-target['z']) < .08:
            return target
        if old.get('destination') == target:
            route = list(old['route'])
        else:
            road_z = lambda z: math.ceil((z+63)/21)*21-63
            sx, sz = old['x'], old['z']; tx, tz = target['x'], target['z']
            # Approach/leave tables through their authored aisles, never through a desk.
            departure = []
            if old['mode'] == 'seated' and old.get('attraction_id') in ('storefront_cafe','study_nook'):
                sx += .95 if old['attraction_id']=='storefront_cafe' else (-.7 if old['slot']%2==0 else .7)
                departure.append([sx,sz])
            approach_x = tx
            if target.get('attraction_id') in ('storefront_cafe','study_nook'):
                approach_x += .95 if target['attraction_id']=='storefront_cafe' else (-.7 if target['slot']%2==0 else .7)
            road_x = round((sx+63)/21)*21-63
            same_row = abs(sz-tz) < .05 and abs(road_z(sz)-sz) < .05
            same_col = abs(sx-tx) < .05 and abs(road_x-sx) < .05
            if same_row or same_col:
                # Already on the target's road: walk straight along it. Detouring via the nearest
                # crossing made walkers bounce in place between two points (R-187).
                route = [*departure, [tx, tz]]
            else:
                route = [*departure, [sx, road_z(sz)], [road_x, road_z(sz)],
                         [road_x, road_z(tz)], [approach_x, road_z(tz)], [approach_x,tz], [tx,tz]]
        x, z, budget, heading = old['x'], old['z'], 2.8*dt, old['heading']
        while route and budget > 0:
            tx, tz = route[0]; dx, dz = tx-x, tz-z; distance = math.hypot(dx,dz)
            if distance < .001:
                route.pop(0); continue
            step = min(distance, budget); x += dx/distance*step; z += dz/distance*step
            heading = math.atan2(dx,dz); budget -= step
            if step >= distance: route.pop(0)
        if not route: return target
        return dict(target, mode='walking', x=x, z=z, heading=heading, activity='wander',
                    elevation=0., destination=target, route=route)


class WorldRoom:
    def __init__(self, pool, vid, world):
        self.pool, self.vid, self.world = pool, vid, world
        self.lock = asyncio.Lock()
        self.clients = {}
        self.task = None
        self.topology_dirty = False
        self.received_at = OrderedDict()
        self.fanout_ms = deque(maxlen=512)
        self.catalog = None

    def record_fanout(self, states):
        now = time.monotonic()
        for state in states:
            started = self.received_at.get(state['seq'])
            if started is not None:
                self.fanout_ms.append((now-started)*1000)

    async def refresh(self, conn):
        members = await many(conn, """SELECT m.user_id,m.house_slot,u.idle_activity,
            EXISTS(SELECT 1 FROM inventory i
              WHERE i.user_id=m.user_id AND i.village_id=m.village_id AND i.equipped AND i.slot='pet') AS has_pet
            FROM village_members m JOIN users u ON u.id=m.user_id WHERE m.village_id=%s""", (self.vid,))
        seed = (await one(conn, 'SELECT seed FROM villages WHERE id=%s', (self.vid,)))['seed']
        old = self.world
        self.world = World(seed, members, old.seq, old.avatars)
        self.topology_dirty |= self.world.members.keys() != old.members.keys()
        self.world.last = old.last
        self.world.tick_at = old.tick_at
        row = await one(conn, 'SELECT weather,disaster FROM village_world WHERE village_id=%s', (self.vid,))
        unlocked = [r['building'] for r in await many(conn, 'SELECT building FROM village_unlocks WHERE village_id=%s', (self.vid,))]
        from app.catalog_registry import load_catalog
        # Catalog validation is CPU/file work, not part of the 1 Hz world tick.
        if self.catalog is None:
            self.catalog = await asyncio.to_thread(load_catalog)
        xp = (await one(conn, """SELECT COALESCE(sum(x.delta),0) AS xp FROM xp_ledger x
            JOIN village_members m ON m.village_id=x.village_id AND m.user_id=x.user_id
            WHERE x.village_id=%s AND x.delta>0 AND x.reason<>'treasury_devnet'""", (self.vid,)))['xp']
        self.world.world = dict(row or {}, unlocked=unlocked, level=self.catalog.progression(xp)[0])
        self.world.event = bool(await one(conn, "SELECT 1 FROM mayor_events WHERE village_id=%s AND status='active' LIMIT 1", (self.vid,)))

    def snapshot(self):
        return dict(type='world_snapshot', world_seq=self.world.seq, server_time=time.time(), avatars=list(self.world.avatars.values()))

    async def persist(self, conn):
        await conn.execute('UPDATE village_overworld SET world_seq=%s,avatars=%s WHERE village_id=%s',
                           (self.world.seq, Jsonb(self.world.avatars), self.vid))

    def broadcast(self, changes):
        for queue, wake in self.clients.values():
            for s in changes: queue[s['user_id']] = s
            wake.set()

    async def intent(self, uid, data, received_at=None):
        received_at = time.monotonic() if received_at is None else received_at
        intent = Intent.model_validate(data)
        async with self.lock:
            before = copy.deepcopy(self.world)
            try:
                async with self.pool.connection() as conn:
                    if uid not in self.world.members or intent.action != 'move':
                        await self.refresh(conn)
                    cached = await one(conn, 'SELECT payload,result FROM overworld_requests WHERE village_id=%s AND user_id=%s AND request_id=%s', (self.vid, uid, intent.request_id))
                    if cached:
                        if cached['payload'] != data: raise ValueError('Request id already used with different payload')
                        return cached['result']
                    state = self.world.reduce(uid, intent, time.time())
                    result = dict(type='intent_result', request_id=intent.request_id, ok=True, world_seq=self.world.seq)
                    await self.persist(conn)
                    await conn.execute('INSERT INTO overworld_requests(village_id,user_id,request_id,payload,result) VALUES (%s,%s,%s,%s,%s)',
                                       (self.vid, uid, intent.request_id, Jsonb(data), Jsonb(result)))
            except (Exception, asyncio.CancelledError):
                self.world = before
                raise
            if state:
                self.received_at[state['seq']] = received_at
                while len(self.received_at) > 512: self.received_at.popitem(last=False)
                self.broadcast([state])
            return result

    async def run(self):
        while True:
            await asyncio.sleep(1)
            async with self.lock:
                before = copy.deepcopy(self.world)
                try:
                    async with self.pool.connection() as conn:
                        await self.refresh(conn)
                        await conn.execute("DELETE FROM overworld_requests WHERE village_id=%s AND created_at < now()-interval '24 hours'", (self.vid,))
                        membership_changed = self.topology_dirty
                        if membership_changed: self.world.seq += 1
                        changes = self.world.tick(time.time())
                        if changes or membership_changed: await self.persist(conn)
                except (Exception, asyncio.CancelledError):
                    self.world = before
                    # Fail closed: reconnect clients rather than render divergent local state.
                    for _, wake in self.clients.values(): wake.set()
                    raise
                if changes: self.broadcast(changes)
                if membership_changed:
                    self.topology_dirty = False
                    for queue,wake in self.clients.values():
                        queue[None] = self.snapshot()
                        wake.set()


async def load_rooms(pool):
    rooms = {}
    async with pool.connection() as conn:
        await conn.execute('INSERT INTO village_overworld(village_id) SELECT id FROM villages ON CONFLICT DO NOTHING')
        for row in await many(conn, 'SELECT * FROM village_overworld'):
            room = WorldRoom(pool, row['village_id'], World(0, [], row['world_seq']))
            await room.refresh(conn)
            room.world.avatars.update({u:s for u,s in row['avatars'].items() if u in room.world.members})
            rooms[str(row['village_id'])] = room
    return rooms
