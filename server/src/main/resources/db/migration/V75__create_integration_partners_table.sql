-- V75: Marketplace - Integration Partners

CREATE TABLE IF NOT EXISTS integration_partners (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT       NOT NULL REFERENCES organizations(id),
    partner_name        VARCHAR(100) NOT NULL,
    partner_slug        VARCHAR(50)  NOT NULL,
    category            VARCHAR(30)  NOT NULL,
    description         TEXT,
    logo_url            VARCHAR(500),
    website_url         VARCHAR(500),
    status              VARCHAR(20)  NOT NULL DEFAULT 'AVAILABLE',
    config              JSONB,
    api_key_encrypted   VARCHAR(500),
    connected_at        TIMESTAMP WITH TIME ZONE,
    last_sync_at        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_integration_partners_org ON integration_partners(organization_id);
CREATE INDEX idx_integration_partners_category ON integration_partners(category);
CREATE INDEX idx_integration_partners_status ON integration_partners(status);
CREATE UNIQUE INDEX idx_integration_partners_slug_org ON integration_partners(organization_id, partner_slug);
