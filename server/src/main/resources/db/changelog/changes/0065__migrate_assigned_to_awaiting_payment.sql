-- ============================================================================
-- 0065 : Migrate ASSIGNED → AWAITING_PAYMENT
-- ============================================================================
-- The ASSIGNED status is removed from the workflow. Assignment now goes
-- directly to AWAITING_PAYMENT. Migrate existing ASSIGNED records.
-- ============================================================================

-- 1. Migrate ASSIGNED → AWAITING_PAYMENT
UPDATE service_requests SET status = 'AWAITING_PAYMENT' WHERE status = 'ASSIGNED';

-- 2. Fix inconsistent data: PENDING with assignee → AWAITING_PAYMENT
UPDATE service_requests SET status = 'AWAITING_PAYMENT' WHERE status = 'PENDING' AND assigned_to_id IS NOT NULL;
