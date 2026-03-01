-- V87 : Table de mapping de contenu par canal (descriptions, photos, amenities)
CREATE TABLE IF NOT EXISTS channel_content_mappings (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT       NOT NULL REFERENCES organizations(id),
    property_id         BIGINT       NOT NULL REFERENCES properties(id),
    channel_name        VARCHAR(50)  NOT NULL,
    title               VARCHAR(200),
    description         TEXT,
    amenities           JSONB DEFAULT '[]',
    photo_urls          JSONB DEFAULT '[]',
    property_type       VARCHAR(50),
    bedrooms            INTEGER,
    bathrooms           INTEGER,
    max_guests          INTEGER,
    config              JSONB DEFAULT '{}',
    synced_at           TIMESTAMP WITH TIME ZONE,
    sync_status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    external_content_id VARCHAR(255),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE (organization_id, property_id, channel_name)
);

CREATE INDEX idx_ccm_org_prop ON channel_content_mappings(organization_id, property_id);
CREATE INDEX idx_ccm_channel ON channel_content_mappings(channel_name);
