-- liquibase formatted sql
-- changeset clenzy-team:0093-create-property-photos

-- Drop the old auto-generated table if it exists (JPA-created, no migration)
DROP TABLE IF EXISTS property_photos CASCADE;

CREATE TABLE property_photos (
    id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    organization_id BIGINT NOT NULL,
    storage_key VARCHAR(500),
    original_filename VARCHAR(255),
    content_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
    file_size BIGINT,
    data BYTEA,
    sort_order INT NOT NULL DEFAULT 0,
    caption VARCHAR(500),
    source VARCHAR(50) DEFAULT 'MANUAL',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_property_photos_property ON property_photos(property_id);
CREATE INDEX idx_property_photos_org ON property_photos(organization_id);
