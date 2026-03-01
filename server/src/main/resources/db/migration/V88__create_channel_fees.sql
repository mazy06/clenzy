-- V88 : Table des frais supplementaires par canal (menage, animaux, etc.)
CREATE TABLE IF NOT EXISTS channel_fees (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT       NOT NULL REFERENCES organizations(id),
    property_id         BIGINT       NOT NULL REFERENCES properties(id),
    channel_name        VARCHAR(50)  NOT NULL,
    fee_type            VARCHAR(50)  NOT NULL,
    name                VARCHAR(100) NOT NULL,
    amount              DECIMAL(10,2) NOT NULL,
    currency            VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    charge_type         VARCHAR(30)  NOT NULL DEFAULT 'PER_STAY',
    is_mandatory        BOOLEAN NOT NULL DEFAULT true,
    is_taxable          BOOLEAN NOT NULL DEFAULT false,
    enabled             BOOLEAN NOT NULL DEFAULT true,
    config              JSONB DEFAULT '{}',
    synced_at           TIMESTAMP WITH TIME ZONE,
    sync_status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    external_fee_id     VARCHAR(255),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cf_org_prop ON channel_fees(organization_id, property_id);
CREATE INDEX idx_cf_channel ON channel_fees(channel_name);
CREATE INDEX idx_cf_type ON channel_fees(fee_type);
