-- Baitly: explicit, revocable publication of aggregate concierge performance.
-- Matches BaitlyConciergePublication and MarketplaceProvider @Table names.
CREATE TABLE baitly_concierge_publications (
    provider_id BIGINT PRIMARY KEY REFERENCES marketplace_providers(id) ON DELETE CASCADE,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    managed_properties INTEGER NOT NULL CHECK (managed_properties >= 0),
    occupancy_pct NUMERIC(5,1) CHECK (occupancy_pct BETWEEN 0 AND 100),
    updated_at TIMESTAMPTZ NOT NULL,
    consented_by VARCHAR(100) NOT NULL,
    CONSTRAINT baitly_concierge_minimum_sample CHECK (NOT published OR managed_properties >= 5),
    CONSTRAINT baitly_concierge_period CHECK (period_end >= period_start)
);
CREATE INDEX baitly_concierge_publication_period ON baitly_concierge_publications(period_start) WHERE published;
