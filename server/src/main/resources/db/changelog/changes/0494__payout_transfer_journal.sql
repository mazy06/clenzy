-- Baitly : journal de décaissement, sans recalcul ni mouvement des soldes historiques.
SELECT set_config('baitly.payout_previous_bypass', COALESCE(current_setting('app.bypass_rls', true), ''), true);
SET LOCAL app.bypass_rls = 'on';
CREATE TABLE payout_transfers (
    id bigserial PRIMARY KEY,
    organization_id bigint NOT NULL,
    source varchar(30) NOT NULL CHECK (source IN ('OWNER_PAYOUT','INTERVENTION')),
    source_id bigint NOT NULL,
    beneficiary_user_id bigint NOT NULL,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    currency varchar(3) NOT NULL,
    provider varchar(30) NOT NULL,
    destination varchar(100) NOT NULL,
    description varchar(255) NOT NULL,
    idempotency_key varchar(100) NOT NULL UNIQUE,
    state varchar(30) NOT NULL CHECK (state IN ('SUBMITTING','TRANSFERRED','RECONCILIATION_REQUIRED')),
    external_reference varchar(255),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, source_id),
    UNIQUE(id, organization_id),
    CHECK (state <> 'TRANSFERRED' OR nullif(trim(external_reference), '') IS NOT NULL)
);
CREATE INDEX idx_payout_transfers_org_created ON payout_transfers(organization_id, created_at DESC, id DESC);

CREATE TABLE payout_transfer_events (
    id bigserial PRIMARY KEY,
    organization_id bigint NOT NULL,
    transfer_id bigint NOT NULL,
    state varchar(30) NOT NULL CHECK (state IN ('SUBMITTING','TRANSFERRED','RECONCILIATION_REQUIRED')),
    external_reference varchar(255),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transfer_id, organization_id) REFERENCES payout_transfers(id, organization_id)
);
CREATE INDEX idx_payout_transfer_events_transfer ON payout_transfer_events(organization_id, transfer_id, id);

-- Une tentative historique ne doit jamais redevenir une première émission après déploiement.
-- Le destinataire historique n'était pas figé : aucune destination actuelle n'est présentée comme prouvée.
INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_user_id,amount,currency,provider,
    destination,description,idempotency_key,state,external_reference,created_at,updated_at)
SELECT p.organization_id,'OWNER_PAYOUT',p.id,p.owner_id,p.net_amount,p.currency,'STRIPE',
    'legacy-unresolved','Payout #' || p.id || ' - ' || p.period_start || ' to ' || p.period_end,
    'payout-' || p.id,'RECONCILIATION_REQUIRED',nullif(trim(p.stripe_transfer_id),''),
    COALESCE(p.created_at,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP
FROM owner_payouts p
WHERE p.net_amount > 0 AND (p.payout_method = 'STRIPE_CONNECT' OR p.stripe_transfer_id IS NOT NULL)
    AND (p.status IN ('PAID','PROCESSING','FAILED') OR p.retry_count > 0 OR p.stripe_transfer_id IS NOT NULL);

INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_user_id,amount,currency,provider,
    destination,description,idempotency_key,state,external_reference,created_at,updated_at)
SELECT p.organization_id,'INTERVENTION',p.intervention_id,p.user_id,p.amount,'EUR','STRIPE',
    'legacy-unresolved','Versement mission ménage #' || p.intervention_id,
    'payout-intervention-' || p.intervention_id,'RECONCILIATION_REQUIRED',nullif(trim(p.stripe_transfer_id),''),
    p.created_at,CURRENT_TIMESTAMP
FROM housekeeper_payout_records p
WHERE p.amount > 0 AND (p.status IN ('PENDING','SENT','FAILED') OR p.stripe_transfer_id IS NOT NULL);

INSERT INTO payout_transfer_events(organization_id,transfer_id,state,external_reference)
SELECT organization_id,id,state,external_reference FROM payout_transfers;

SELECT set_config('app.bypass_rls', current_setting('baitly.payout_previous_bypass'), true);

CREATE FUNCTION baitly_protect_payout_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Payout transfer evidence cannot be deleted' USING ERRCODE = '23514';
    END IF;
    IF ROW(NEW.organization_id,NEW.source,NEW.source_id,NEW.beneficiary_user_id,NEW.amount,NEW.currency,
        NEW.provider,NEW.destination,NEW.description,NEW.idempotency_key,NEW.created_at)
        IS DISTINCT FROM ROW(OLD.organization_id,OLD.source,OLD.source_id,OLD.beneficiary_user_id,OLD.amount,OLD.currency,
        OLD.provider,OLD.destination,OLD.description,OLD.idempotency_key,OLD.created_at) THEN
        RAISE EXCEPTION 'Payout instruction is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.state = 'TRANSFERRED' AND (NEW.state <> OLD.state OR NEW.external_reference IS DISTINCT FROM OLD.external_reference) THEN
        RAISE EXCEPTION 'A confirmed transfer cannot be overwritten' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER payout_transfer_immutable BEFORE UPDATE OR DELETE ON payout_transfers
    FOR EACH ROW EXECUTE FUNCTION baitly_protect_payout_transfer();

CREATE FUNCTION baitly_protect_payout_transfer_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Payout transfer history is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER payout_transfer_event_immutable BEFORE UPDATE OR DELETE ON payout_transfer_events
    FOR EACH ROW EXECUTE FUNCTION baitly_protect_payout_transfer_event();

ALTER TABLE payout_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_transfers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payout_transfers
    USING (current_setting('app.bypass_rls',true) = 'on'
        OR organization_id = NULLIF(current_setting('app.current_org',true),'')::bigint)
    WITH CHECK (current_setting('app.bypass_rls',true) = 'on'
        OR organization_id = NULLIF(current_setting('app.current_org',true),'')::bigint);
ALTER TABLE payout_transfer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_transfer_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payout_transfer_events
    USING (current_setting('app.bypass_rls',true) = 'on'
        OR organization_id = NULLIF(current_setting('app.current_org',true),'')::bigint)
    WITH CHECK (current_setting('app.bypass_rls',true) = 'on'
        OR organization_id = NULLIF(current_setting('app.current_org',true),'')::bigint);
