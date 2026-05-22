-- ============================================================================
-- 0123 : kyc_connections + channel_manager_connections
-- ============================================================================
-- Deux nouveaux domaines d'integration :
--   1. KYC / verification d'identite : Sumsub, Veriff, Onfido (API key)
--   2. Channel Manager (middleware logiciel) : SiteMinder, Hostaway,
--      Rentals United (API key)
--
-- Note distinction Channels vs Channel Manager :
--   - tab Channels : OTAs eux-memes (Airbnb, Booking.com, Expedia, Almosafer)
--   - tab Integrations / Channel Manager : middleware logiciel qui agregent
--     plusieurs OTAs (utile pour OTAs niche sans integration directe)
-- ============================================================================

CREATE TABLE kyc_connections (
    id                    BIGSERIAL PRIMARY KEY,
    organization_id       BIGINT NOT NULL,
    user_id               BIGINT NOT NULL,
    provider_type         VARCHAR(30) NOT NULL,
    server_url            VARCHAR(500) NOT NULL,
    account_identifier    VARCHAR(200),
    api_key_encrypted     TEXT NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    error_message         TEXT,
    last_tested_at        TIMESTAMP,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT kyc_connections_status_check
        CHECK (status IN ('ACTIVE','ERROR','REVOKED')),
    CONSTRAINT kyc_connections_provider_check
        CHECK (provider_type IN ('SUMSUB','VERIFF','ONFIDO'))
);

CREATE INDEX idx_kyc_conn_org
    ON kyc_connections (organization_id);

CREATE UNIQUE INDEX uq_kyc_conn_org_provider
    ON kyc_connections (organization_id, provider_type);

-- ─── Channel Manager (middleware) ──────────────────────────────────────────

CREATE TABLE channel_manager_connections (
    id                    BIGSERIAL PRIMARY KEY,
    organization_id       BIGINT NOT NULL,
    user_id               BIGINT NOT NULL,
    provider_type         VARCHAR(30) NOT NULL,
    server_url            VARCHAR(500) NOT NULL,
    account_identifier    VARCHAR(200),
    api_key_encrypted     TEXT NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    error_message         TEXT,
    last_tested_at        TIMESTAMP,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT channel_manager_connections_status_check
        CHECK (status IN ('ACTIVE','ERROR','REVOKED')),
    CONSTRAINT channel_manager_connections_provider_check
        CHECK (provider_type IN ('SITEMINDER','HOSTAWAY','RENTALS_UNITED'))
);

CREATE INDEX idx_channel_mgr_conn_org
    ON channel_manager_connections (organization_id);

CREATE UNIQUE INDEX uq_channel_mgr_conn_org_provider
    ON channel_manager_connections (organization_id, provider_type);
