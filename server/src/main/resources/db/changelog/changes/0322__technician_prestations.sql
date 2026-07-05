-- 0322 : Surcouche « travaux » par technicien (prestations + prix propres).
-- Scopée (organisation, utilisateur) : un technicien ne voit que ses lignes.
CREATE TABLE IF NOT EXISTS technician_prestations (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    intervention_type VARCHAR(60) NOT NULL,
    base_price DOUBLE PRECISION,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP,
    CONSTRAINT uq_technician_prestation UNIQUE (organization_id, user_id, intervention_type)
);
CREATE INDEX IF NOT EXISTS idx_technician_prestation_org_user
    ON technician_prestations (organization_id, user_id);
