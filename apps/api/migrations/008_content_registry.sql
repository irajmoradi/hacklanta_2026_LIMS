-- Definitions only: village_unlocks remains player state, never seeded by content sync.
-- Keep catalog_items' existing enum/slot constraints and shop response compatible.
CREATE TABLE IF NOT EXISTS content_entries (
  id text PRIMARY KEY,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  CHECK (definition->>'id' = id)
);
CREATE TABLE IF NOT EXISTS content_progression (
  id integer PRIMARY KEY CHECK (id = 1),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object')
);
