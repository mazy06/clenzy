-- Baitly : un bénéficiaire légal distinct de l'exécutant, sans modifier les versements historiques.
ALTER TABLE housekeeper_payout_records ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE housekeeper_payout_records ADD COLUMN beneficiary_organization_id bigint REFERENCES organizations(id);
ALTER TABLE housekeeper_payout_records ADD CONSTRAINT provider_payout_one_beneficiary
    CHECK (num_nonnulls(user_id,beneficiary_organization_id)=1);

ALTER TABLE payout_transfers ALTER COLUMN beneficiary_user_id DROP NOT NULL;
ALTER TABLE payout_transfers ADD COLUMN beneficiary_organization_id bigint REFERENCES organizations(id);
ALTER TABLE payout_transfers ADD CONSTRAINT payout_transfer_one_beneficiary
    CHECK (num_nonnulls(beneficiary_user_id,beneficiary_organization_id)=1);

CREATE TABLE provider_payout_beneficiaries (
    intervention_id bigint PRIMARY KEY REFERENCES interventions(id),
    organization_id bigint NOT NULL REFERENCES organizations(id),
    beneficiary_organization_id bigint NOT NULL REFERENCES organizations(id),
    assigned_user_id bigint REFERENCES users(id),
    team_id bigint REFERENCES teams(id),
    selected_by_user_id bigint NOT NULL REFERENCES users(id),
    selected_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (num_nonnulls(assigned_user_id,team_id)=1)
);
CREATE INDEX idx_provider_beneficiary_organization ON provider_payout_beneficiaries(organization_id,intervention_id);

CREATE OR REPLACE FUNCTION baitly_protect_payout_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Payout transfer evidence cannot be deleted' USING ERRCODE = '23514';
    END IF;
    IF ROW(NEW.organization_id,NEW.source,NEW.source_id,NEW.beneficiary_user_id,NEW.beneficiary_organization_id,
        NEW.amount,NEW.currency,NEW.provider,NEW.destination,NEW.description,NEW.idempotency_key,NEW.created_at)
        IS DISTINCT FROM ROW(OLD.organization_id,OLD.source,OLD.source_id,OLD.beneficiary_user_id,OLD.beneficiary_organization_id,
        OLD.amount,OLD.currency,OLD.provider,OLD.destination,OLD.description,OLD.idempotency_key,OLD.created_at) THEN
        RAISE EXCEPTION 'Payout instruction is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.state = 'TRANSFERRED' AND (NEW.state <> OLD.state OR NEW.external_reference IS DISTINCT FROM OLD.external_reference) THEN
        RAISE EXCEPTION 'A confirmed transfer cannot be overwritten' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION baitly_protect_provider_payout_beneficiary() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Provider beneficiary decision is immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER provider_payout_beneficiary_immutable BEFORE UPDATE OR DELETE ON provider_payout_beneficiaries
    FOR EACH ROW EXECUTE FUNCTION baitly_protect_provider_payout_beneficiary();

CREATE FUNCTION baitly_protect_provider_payout_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(NEW.organization_id,NEW.intervention_id,NEW.user_id,NEW.beneficiary_organization_id)
        IS DISTINCT FROM ROW(OLD.organization_id,OLD.intervention_id,OLD.user_id,OLD.beneficiary_organization_id) THEN
        RAISE EXCEPTION 'Provider payout beneficiary is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER provider_payout_record_beneficiary_immutable BEFORE UPDATE ON housekeeper_payout_records
    FOR EACH ROW EXECUTE FUNCTION baitly_protect_provider_payout_record();

ALTER TABLE provider_payout_beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_payout_beneficiaries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON provider_payout_beneficiaries
    USING (current_setting('app.bypass_rls',true)='on'
        OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint)
    WITH CHECK (current_setting('app.bypass_rls',true)='on'
        OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint);

-- Lecture seule, limitée au bénéficiaire de la mission terminée/payée du tenant courant.
-- Les comptes de société ne deviennent pas accessibles via un simple lien d'utilisateur.
DROP POLICY completed_provider_mission_read ON payment_connections;
CREATE POLICY completed_provider_mission_read ON payment_connections FOR SELECT
    USING (beneficiary_key=concat('user:',user_id) AND user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM interventions i LEFT JOIN teams t ON t.id=i.team_id
        WHERE i.organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint
          AND COALESCE(i.assigned_user_id,t.personal_user_id)=payment_connections.user_id
          AND i.status='COMPLETED' AND i.payment_status='PAID'
    ));
CREATE POLICY completed_provider_organization_read ON payment_connections FOR SELECT
    USING (beneficiary_key='organization' AND user_id IS NULL AND EXISTS (
        SELECT 1 FROM provider_payout_beneficiaries b
        JOIN interventions i ON i.id=b.intervention_id AND i.organization_id=b.organization_id
        LEFT JOIN teams t ON t.id=i.team_id
        LEFT JOIN users u ON u.id=i.assigned_user_id
        WHERE i.organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint
          AND b.beneficiary_organization_id=payment_connections.organization_id
          AND i.status='COMPLETED' AND i.payment_status='PAID'
          AND i.assigned_user_id IS NOT DISTINCT FROM b.assigned_user_id
          AND i.team_id IS NOT DISTINCT FROM b.team_id
          AND b.beneficiary_organization_id=CASE WHEN i.assigned_user_id IS NOT NULL THEN u.organization_id ELSE t.organization_id END
    ));
