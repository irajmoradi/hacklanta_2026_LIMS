ALTER TABLE village_members ADD COLUMN IF NOT EXISTS house_variant jsonb
    CHECK (house_variant IS NULL OR jsonb_typeof(house_variant) = 'object');
ALTER TABLE village_members ADD COLUMN IF NOT EXISTS house_materials jsonb
    CHECK (house_materials IS NULL OR jsonb_typeof(house_materials) = 'object');
