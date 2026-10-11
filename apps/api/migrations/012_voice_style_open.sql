-- Integrator (ARCH-003 follow-up): voice styles come from packages/catalog; accept any lowercase identifier.
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_voice_style_check;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_items_voice_style_format') THEN
    ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_voice_style_format
      CHECK (voice_style IS NULL OR voice_style ~ '^[a-z][a-z0-9_]{1,40}$');
  END IF;
END $$;
