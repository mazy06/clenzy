-- Baitly : choix explicite du créancier société, sans modifier les dépenses ou transferts historiques.
CREATE TABLE baitly_expense_beneficiaries (
    expense_id bigint PRIMARY KEY REFERENCES provider_expenses(id),
    organization_id bigint NOT NULL REFERENCES organizations(id),
    provider_id bigint NOT NULL REFERENCES users(id),
    beneficiary_organization_id bigint NOT NULL REFERENCES organizations(id),
    selected_by_user_id bigint NOT NULL REFERENCES users(id),
    selected_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_baitly_expense_beneficiary_org ON baitly_expense_beneficiaries(organization_id,expense_id);

CREATE FUNCTION baitly_check_expense_beneficiary() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e provider_expenses%ROWTYPE;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Expense beneficiary decision is immutable' USING ERRCODE='23514';
    END IF;
    SELECT * INTO e FROM provider_expenses WHERE id=NEW.expense_id FOR UPDATE;
    IF e.id IS NULL OR e.organization_id IS DISTINCT FROM NEW.organization_id OR e.provider_id IS DISTINCT FROM NEW.provider_id
        OR e.status NOT IN ('DRAFT','APPROVED','INCLUDED') OR e.payment_reference IS NOT NULL
        OR EXISTS(SELECT 1 FROM payout_transfers WHERE organization_id=e.organization_id AND source='PROVIDER_EXPENSE' AND source_id=e.id)
        OR NOT EXISTS(SELECT 1 FROM users u JOIN organizations o ON o.id=u.organization_id
            WHERE u.id=e.provider_id AND o.id=NEW.beneficiary_organization_id AND o.type IN ('CONCIERGE','CLEANING_COMPANY')) THEN
        RAISE EXCEPTION 'Expense beneficiary does not match the unpaid expense' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER baitly_expense_beneficiary_immutable BEFORE INSERT OR UPDATE OR DELETE ON baitly_expense_beneficiaries
    FOR EACH ROW EXECUTE FUNCTION baitly_check_expense_beneficiary();

CREATE FUNCTION baitly_keep_expense_creditor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(NEW.organization_id,NEW.provider_id) IS DISTINCT FROM ROW(OLD.organization_id,OLD.provider_id)
        AND EXISTS(SELECT 1 FROM baitly_expense_beneficiaries WHERE expense_id=OLD.id) THEN
        RAISE EXCEPTION 'Expense creditor is frozen by a beneficiary decision' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER baitly_expense_creditor_immutable BEFORE UPDATE ON provider_expenses
    FOR EACH ROW EXECUTE FUNCTION baitly_keep_expense_creditor();

ALTER TABLE baitly_expense_beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE baitly_expense_beneficiaries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON baitly_expense_beneficiaries
    USING(current_setting('app.bypass_rls',true)='on' OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint)
    WITH CHECK(current_setting('app.bypass_rls',true)='on' OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint);

CREATE POLICY retained_expense_company_read ON payment_connections FOR SELECT
    USING(beneficiary_key='organization' AND user_id IS NULL AND EXISTS(
        SELECT 1 FROM baitly_expense_beneficiaries b JOIN provider_expenses e ON e.id=b.expense_id AND e.organization_id=b.organization_id
        JOIN owner_payouts p ON p.id=e.owner_payout_id AND p.organization_id=e.organization_id
        JOIN users u ON u.id=e.provider_id AND u.id=b.provider_id
        WHERE e.organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint
          AND b.beneficiary_organization_id=payment_connections.organization_id AND u.organization_id=b.beneficiary_organization_id
          AND p.status='PAID' AND p.funding_version=1 AND e.status IN ('INCLUDED','PAID')
    ));

ALTER POLICY retained_expense_provider_read ON payment_connections
    USING (beneficiary_key=concat('user:',user_id) AND user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM provider_expenses e JOIN owner_payouts p ON p.id=e.owner_payout_id
        WHERE e.organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint
          AND p.organization_id=e.organization_id AND p.status='PAID' AND p.funding_version=1
          AND e.provider_id=payment_connections.user_id AND e.status IN ('INCLUDED','PAID')
          AND NOT EXISTS(SELECT 1 FROM baitly_expense_beneficiaries b WHERE b.expense_id=e.id)
    ));
