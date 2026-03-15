-- ============================================================
-- 0084 : Owner payout configuration (Stripe Connect / SEPA)
-- ============================================================

CREATE TABLE IF NOT EXISTS owner_payout_config (
    id                           BIGSERIAL PRIMARY KEY,
    organization_id              BIGINT NOT NULL,
    owner_id                     BIGINT NOT NULL REFERENCES users(id),
    payout_method                VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    stripe_connected_account_id  VARCHAR(255),
    stripe_onboarding_complete   BOOLEAN NOT NULL DEFAULT false,
    iban                         VARCHAR(512),
    bic                          VARCHAR(20),
    bank_account_holder          VARCHAR(255),
    verified                     BOOLEAN NOT NULL DEFAULT false,
    created_at                   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, owner_id)
);

-- Extension de owner_payouts pour tracer la methode de paiement utilisee
ALTER TABLE owner_payouts ADD COLUMN IF NOT EXISTS payout_method VARCHAR(20);
ALTER TABLE owner_payouts ADD COLUMN IF NOT EXISTS stripe_transfer_id VARCHAR(255);
