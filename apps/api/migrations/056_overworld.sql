CREATE TABLE IF NOT EXISTS village_overworld (
  village_id uuid PRIMARY KEY REFERENCES villages(id) ON DELETE CASCADE,
  world_seq bigint NOT NULL DEFAULT 0,
  avatars jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS overworld_requests (
  village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  payload jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (village_id,user_id,request_id)
);
CREATE INDEX IF NOT EXISTS overworld_requests_expiry ON overworld_requests(created_at);
