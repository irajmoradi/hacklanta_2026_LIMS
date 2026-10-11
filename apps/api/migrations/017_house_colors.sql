ALTER TABLE village_members ADD COLUMN IF NOT EXISTS house_style text
    CHECK (house_style IN ('cottage','modern','aframe','tudor','beach','townhouse'));
ALTER TABLE village_members ADD COLUMN IF NOT EXISTS house_colors jsonb;
