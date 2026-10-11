-- Additive and repeatable on the main database and isolated Tiger house storage.
ALTER TABLE house_items ADD COLUMN IF NOT EXISTS floor integer NOT NULL DEFAULT 0 CHECK (floor BETWEEN 0 AND 2);
ALTER TABLE house_items ADD COLUMN IF NOT EXISTS creator uuid;
ALTER TABLE house_items ADD COLUMN IF NOT EXISTS model_url text;
ALTER TABLE house_items ADD COLUMN IF NOT EXISTS creator_name text;
UPDATE house_items SET creator=house_id WHERE creator IS NULL;
ALTER TABLE house_items ALTER COLUMN creator SET NOT NULL;
UPDATE house_rooms SET editors='{}' WHERE cardinality(editors)>0;
CREATE INDEX IF NOT EXISTS house_items_floor ON house_items(house_id,floor);
CREATE INDEX IF NOT EXISTS house_moves_actor_recent ON house_item_moves(house_id,user_id,time DESC);
