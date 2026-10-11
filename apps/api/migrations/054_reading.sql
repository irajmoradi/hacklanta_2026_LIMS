CREATE TABLE IF NOT EXISTS reading_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 week_start date NOT NULL,
 user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 title text NOT NULL, link text NOT NULL DEFAULT '', author text NOT NULL DEFAULT '',
 why text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reading_week ON reading_items(village_id,week_start);
CREATE TABLE IF NOT EXISTS reading_completions (
 item_id uuid NOT NULL REFERENCES reading_items(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 takeaway text NOT NULL DEFAULT '', awarded boolean NOT NULL,
 -- activity_events is a hypertable keyed by (id,created_at); match reactions' logical ID reference.
 activity_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(item_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS reading_activity ON reading_completions(activity_id);
CREATE TABLE IF NOT EXISTS reading_suggestions (
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 week_start date NOT NULL, suggestions jsonb NOT NULL,
 PRIMARY KEY(village_id,week_start)
);
