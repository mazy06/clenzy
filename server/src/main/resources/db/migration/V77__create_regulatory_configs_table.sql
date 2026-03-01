-- V77: Regulatory Compliance Configurations

CREATE TABLE IF NOT EXISTS regulatory_configs (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT       NOT NULL REFERENCES organizations(id),
    property_id         BIGINT       NOT NULL REFERENCES properties(id),
    regulatory_type     VARCHAR(30)  NOT NULL,
    is_enabled          BOOLEAN      DEFAULT true,
    registration_number VARCHAR(50),
    max_days_per_year   INTEGER      DEFAULT 120,
    country_code        VARCHAR(2)   DEFAULT 'FR',
    city_code           VARCHAR(10),
    notes               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_regulatory_configs_org ON regulatory_configs(organization_id);
CREATE INDEX idx_regulatory_configs_property ON regulatory_configs(organization_id, property_id);
CREATE INDEX idx_regulatory_configs_type ON regulatory_configs(regulatory_type);
