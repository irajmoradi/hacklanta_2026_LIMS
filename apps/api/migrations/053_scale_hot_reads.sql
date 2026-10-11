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
