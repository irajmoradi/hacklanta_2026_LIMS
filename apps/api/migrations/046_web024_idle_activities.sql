-- Additive and repeatable; retain all existing preferences.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_idle_activity_check;
ALTER TABLE users ADD CONSTRAINT users_idle_activity_check
    CHECK (idle_activity IN ('gardening', 'dancing', 'reading', 'home', 'food', 'walk_pet', 'studying', 'working_out', 'gaming'));
