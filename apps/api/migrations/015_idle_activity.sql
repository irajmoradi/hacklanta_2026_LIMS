ALTER TABLE users ADD COLUMN IF NOT EXISTS idle_activity text NOT NULL DEFAULT 'home'
    CHECK (idle_activity IN ('gardening', 'dancing', 'reading', 'home', 'food', 'walk_pet'));
