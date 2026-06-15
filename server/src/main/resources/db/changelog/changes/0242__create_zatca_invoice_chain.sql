-- CLZ-P0-21 : chaîne PIH/ICV ZATCA (KSA). Séquence ICV monotone + hash chaîné par org.
-- Double unicité = garde-fou anti check-then-act (audit #8).

CREATE TABLE IF NOT EXISTS zatca_invoice_chain (
    id                     BIGSERIAL PRIMARY KEY,
    organization_id        BIGINT      NOT NULL,
    icv                    BIGINT      NOT NULL,
    invoice_number         VARCHAR(64) NOT NULL,
    invoice_hash           VARCHAR(64) NOT NULL,
    previous_invoice_hash  VARCHAR(64) NOT NULL,
    created_at             TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_zatca_chain_org_icv UNIQUE (organization_id, icv),
    CONSTRAINT uq_zatca_chain_org_invoice UNIQUE (organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_zatca_chain_org_icv
    ON zatca_invoice_chain (organization_id, icv DESC);
