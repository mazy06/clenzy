-- Modèles métier constellation (vague M-B, M6) — dossier de litige bancaire :
-- une ligne par dispute Stripe (webhook dispute.created), statut
-- OPEN → SUBMITTED (dépôt des preuves) → WON/LOST (webhook dispute.closed).
CREATE TABLE IF NOT EXISTS payment_disputes (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    provider_dispute_id VARCHAR(120) NOT NULL,
    charge_id VARCHAR(120),
    reservation_id BIGINT,
    amount NUMERIC(12, 2),
    currency VARCHAR(8),
    due_by TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    evidence_submitted_at TIMESTAMP,
    outcome VARCHAR(40),
    outcome_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP,
    CONSTRAINT uq_payment_disputes_provider UNIQUE (provider_dispute_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_disputes_org
    ON payment_disputes (organization_id, status);
