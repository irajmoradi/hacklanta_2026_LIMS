ALTER TABLE competitions ADD COLUMN IF NOT EXISTS scoring text NOT NULL DEFAULT 'cumulative'
 CHECK(scoring IN ('cumulative','scoreboard','ordinal'));
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS unit text CHECK(length(trim(unit)) BETWEEN 1 AND 40);
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS target double precision CHECK(target > 0 AND target <= 1e12);
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='competitions'::regclass AND conname='competition_scoring_terms') THEN
ALTER TABLE competitions ADD CONSTRAINT competition_scoring_terms CHECK(
 (scoring <> 'scoreboard' OR unit IS NOT NULL) AND
 (scoring <> 'cumulative' OR (unit IS NULL AND target IS NULL)));
END IF;
END $$;
ALTER TABLE competition_entries ADD COLUMN IF NOT EXISTS claimed_value double precision CHECK(claimed_value >= 0 AND claimed_value <= 1e12);
ALTER TABLE competition_entries ADD COLUMN IF NOT EXISTS value double precision CHECK(value >= 0 AND value <= 1e12);
ALTER TABLE competition_entries ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
UPDATE competition_entries SET confirmed_at=created_at WHERE decision='confirmed';
