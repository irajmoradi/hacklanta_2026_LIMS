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
