-- ============================================================================
-- 0082 : Create payout_schedule_config table (global singleton)
-- ============================================================================
-- Configuration globale du calendrier de generation automatique des reversements.
-- Table singleton : un seul row, upsert via l'application.

CREATE TABLE IF NOT EXISTS payout_schedule_config (
    id              BIGSERIAL PRIMARY KEY,
    payout_days_of_month INTEGER[] NOT NULL DEFAULT '{1,15}',
    grace_period_days    INTEGER   NOT NULL DEFAULT 2,
    auto_generate_enabled BOOLEAN  NOT NULL DEFAULT true,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default config
INSERT INTO payout_schedule_config (payout_days_of_month, grace_period_days, auto_generate_enabled)
VALUES ('{1,15}', 2, true)
ON CONFLICT DO NOTHING;
