-- Baitly : récupération séparée du transfert initial, conservé comme preuve historique.
CREATE TABLE baitly_transfer_recoveries (
    id bigserial PRIMARY KEY,
    organization_id bigint NOT NULL,
    transfer_id bigint NOT NULL,
    refund_id bigint NOT NULL,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    currency varchar(3) NOT NULL,
    state varchar(30) NOT NULL CHECK (state IN ('WAITING_REFUND','RECOVERING','RECOVERED','REVIEW_REQUIRED','CANCELLED')),
    reversal_reference varchar(255) UNIQUE,
    failure_code varchar(80),
    first_attempt_at timestamptz,
    next_attempt_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    UNIQUE(transfer_id,refund_id),
    FOREIGN KEY(transfer_id,organization_id) REFERENCES payout_transfers(id,organization_id),
    FOREIGN KEY(refund_id,organization_id) REFERENCES payment_transactions(id,organization_id),
    CHECK (state <> 'RECOVERED' OR (reversal_reference IS NOT NULL AND reversal_reference LIKE 'trr_%'))
);
CREATE INDEX idx_baitly_transfer_recovery_queue ON baitly_transfer_recoveries(next_attempt_at,id)
    WHERE state NOT IN ('RECOVERED','CANCELLED');
CREATE INDEX idx_baitly_transfer_recovery_org ON baitly_transfer_recoveries(organization_id,transfer_id,id);

CREATE FUNCTION baitly_protect_transfer_recovery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Recovery evidence cannot be deleted' USING ERRCODE='23514';
    END IF;
    IF ROW(NEW.organization_id,NEW.transfer_id,NEW.refund_id,NEW.amount,NEW.currency,NEW.created_at)
        IS DISTINCT FROM ROW(OLD.organization_id,OLD.transfer_id,OLD.refund_id,OLD.amount,OLD.currency,OLD.created_at)
        OR (OLD.first_attempt_at IS NOT NULL AND NEW.first_attempt_at IS DISTINCT FROM OLD.first_attempt_at)
        OR (OLD.reversal_reference IS NOT NULL AND NEW.reversal_reference IS DISTINCT FROM OLD.reversal_reference)
        OR (OLD.state IN ('RECOVERED','CANCELLED') AND NEW.state <> OLD.state) THEN
        RAISE EXCEPTION 'Recovery instruction and confirmed evidence are immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER baitly_transfer_recovery_immutable BEFORE UPDATE OR DELETE ON baitly_transfer_recoveries
    FOR EACH ROW EXECUTE FUNCTION baitly_protect_transfer_recovery();
ALTER TABLE baitly_transfer_recoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE baitly_transfer_recoveries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON baitly_transfer_recoveries
    USING (current_setting('app.bypass_rls',true)='on'
        OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint)
    WITH CHECK (current_setting('app.bypass_rls',true)='on'
        OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint);
