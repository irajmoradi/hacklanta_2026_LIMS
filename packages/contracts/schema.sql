-- Village DB schema v1. Postgres 17 + TimescaleDB (local docker now, Tiger Data later).
-- Integrator-owned. Apply with: psql "$DATABASE_URL" -f packages/contracts/schema.sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_issuer   text NOT NULL,
  auth_subject  text NOT NULL,          -- Auth0 sub, NOT assumed to be a uuid
  display_name  text NOT NULL,
  phone_e164    text,                   -- for iMessage via Photon (optional)
  roast_ok      boolean NOT NULL DEFAULT true,   -- "don't roast me" toggle
  agent_msgs_ok boolean NOT NULL DEFAULT true,   -- mute Mayor texts
  voice_id      text,                   -- ElevenLabs voice (cloned w/ consent, or stock)
  voice_consent boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_issuer, auth_subject)
);

CREATE TABLE IF NOT EXISTS villages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  seed        integer NOT NULL,          -- procedural layout seed (persisted)
  invite_code text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS village_members (
  village_id  uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('member','owner')),
  house_level integer NOT NULL DEFAULT 1,
  house_slot  integer NOT NULL,          -- index into the seeded layout's house plots
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (village_id, user_id),
  UNIQUE (village_id, house_slot)
);

CREATE TABLE IF NOT EXISTS goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  village_id  uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start  date NOT NULL,             -- Monday of the goal week
  title       text NOT NULL,
  detail      text,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','missed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (village_id, user_id, week_start)
);

-- Time-series: check-ins (daily status / progress updates). Hypertable.
CREATE TABLE IF NOT EXISTS check_ins (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  village_id  uuid NOT NULL,
  user_id     uuid NOT NULL,
  goal_id     uuid,                      -- null = plain daily status
  kind        text NOT NULL CHECK (kind IN ('status','progress')),
  body        text NOT NULL,
  evidence_asset_id text,                -- object key of uploaded photo, private
  idempotency_key text NOT NULL,         -- client-generated; retries award XP once
  PRIMARY KEY (id, created_at),
  UNIQUE (idempotency_key, created_at)
);
SELECT create_hypertable('check_ins', 'created_at', if_not_exists => TRUE);

-- Time-series: everything that happens in the village (feed + Mayor context). Hypertable.
CREATE TABLE IF NOT EXISTS activity_events (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  village_id  uuid NOT NULL,
  user_id     uuid,                      -- null = village-wide / Mayor
  type        text NOT NULL,             -- checkin|goal_set|xp|purchase|mayor_event|mayor_message|avatar_ready|...
  payload     jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, created_at)
);
SELECT create_hypertable('activity_events', 'created_at', if_not_exists => TRUE);

-- XP is a ledger, never a client-side counter.
CREATE TABLE IF NOT EXISTS xp_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  village_id  uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta       integer NOT NULL,
  reason      text NOT NULL,             -- checkin|goal_set|purchase|mayor_event|weekly_win
  source_key  text NOT NULL UNIQUE,      -- idempotency: e.g. 'checkin:<idempotency_key>'
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_items (
  id          text PRIMARY KEY,          -- 'hat_crown', 'pet_dog', 'house_lv2' ...
  kind        text NOT NULL CHECK (kind IN ('clothing','pet','house','decoration','voice_style')),
  name        text NOT NULL,
  price_xp    integer NOT NULL CHECK (price_xp >= 0),
  requires    text REFERENCES catalog_items(id),   -- e.g. pet_dog requires house_backyard
  asset_key   text                       -- GLB key in /assets catalog
);

CREATE TABLE IF NOT EXISTS inventory (
  village_id  uuid NOT NULL,
  user_id     uuid NOT NULL,
  item_id     text NOT NULL REFERENCES catalog_items(id),
  equipped    boolean NOT NULL DEFAULT false,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (village_id, user_id, item_id),
  FOREIGN KEY (village_id, user_id) REFERENCES village_members(village_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS avatar_assets (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revision    integer NOT NULL,
  manifest    jsonb NOT NULL,            -- AvatarManifest (see api.md)
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, revision)
);

CREATE TABLE IF NOT EXISTS avatar_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage       text NOT NULL CHECK (stage IN ('segment','head','body','voice_expr')),
  status      text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  idem_key    text NOT NULL UNIQUE,      -- hash(input asset, stage, model rev, params)
  input       jsonb NOT NULL,            -- asset keys, never arbitrary URLs
  result      jsonb,
  error       text,
  attempts    integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        text NOT NULL,
  audio_key   text,                      -- mp3 object key
  expr_key    text,                      -- LAM Audio2Expression json key (optional)
  ai_generated boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mayor_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  village_id  uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('challenge','recap','random_event','prayer_response')),
  title       text NOT NULL,
  body        text NOT NULL,
  reward_xp   integer NOT NULL DEFAULT 0 CHECK (reward_xp BETWEEN 0 AND 500),
  penalty     text,                      -- 'crater' | 'house_downgrade' | null (recoverable)
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','failed','expired')),
  starts_at   timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz,
  model       text,                      -- provenance: which LLM + prompt version proposed it
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS build_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id    text NOT NULL,
  reviewer    text NOT NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ===== v2 additions (2026-10-10 02:15, integrator) =====
-- Durable idempotency for check-ins (hypertable can't carry a plain unique key).
CREATE TABLE IF NOT EXISTS check_in_keys (
  idempotency_key text PRIMARY KEY,
  check_in_id     uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- AI evidence auditor verdicts (Gemini vision). One row per review attempt; latest wins.
CREATE TABLE IF NOT EXISTS evidence_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_id   uuid NOT NULL,
  verdict       text NOT NULL CHECK (verdict IN ('verified','suspicious','rejected','error')),
  confidence    real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  reason        text NOT NULL,
  model         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_reviews_ci ON evidence_reviews (check_in_id, created_at DESC);

-- Mayor outbox for proactive iMessage delivery (claimed by the agent, idempotent send).
CREATE TABLE IF NOT EXISTS mayor_outbox (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  village_id       uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_e164       text NOT NULL,
  text             text NOT NULL,
  audio_key        text,
  kind             text NOT NULL DEFAULT 'nudge',   -- nudge|recap|event|reply
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','sent','failed')),
  claimed_until    timestamptz,
  provider_msg_id  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz
);

-- ===== v3 additions (API-003, merged 2026-10-10 02:45) =====
-- API-003: additive only. Apply after the shared contract schema.
CREATE TABLE IF NOT EXISTS weekly_audits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 week_start date NOT NULL,
 auditor_id uuid REFERENCES users(id),
 generation integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','finalized')),
 winner_id uuid REFERENCES users(id),
 finalized_at timestamptz,
 UNIQUE(village_id,week_start)
);
CREATE TABLE IF NOT EXISTS weekly_assignments (
 week_id uuid NOT NULL REFERENCES weekly_audits(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id),
 PRIMARY KEY(week_id,user_id)
);
CREATE TABLE IF NOT EXISTS weekly_grades (
 week_id uuid NOT NULL REFERENCES weekly_audits(id) ON DELETE CASCADE,
 goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
 auditor_id uuid NOT NULL REFERENCES users(id),
 ambition integer NOT NULL CHECK (ambition BETWEEN 1 AND 5),
 evidence_quality integer NOT NULL CHECK (evidence_quality BETWEEN 1 AND 5),
 progress integer NOT NULL CHECK (progress BETWEEN 1 AND 5),
 completed boolean NOT NULL,
 rationale text NOT NULL,
 PRIMARY KEY(week_id,goal_id)
);
CREATE TABLE IF NOT EXISTS weekly_suggestions (
 week_id uuid NOT NULL REFERENCES weekly_audits(id) ON DELETE CASCADE,
 goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
 suggestion jsonb NOT NULL,
 model text NOT NULL,
 PRIMARY KEY(week_id,goal_id)
);
CREATE TABLE IF NOT EXISTS weekly_votes (
 week_id uuid NOT NULL REFERENCES weekly_audits(id) ON DELETE CASCADE,
 generation integer NOT NULL,
 user_id uuid NOT NULL REFERENCES users(id),
 PRIMARY KEY(week_id,generation,user_id)
);
CREATE TABLE IF NOT EXISTS weekly_badges (
 week_id uuid NOT NULL REFERENCES weekly_audits(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id),
 PRIMARY KEY(week_id,user_id)
);
CREATE TABLE IF NOT EXISTS auditor_penalties (
 week_id uuid NOT NULL REFERENCES weekly_audits(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 PRIMARY KEY(week_id,user_id)
);
CREATE TABLE IF NOT EXISTS competitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 creator_id uuid NOT NULL REFERENCES users(id),
 title text NOT NULL,
 terms text NOT NULL,
 friendly boolean NOT NULL,
 auditor_id uuid REFERENCES users(id),
 entry_lamports bigint NOT NULL DEFAULT 0 CHECK(entry_lamports BETWEEN 0 AND 1000000000000),
 auditor_fee_bps integer NOT NULL DEFAULT 0 CHECK(auditor_fee_bps BETWEEN 0 AND 10000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','settled')),
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((friendly AND auditor_id IS NULL AND entry_lamports=0 AND auditor_fee_bps=0)
     OR (NOT friendly AND auditor_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS competition_participants (
 competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id),
 entry_lamports_intent bigint NOT NULL,
 PRIMARY KEY(competition_id,user_id)
);
CREATE TABLE IF NOT EXISTS competition_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id),
 body text NOT NULL,
 evidence_asset_id text,
 idempotency_key text NOT NULL,
 review jsonb,
 decision text NOT NULL DEFAULT 'pending' CHECK(decision IN ('pending','confirmed','rejected')),
 points integer NOT NULL DEFAULT 0 CHECK(points BETWEEN 0 AND 500),
 reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(competition_id,user_id,idempotency_key),
 FOREIGN KEY(competition_id,user_id) REFERENCES competition_participants(competition_id,user_id)
);

-- ===== v4 additions (API-004, merged 2026-10-10 02:52) =====
ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_consent_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_consent_version text;
ALTER TABLE voice_lines ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES avatar_jobs(id);
CREATE TABLE IF NOT EXISTS llm_hourly_budget (
    hour timestamptz PRIMARY KEY,
    calls integer NOT NULL CHECK (calls >= 0)
);

-- ===== v5 additions (API-006, merged 2026-10-10 03:15) =====
ALTER TABLE users ADD COLUMN IF NOT EXISTS portrait_placeholder boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS inbound_messages (
    message_id text PRIMARY KEY,
    request_hash text NOT NULL,
    response jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== v6 additions (API-007, merged 2026-10-10 05:40) =====
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

-- ===== v7 additions (API-008, merged 2026-10-10 06:05) =====
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
WITH ranked AS (
 SELECT village_id,user_id,item_id,row_number() OVER (
 PARTITION BY village_id,user_id,slot ORDER BY acquired_at DESC,item_id DESC) AS n
 FROM inventory WHERE equipped
) UPDATE inventory i SET equipped=false FROM ranked r WHERE r.n>1
 AND (i.village_id,i.user_id,i.item_id)=(r.village_id,r.user_id,r.item_id);
ALTER TABLE inventory ALTER COLUMN slot SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_one_equipped_slot
 ON inventory(village_id,user_id,slot) WHERE equipped;
CREATE OR REPLACE FUNCTION inventory_catalog_slot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT slot INTO NEW.slot FROM catalog_items WHERE id=NEW.item_id;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER inventory_catalog_slot BEFORE INSERT OR UPDATE ON inventory
 FOR EACH ROW EXECUTE FUNCTION inventory_catalog_slot();

-- ===== v8 additions (ARCH-001, merged 2026-10-10 06:15) =====
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

-- ===== activity signals (ACT-001, merged 2026-10-10 06:30) =====
-- Apply after packages/contracts/schema.sql. Integrator-owned application step.
BEGIN;
CREATE TABLE IF NOT EXISTS external_accounts (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK (provider IN ('discord','steam')),
 external_id text NOT NULL,
 consent_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,provider),
 UNIQUE (provider,external_id)
);
CREATE TABLE IF NOT EXISTS external_activity_preferences (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 opted_out boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS activity_signals (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 village_id uuid NOT NULL,
 provider text NOT NULL CHECK (provider IN ('discord','steam')),
 kind text NOT NULL CHECK (kind IN ('playing','listening','voice','online')),
 title text NOT NULL,
 minutes double precision NOT NULL CHECK (minutes > 0 AND minutes < 'Infinity'::float8),
 started_at timestamptz NOT NULL,
 PRIMARY KEY (id,started_at)
);
SELECT create_hypertable('activity_signals','started_at',if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS activity_signals_village_time
 ON activity_signals(village_id,started_at DESC);
CREATE TABLE IF NOT EXISTS external_steam_counters (
 user_id uuid NOT NULL,
 provider text NOT NULL DEFAULT 'steam' CHECK (provider='steam'),
 app_id bigint NOT NULL,
 lifetime_minutes bigint NOT NULL CHECK (lifetime_minutes>=0),
 observed_at timestamptz NOT NULL,
 consent_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,app_id),
 FOREIGN KEY(user_id,provider) REFERENCES external_accounts(user_id,provider) ON DELETE CASCADE
);
COMMIT;

-- ===== 009_mayor.sql (merged 2026-10-10 06:55) =====
-- API-009: additive, idempotent. No provider calls from database triggers.
CREATE TABLE IF NOT EXISTS mayor_memory (
 village_id uuid PRIMARY KEY REFERENCES villages(id) ON DELETE CASCADE,
 document jsonb NOT NULL DEFAULT '{"weeks":[],"facts":[],"recent":[]}',
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (octet_length(document::text) <= 1400)
);
ALTER TABLE mayor_events ADD COLUMN IF NOT EXISTS template_id text;
CREATE TABLE IF NOT EXISTS village_gazettes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 edition_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
 content jsonb NOT NULL,
 model text NOT NULL,
 ai_generated boolean NOT NULL DEFAULT true CHECK (ai_generated),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(village_id,edition_date)
);

CREATE OR REPLACE FUNCTION refresh_mayor_memory(v uuid) RETURNS void AS $$
DECLARE d jsonb; k text;
BEGIN
 -- The memory row serializes snapshots, including concurrent check-ins.
 INSERT INTO mayor_memory(village_id) VALUES(v) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM mayor_memory WHERE village_id=v FOR UPDATE;
 SELECT jsonb_build_object(
 'weeks', COALESCE((SELECT jsonb_agg(x) FROM (
   SELECT week_start AS week, winner_id AS winner,
     (SELECT count(*) FROM weekly_grades g WHERE g.week_id=w.id AND g.completed) AS completed
   FROM weekly_audits w WHERE village_id=v AND status='finalized'
   ORDER BY week_start DESC LIMIT 4) x), '[]'::jsonb),
 'facts', COALESCE((SELECT jsonb_agg(x) FROM (
   SELECT m.user_id AS villager,
     (SELECT count(*) FROM weekly_audits w WHERE w.village_id=v
       AND w.status='finalized' AND w.winner_id=m.user_id) AS wins,
     (SELECT count(*) FROM check_ins c WHERE c.village_id=v AND c.user_id=m.user_id) AS checkins,
     (SELECT count(*)-count(DISTINCT evidence_asset_id) FROM check_ins c
       WHERE c.village_id=v AND c.user_id=m.user_id
       AND evidence_asset_id IS NOT NULL) AS reused_evidence
   FROM village_members m WHERE m.village_id=v ORDER BY m.house_slot LIMIT 12) x), '[]'::jsonb),
 'recent', COALESCE((SELECT jsonb_agg(x) FROM (
   SELECT kind, status, left(body,120) AS summary FROM mayor_events
   WHERE village_id=v ORDER BY created_at DESC,id LIMIT 3) x), '[]'::jsonb)
 ) INTO d;
 WHILE octet_length(d::text)>1400 LOOP
   k := CASE WHEN jsonb_array_length(d->'recent')>1 THEN 'recent'
             WHEN jsonb_array_length(d->'weeks')>1 THEN 'weeks'
             WHEN jsonb_array_length(d->'facts')>1 THEN 'facts'
             WHEN jsonb_array_length(d->'recent')>0 THEN 'recent'
             WHEN jsonb_array_length(d->'weeks')>0 THEN 'weeks' ELSE 'facts' END;
   d := jsonb_set(d, ARRAY[k], (d->k) - (jsonb_array_length(d->k)-1));
 END LOOP;
 UPDATE mayor_memory SET document=d,updated_at=now() WHERE village_id=v;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mayor_memory_changed() RETURNS trigger AS $$
BEGIN
 PERFORM refresh_mayor_memory(NEW.village_id);
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER mayor_memory_week AFTER INSERT OR UPDATE OF status
 ON weekly_audits FOR EACH ROW WHEN (NEW.status='finalized')
 EXECUTE FUNCTION mayor_memory_changed();
CREATE OR REPLACE TRIGGER mayor_memory_event AFTER INSERT OR UPDATE OF status
 ON mayor_events FOR EACH ROW EXECUTE FUNCTION mayor_memory_changed();
CREATE OR REPLACE TRIGGER mayor_memory_checkin AFTER INSERT
 ON check_ins FOR EACH ROW EXECUTE FUNCTION mayor_memory_changed();

-- Initialize memory from pre-migration history as well as future activity.
DO $$
DECLARE v uuid;
BEGIN
 FOR v IN SELECT id FROM villages ORDER BY id LOOP
   PERFORM refresh_mayor_memory(v);
 END LOOP;
END;
$$;

-- ===== 010_social.sql (merged 2026-10-10 06:55) =====
CREATE TABLE IF NOT EXISTS villager_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 text text NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
 kind text NOT NULL CHECK (kind IN ('message','poke','cheer')),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 CHECK (from_user_id <> to_user_id)
);
CREATE INDEX IF NOT EXISTS messages_inbox ON villager_messages(village_id,to_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender ON villager_messages(from_user_id,created_at DESC);
ALTER TABLE mayor_outbox ADD COLUMN IF NOT EXISTS villager_message_id uuid
 REFERENCES villager_messages(id) ON DELETE CASCADE;
CREATE TABLE IF NOT EXISTS mayor_bribes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 currency text NOT NULL CHECK (currency IN ('xp','sol_intent')),
 xp integer NOT NULL CHECK (xp BETWEEN 0 AND 10000),
 wish text NOT NULL CHECK (length(wish) BETWEEN 1 AND 1000),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','consumed','intent')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((currency='xp' AND xp>0 AND status<>'intent') OR
        (currency='sol_intent' AND xp=0 AND status='intent'))
);
CREATE INDEX IF NOT EXISTS bribes_pending ON mayor_bribes(village_id,created_at) WHERE status='pending';
CREATE TABLE IF NOT EXISTS account_deletion_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 deleted_at timestamptz NOT NULL DEFAULT now()
);

-- ===== 012_voice_style_open.sql (integrator, 2026-10-10 06:55) =====
-- Integrator (ARCH-003 follow-up): voice styles come from packages/catalog; accept any lowercase identifier.
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_voice_style_check;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_items_voice_style_format') THEN
    ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_voice_style_format
      CHECK (voice_style IS NULL OR voice_style ~ '^[a-z][a-z0-9_]{1,40}$');
  END IF;
END $$;

-- ===== 011_photo_items.sql (API-011, merged 2026-10-10 06:50) =====
-- Additive API-011 storage. Grants have durable source keys; spending is atomic.
CREATE TABLE IF NOT EXISTS photo_item_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL,
 user_id uuid NOT NULL,
 source text NOT NULL UNIQUE,
 spent_job uuid UNIQUE REFERENCES avatar_jobs(id) ON DELETE SET NULL,
 consumed_at timestamptz,
 FOREIGN KEY (village_id,user_id) REFERENCES village_members(village_id,user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS photo_item_jobs (
 job_id uuid PRIMARY KEY REFERENCES avatar_jobs(id) ON DELETE CASCADE,
 village_id uuid NOT NULL,
 user_id uuid NOT NULL,
 FOREIGN KEY (village_id,user_id) REFERENCES village_members(village_id,user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS custom_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL,
 owner uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('outfit','object')),
 slot text NOT NULL CHECK (slot IN ('torso','head','decoration')),
 tint jsonb,
 pattern_url text,
 glb_url text,
 preview text NOT NULL,
 source_job uuid NOT NULL UNIQUE REFERENCES avatar_jobs(id) ON DELETE CASCADE,
 equipped boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (village_id,owner) REFERENCES village_members(village_id,user_id) ON DELETE CASCADE,
 CHECK ((kind='outfit' AND slot IN ('torso','head') AND tint IS NOT NULL AND pattern_url IS NOT NULL)
     OR (kind='object' AND slot='decoration' AND glb_url IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS custom_items_equipped_slot
 ON custom_items(village_id,owner,slot) WHERE equipped;

CREATE OR REPLACE FUNCTION photo_token_weekly() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='finalized' AND NEW.winner_id IS NOT NULL THEN
  INSERT INTO photo_item_tokens(village_id,user_id,source)
   VALUES(NEW.village_id,NEW.winner_id,'weekly:' || NEW.id::text) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER photo_token_weekly AFTER INSERT OR UPDATE ON weekly_audits
 FOR EACH ROW EXECUTE FUNCTION photo_token_weekly();
CREATE OR REPLACE FUNCTION photo_token_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.reason='mayor_event' AND NEW.delta>0 THEN
  INSERT INTO photo_item_tokens(village_id,user_id,source)
   VALUES(NEW.village_id,NEW.user_id,'reward:' || NEW.source_key) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER photo_token_event AFTER INSERT ON xp_ledger
 FOR EACH ROW EXECUTE FUNCTION photo_token_event();

-- Honor existing crowns/rewards too; replay cannot restore spent tokens.
INSERT INTO photo_item_tokens(village_id,user_id,source)
 SELECT w.village_id,w.winner_id,'weekly:' || w.id::text FROM weekly_audits w
 JOIN village_members m ON m.village_id=w.village_id AND m.user_id=w.winner_id
 WHERE w.status='finalized' AND w.winner_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO photo_item_tokens(village_id,user_id,source)
 SELECT x.village_id,x.user_id,'reward:' || x.source_key FROM xp_ledger x
 JOIN village_members m ON m.village_id=x.village_id AND m.user_id=x.user_id
 WHERE x.reason='mayor_event' AND x.delta>0 AND x.source_key IS NOT NULL
 ON CONFLICT DO NOTHING;

-- ===== 013_face_auth.sql (API-013, merged 2026-10-10 12:40) =====
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_verified_at timestamptz;

-- Only the five most recent attempts are retained, never image data.
CREATE TABLE IF NOT EXISTS face_auth_limits (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  attempts timestamptz[] NOT NULL DEFAULT '{}'
);

-- folded from apps/api/migrations/014_villagergram.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_voice_by_friends boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_villagergrams boolean NOT NULL DEFAULT false;
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_kind_check;
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_kind_check CHECK (kind IN ('clothing','pet','house','decoration','voice_style','consumable'));
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_slot_check;
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_slot_check CHECK (slot IN ('head','face','torso','neck','pet','house','voice_style','decoration','consumable'));
CREATE TABLE IF NOT EXISTS villagergrams (
 id uuid PRIMARY KEY,
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 speaker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 text text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS grams_sender_date ON villagergrams(sender_id,created_at);
CREATE INDEX IF NOT EXISTS grams_recipient_date ON villagergrams(recipient_id,created_at);
ALTER TABLE mayor_outbox ADD COLUMN IF NOT EXISTS villagergram_id uuid REFERENCES villagergrams(id) ON DELETE CASCADE;
ALTER TABLE mayor_outbox ADD COLUMN IF NOT EXISTS image_key text;
ALTER TABLE mayor_outbox DROP CONSTRAINT IF EXISTS mayor_outbox_status_check;
ALTER TABLE mayor_outbox ADD CONSTRAINT mayor_outbox_status_check CHECK (status IN ('pending','claimed','sent','failed','dry_run'));

-- folded from apps/api/migrations/015_idle_activity.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS idle_activity text NOT NULL DEFAULT 'home'
    CHECK (idle_activity IN ('gardening', 'dancing', 'reading', 'home', 'food', 'walk_pet'));

-- folded from apps/api/migrations/016_reactions.sql
-- FEAT-001. Polymorphic targets are checked in the same transaction by the API.
CREATE TABLE IF NOT EXISTS reactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 target_kind text NOT NULL CHECK (target_kind IN ('activity','goal','check_in')),
 target_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 emoji text NOT NULL CHECK (emoji IN ('🎉','🔥','👏','💪','❤️','😂','🤯','👑')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(target_kind,target_id,user_id,emoji)
);
CREATE INDEX IF NOT EXISTS reactions_village_target ON reactions(village_id,target_kind,target_id);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS completed_at timestamptz;
-- Old completions have no known completion time; retain their original recorded date.
UPDATE goals SET completed_at=created_at WHERE status='done' AND completed_at IS NULL;

-- Give historical wins and badges stable, reactable activity IDs too.
INSERT INTO activity_events(village_id,user_id,type,payload,created_at)
SELECT c.village_id,u.id,'competition_won',
 jsonb_build_object('competition_id',c.id,'title',c.title),
 COALESCE((SELECT max(e.created_at) FROM activity_events e
   WHERE e.village_id=c.village_id AND e.type='competition_settled'
   AND e.payload->>'competition_id'=c.id::text),c.created_at)
FROM competitions c JOIN users u ON c.result->'winners' ? u.id::text
WHERE c.status='settled' AND NOT EXISTS (SELECT 1 FROM activity_events e
 WHERE e.village_id=c.village_id AND e.user_id=u.id AND e.type='competition_won'
 AND e.payload->>'competition_id'=c.id::text);
INSERT INTO activity_events(village_id,user_id,type,payload,created_at)
SELECT w.village_id,b.user_id,'badge_earned',
 jsonb_build_object('week_id',w.id,'title','Weekly completion star'),w.finalized_at
FROM weekly_badges b JOIN weekly_audits w ON w.id=b.week_id
WHERE w.status='finalized' AND NOT EXISTS (SELECT 1 FROM activity_events e
 WHERE e.village_id=w.village_id AND e.user_id=b.user_id AND e.type='badge_earned'
 AND e.payload->>'week_id'=w.id::text);

-- folded from apps/api/migrations/017_house_colors.sql
ALTER TABLE village_members ADD COLUMN IF NOT EXISTS house_style text
    CHECK (house_style IN ('cottage','modern','aframe','tudor','beach','townhouse'));
ALTER TABLE village_members ADD COLUMN IF NOT EXISTS house_colors jsonb;

-- folded from apps/api/migrations/018_gram_video.sql
ALTER TABLE villagergrams ADD COLUMN IF NOT EXISTS video_key text;
ALTER TABLE villagergrams ADD COLUMN IF NOT EXISTS video_pending_until timestamptz;
ALTER TABLE mayor_outbox ADD COLUMN IF NOT EXISTS video_key text;
ALTER TABLE mayor_outbox ADD COLUMN IF NOT EXISTS video_pending_until timestamptz;

-- folded from apps/api/migrations/019_item_colors.sql
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

-- folded from apps/api/migrations/025_inbound_evidence.sql
-- Pending evidence survives agent/API restarts. No phone numbers or image bytes here.
CREATE TABLE IF NOT EXISTS inbound_evidence_pending (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 choices jsonb NOT NULL,
 images jsonb NOT NULL,
 expires_at timestamptz NOT NULL
);

-- folded from apps/api/migrations/022_photo_refunds_guests.sql
-- Refund exactly once, including failures reported while the browser is closed.
CREATE OR REPLACE FUNCTION refund_failed_photo_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='failed' THEN
  UPDATE photo_item_tokens SET consumed_at=NULL,spent_job=NULL WHERE spent_job=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER refund_failed_photo_item AFTER UPDATE OF status ON avatar_jobs
 FOR EACH ROW EXECUTE FUNCTION refund_failed_photo_item();
UPDATE photo_item_tokens SET consumed_at=NULL,spent_job=NULL
 WHERE spent_job IN (SELECT id FROM avatar_jobs WHERE status='failed');
CREATE SEQUENCE IF NOT EXISTS demo_guest_number;

-- folded from apps/api/migrations/020_farm_animals.sql
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

-- folded from apps/api/migrations/021_idle_studying.sql
-- Re-runnable additive migration; preserve every existing preference.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_idle_activity_check;
ALTER TABLE users ADD CONSTRAINT users_idle_activity_check
    CHECK (idle_activity IN ('gardening', 'dancing', 'reading', 'home', 'food', 'walk_pet', 'studying'));

-- folded from apps/api/migrations/023_house_options.sql
ALTER TABLE village_members ADD COLUMN IF NOT EXISTS house_variant jsonb
    CHECK (house_variant IS NULL OR jsonb_typeof(house_variant) = 'object');
ALTER TABLE village_members ADD COLUMN IF NOT EXISTS house_materials jsonb
    CHECK (house_materials IS NULL OR jsonb_typeof(house_materials) = 'object');

-- folded from apps/api/migrations/026_disasters.sql
ALTER TABLE village_world ADD COLUMN disaster jsonb;
ALTER TABLE village_world ADD COLUMN last_disaster text;
ALTER TABLE village_world ADD COLUMN rebuilt_at timestamptz;
ALTER TABLE inventory ADD COLUMN away boolean NOT NULL DEFAULT false;
ALTER TABLE custom_items ADD COLUMN away boolean NOT NULL DEFAULT false;

INSERT INTO catalog_items(id,kind,name,price_xp,slot) VALUES ('revival_potion','consumable','Revival potion',30,'consumable') ON CONFLICT DO NOTHING;

-- folded from apps/api/migrations/046_web024_idle_activities.sql
-- Additive and repeatable; retain all existing preferences.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_idle_activity_check;
ALTER TABLE users ADD CONSTRAINT users_idle_activity_check
    CHECK (idle_activity IN ('gardening', 'dancing', 'reading', 'home', 'food', 'walk_pet', 'studying', 'working_out', 'gaming'));

-- folded from apps/api/migrations/027_coins.sql
-- FEAT-007. Keep historical XP rows for audit; progress reads positive awards only.
CREATE TABLE IF NOT EXISTS coin_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 delta integer NOT NULL,
 reason text NOT NULL,
 source_key text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coin_ledger_member ON coin_ledger(village_id,user_id);

-- One row per historical source preserves spending, timestamps and idempotency.
INSERT INTO coin_ledger(village_id,user_id,delta,reason,source_key,created_at)
 SELECT village_id,user_id,delta,reason,source_key,created_at FROM xp_ledger
 ON CONFLICT(source_key) DO NOTHING;

-- Covers every award path, including synchronous seed jobs and direct SQL imports.
CREATE OR REPLACE FUNCTION coins_from_xp() RETURNS trigger AS $$
BEGIN
 IF NEW.delta < 0 THEN
   RAISE EXCEPTION 'XP is progress only; debit coin_ledger instead';
 END IF;
 INSERT INTO coin_ledger(village_id,user_id,delta,reason,source_key,created_at)
 VALUES(NEW.village_id,NEW.user_id,NEW.delta,NEW.reason,NEW.source_key,NEW.created_at)
 ON CONFLICT(source_key) DO NOTHING;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER xp_awards_coins AFTER INSERT ON xp_ledger
 FOR EACH ROW EXECUTE FUNCTION coins_from_xp();

-- Retain the old column for baseline-schema compatibility; new code uses coins.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns
   WHERE table_schema=current_schema() AND table_name='catalog_items' AND column_name='price_coins') THEN
   ALTER TABLE catalog_items ADD COLUMN price_coins integer NOT NULL DEFAULT 0 CHECK(price_coins>=0);
   UPDATE catalog_items SET price_coins=price_xp;
 END IF;
END $$;
ALTER TABLE catalog_items ALTER COLUMN price_xp SET DEFAULT 0;

-- folded from apps/api/migrations/047_competition_scoring.sql
ALTER TABLE competitions ADD COLUMN scoring text NOT NULL DEFAULT 'cumulative'
 CHECK(scoring IN ('cumulative','scoreboard','ordinal'));
ALTER TABLE competitions ADD COLUMN unit text CHECK(length(trim(unit)) BETWEEN 1 AND 40);
ALTER TABLE competitions ADD COLUMN target double precision CHECK(target > 0 AND target <= 1e12);
ALTER TABLE competitions ADD CONSTRAINT competition_scoring_terms CHECK(
 (scoring <> 'scoreboard' OR unit IS NOT NULL) AND
 (scoring <> 'cumulative' OR (unit IS NULL AND target IS NULL)));
ALTER TABLE competition_entries ADD COLUMN claimed_value double precision CHECK(claimed_value >= 0 AND claimed_value <= 1e12);
ALTER TABLE competition_entries ADD COLUMN value double precision CHECK(value >= 0 AND value <= 1e12);
ALTER TABLE competition_entries ADD COLUMN confirmed_at timestamptz;
UPDATE competition_entries SET confirmed_at=created_at WHERE decision='confirmed';

-- folded from apps/api/migrations/048_head_speech.sql
CREATE TABLE IF NOT EXISTS head_speech_cache (
  cache_key text PRIMARY KEY,
  speaker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  line_id uuid REFERENCES voice_lines(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','ready','failed')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS head_speech_attempts (
  id uuid PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS head_speech_daily ON head_speech_attempts(requester_id,created_at);

-- 049_goal_stretch.sql
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_status_check;
ALTER TABLE goals ADD CONSTRAINT goals_status_check CHECK (status IN ('active','done','missed','stretch'));
CREATE TABLE IF NOT EXISTS goal_stretches (
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  tier integer NOT NULL CHECK (tier BETWEEN 1 AND 3),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','done')),
  completed_at timestamptz,
  PRIMARY KEY (goal_id,tier)
);
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS stretch_tier integer CHECK (stretch_tier BETWEEN 1 AND 3);

-- 050_house_interiors.sql
-- Independent identities deliberately have no foreign keys into the main database:
-- this exact schema also runs on the dedicated Tiger service.
CREATE TABLE IF NOT EXISTS house_rooms (
 house_id uuid PRIMARY KEY, seq bigint NOT NULL DEFAULT 0,
 editors uuid[] NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS house_items (
 house_id uuid NOT NULL REFERENCES house_rooms(house_id), item_id text NOT NULL,
 kind text NOT NULL, x double precision NOT NULL, z double precision NOT NULL,
 rot double precision NOT NULL DEFAULT 0, stashed boolean NOT NULL DEFAULT false,
 seq bigint NOT NULL DEFAULT 0, PRIMARY KEY(house_id,item_id)
);
CREATE TABLE IF NOT EXISTS house_item_moves (
 time timestamptz NOT NULL DEFAULT clock_timestamp(), house_id uuid NOT NULL,
 item_id text NOT NULL, user_id uuid NOT NULL, x double precision NOT NULL,
 z double precision NOT NULL, rot double precision NOT NULL, action text NOT NULL,
 seq bigint NOT NULL, before_state jsonb, after_state jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS house_moves_recent ON house_item_moves(house_id,time DESC);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='timescaledb') THEN
  PERFORM create_hypertable('house_item_moves','time',if_not_exists=>true,migrate_data=>true);
  ALTER TABLE house_item_moves SET (timescaledb.compress, timescaledb.compress_segmentby='house_id');
  PERFORM add_compression_policy('house_item_moves',INTERVAL '7 days',if_not_exists=>true);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS house_furniture_inventory (
 house_id uuid NOT NULL, kind text NOT NULL, PRIMARY KEY(house_id,kind)
);

-- 051_house_presence.sql
CREATE TABLE IF NOT EXISTS house_presence (
 house_id uuid NOT NULL, session_id uuid PRIMARY KEY, user_id uuid NOT NULL,
 display_name text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS house_presence_room ON house_presence(house_id,expires_at);

-- 052_house_floors.sql
-- Additive and repeatable on the main database and isolated Tiger house storage.
ALTER TABLE house_items ADD COLUMN IF NOT EXISTS floor integer NOT NULL DEFAULT 0 CHECK (floor BETWEEN 0 AND 2);
ALTER TABLE house_items ADD COLUMN IF NOT EXISTS creator uuid;
ALTER TABLE house_items ADD COLUMN IF NOT EXISTS model_url text;
ALTER TABLE house_items ADD COLUMN IF NOT EXISTS creator_name text;
UPDATE house_items SET creator=house_id WHERE creator IS NULL;
ALTER TABLE house_items ALTER COLUMN creator SET NOT NULL;
UPDATE house_rooms SET editors='{}' WHERE cardinality(editors)>0;
CREATE INDEX IF NOT EXISTS house_items_floor ON house_items(house_id,floor);
CREATE INDEX IF NOT EXISTS house_moves_actor_recent ON house_item_moves(house_id,user_id,time DESC);

-- 053_scale_hot_reads.sql
-- SCALE-001: member status/ledger probes and bounded feed reads.
-- Timescale propagates these idempotent indexes to existing/new chunks.
CREATE INDEX IF NOT EXISTS check_ins_member_recent
  ON check_ins(village_id,user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS check_ins_evidence_lookup
  ON check_ins(village_id,(id::text)) WHERE evidence_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS activity_events_village_recent
  ON activity_events(village_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS xp_ledger_member_positive
  ON xp_ledger(village_id,user_id) INCLUDE (delta) WHERE delta>0;

-- 054_reading.sql
CREATE TABLE IF NOT EXISTS reading_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 week_start date NOT NULL,
 user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 title text NOT NULL, link text NOT NULL DEFAULT '', author text NOT NULL DEFAULT '',
 why text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reading_week ON reading_items(village_id,week_start);
CREATE TABLE IF NOT EXISTS reading_completions (
 item_id uuid NOT NULL REFERENCES reading_items(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 takeaway text NOT NULL DEFAULT '', awarded boolean NOT NULL,
 -- activity_events is a hypertable keyed by (id,created_at); match reactions' logical ID reference.
 activity_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(item_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS reading_activity ON reading_completions(activity_id);
CREATE TABLE IF NOT EXISTS reading_suggestions (
 village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
 week_start date NOT NULL, suggestions jsonb NOT NULL,
 PRIMARY KEY(village_id,week_start)
);

-- 055_lower_body_slots.sql
-- ASSET-013: independent clothing slots; existing inventory is unchanged.
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_slot_check;
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_slot_check CHECK
 (slot IN ('head','face','torso','neck','bottoms','shoes','pet','house','voice_style','decoration','consumable','farm_animal','house_addon'));

-- 056_overworld.sql
CREATE TABLE IF NOT EXISTS village_overworld (
  village_id uuid PRIMARY KEY REFERENCES villages(id) ON DELETE CASCADE,
  world_seq bigint NOT NULL DEFAULT 0,
  avatars jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS overworld_requests (
  village_id uuid NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  payload jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (village_id,user_id,request_id)
);
CREATE INDEX IF NOT EXISTS overworld_requests_expiry ON overworld_requests(created_at);

-- FEAT-027: additive, idempotent. Re-number if 057 is occupied at merge time.
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS payout_mode text NOT NULL DEFAULT 'winner_take_all' CHECK (payout_mode IN ('winner_take_all','proportional','ranked'));
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS ranked_bps integer[] NOT NULL DEFAULT '{}';
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS entry_coins integer NOT NULL DEFAULT 0 CHECK(entry_coins BETWEEN 0 AND 1000000);
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS deadline timestamptz;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS pot_address text UNIQUE;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS chain_config jsonb;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS chain_status text NOT NULL DEFAULT 'unfunded';
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS settlement_snapshot jsonb;
ALTER TABLE competition_participants ADD COLUMN IF NOT EXISTS wallet_address text;
ALTER TABLE competition_participants ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT clock_timestamp();
CREATE UNIQUE INDEX IF NOT EXISTS competition_wallet_once ON competition_participants(competition_id,wallet_address);
CREATE TABLE IF NOT EXISTS solana_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 village_id uuid NOT NULL REFERENCES villages(id), user_id uuid NOT NULL REFERENCES users(id),
 competition_id uuid REFERENCES competitions(id), action text NOT NULL,
 wallet text NOT NULL, instructions jsonb NOT NULL, metadata jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
 signature text UNIQUE, confirmed_at timestamptz
);
CREATE INDEX IF NOT EXISTS solana_intents_user_day ON solana_intents(user_id,created_at);

ALTER TABLE competition_participants ADD COLUMN IF NOT EXISTS chain_join_index integer;

-- Treasury is personal progress, not a purchase of spendable village coins.
CREATE OR REPLACE FUNCTION coins_from_xp() RETURNS trigger AS $$
BEGIN
 IF NEW.delta < 0 THEN
   RAISE EXCEPTION 'XP is progress only; debit coin_ledger instead';
 END IF;
 IF NEW.reason <> 'treasury_devnet' THEN
   INSERT INTO coin_ledger(village_id,user_id,delta,reason,source_key,created_at)
   VALUES(NEW.village_id,NEW.user_id,NEW.delta,NEW.reason,NEW.source_key,NEW.created_at)
   ON CONFLICT(source_key) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- folded from apps/api/migrations/058_repair_tasks.sql
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS repair_task text;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS repair_event_id uuid;

-- folded from 059_claim_codes.sql
-- FEAT-029: retain seat IDs and all existing progress.
CREATE TABLE IF NOT EXISTS auth_seat_links (
 account_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 seat_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (account_id <> seat_id)
);
CREATE TABLE IF NOT EXISTS seat_claim_codes (
 code_hash text PRIMARY KEY,
 village_id uuid NOT NULL,
 seat_id uuid NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now() + interval '72 hours',
 consumed_at timestamptz,
 FOREIGN KEY (village_id,seat_id) REFERENCES village_members(village_id,user_id) ON DELETE CASCADE
);
