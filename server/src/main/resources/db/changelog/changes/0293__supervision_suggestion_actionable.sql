-- Rend les suggestions de la constellation ACTIONNABLES (Phase B).
-- Une suggestion peut désormais porter une action exécutable (ex. baisse de prix
-- sur une plage) que l'opérateur applique en un clic depuis la carte HITL, en
-- plus du simple rejet. Colonnes nullable : les suggestions LLM existantes
-- restent informationnelles (action_type NULL = "lire + agir/rejeter" comme avant).

-- action_params : petit payload JSON (from/to/percent…) stocké en TEXT pour
-- rester portable (le schéma de test est généré par Hibernate, pas Liquibase).
ALTER TABLE supervision_suggestion
    ADD COLUMN IF NOT EXISTS action_type            VARCHAR(40),
    ADD COLUMN IF NOT EXISTS action_params          TEXT,
    ADD COLUMN IF NOT EXISTS estimated_impact_cents BIGINT,
    ADD COLUMN IF NOT EXISTS severity               VARCHAR(20),
    ADD COLUMN IF NOT EXISTS applied_at             TIMESTAMP;
