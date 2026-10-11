ALTER TABLE village_world ADD COLUMN IF NOT EXISTS disaster jsonb;
ALTER TABLE village_world ADD COLUMN IF NOT EXISTS last_disaster text;
ALTER TABLE village_world ADD COLUMN IF NOT EXISTS rebuilt_at timestamptz;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS away boolean NOT NULL DEFAULT false;
ALTER TABLE custom_items ADD COLUMN IF NOT EXISTS away boolean NOT NULL DEFAULT false;

INSERT INTO catalog_items(id,kind,name,price_xp,slot) VALUES ('revival_potion','consumable','Revival potion',30,'consumable') ON CONFLICT DO NOTHING;
