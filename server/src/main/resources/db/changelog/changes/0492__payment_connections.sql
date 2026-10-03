-- Baitly: separate organization accounts from personal payout beneficiaries.
CREATE TABLE payment_connections (
    id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    beneficiary_key VARCHAR(80) NOT NULL,
    user_id BIGINT REFERENCES users(id),
    country VARCHAR(2) NOT NULL,
    provider VARCHAR(24) NOT NULL,
    provider_account_id VARCHAR(128),
    charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    transfers_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
    authorized BOOLEAN NOT NULL DEFAULT TRUE,
    checked_at TIMESTAMP WITH TIME ZONE,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT payment_connection_beneficiary_unique UNIQUE (organization_id, beneficiary_key),
    CONSTRAINT payment_connection_account_unique UNIQUE (provider, provider_account_id),
    CONSTRAINT payment_connection_country_check CHECK (country IN ('FR', 'MA', 'SA'))
);

ALTER TABLE payment_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_connections FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payment_connections
    USING (current_setting('app.bypass_rls', true) = 'on'
        OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint)
    WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
        OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint);
