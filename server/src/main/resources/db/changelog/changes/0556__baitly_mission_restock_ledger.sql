-- Entity BaitlyRestockLedger matches this immutable stock movement audit.
CREATE TABLE baitly_restock_ledger (
    id BIGSERIAL PRIMARY KEY,
    request_key VARCHAR(36) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL,
    intervention_id BIGINT NOT NULL REFERENCES interventions(id),
    property_id BIGINT NOT NULL REFERENCES properties(id),
    actor_key VARCHAR(255) NOT NULL,
    request_body TEXT NOT NULL,
    receipt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX baitly_restock_ledger_mission_idx ON baitly_restock_ledger(intervention_id,organization_id,created_at);
