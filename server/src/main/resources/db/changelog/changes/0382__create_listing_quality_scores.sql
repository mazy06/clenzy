-- Modèles métier constellation (vague M-A, M3) — score qualité d'annonce v1
-- HEURISTIQUE (photos, description, équipements, note moyenne). Le breakdown
-- JSONB accueillera les contributeurs v2 (vision LLM sur les photos) sans
-- changement de schéma. Recalculé au fil des scans de supervision.
CREATE TABLE IF NOT EXISTS listing_quality_scores (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL,
    score INT NOT NULL,
    breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    computed_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_listing_quality_org_property UNIQUE (organization_id, property_id)
);
