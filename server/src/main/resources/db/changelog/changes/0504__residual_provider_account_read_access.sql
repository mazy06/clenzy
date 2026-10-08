-- Baitly : la lecture du bénéficiaire reste possible après un remboursement partiel.
-- L'autorisation d'émettre et le montant sont contrôlés par BaitlyProviderPayoutGuard.
-- Les droits d'écriture et les restrictions de bénéficiaire ne changent pas.
ALTER POLICY completed_provider_mission_read ON payment_connections
    USING (beneficiary_key=concat('user:',user_id) AND user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM interventions i LEFT JOIN teams t ON t.id=i.team_id
        WHERE i.organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint
          AND COALESCE(i.assigned_user_id,t.personal_user_id)=payment_connections.user_id
          AND i.status='COMPLETED' AND i.payment_status IN ('PAID','PARTIALLY_REFUNDED')
    ));
ALTER POLICY completed_provider_organization_read ON payment_connections
    USING (beneficiary_key='organization' AND user_id IS NULL AND EXISTS (
        SELECT 1 FROM provider_payout_beneficiaries b
        JOIN interventions i ON i.id=b.intervention_id AND i.organization_id=b.organization_id
        LEFT JOIN teams t ON t.id=i.team_id
        LEFT JOIN users u ON u.id=i.assigned_user_id
        WHERE i.organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint
          AND b.beneficiary_organization_id=payment_connections.organization_id
          AND i.status='COMPLETED' AND i.payment_status IN ('PAID','PARTIALLY_REFUNDED')
          AND i.assigned_user_id IS NOT DISTINCT FROM b.assigned_user_id
          AND i.team_id IS NOT DISTINCT FROM b.team_id
          AND b.beneficiary_organization_id=CASE WHEN i.assigned_user_id IS NOT NULL THEN u.organization_id ELSE t.organization_id END
    ));
