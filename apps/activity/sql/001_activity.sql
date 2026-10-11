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
