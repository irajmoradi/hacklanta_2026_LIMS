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
