-- ============================================================================
-- 0064 : Fix service_requests status CHECK constraint
-- ============================================================================
-- The old CHECK constraint allows APPROVED which no longer exists in the Java
-- enum RequestStatus. Migrate APPROVED → ASSIGNED and update the constraint
-- to match: PENDING, ASSIGNED, AWAITING_PAYMENT, IN_PROGRESS, COMPLETED,
-- CANCELLED, REJECTED.
-- ============================================================================

-- 1. Drop the old constraint
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check;

-- 2. Migrate legacy data
UPDATE service_requests SET status = 'ASSIGNED' WHERE status = 'APPROVED';

-- 3. Add the new constraint matching the Java enum
ALTER TABLE service_requests
  ADD CONSTRAINT service_requests_status_check
  CHECK (status IN ('PENDING','ASSIGNED','AWAITING_PAYMENT','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED'));
