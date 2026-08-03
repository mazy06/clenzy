-- Modèles métier constellation (vague M-B, M4) — devis prestataires : saisis sur
-- la fiche intervention, comparés par la carte QUOTE_APPROVAL (agent Opérations).
-- Un seul devis APPROUVÉ par intervention (unique partiel) ; l'approbation reporte
-- le montant sur intervention.estimated_cost (source des cartes aval : retenue de
-- caution, accord travaux).
CREATE TABLE IF NOT EXISTS service_quotes (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL,
    intervention_id BIGINT,
    provider_name VARCHAR(200) NOT NULL,
    provider_email VARCHAR(320),
    provider_phone VARCHAR(40),
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    valid_until DATE,
    earliest_start_date DATE,
    description VARCHAR(1000),
    document_ref VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    approved_by VARCHAR(120),
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_quotes_org_intervention
    ON service_quotes (organization_id, intervention_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_quotes_one_approved
    ON service_quotes (intervention_id) WHERE status = 'APPROVED';
