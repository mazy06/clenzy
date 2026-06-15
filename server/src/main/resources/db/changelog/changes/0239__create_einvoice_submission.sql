-- E-invoicing : suivi de soumission par facture (CLZ-P0-04), socle Factur-X/DGI/ZATCA.
-- Idempotence par (organization_id, invoice_number) via contrainte unique. Idempotent (re-run safe).
CREATE TABLE IF NOT EXISTS einvoice_submissions (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT       NOT NULL,
    invoice_number  VARCHAR(64)  NOT NULL,
    country_code    VARCHAR(2),
    provider_code   VARCHAR(40)  NOT NULL,
    mode            VARCHAR(32)  NOT NULL,
    status          VARCHAR(32)  NOT NULL,
    external_ref    VARCHAR(128),
    message         VARCHAR(512),
    created_at      TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT uq_einvoice_org_invoice UNIQUE (organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_einvoice_status ON einvoice_submissions (status);
