ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS repair_task text;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS repair_event_id uuid;
