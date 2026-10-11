-- Independent add-on slot preserves house cosmetics and dog equipment.
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_kind_check;
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_kind_check CHECK
 (kind IN ('clothing','pet','house','decoration','voice_style','consumable','farm_animal','house_addon'));
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_slot_check;
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_slot_check CHECK
 (slot IN ('head','face','torso','neck','pet','house','voice_style','decoration','consumable','farm_animal','house_addon'));
DROP INDEX IF EXISTS inventory_one_equipped_slot;
CREATE UNIQUE INDEX inventory_one_equipped_slot ON inventory(village_id,user_id,slot)
 WHERE equipped AND slot <> 'farm_animal';
