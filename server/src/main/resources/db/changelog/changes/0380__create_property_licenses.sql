-- Modèles métier constellation (vague M-A, M1) — licences & autorisations d'un
-- logement : licence courte durée, enregistrement touristique, certificat de
-- sécurité… L'échéance + le délai de renouvellement alimentent la carte
-- LICENSE_RENEWAL de l'agent Conformité.
CREATE TABLE IF NOT EXISTS property_licenses (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL,
    license_type VARCHAR(40) NOT NULL,
    license_number VARCHAR(120),
    issued_by VARCHAR(200),
    issued_at DATE,
    expires_at DATE,
    renewal_lead_days INT NOT NULL DEFAULT 60,
    document_ref VARCHAR(500),
    notes VARCHAR(1000),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_property_licenses_org_prop
    ON property_licenses (organization_id, property_id);
