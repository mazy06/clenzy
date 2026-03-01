-- V89 : Table des politiques d'annulation par canal
CREATE TABLE IF NOT EXISTS channel_cancellation_policies (
    id                      BIGSERIAL PRIMARY KEY,
    organization_id         BIGINT       NOT NULL REFERENCES organizations(id),
    property_id             BIGINT       NOT NULL REFERENCES properties(id),
    channel_name            VARCHAR(50)  NOT NULL,
    policy_type             VARCHAR(30)  NOT NULL,
    name                    VARCHAR(100),
    description             TEXT,
    cancellation_rules      JSONB NOT NULL DEFAULT '[]',
    non_refundable_discount DECIMAL(5,2),
    enabled                 BOOLEAN NOT NULL DEFAULT true,
    config                  JSONB DEFAULT '{}',
    synced_at               TIMESTAMP WITH TIME ZONE,
    sync_status             VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    external_policy_id      VARCHAR(255),
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE (organization_id, property_id, channel_name)
);

CREATE INDEX idx_ccp_org_prop ON channel_cancellation_policies(organization_id, property_id);
CREATE INDEX idx_ccp_channel ON channel_cancellation_policies(channel_name);
