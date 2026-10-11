import json
from dataclasses import replace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app import auditor, budget, disasters, domain
from app.config import Settings
from app.db import one
from app.domain import SEED_USERS, VILLAGE_ID
from app.mayor import Mayor
from app.models import CheckInInput, EvidenceReview
from app.repair_plans import RepairPlan, choose_plan, example
from app.security import DailyLimiter

REAL_GENERATE = Mayor.generate


@pytest.mark.parametrize('change', [
    {'kind': 'invented'}, {'target': 0}, {'target': 7}, {'target': True},
    {'target': '2'}, {'reward_xp': 500},
])
def test_menu_bounds(change):
    value = example('scorch').model_dump()
    value['tasks'][0].update(change)
    with pytest.raises(ValidationError):
        RepairPlan.model_validate(value)


def test_count_and_duplicates():
    value = example('blight').model_dump()
    for tasks in [value['tasks'][:1], value['tasks'] * 2, [value['tasks'][0]] * 2]:
        with pytest.raises(ValidationError):
            RepairPlan.model_validate({**value, 'tasks': tasks})
    with pytest.raises(ValidationError):
        RepairPlan.model_validate({**value, 'reasoning': 'Only one sentence here.'})


async def test_gemini_then_openrouter(monkeypatch):
    calls = []
    async def gemini(self, *args):
        calls.append('gemini')
        raise RuntimeError('Offline')
    async def openrouter(self, *args):
        calls.append('openrouter')
        return example('scorch')
    monkeypatch.setattr(Mayor, 'generate', REAL_GENERATE)
    monkeypatch.setattr(Mayor, 'gemini', gemini)
    monkeypatch.setattr(Mayor, 'openrouter', openrouter)
    plan = await choose_plan('scorch', 0, Settings(database_url='unused'))
    assert calls == ['gemini', 'openrouter']
    assert not plan['example']


async def test_valid_and_invalid_provider(monkeypatch):
    async def generate(self, schema, instruction, context):
        self.last_source = 'mock-gemini'
        assert context['recent_checkins'] == 8
        return example('blackout', 8)
    monkeypatch.setattr(Mayor, 'generate', generate)
    assert (await choose_plan('blackout', 8, object()))['model'] == 'mock-gemini'
    async def broken(*args):
        raise ValueError('invalid JSON')
    monkeypatch.setattr(Mayor, 'generate', broken)
    plan = await choose_plan('blackout', 8, object())
    assert plan['example'] and len(plan['tasks']) == 2


async def test_lab_no_database_writes_and_caps(api, monkeypatch):
    client, app = api
    app.state.settings = replace(app.state.settings, cost_limiter=DailyLimiter({'llm': (1, 1, 1)}))
    async def forbidden(*args, **kwargs):
        raise AssertionError('Lab must never open a database connection')
    monkeypatch.setattr(budget.AsyncConnection, 'connect', forbidden)
    async def generate(self, schema, instruction, context):
        await budget.reserve(self.settings)
        self.last_source = 'mock-gemini'
        return example('scorch', 4)
    monkeypatch.setattr(Mayor, 'generate', generate)
    for fallback in [False, True]:
        response = await client.post('/api/lab/repair-plan', json={'kind': 'scorch'})
        assert response.status_code == 200
        events = [json.loads(line) for line in response.text.splitlines()]
        assert len(events) == 3
        assert events[-1]['plan']['example'] is fallback
    assert (await client.post('/api/lab/repair-plan', json={'kind': 'nope'})).status_code == 422


async def test_per_task_verified_progress_and_repair(api):
    client, app = api
    uid = SEED_USERS[0][0]
    async with app.state.pool.connection() as conn:
        event = await one(conn, "INSERT INTO mayor_events(village_id,kind,title,body,status) "
                         "VALUES(%s,'challenge','Missed','Goal','failed') RETURNING id", (VILLAGE_ID,))
        d = await disasters.start(conn, VILLAGE_ID, event['id'], 'blight')
        assert d['repair_plan']['example']
        log = await one(conn, "SELECT payload FROM activity_events WHERE village_id=%s "
                        "AND type='agent_decision' ORDER BY created_at DESC,id DESC LIMIT 1", (VILLAGE_ID,))
        assert log['payload']['repair_plan'] == d['repair_plan']
        for task, key in [('checkins', 'one'), ('checkins', 'one'), ('checkins', 'two'), ('study_session', 'three')]:
            asset = 'evidence/' + key
            await domain.activity(conn, VILLAGE_ID, uid, 'evidence_uploaded', {'evidence_asset_id': asset})
            result = await domain.check_in(conn, VILLAGE_ID, uid, CheckInInput(
                kind='status', body='Photo of the repair activity', evidence_asset_id=asset,
                repair_task=task, idempotency_key=str(uuid4())))
            cid = result['check_in']['id']
            row = await one(conn, 'SELECT * FROM check_ins WHERE id=%s', (cid,))
            before = (await one(conn, 'SELECT disaster FROM village_world WHERE village_id=%s', (VILLAGE_ID,)))['disaster']
            assert before  # Pending evidence never completes the repair.
            await auditor.store_review(conn, row, EvidenceReview(verdict='rejected', confidence=1, reason='Not yet approved'), 'test')
            assert (await one(conn, 'SELECT disaster FROM village_world WHERE village_id=%s', (VILLAGE_ID,)))['disaster']
            await conn.execute("UPDATE evidence_reviews SET created_at=now()-interval '1 second' WHERE check_in_id=%s", (cid,))
            await auditor.store_review(conn, row, EvidenceReview(verdict='verified', confidence=1, reason='Owner confirmed activity'), 'test')
            current = (await one(conn, 'SELECT disaster FROM village_world WHERE village_id=%s', (VILLAGE_ID,)))['disaster']
            if key == 'one':
                assert current['repair_plan']['tasks'][0]['progress'] == 1  # same photo is not counted twice
            elif key == 'two':
                assert current['repair_plan']['tasks'][0]['progress'] == 2
                assert current['repair_plan']['tasks'][1]['progress'] == 0
            else:
                assert current is None
    logs = (await client.get(f'/api/villages/{VILLAGE_ID}/agent-log')).json()
    entry = next(item for item in logs if item['action'] == 'repair_plan')
    assert entry['repair_plan'] == d['repair_plan']
    assert entry['reason'] == d['repair_plan']['reasoning']


async def test_tag_requires_current_task_and_owned_evidence(api):
    client, app = api
    base = f'/api/villages/{VILLAGE_ID}/check-ins'
    payload = {'kind': 'status', 'body': 'Helping', 'repair_task': 'checkins', 'idempotency_key': str(uuid4())}
    assert (await client.post(base, json=payload)).status_code == 422
    async with app.state.pool.connection() as conn:
        event = await one(conn, "INSERT INTO mayor_events(village_id,kind,title,body,status) "
                         "VALUES(%s,'challenge','Missed','Goal','failed') RETURNING id", (VILLAGE_ID,))
        await disasters.start(conn, VILLAGE_ID, event['id'], 'scorch')
    assert (await client.post(base, json=payload)).status_code == 422
    payload['evidence_asset_id'] = 'evidence/not-uploaded.png'
    asset = app.state.settings.asset_dir / payload['evidence_asset_id']
    asset.parent.mkdir(parents=True, exist_ok=True)
    asset.write_bytes(b'synthetic ownership test; never sent to a provider')
    assert (await client.post(base, json=payload)).status_code == 422
    assert (await client.post(base, json={**payload, 'repair_task': 'invented'})).status_code == 422
