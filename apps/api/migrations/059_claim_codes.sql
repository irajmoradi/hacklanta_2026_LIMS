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
