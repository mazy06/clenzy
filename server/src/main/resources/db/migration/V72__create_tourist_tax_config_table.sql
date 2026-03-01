-- V72: Tourist Tax Configuration per property

CREATE TABLE IF NOT EXISTS tourist_tax_configs (
    id                    BIGSERIAL PRIMARY KEY,
    organization_id       BIGINT       NOT NULL REFERENCES organizations(id),
    property_id           BIGINT       NOT NULL REFERENCES properties(id),
    commune_name          VARCHAR(255) NOT NULL,
    commune_code          VARCHAR(10),
    calculation_mode      VARCHAR(30)  NOT NULL DEFAULT 'PER_PERSON_PER_NIGHT',
    rate_per_person       DECIMAL(6,2),
    percentage_rate       DECIMAL(5,4),
    max_nights            INTEGER,
    children_exempt_under INTEGER      DEFAULT 18,
    enabled               BOOLEAN      NOT NULL DEFAULT true,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_tourist_tax_org_property ON tourist_tax_configs(organization_id, property_id);
