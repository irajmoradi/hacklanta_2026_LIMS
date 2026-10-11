ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_voice_by_friends boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_villagergrams boolean NOT NULL DEFAULT false;
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_kind_check;
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_kind_check CHECK (kind IN ('clothing','pet','house','decoration','voice_style','consumable'));
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_slot_check;
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_slot_check CHECK (slot IN ('head','face','torso','neck','pet','house','voice_style','decoration','consumable'));
CREATE TABLE IF NOT EXISTS villagergrams (
 id uuid PRIMARY KEY,
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 speaker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 text text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS grams_sender_date ON villagergrams(sender_id,created_at);
CREATE INDEX IF NOT EXISTS grams_recipient_date ON villagergrams(recipient_id,created_at);
ALTER TABLE mayor_outbox ADD COLUMN IF NOT EXISTS villagergram_id uuid REFERENCES villagergrams(id) ON DELETE CASCADE;
ALTER TABLE mayor_outbox ADD COLUMN IF NOT EXISTS image_key text;
ALTER TABLE mayor_outbox DROP CONSTRAINT IF EXISTS mayor_outbox_status_check;
ALTER TABLE mayor_outbox ADD CONSTRAINT mayor_outbox_status_check CHECK (status IN ('pending','claimed','sent','failed','dry_run'));
