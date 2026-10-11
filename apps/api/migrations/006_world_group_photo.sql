CREATE TABLE IF NOT EXISTS village_world (
  village_id uuid PRIMARY KEY REFERENCES villages(id) ON DELETE CASCADE,
  weather text NOT NULL DEFAULT 'clear' CHECK (weather IN ('clear','rain','fog','festival_night')),
  weather_changed_at timestamptz
);
CREATE TABLE IF NOT EXISTS village_unlocks (
  village_id uuid REFERENCES villages(id) ON DELETE CASCADE,
  building text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (village_id, building)
);
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS requires_building text;
INSERT INTO catalog_items(id,kind,name,price_xp,requires_building)
VALUES ('pet_dog_b','pet','Shelter Dog',100,'pet_shelter') ON CONFLICT (id) DO NOTHING;
ALTER TABLE mayor_events ADD COLUMN IF NOT EXISTS repairs_event_id uuid REFERENCES mayor_events(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS one_repair_per_event ON mayor_events(repairs_event_id);
CREATE TABLE IF NOT EXISTS group_photos (
  job_id uuid PRIMARY KEY REFERENCES avatar_jobs(id) ON DELETE CASCADE,
  village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  consent_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS group_photo_claims (
  job_id uuid REFERENCES group_photos(job_id) ON DELETE CASCADE,
  crop_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  head_job_id uuid NOT NULL REFERENCES avatar_jobs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id,crop_id),
  UNIQUE (job_id,user_id)
);
