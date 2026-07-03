-- Campagne multi-agent (T-06b, ADR-005) : poches de credits IA.
-- Deux poches (D-101/D-102) : SUBSCRIPTION (dotation mensuelle, expire en fin de
-- cycle, consommee EN PREMIER) puis TOPUP (prepaye, 12 mois, FIFO par expiration).
-- PROMO = geste commercial. Le solde chaud vit dans Redis (CreditBalanceService),
-- cette table est la verite froide rechargee au besoin.

CREATE TABLE ai_credit_grant (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    source VARCHAR(16) NOT NULL,                      -- SUBSCRIPTION | TOPUP | PROMO
    millicredits_granted BIGINT NOT NULL,
    millicredits_consumed BIGINT NOT NULL DEFAULT 0,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    stripe_ref VARCHAR(64),                           -- checkout session / invoice id (idempotence webhook T-07)
    CONSTRAINT uq_ai_credit_grant_stripe_ref UNIQUE (stripe_ref),
    CONSTRAINT chk_ai_credit_grant_bounds CHECK (
        millicredits_granted >= 0
        AND millicredits_consumed >= 0
        AND millicredits_consumed <= millicredits_granted)
);

CREATE INDEX idx_ai_credit_grant_org_active ON ai_credit_grant (organization_id, expires_at);
