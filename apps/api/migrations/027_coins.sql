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
