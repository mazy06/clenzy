-- Baitly : ventiler les remboursements après reversement sans altérer la preuve du transfert.
ALTER TABLE baitly_transfer_recoveries ADD COLUMN commission_refund_amount numeric(12,2);
ALTER TABLE baitly_transfer_recoveries ADD COLUMN gross_basis numeric(12,2);

-- Avant 0508, seules les séries sans commission ou la restitution intégrale étaient admises.
-- Le complément du remboursement est donc la commission entière (ou zéro pour une série).
-- RLS reste active ; le bypass est limité à la transaction Liquibase de cette migration.
SET LOCAL app.bypass_rls = 'on';
UPDATE baitly_transfer_recoveries r
SET commission_refund_amount = p.amount - r.amount,
    gross_basis = t.amount + p.amount - r.amount
FROM payment_transactions p, payout_transfers t
WHERE p.id = r.refund_id AND p.organization_id = r.organization_id
  AND t.id = r.transfer_id AND t.organization_id = r.organization_id;

ALTER TABLE baitly_transfer_recoveries
    ALTER COLUMN commission_refund_amount SET NOT NULL,
    ALTER COLUMN gross_basis SET NOT NULL,
    DROP CONSTRAINT baitly_transfer_recoveries_amount_check,
    DROP CONSTRAINT baitly_transfer_recoveries_state_check,
    ADD CONSTRAINT baitly_recovery_allocation_check CHECK (
        amount >= 0 AND commission_refund_amount >= 0 AND gross_basis > 0
        AND amount + commission_refund_amount > 0 AND amount + commission_refund_amount <= gross_basis),
    ADD CONSTRAINT baitly_recovery_state_check CHECK (state IN (
        'WAITING_REFUND','RECOVERING','RECOVERED','NO_RECOVERY_REQUIRED','REVIEW_REQUIRED','CANCELLED')),
    ADD CONSTRAINT baitly_recovery_zero_check CHECK (
        (amount = 0 AND state IN ('WAITING_REFUND','NO_RECOVERY_REQUIRED','REVIEW_REQUIRED','CANCELLED')
            AND reversal_reference IS NULL AND first_attempt_at IS NULL)
        OR (amount > 0 AND state <> 'NO_RECOVERY_REQUIRED'));

CREATE OR REPLACE FUNCTION baitly_protect_transfer_recovery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Recovery evidence cannot be deleted' USING ERRCODE='23514';
    END IF;
    IF ROW(NEW.organization_id,NEW.transfer_id,NEW.refund_id,NEW.amount,NEW.commission_refund_amount,NEW.gross_basis,NEW.currency,NEW.created_at)
        IS DISTINCT FROM ROW(OLD.organization_id,OLD.transfer_id,OLD.refund_id,OLD.amount,OLD.commission_refund_amount,OLD.gross_basis,OLD.currency,OLD.created_at)
        OR (OLD.first_attempt_at IS NOT NULL AND NEW.first_attempt_at IS DISTINCT FROM OLD.first_attempt_at)
        OR (OLD.reversal_reference IS NOT NULL AND NEW.reversal_reference IS DISTINCT FROM OLD.reversal_reference)
        OR (OLD.state IN ('RECOVERED','NO_RECOVERY_REQUIRED','CANCELLED') AND NEW.state <> OLD.state) THEN
        RAISE EXCEPTION 'Recovery instruction and confirmed evidence are immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP INDEX idx_baitly_transfer_recovery_queue;
CREATE INDEX idx_baitly_transfer_recovery_queue ON baitly_transfer_recoveries(next_attempt_at,id)
    WHERE state NOT IN ('RECOVERED','NO_RECOVERY_REQUIRED','CANCELLED');
