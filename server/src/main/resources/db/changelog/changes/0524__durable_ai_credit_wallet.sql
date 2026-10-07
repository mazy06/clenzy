-- Baitly : réservations durables, dette d'usage et retraits de droits financés.
CREATE TABLE baitly_ai_credit_accounts (
    organization_id BIGINT PRIMARY KEY,
    overdraft_millicredits BIGINT NOT NULL DEFAULT 0 CHECK (overdraft_millicredits >= 0)
);
CREATE TABLE baitly_ai_credit_reservations (
    id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES baitly_ai_credit_accounts(organization_id),
    remaining_millicredits BIGINT NOT NULL CHECK (remaining_millicredits >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    closed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX baitly_ai_credit_reservations_org ON baitly_ai_credit_reservations(organization_id, expires_at) WHERE NOT closed;
ALTER TABLE ai_credit_grant ADD COLUMN millicredits_revoked BIGINT NOT NULL DEFAULT 0;
ALTER TABLE ai_credit_grant ADD COLUMN millicredits_expired BIGINT NOT NULL DEFAULT 0 CHECK (millicredits_expired >= 0);
-- Reclasser uniquement les expirations dont le journal identifie exactement la poche et l'organisation.
UPDATE ai_credit_grant g SET millicredits_expired=-e.millicredits, millicredits_consumed=g.millicredits_consumed+e.millicredits
FROM ai_usage_ledger e WHERE e.organization_id=g.organization_id AND e.entry_type='EXPIRY'
AND e.idempotency_key='expiry:grant:' || g.id::text AND e.millicredits<0 AND -e.millicredits<=g.millicredits_consumed;
ALTER TABLE ai_credit_grant ADD CONSTRAINT baitly_ai_credit_revoked_bounds CHECK (millicredits_revoked >= 0 AND millicredits_revoked <= millicredits_granted);
CREATE TABLE baitly_ai_credit_coverage (
    invoice_id VARCHAR(255) PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    subscription_id VARCHAR(255) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT baitly_ai_credit_period CHECK (period_end > period_start)
);
CREATE INDEX baitly_ai_credit_coverage_org ON baitly_ai_credit_coverage(organization_id, subscription_id, period_end);
