-- Pending evidence survives agent/API restarts. No phone numbers or image bytes here.
CREATE TABLE IF NOT EXISTS inbound_evidence_pending (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 choices jsonb NOT NULL,
 images jsonb NOT NULL,
 expires_at timestamptz NOT NULL
);
