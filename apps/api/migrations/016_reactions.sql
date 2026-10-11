-- FEAT-001. Polymorphic targets are checked in the same transaction by the API.
CREATE TABLE IF NOT EXISTS reactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 target_kind text NOT NULL CHECK (target_kind IN ('activity','goal','check_in')),
 target_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 emoji text NOT NULL CHECK (emoji IN ('🎉','🔥','👏','💪','❤️','😂','🤯','👑')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(target_kind,target_id,user_id,emoji)
);
CREATE INDEX IF NOT EXISTS reactions_village_target ON reactions(village_id,target_kind,target_id);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS completed_at timestamptz;
-- Old completions have no known completion time; retain their original recorded date.
UPDATE goals SET completed_at=created_at WHERE status='done' AND completed_at IS NULL;

-- Give historical wins and badges stable, reactable activity IDs too.
INSERT INTO activity_events(village_id,user_id,type,payload,created_at)
SELECT c.village_id,u.id,'competition_won',
 jsonb_build_object('competition_id',c.id,'title',c.title),
 COALESCE((SELECT max(e.created_at) FROM activity_events e
   WHERE e.village_id=c.village_id AND e.type='competition_settled'
   AND e.payload->>'competition_id'=c.id::text),c.created_at)
FROM competitions c JOIN users u ON c.result->'winners' ? u.id::text
WHERE c.status='settled' AND NOT EXISTS (SELECT 1 FROM activity_events e
 WHERE e.village_id=c.village_id AND e.user_id=u.id AND e.type='competition_won'
 AND e.payload->>'competition_id'=c.id::text);
INSERT INTO activity_events(village_id,user_id,type,payload,created_at)
SELECT w.village_id,b.user_id,'badge_earned',
 jsonb_build_object('week_id',w.id,'title','Weekly completion star'),w.finalized_at
FROM weekly_badges b JOIN weekly_audits w ON w.id=b.week_id
WHERE w.status='finalized' AND NOT EXISTS (SELECT 1 FROM activity_events e
 WHERE e.village_id=w.village_id AND e.user_id=b.user_id AND e.type='badge_earned'
 AND e.payload->>'week_id'=w.id::text);
