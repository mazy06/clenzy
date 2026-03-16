-- 0086: Fix owner_payouts status CHECK constraint (add PROCESSING status)
-- The constraint was missing PROCESSING which is needed for SEPA payout execution

ALTER TABLE owner_payouts DROP CONSTRAINT IF EXISTS owner_payouts_status_check;

ALTER TABLE owner_payouts ADD CONSTRAINT owner_payouts_status_check
    CHECK (status IN ('PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'));
