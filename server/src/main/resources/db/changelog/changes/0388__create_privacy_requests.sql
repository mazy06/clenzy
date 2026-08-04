-- M9 (modèles métier constellation) : demandes RGPD des voyageurs (effacement,
-- accès, rectification). L'échéance légale (30 jours) est portée par due_at ;
-- l'effacement est SÉLECTIF (PII purgées, factures/fiches police conservées avec
-- base légale tracée dans report). Alimente la carte GDPR_ERASE (agent Conformité).
CREATE TABLE IF NOT EXISTS privacy_requests (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    guest_id BIGINT,
    requester_email VARCHAR(320) NOT NULL,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    requested_at DATE NOT NULL,
    due_at DATE NOT NULL,
    completed_at TIMESTAMP,
    handled_by VARCHAR(120),
    notes TEXT,
    report JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_org_status
    ON privacy_requests (organization_id, status, due_at);
