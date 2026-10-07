-- Baitly : curseurs de lecture Stripe, séparés des instructions de décaissement.
-- Table et colonnes alignées sur PayoutRecoveryJob ; aucune migration de solde.
CREATE TABLE payout_recovery_jobs (
    id bigserial PRIMARY KEY,
    account_id varchar(100) NOT NULL CHECK (account_id LIKE 'acct\_%' ESCAPE '\'),
    livemode boolean NOT NULL,
    earliest_at timestamptz NOT NULL,
    window_end timestamptz,
    after_payout_id varchar(255),
    last_completed_at timestamptz,
    last_attempt_at timestamptz,
    next_attempt_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    failures integer NOT NULL DEFAULT 0 CHECK (failures >= 0),
    error_code varchar(40),
    lease_token varchar(36),
    lease_until timestamptz,
    UNIQUE(account_id,livemode),
    CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
    CHECK (after_payout_id IS NULL OR window_end IS NOT NULL)
);
CREATE INDEX idx_payout_recovery_due ON payout_recovery_jobs(next_attempt_at);
CREATE INDEX idx_payout_transfers_recovery ON payout_transfers(destination,stripe_livemode,created_at)
    WHERE provider='STRIPE' AND stripe_livemode IS NOT NULL;
CREATE INDEX idx_payout_transfers_stalled ON payout_transfers(updated_at) WHERE state='SUBMITTING';
ALTER TABLE payout_recovery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_recovery_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY payout_recovery_internal ON payout_recovery_jobs
    USING (current_setting('app.bypass_rls',true) = 'on')
    WITH CHECK (current_setting('app.bypass_rls',true) = 'on');
