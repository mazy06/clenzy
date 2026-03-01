-- V67 : WhatsApp Business API integration

CREATE TABLE whatsapp_configs (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL UNIQUE,
    api_token           VARCHAR(1000),
    phone_number_id     VARCHAR(100),
    business_account_id VARCHAR(100),
    webhook_verify_token VARCHAR(255),
    enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_wac_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE whatsapp_templates (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    template_name   VARCHAR(255) NOT NULL,
    language        VARCHAR(10) NOT NULL DEFAULT 'fr',
    category        VARCHAR(50),
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    components      JSONB,
    synced_at       TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_wat_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT chk_wat_status CHECK (status IN ('APPROVED','PENDING','REJECTED'))
);

CREATE INDEX idx_wat_org ON whatsapp_templates(organization_id);
