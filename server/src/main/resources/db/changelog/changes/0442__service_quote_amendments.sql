-- Historique distinct de l'accord accepté Baitly. Aucune modification des devis existants.
CREATE TABLE service_quote_amendments (
    id BIGSERIAL PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL,
    quote_id BIGINT NOT NULL REFERENCES service_quotes(id),
    intervention_id BIGINT NOT NULL REFERENCES interventions(id),
    base_intervention_version BIGINT NOT NULL DEFAULT 0,
    proposed_by BIGINT NOT NULL REFERENCES users(id),
    original_amount NUMERIC(12,2) NOT NULL CHECK (original_amount >= 0),
    proposed_amount NUMERIC(12,2) NOT NULL CHECK (proposed_amount >= 0 AND proposed_amount <> original_amount),
    currency VARCHAR(8) NOT NULL,
    reason VARCHAR(1000) NOT NULL CHECK (length(trim(reason)) > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED'
        CHECK (status IN ('PROPOSED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'OBSOLETE')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    decided_at TIMESTAMP WITH TIME ZONE,
    decided_by BIGINT REFERENCES users(id),
    CHECK ((status = 'PROPOSED' AND decided_at IS NULL AND decided_by IS NULL)
        OR (status <> 'PROPOSED' AND decided_at IS NOT NULL AND decided_by IS NOT NULL))
);
CREATE UNIQUE INDEX uq_quote_amendment_pending ON service_quote_amendments(quote_id) WHERE status = 'PROPOSED';
CREATE INDEX idx_quote_amendments_org_quote ON service_quote_amendments(organization_id, quote_id, created_at);
