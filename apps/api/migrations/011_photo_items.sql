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
