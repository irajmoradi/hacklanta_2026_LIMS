CREATE TABLE IF NOT EXISTS house_presence (
 house_id uuid NOT NULL, session_id uuid PRIMARY KEY, user_id uuid NOT NULL,
 display_name text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS house_presence_room ON house_presence(house_id,expires_at);
