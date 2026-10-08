-- Une seule preuve PSP ; les affectations n'ont jamais de provider_tx_id.
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS refund_parent_id BIGINT REFERENCES payment_transactions(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_refund_parent_source ON payment_transactions(refund_parent_id, source_type, source_id)
    WHERE refund_parent_id IS NOT NULL;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_refund_allocation' AND conrelid='payment_transactions'::regclass) THEN
        ALTER TABLE payment_transactions ADD CONSTRAINT ck_refund_allocation CHECK
            (refund_parent_id IS NULL OR (refund_parent_id<>id AND provider_tx_id IS NULL AND payment_type='REFUND'
                AND provider_type='STRIPE' AND source_type='INTERVENTION' AND source_id IS NOT NULL AND amount>0));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_refund_parent_org' AND conrelid='payment_transactions'::regclass) THEN
        ALTER TABLE payment_transactions ADD CONSTRAINT fk_refund_parent_org FOREIGN KEY(refund_parent_id,organization_id) REFERENCES payment_transactions(id,organization_id);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION baitly_protect_refund_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='DELETE' THEN
        IF OLD.refund_parent_id IS NOT NULL OR OLD.metadata->>'externalBatchDistributed'='true' THEN
            RAISE EXCEPTION 'Refund allocation evidence cannot be deleted' USING ERRCODE='23514';
        END IF;
        RETURN OLD;
    END IF;
    IF NEW.refund_parent_id IS DISTINCT FROM OLD.refund_parent_id
        OR (OLD.refund_parent_id IS NOT NULL AND
            ROW(NEW.organization_id,NEW.amount,NEW.currency,NEW.source_type,NEW.source_id,NEW.payment_type,NEW.provider_type,
                NEW.metadata->>'originalTransactionRef',NEW.metadata->>'batchAllocationId')
            IS DISTINCT FROM ROW(OLD.organization_id,OLD.amount,OLD.currency,OLD.source_type,OLD.source_id,OLD.payment_type,OLD.provider_type,
                OLD.metadata->>'originalTransactionRef',OLD.metadata->>'batchAllocationId'))
        OR (OLD.metadata->>'externalBatchDistributed'='true' AND
            ROW(NEW.metadata->'refundAssignments',NEW.metadata->'externalBatchDistributed',NEW.metadata->>'assignedBy',
                NEW.metadata->>'assignedAt',NEW.metadata->>'assignmentReason') IS DISTINCT FROM
            ROW(OLD.metadata->'refundAssignments',OLD.metadata->'externalBatchDistributed',OLD.metadata->>'assignedBy',
                OLD.metadata->>'assignedAt',OLD.metadata->>'assignmentReason')) THEN
        RAISE EXCEPTION 'Refund allocation identity and decision are immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS baitly_refund_allocation_immutable ON payment_transactions;
CREATE TRIGGER baitly_refund_allocation_immutable BEFORE UPDATE OR DELETE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION baitly_protect_refund_allocation();
