ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_consent_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_consent_version text;
ALTER TABLE voice_lines ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES avatar_jobs(id);
CREATE TABLE IF NOT EXISTS llm_hourly_budget (
    hour timestamptz PRIMARY KEY,
    calls integer NOT NULL CHECK (calls >= 0)
);
