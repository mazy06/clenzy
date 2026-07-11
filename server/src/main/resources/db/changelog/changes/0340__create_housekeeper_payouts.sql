-- Moteur Ménage (Phase 3B — P9) : payout Stripe Connect des prestataires ménage.
-- 1) housekeeper_payout_configs : compte Express du PRO (miroir volontaire de
--    owner_payout_configs — SRP, zéro régression du flux propriétaires).
-- 2) housekeeper_payout_records : un versement par intervention (UNIQUE =
--    verrou anti-double-payout, check-then-act interdit — audit règle 8).
CREATE TABLE IF NOT EXISTS housekeeper_payout_configs (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    stripe_account_id VARCHAR(64),
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP,
    CONSTRAINT housekeeper_payout_configs_user_org_unique UNIQUE (user_id, organization_id)
);
CREATE INDEX IF NOT EXISTS housekeeper_payout_configs_stripe_idx
    ON housekeeper_payout_configs (stripe_account_id);

CREATE TABLE IF NOT EXISTS housekeeper_payout_records (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    intervention_id BIGINT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    commission_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    stripe_transfer_id VARCHAR(64),
    status VARCHAR(16) NOT NULL,
    failure_reason VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP,
    -- Verrou anti-double-payout : UN versement max par intervention (l'insert
    -- concurrent perd sur la contrainte, jamais deux transferts Stripe).
    CONSTRAINT housekeeper_payout_records_intervention_unique UNIQUE (intervention_id)
);
CREATE INDEX IF NOT EXISTS housekeeper_payout_records_user_idx
    ON housekeeper_payout_records (user_id);
CREATE INDEX IF NOT EXISTS housekeeper_payout_records_org_status_idx
    ON housekeeper_payout_records (organization_id, status);

COMMENT ON TABLE housekeeper_payout_configs IS
    'Compte Stripe Connect Express du prestataire menage (onboarding embarque). Moteur Menage 3B';
COMMENT ON TABLE housekeeper_payout_records IS
    'Versements prestataire par intervention (PENDING|SENT|FAILED|BLOCKED). UNIQUE(intervention) = anti-double-payout';
