-- Baitly : parts d'encaissement immuables, sans reconstitution des anciens paiements.
-- Tables vérifiées contre PaymentTransaction et Intervention et leurs changesets existants.
ALTER TABLE payment_transactions ADD CONSTRAINT uq_payment_tx_id_org UNIQUE (id, organization_id);
ALTER TABLE interventions ADD CONSTRAINT uq_intervention_id_org UNIQUE (id, organization_id);
CREATE TABLE intervention_payment_allocations (
    id bigserial PRIMARY KEY,
    organization_id bigint NOT NULL,
    transaction_id bigint NOT NULL,
    intervention_id bigint NOT NULL,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    confirmed_at timestamp,
    CONSTRAINT uq_intervention_payment_allocation UNIQUE (transaction_id, intervention_id),
    FOREIGN KEY (transaction_id, organization_id) REFERENCES payment_transactions(id, organization_id),
    FOREIGN KEY (intervention_id, organization_id) REFERENCES interventions(id, organization_id)
);
CREATE INDEX idx_intervention_payment_allocation_mission
    ON intervention_payment_allocations (organization_id, intervention_id);
ALTER TABLE intervention_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_payment_allocations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON intervention_payment_allocations
    USING (current_setting('app.bypass_rls', true) = 'on'
        OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint)
    WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
        OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint);
