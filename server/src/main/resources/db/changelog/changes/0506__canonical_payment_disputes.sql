-- Baitly : un litige est lié à l'encaissement local, avec les mouvements PSP exacts.
ALTER TABLE payment_transactions ADD COLUMN disputed_amount numeric(12,2) NOT NULL DEFAULT 0
    CHECK (disputed_amount >= 0 AND disputed_amount <= amount);
ALTER TABLE payment_disputes ADD COLUMN payment_transaction_id bigint;
ALTER TABLE payment_disputes ADD CONSTRAINT fk_dispute_payment_org
    FOREIGN KEY(payment_transaction_id,organization_id) REFERENCES payment_transactions(id,organization_id);
ALTER TABLE payment_disputes ADD CONSTRAINT uq_dispute_payment_reference_org UNIQUE(provider_dispute_id,payment_transaction_id,organization_id);
CREATE INDEX idx_dispute_payment_org ON payment_disputes(organization_id,payment_transaction_id,status);
ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_disputes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payment_disputes
    USING (current_setting('app.bypass_rls',true)='on' OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint)
    WITH CHECK (current_setting('app.bypass_rls',true)='on' OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint);
CREATE TABLE baitly_dispute_balance_entries (
    provider_reference varchar(120) PRIMARY KEY,
    organization_id bigint NOT NULL,
    payment_transaction_id bigint NOT NULL,
    provider_dispute_id varchar(120) NOT NULL,
    amount numeric(12,2) NOT NULL,
    fee numeric(12,2) NOT NULL,
    net numeric(12,2) NOT NULL,
    currency varchar(3) NOT NULL,
    created_at timestamptz NOT NULL,
    available_at timestamptz NOT NULL,
    CHECK (amount-fee=net),
    FOREIGN KEY(payment_transaction_id,organization_id) REFERENCES payment_transactions(id,organization_id),
    FOREIGN KEY(provider_dispute_id,payment_transaction_id,organization_id)
        REFERENCES payment_disputes(provider_dispute_id,payment_transaction_id,organization_id)
);
CREATE FUNCTION baitly_protect_dispute_balance_entry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Confirmed PSP balance evidence is immutable' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER baitly_dispute_balance_immutable BEFORE UPDATE OR DELETE ON baitly_dispute_balance_entries
    FOR EACH ROW EXECUTE FUNCTION baitly_protect_dispute_balance_entry();
ALTER TABLE baitly_dispute_balance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE baitly_dispute_balance_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON baitly_dispute_balance_entries
    USING (current_setting('app.bypass_rls',true)='on' OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint)
    WITH CHECK (current_setting('app.bypass_rls',true)='on' OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint);
