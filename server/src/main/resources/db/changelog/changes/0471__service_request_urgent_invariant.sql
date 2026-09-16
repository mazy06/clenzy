-- Baitly: historical SQL inserts can omit urgency, unlike Java's primitive boolean.
-- Repair existing nulls without changing explicitly urgent requests, then enforce
-- the same default and invariant for every future writer.
UPDATE service_requests SET is_urgent = FALSE WHERE is_urgent IS NULL;

ALTER TABLE service_requests ALTER COLUMN is_urgent SET DEFAULT FALSE;
ALTER TABLE service_requests ALTER COLUMN is_urgent SET NOT NULL;
