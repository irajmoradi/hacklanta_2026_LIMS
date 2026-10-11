ALTER TABLE users ADD COLUMN IF NOT EXISTS face_verified_at timestamptz;

-- Only the five most recent attempts are retained, never image data.
CREATE TABLE IF NOT EXISTS face_auth_limits (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  attempts timestamptz[] NOT NULL DEFAULT '{}'
);
