from pathlib import Path

from app.domain import SEED_USERS


async def test_idle_migration_is_repeatable_and_preserves_all_preferences(api):
    client, app = api
    migration = Path(__file__).parents[1] / 'migrations/046_web024_idle_activities.sql'
    for activity in ['studying', 'home', 'gaming', 'working_out']:
        response = await client.patch('/api/me', json={'idle_activity': activity})
        assert response.status_code == 200
        async with app.state.pool.connection() as conn:
            for _ in range(2):
                await conn.execute(migration.read_text(encoding='utf-8'))
            cursor = await conn.execute(
                'SELECT idle_activity FROM users WHERE id=%s', (SEED_USERS[0][0],)
            )
            row = await cursor.fetchone()
            assert row['idle_activity'] == activity
