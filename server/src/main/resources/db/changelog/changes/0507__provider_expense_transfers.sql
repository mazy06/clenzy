-- Baitly : une dépense retenue peut être transférée une seule fois à son prestataire.
-- Aucun historique n'est déclaré payé, aucune référence financière n'est fabriquée.
ALTER TABLE payout_transfers DROP CONSTRAINT payout_transfers_source_check;
ALTER TABLE payout_transfers ADD CONSTRAINT payout_transfers_source_check
    CHECK (source IN ('OWNER_PAYOUT','INTERVENTION','PROVIDER_EXPENSE'));

CREATE POLICY retained_expense_provider_read ON payment_connections FOR SELECT
    USING (beneficiary_key=concat('user:',user_id) AND user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM provider_expenses e JOIN owner_payouts p ON p.id=e.owner_payout_id
        WHERE e.organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint
          AND p.organization_id=e.organization_id AND p.status='PAID' AND p.funding_version=1
          AND e.provider_id=payment_connections.user_id AND e.status IN ('INCLUDED','PAID')
    ));
