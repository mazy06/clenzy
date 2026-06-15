-- Crédit fidélité (2.8 phase 2b) : le voyageur gagne loyalty_credit_percent % de chaque séjour
-- DIRECT, crédité APRÈS le check-out, réutilisable. Solde par (organisation, email) + ledger
-- d'écritures (gain / rédemption / clawback). Montants en centimes (BIGINT) → déduction atomique.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS loyalty_credit_percent INTEGER;

CREATE TABLE IF NOT EXISTS guest_credit_accounts (
    id               BIGSERIAL PRIMARY KEY,
    organization_id  BIGINT NOT NULL REFERENCES organizations(id),
    email            VARCHAR(255) NOT NULL,
    balance_cents    BIGINT NOT NULL DEFAULT 0,
    currency         VARCHAR(3) NOT NULL DEFAULT 'EUR',
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_guest_credit_account UNIQUE (organization_id, email)
);

CREATE TABLE IF NOT EXISTS guest_credit_transactions (
    id               BIGSERIAL PRIMARY KEY,
    account_id       BIGINT NOT NULL REFERENCES guest_credit_accounts(id) ON DELETE CASCADE,
    organization_id  BIGINT NOT NULL,
    amount_cents     BIGINT NOT NULL,
    type             VARCHAR(20) NOT NULL,
    reservation_code VARCHAR(100),
    created_at       TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guest_credit_tx_account ON guest_credit_transactions(account_id);

-- Idempotence du gain : un seul EARN par (organisation, réservation).
CREATE UNIQUE INDEX IF NOT EXISTS uq_guest_credit_earn
    ON guest_credit_transactions(organization_id, reservation_code, type)
    WHERE reservation_code IS NOT NULL;
