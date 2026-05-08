-- ============================================================================
-- 0113 : Force-rebuild service_requests.status CHECK constraint
-- ============================================================================
-- 0064 was marked EXECUTED on prod by `changelog-sync-to-tag pre-liquibase-baseline`
-- (changeset 0107a) without actually running its SQL. The constraint left in
-- place by Hibernate ddl-auto=update accepts only legacy values
-- (PENDING, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED, REJECTED) and rejects
-- the current enum values ASSIGNED and AWAITING_PAYMENT. Result: every
-- assign/auto-assign on a ServiceRequest fails at commit with
-- DataIntegrityViolationException.
--
-- This changeset re-applies 0064 idempotently:
--   1. Migrate any leftover legacy data (APPROVED → ASSIGNED).
--   2. Drop the existing constraint (any name, any definition).
--   3. Add the constraint with the full enum value list.
-- ============================================================================

-- 1. Migrate legacy data so the new constraint accepts every existing row.
UPDATE service_requests SET status = 'ASSIGNED' WHERE status = 'APPROVED';

-- 2. Drop the constraint by name (whatever it allowed before).
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check;

-- 3. Re-create it with the values matching the Java RequestStatus enum.
ALTER TABLE service_requests
  ADD CONSTRAINT service_requests_status_check
  CHECK (status IN ('PENDING','ASSIGNED','AWAITING_PAYMENT','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED'));
