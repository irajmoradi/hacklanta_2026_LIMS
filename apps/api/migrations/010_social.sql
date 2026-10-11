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
