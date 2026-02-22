-- V42: Complete multi-tenant isolation for integration entities
-- V41 already added organization_id to airbnb_connections, tuya_connections, minut_connections
-- This migration adds organization_id to airbnb_listing_mappings and creates missing FK/indexes

-- 1. airbnb_listing_mappings: ajouter organization_id et peupler via property
ALTER TABLE airbnb_listing_mappings ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE airbnb_listing_mappings alm SET organization_id = p.organization_id
FROM properties p WHERE alm.property_id = p.id
AND alm.organization_id IS NULL;

-- 2. FK constraints pour les 4 tables d'integration
ALTER TABLE airbnb_connections ADD CONSTRAINT fk_airbnb_conn_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE tuya_connections ADD CONSTRAINT fk_tuya_conn_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE minut_connections ADD CONSTRAINT fk_minut_conn_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE airbnb_listing_mappings ADD CONSTRAINT fk_airbnb_mapping_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- 3. Indexes pour les 4 tables d'integration
CREATE INDEX IF NOT EXISTS idx_airbnb_connections_org ON airbnb_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_tuya_connections_org ON tuya_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_minut_connections_org ON minut_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_airbnb_listing_mappings_org ON airbnb_listing_mappings(organization_id);
