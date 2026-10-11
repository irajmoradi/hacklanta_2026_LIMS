ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_status_check;
ALTER TABLE goals ADD CONSTRAINT goals_status_check CHECK (status IN ('active','done','missed','stretch'));
CREATE TABLE IF NOT EXISTS goal_stretches (
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  tier integer NOT NULL CHECK (tier BETWEEN 1 AND 3),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','done')),
  completed_at timestamptz,
  PRIMARY KEY (goal_id,tier)
);
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS stretch_tier integer CHECK (stretch_tier BETWEEN 1 AND 3);
