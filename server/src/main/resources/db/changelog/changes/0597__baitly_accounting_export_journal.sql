-- Journal Baitly sans payload, nom, coordonnées, URL ou secret fournisseur.
-- Tables/colonnes vérifiées contre PennylaneConnection, Invoice et ProviderExpense, et 0080.
ALTER TABLE pennylane_connections ADD COLUMN accounting_generation UUID NOT NULL DEFAULT gen_random_uuid();

CREATE TABLE baitly_accounting_exports (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL CHECK (organization_id > 0),
    document_kind VARCHAR(16) NOT NULL CHECK (document_kind IN ('INVOICE','EXPENSE')),
    document_id BIGINT NOT NULL CHECK (document_id > 0),
    generation UUID NOT NULL,
    attempt UUID NOT NULL,
    fingerprint VARCHAR(64) NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
    source_version VARCHAR(64),
    state VARCHAR(16) NOT NULL CHECK (state IN ('SENDING','UNKNOWN','CONFIRMED')),
    remote_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMPTZ,
    uncertain_at TIMESTAMPTZ,
    CONSTRAINT uq_baitly_accounting_export_document UNIQUE (organization_id,document_kind,document_id),
    CONSTRAINT ck_baitly_accounting_export_proof CHECK (
        (state = 'CONFIRMED' AND remote_id IS NOT NULL AND confirmed_at IS NOT NULL)
        OR (state <> 'CONFIRMED' AND remote_id IS NULL AND confirmed_at IS NULL)
    )
);
CREATE INDEX idx_baitly_accounting_export_review ON baitly_accounting_exports (organization_id,state);

-- Avant le journal, une ligne sans marqueur pouvait déjà avoir été envoyée.
-- Ne jamais convertir cette absence de preuve historique en autorisation de recréer.
INSERT INTO baitly_accounting_exports (organization_id,document_kind,document_id,generation,attempt,fingerprint,state,uncertain_at)
SELECT i.organization_id,'INVOICE',i.id,COALESCE(c.accounting_generation,gen_random_uuid()),gen_random_uuid(),repeat('0',64),'UNKNOWN',CURRENT_TIMESTAMP
FROM invoices i LEFT JOIN pennylane_connections c ON c.organization_id=i.organization_id
WHERE i.organization_id>0 AND i.pennylane_invoice_id IS NULL AND i.status IN ('ISSUED','SENT','PAID');
INSERT INTO baitly_accounting_exports (organization_id,document_kind,document_id,generation,attempt,fingerprint,state,uncertain_at)
SELECT e.organization_id,'EXPENSE',e.id,COALESCE(c.accounting_generation,gen_random_uuid()),gen_random_uuid(),repeat('0',64),'UNKNOWN',CURRENT_TIMESTAMP
FROM provider_expenses e LEFT JOIN pennylane_connections c ON c.organization_id=e.organization_id
WHERE e.organization_id>0 AND e.pennylane_invoice_id IS NULL AND e.status IN ('APPROVED','INCLUDED','PAID');
