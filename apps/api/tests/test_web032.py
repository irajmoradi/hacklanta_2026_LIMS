from uuid import uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.domain import SEED_USERS, VILLAGE_ID
from scripts.cleanup_qa_checkins import cleanup


async def test_qa_hidden_before_limit_and_evidence_flag(api):
    client, app = api
    uid = SEED_USERS[0][0]
    cid = uuid4()
    async with app.state.pool.connection() as conn:
        await conn.execute(
            """INSERT INTO check_ins(id,village_id,user_id,kind,body,idempotency_key,
            evidence_asset_id)
            VALUES (%s,%s,%s,'status','Normal evidence','web032-normal','test')""",
            (cid, VILLAGE_ID, uid),
        )
        await conn.execute(
            """INSERT INTO activity_events(village_id,user_id,type,payload)
            VALUES (%s,%s,'checkin',%s)""",
            (VILLAGE_ID, uid, Jsonb({'check_in_id': str(cid), 'body': 'Normal evidence'})),
        )
        for n in range(8):
            await conn.execute(
                """INSERT INTO check_ins(village_id,user_id,kind,body,idempotency_key,
                created_at) VALUES (%s,%s,'status',%s,%s,now()+interval '1 second')""",
                (VILLAGE_ID, uid, f'QA-test-{n}', f'web032-qa-{n}'),
            )
            await conn.execute(
                """INSERT INTO activity_events(village_id,user_id,type,payload,created_at)
                VALUES (%s,%s,'checkin',%s,now()+interval '1 second')""",
                (VILLAGE_ID, uid, Jsonb({'body': f'QA-test-{n}'})),
            )
    feed = await client.get(f'/api/villages/{VILLAGE_ID}/feed?limit=1')
    assert feed.status_code == 200
    assert len(feed.json()) == 1
    assert feed.json()[0]['payload']['has_evidence'] is True
    profile = await client.get(f'/api/villages/{VILLAGE_ID}/users/{uid}')
    assert profile.status_code == 200
    assert not profile.json()['villager']['status_line'].startswith('QA-')
    assert all(not c['body'].startswith('QA-') for c in profile.json()['check_ins'])


async def test_cleanup_demo_only_and_idempotent(api, test_database):
    settings, _ = test_database
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        # The API fixture seeds a fresh private test schema for this case.
        for n in range(8):
            conn.execute(
                """INSERT INTO check_ins(village_id,user_id,kind,body,idempotency_key)
                VALUES (%s,%s,'status',%s,%s)""",
                (VILLAGE_ID, SEED_USERS[0][0], f'QA-clean-{n}', f'web032-clean-{n}'),
            )
        other = uuid4()
        conn.execute("INSERT INTO villages(id,name,seed,invite_code) VALUES (%s,'Other',1,%s)",
                     (other, str(other)))
        conn.execute(
            """INSERT INTO check_ins(village_id,user_id,kind,body,idempotency_key)
            VALUES (%s,%s,'status','QA-protected','web032-protected')""",
            (other, SEED_USERS[0][0]),
        )
        assert cleanup(conn) == 8
        assert cleanup(conn, apply=True) == 8
        assert cleanup(conn, apply=True) == 0
        assert conn.execute("SELECT 1 FROM check_ins WHERE village_id=%s", (other,)).fetchone()
        assert conn.execute("SELECT 1 FROM check_ins WHERE village_id=%s", (VILLAGE_ID,)).fetchone()
        conn.rollback()
