-- ASSET-013: independent clothing slots; existing inventory is unchanged.
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_slot_check;
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_slot_check CHECK
 (slot IN ('head','face','torso','neck','bottoms','shoes','pet','house','voice_style','decoration','consumable','farm_animal','house_addon'));
