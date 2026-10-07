-- Baitly : preuves de transfert et observations bancaires, sans requalifier les anciens paiements.
ALTER TABLE payout_transfers ADD COLUMN destination_payment varchar(255);
ALTER TABLE payout_transfers ADD COLUMN stripe_livemode boolean;
ALTER TABLE payout_transfers ADD CONSTRAINT payout_destination_proof_pair
    CHECK ((destination_payment IS NULL AND stripe_livemode IS NULL)
        OR (nullif(trim(destination_payment),'') IS NOT NULL AND stripe_livemode IS NOT NULL));
CREATE UNIQUE INDEX uq_payout_destination_proof ON payout_transfers(destination,stripe_livemode,destination_payment)
    WHERE destination_payment IS NOT NULL;

CREATE FUNCTION baitly_protect_destination_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.destination_payment IS NOT NULL AND
       (NEW.destination_payment,NEW.stripe_livemode) IS DISTINCT FROM (OLD.destination_payment,OLD.stripe_livemode) THEN
        RAISE EXCEPTION 'Stripe destination evidence is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER payout_destination_proof_immutable BEFORE UPDATE ON payout_transfers
    FOR EACH ROW EXECUTE FUNCTION baitly_protect_destination_payment();

-- Journal interne PSP global. Les projections API ne renvoient que les virements
-- rapprochés au transfert de l'organisation courante, jamais les sources du compte entier.
CREATE TABLE stripe_bank_payout_events (
    id bigserial PRIMARY KEY,
    event_id varchar(255) NOT NULL UNIQUE,
    account_id varchar(100) NOT NULL,
    payout_id varchar(255) NOT NULL,
    livemode boolean NOT NULL,
    status varchar(20) NOT NULL CHECK (status IN ('PENDING','IN_TRANSIT','PAID','FAILED','CANCELED')),
    payout_created timestamptz NOT NULL,
    event_created timestamptz NOT NULL,
    arrival_date timestamptz,
    failure_code varchar(100),
    sources jsonb NOT NULL CHECK (jsonb_typeof(sources) = 'array'),
    recorded_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_bank_payout_account ON stripe_bank_payout_events(account_id,livemode,payout_id);
CREATE INDEX idx_bank_payout_sources ON stripe_bank_payout_events USING gin(sources jsonb_path_ops);
CREATE TRIGGER bank_payout_event_immutable BEFORE UPDATE OR DELETE ON stripe_bank_payout_events
    FOR EACH ROW EXECUTE FUNCTION baitly_protect_payout_transfer_event();
ALTER TABLE stripe_bank_payout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_bank_payout_events FORCE ROW LEVEL SECURITY;
CREATE POLICY bank_payout_internal ON stripe_bank_payout_events
    USING (current_setting('app.bypass_rls',true) = 'on')
    WITH CHECK (current_setting('app.bypass_rls',true) = 'on');
