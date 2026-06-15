-- CLZ-P0-17 : recommandations de prix (shadow/reco/auto), distinctes du prix résolu.
-- Transition de statut par CAS (UPDATE conditionnel) ; unicité par (org, bien, date).

CREATE TABLE IF NOT EXISTS price_recommendations (
    id               BIGSERIAL PRIMARY KEY,
    organization_id  BIGINT        NOT NULL,
    property_id      BIGINT        NOT NULL,
    reco_date        DATE          NOT NULL,
    suggested_price  NUMERIC(12,2) NOT NULL,
    base_price       NUMERIC(12,2),
    currency         VARCHAR(3),
    source           VARCHAR(16)   NOT NULL,
    status           VARCHAR(16)   NOT NULL DEFAULT 'PROPOSED',
    reason           VARCHAR(1024),
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_price_reco_org_property_date UNIQUE (organization_id, property_id, reco_date)
);

CREATE INDEX IF NOT EXISTS idx_price_reco_property_date
    ON price_recommendations (organization_id, property_id, reco_date);

CREATE INDEX IF NOT EXISTS idx_price_reco_status
    ON price_recommendations (organization_id, property_id, status, reco_date);
