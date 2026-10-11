ALTER TABLE inventory ADD COLUMN IF NOT EXISTS colors jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Idempotent, including when tests build a separate schema.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='inventory'::regclass AND conname='inventory_item_colors') THEN
    ALTER TABLE inventory ADD CONSTRAINT inventory_item_colors CHECK (
      jsonb_typeof(colors)='object' AND
      (colors='{}'::jsonb OR (
        colors ? 'primary' AND
        colors - ARRAY['primary','secondary','accent'] = '{}'::jsonb AND
        jsonb_typeof(colors->'primary')='string' AND
        colors->>'primary' ~ '^#[0-9a-fA-F]{6}$' AND
        (NOT colors ? 'secondary' OR (jsonb_typeof(colors->'secondary')='string' AND colors->>'secondary' ~ '^#[0-9a-fA-F]{6}$')) AND
        (NOT colors ? 'accent' OR (jsonb_typeof(colors->'accent')='string' AND colors->>'accent' ~ '^#[0-9a-fA-F]{6}$'))
      ))
    );
  END IF;
END $$;
