-- V79: Create fiscal_profiles table (1:1 with organizations)
-- Stores fiscal/tax configuration per organization for multi-country support

CREATE TABLE fiscal_profiles (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL UNIQUE REFERENCES organizations(id),
    country_code    VARCHAR(3) NOT NULL DEFAULT 'FR',
    default_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    tax_id_number   VARCHAR(50),
    vat_number      VARCHAR(30),
    fiscal_regime   VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
    vat_registered  BOOLEAN NOT NULL DEFAULT TRUE,
    vat_declaration_frequency VARCHAR(15) DEFAULT 'MONTHLY',
    invoice_language VARCHAR(5) DEFAULT 'fr',
    invoice_prefix  VARCHAR(10) DEFAULT 'FA-',
    legal_mentions  TEXT,
    legal_entity_name VARCHAR(200),
    legal_address   TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fiscal_profile_country ON fiscal_profiles(country_code);
CREATE INDEX idx_fiscal_profile_org ON fiscal_profiles(organization_id);
