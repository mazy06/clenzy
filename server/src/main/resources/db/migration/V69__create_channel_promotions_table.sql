-- V69: Channel Promotions table for OTA promotions management
CREATE TABLE IF NOT EXISTS channel_promotions (
    id                    BIGSERIAL PRIMARY KEY,
    organization_id       BIGINT       NOT NULL REFERENCES organizations(id),
    property_id           BIGINT       NOT NULL REFERENCES properties(id),
    channel_name          VARCHAR(50)  NOT NULL,
    promotion_type        VARCHAR(50)  NOT NULL,
    enabled               BOOLEAN      NOT NULL DEFAULT true,
    config                JSONB        DEFAULT '{}',
    discount_percentage   DECIMAL(5,2),
    start_date            DATE,
    end_date              DATE,
    status                VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    external_promotion_id VARCHAR(255),
    synced_at             TIMESTAMP WITH TIME ZONE,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_channel_promotions_org_property ON channel_promotions(organization_id, property_id);
CREATE INDEX idx_channel_promotions_channel ON channel_promotions(channel_name);
CREATE INDEX idx_channel_promotions_status ON channel_promotions(status);
CREATE INDEX idx_channel_promotions_dates ON channel_promotions(start_date, end_date);
