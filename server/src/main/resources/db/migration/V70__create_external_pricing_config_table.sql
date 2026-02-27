-- V70: External Pricing Configuration table (PriceLabs, Beyond Pricing, Wheelhouse)
CREATE TABLE IF NOT EXISTS external_pricing_configs (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT       NOT NULL REFERENCES organizations(id),
    provider            VARCHAR(30)  NOT NULL,
    api_key             VARCHAR(500),
    api_url             VARCHAR(500),
    property_mappings   JSONB        DEFAULT '{}',
    enabled             BOOLEAN      NOT NULL DEFAULT false,
    last_sync_at        TIMESTAMP WITH TIME ZONE,
    sync_interval_hours INTEGER      DEFAULT 6,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_external_pricing_org ON external_pricing_configs(organization_id);
CREATE INDEX idx_external_pricing_provider ON external_pricing_configs(provider);
CREATE UNIQUE INDEX idx_external_pricing_org_provider ON external_pricing_configs(organization_id, provider);
