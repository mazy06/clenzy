-- Add version column for optimistic locking on interventions
-- The column may already exist (created by Hibernate ddl-auto) but with NULL values
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS version BIGINT;
UPDATE interventions SET version = 0 WHERE version IS NULL;
ALTER TABLE interventions ALTER COLUMN version SET DEFAULT 0;
ALTER TABLE interventions ALTER COLUMN version SET NOT NULL;
