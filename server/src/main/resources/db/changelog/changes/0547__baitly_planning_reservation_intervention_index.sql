-- Le planning doit retrouver un lien ou un séjour masqué sans rescanner tout le portefeuille.
-- Index partagé par le rattachement groupé et l'exclusion des interventions de séjours annulés.
CREATE INDEX idx_baitly_reservation_org_intervention
    ON reservations (organization_id, intervention_id, id)
    WHERE intervention_id IS NOT NULL;
