-- Baitly : une série par devis source, une demande PMS par échéance.
CREATE TABLE marketplace_recurrences (
    quote_request_id BIGINT PRIMARY KEY REFERENCES marketplace_quote_requests(id),
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    consent_owner_id BIGINT NOT NULL REFERENCES users(id),
    version BIGINT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    anchor_date DATE NOT NULL,
    interval_unit VARCHAR(10) NOT NULL CHECK (interval_unit IN ('DAYS', 'MONTHS')),
    interval_count INTEGER NOT NULL CHECK (interval_count BETWEEN 1 AND 3650),
    lead_days INTEGER NOT NULL CHECK (lead_days BETWEEN 0 AND 90),
    occurrence_index INTEGER NOT NULL DEFAULT 0 CHECK (occurrence_index >= 0),
    next_date DATE NOT NULL,
    last_request_id BIGINT REFERENCES service_requests(id) ON DELETE SET NULL
);
CREATE INDEX idx_marketplace_recurrences_due ON marketplace_recurrences ((next_date - lead_days), quote_request_id) WHERE enabled;
