-- Backfill NULL version values and add NOT NULL constraint
-- The column was added by 0089 but IF NOT EXISTS skipped it (column existed with NULLs)
UPDATE interventions SET version = 0 WHERE version IS NULL;
ALTER TABLE interventions ALTER COLUMN version SET DEFAULT 0;
ALTER TABLE interventions ALTER COLUMN version SET NOT NULL;
