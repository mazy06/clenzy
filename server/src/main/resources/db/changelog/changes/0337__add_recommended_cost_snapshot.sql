-- Moteur Ménage (Phase 1A) — snapshot du prix CONSEIL plateforme à la création.
-- Sépare enfin le conseil (recommended_cost, figé au moment de la création) du
-- pratiqué (estimated_cost, fourre-tout historique : override logement, saisie
-- manuelle, facturé). NULL = créé avant le moteur (pas de conseil disponible).
ALTER TABLE service_requests
    ADD COLUMN IF NOT EXISTS recommended_cost NUMERIC(10, 2);

ALTER TABLE interventions
    ADD COLUMN IF NOT EXISTS recommended_cost NUMERIC(10, 2);

COMMENT ON COLUMN service_requests.recommended_cost IS
    'Prix conseil plateforme (CleaningPricingEngine) snapshote a la creation. NULL = anterieur au moteur';
COMMENT ON COLUMN interventions.recommended_cost IS
    'Prix conseil plateforme (CleaningPricingEngine) snapshote a la creation. NULL = anterieur au moteur';
