ALTER TABLE owner_payout_reservations ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12,2);
ALTER TABLE baitly_transfer_recoveries ADD COLUMN IF NOT EXISTS net_basis NUMERIC(12,2);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_owner_claim_net' AND conrelid='owner_payout_reservations'::regclass) THEN
        ALTER TABLE owner_payout_reservations ADD CONSTRAINT ck_owner_claim_net CHECK(net_amount IS NULL OR (net_amount>=0 AND net_amount<=collected_amount));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_recovery_net_basis' AND conrelid='baitly_transfer_recoveries'::regclass) THEN
        ALTER TABLE baitly_transfer_recoveries ADD CONSTRAINT ck_recovery_net_basis CHECK(net_basis IS NULL OR (net_basis>=0 AND net_basis<=gross_basis AND amount<=net_basis));
    END IF;
END $$;

CREATE OR REPLACE FUNCTION baitly_protect_refund_basis() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (TG_TABLE_NAME='owner_payout_reservations' AND (to_jsonb(NEW)->'net_amount') IS DISTINCT FROM (to_jsonb(OLD)->'net_amount'))
        OR (TG_TABLE_NAME='baitly_transfer_recoveries' AND (to_jsonb(NEW)->'net_basis') IS DISTINCT FROM (to_jsonb(OLD)->'net_basis')) THEN
        RAISE EXCEPTION 'Historical refund basis is immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS baitly_owner_claim_net_immutable ON owner_payout_reservations;
CREATE TRIGGER baitly_owner_claim_net_immutable BEFORE UPDATE ON owner_payout_reservations FOR EACH ROW EXECUTE FUNCTION baitly_protect_refund_basis();
DROP TRIGGER IF EXISTS baitly_recovery_net_immutable ON baitly_transfer_recoveries;
CREATE TRIGGER baitly_recovery_net_immutable BEFORE UPDATE ON baitly_transfer_recoveries FOR EACH ROW EXECUTE FUNCTION baitly_protect_refund_basis();
