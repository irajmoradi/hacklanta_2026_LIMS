ALTER TABLE users ADD COLUMN IF NOT EXISTS portrait_placeholder boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS inbound_messages (
    message_id text PRIMARY KEY,
    request_hash text NOT NULL,
    response jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
