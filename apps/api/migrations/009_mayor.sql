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
