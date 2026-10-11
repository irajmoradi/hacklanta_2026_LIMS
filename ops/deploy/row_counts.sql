SELECT 'users',count(*) FROM users
UNION ALL SELECT 'villages',count(*) FROM villages
UNION ALL SELECT 'village_members',count(*) FROM village_members
UNION ALL SELECT 'goals',count(*) FROM goals
UNION ALL SELECT 'check_ins',count(*) FROM check_ins
UNION ALL SELECT 'xp_ledger',count(*) FROM xp_ledger
UNION ALL SELECT 'avatar_assets',count(*) FROM avatar_assets
UNION ALL SELECT 'avatar_jobs',count(*) FROM avatar_jobs
UNION ALL SELECT 'mayor_outbox',count(*) FROM mayor_outbox
UNION ALL SELECT 'house_items',count(*) FROM house_items
ORDER BY 1;
