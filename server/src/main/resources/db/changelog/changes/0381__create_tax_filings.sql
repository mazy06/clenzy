-- Modèles métier constellation (vague M-A, M2) — registre des déclarations de
-- taxe de séjour : un enregistrement par org et par trimestre, statut
-- DUE → FILED → PAID. Trace le dépôt MANUEL tant qu'aucun portail de
-- télédéclaration n'est branché ; le jour où un canal existe, markFiled
-- deviendra l'issue d'un vrai dépôt sans changer le modèle.
CREATE TABLE IF NOT EXISTS tax_filings (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
    status VARCHAR(20) NOT NULL DEFAULT 'DUE',
    filed_at TIMESTAMP,
    paid_at TIMESTAMP,
    payment_reference VARCHAR(200),
    notes VARCHAR(1000),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP,
    CONSTRAINT uq_tax_filings_org_period UNIQUE (organization_id, period_start)
);
