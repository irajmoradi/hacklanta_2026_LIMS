-- API-008: additive catalog and database-enforced equipment slots.
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS slot text
 CHECK (slot IN ('head','face','torso','neck','pet','house','voice_style','decoration'));
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS voice_style text
 CHECK (voice_style IN ('pirate','shakespearean','hype_coach'));
INSERT INTO catalog_items (id,kind,name,price_xp,requires,requires_building,asset_key,slot,voice_style) VALUES
('hat_beanie','clothing','Cozy Beanie',30,NULL,NULL,'hat_beanie','head',NULL),
('hat_cowboy','clothing','Cowboy Hat',60,NULL,NULL,NULL,'head',NULL),
('hat_crown','clothing','Village Crown',250,NULL,NULL,'hat_crown','head',NULL),
('shirt_hoodie','clothing','Hackathon Hoodie',40,NULL,NULL,NULL,'torso',NULL),
('shirt_stripes','clothing','Striped Shirt',25,NULL,NULL,NULL,'torso',NULL),
('house_backyard','house','Backyard',100,NULL,NULL,'house_backyard','house',NULL),
('house_lv2','house','House Level 2',150,NULL,NULL,'house_lv2','house',NULL),
('house_lv3','house','House Level 3',300,'house_lv2',NULL,'house_lv3','house',NULL),
('pet_dog','pet','Village Dog',100,'house_backyard','pet_shelter','pet_dog','pet',NULL),
('pet_dog_b','pet','Shelter Dog',100,'house_backyard','pet_shelter','pet_dog_b','pet',NULL),
('decor_flowers','decoration','Flower Bed',20,NULL,NULL,'flowers_a','decoration',NULL),
('decor_lamp','decoration','Porch Lamp',35,NULL,NULL,'lantern','decoration',NULL),
('decor_fountain','decoration','Tiny Fountain',80,NULL,NULL,'fountain','decoration',NULL),
('hat_cap','clothing','Village Cap',25,NULL,NULL,'hat_cap','head',NULL),
('hat_festival','clothing','Festival Hat',45,NULL,NULL,'hat_festival','head',NULL),
('hat_headphones','clothing','Headphones',120,NULL,NULL,'hat_headphones','head',NULL),
('glasses_round','clothing','Round Glasses',35,NULL,NULL,'glasses_round','face',NULL),
('jacket_denim','clothing','Denim Jacket',90,NULL,NULL,'jacket_denim','torso',NULL),
('scarf','clothing','Cozy Scarf',30,NULL,NULL,'scarf','neck',NULL),
('voice_pirate','voice_style','Pirate',80,NULL,NULL,NULL,'voice_style','pirate'),
('voice_shakespearean','voice_style','Shakespearean',500,NULL,NULL,NULL,'voice_style','shakespearean'),
('voice_hype_coach','voice_style','Hype coach',150,NULL,NULL,NULL,'voice_style','hype_coach')
ON CONFLICT (id) DO UPDATE SET asset_key=EXCLUDED.asset_key,slot=EXCLUDED.slot,
 voice_style=EXCLUDED.voice_style,requires=EXCLUDED.requires,
 requires_building=EXCLUDED.requires_building;
-- Preserve any externally seeded legacy items and their ownership.
UPDATE catalog_items SET slot=CASE WHEN kind='clothing' THEN 'torso' ELSE kind END
 WHERE slot IS NULL;
-- Older seed/migration INSERTs omit slot, including migration 006 on replay.
CREATE OR REPLACE FUNCTION catalog_default_slot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.slot IS NULL THEN
  NEW.slot := CASE WHEN NEW.id LIKE 'hat_%' THEN 'head'
    WHEN NEW.kind='clothing' THEN 'torso' ELSE NEW.kind END;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER catalog_default_slot BEFORE INSERT ON catalog_items
 FOR EACH ROW EXECUTE FUNCTION catalog_default_slot();
ALTER TABLE catalog_items ALTER COLUMN slot SET NOT NULL;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS slot text;
UPDATE inventory i SET slot=c.slot FROM catalog_items c WHERE c.id=i.item_id
 AND i.slot IS DISTINCT FROM c.slot;
-- Newest acquisition wins a legacy collision; item ID breaks timestamp ties.
-- FEAT-008: direct legacy replay must preserve the intentionally multi-animal slot.
WITH ranked AS (
 SELECT village_id,user_id,item_id,row_number() OVER (
 PARTITION BY village_id,user_id,slot ORDER BY acquired_at DESC,item_id DESC) AS n
 FROM inventory WHERE equipped AND slot <> 'farm_animal'
) UPDATE inventory i SET equipped=false FROM ranked r WHERE r.n>1
 AND (i.village_id,i.user_id,i.item_id)=(r.village_id,r.user_id,r.item_id);
ALTER TABLE inventory ALTER COLUMN slot SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_one_equipped_slot
 ON inventory(village_id,user_id,slot) WHERE equipped AND slot <> 'farm_animal';
CREATE OR REPLACE FUNCTION inventory_catalog_slot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT slot INTO NEW.slot FROM catalog_items WHERE id=NEW.item_id;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER inventory_catalog_slot BEFORE INSERT OR UPDATE ON inventory
 FOR EACH ROW EXECUTE FUNCTION inventory_catalog_slot();
