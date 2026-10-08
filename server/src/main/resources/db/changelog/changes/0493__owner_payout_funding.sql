-- Baitly : les historiques restent inchangés et nécessitent un rapprochement avant exécution.
ALTER TABLE owner_payouts ADD COLUMN funding_version integer NOT NULL DEFAULT 0;

CREATE TABLE owner_payout_reservations (
    id bigserial PRIMARY KEY,
    reservation_id bigint NOT NULL REFERENCES reservations(id),
    organization_id bigint NOT NULL,
    payout_id bigint NOT NULL REFERENCES owner_payouts(id),
    collected_amount numeric(12,2) NOT NULL CHECK (collected_amount > 0),
    currency varchar(3) NOT NULL,
    payment_transaction_ids jsonb NOT NULL,
    CONSTRAINT uq_owner_payout_reservation UNIQUE (reservation_id),
    CONSTRAINT ck_owner_payout_receipts CHECK (
        jsonb_typeof(payment_transaction_ids) = 'array' AND jsonb_array_length(payment_transaction_ids) > 0)
);
CREATE INDEX idx_owner_payout_reservations_payout ON owner_payout_reservations (organization_id, payout_id);

ALTER TABLE owner_payout_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_payout_reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON owner_payout_reservations
    USING (current_setting('app.bypass_rls', true) = 'on'
        OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint)
    WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
        OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint);
