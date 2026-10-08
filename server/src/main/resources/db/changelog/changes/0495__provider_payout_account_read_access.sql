-- Baitly : lecture seule du compte personnel du prestataire d'une mission achevée et payée.
-- Les écritures restent strictement limitées à l'organisation du compte (policy 0492).
CREATE POLICY completed_provider_mission_read ON payment_connections FOR SELECT
    USING (beneficiary_key = concat('user:', user_id) AND EXISTS (
        SELECT 1 FROM interventions i
        WHERE i.organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint
          AND i.assigned_user_id = payment_connections.user_id
          AND i.status = 'COMPLETED' AND i.payment_status = 'PAID'
    ));
