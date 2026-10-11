CREATE TABLE IF NOT EXISTS head_speech_cache (
  cache_key text PRIMARY KEY,
  speaker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  line_id uuid REFERENCES voice_lines(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','ready','failed')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS head_speech_attempts (
  id uuid PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS head_speech_daily ON head_speech_attempts(requester_id,created_at);
