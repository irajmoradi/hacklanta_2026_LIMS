ALTER TABLE villagergrams ADD COLUMN IF NOT EXISTS video_key text;
ALTER TABLE villagergrams ADD COLUMN IF NOT EXISTS video_pending_until timestamptz;
ALTER TABLE mayor_outbox ADD COLUMN IF NOT EXISTS video_key text;
ALTER TABLE mayor_outbox ADD COLUMN IF NOT EXISTS video_pending_until timestamptz;
