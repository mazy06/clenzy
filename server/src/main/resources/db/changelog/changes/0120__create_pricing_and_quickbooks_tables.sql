-- ============================================================================
-- 0120 : Tables pricing_connections (PriceLabs, Beyond) + quickbooks_connections
-- ============================================================================
-- Ajoute deux nouveaux domaines d'integration :
--   1. Tarification dynamique : PriceLabs et Beyond — providers via API key
--      (structure identique a external_service_connections mais separation des
--      domaines = pas de pollution du CHECK signature)
--   2. Comptabilite : QuickBooks — OAuth2 (mirror docusign_connections,
--      reutilise OAuthFlowEngine cote Java)
--
-- Pourquoi des tables separees plutot que reutiliser external_service_connections :
--   - Le code Java utilise SignatureProviderType comme enum (signature uniquement)
--   - Ajouter PRICELABS/BEYOND/QUICKBOOKS a cet enum melangerait les domaines
--   - Une table par domaine = isolation clean, scaling independant, eventuellement
--     des champs business specifiques (par ex. pour PriceLabs : sync interval,
--     market geographic id)
-- ============================================================================

-- ─── Pricing (API key) ─────────────────────────────────────────────────────

CREATE TABLE pricing_connections (
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
    CONSTRAINT pricing_connections_status_check
        CHECK (status IN ('ACTIVE','ERROR','REVOKED')),
    CONSTRAINT pricing_connections_provider_check
        CHECK (provider_type IN ('PRICELABS','BEYOND'))
);

CREATE INDEX idx_pricing_conn_org
    ON pricing_connections (organization_id);

CREATE UNIQUE INDEX uq_pricing_conn_org_provider
    ON pricing_connections (organization_id, provider_type);

-- ─── QuickBooks (OAuth2) ───────────────────────────────────────────────────

CREATE TABLE quickbooks_connections (
    id                          BIGSERIAL PRIMARY KEY,
    organization_id             BIGINT NOT NULL,
    user_id                     BIGINT NOT NULL,
    access_token_encrypted      TEXT,
    refresh_token_encrypted     TEXT,
    token_expires_at            TIMESTAMP,
    refresh_token_expires_at    TIMESTAMP,
    scopes                      VARCHAR(500),
    -- realmId est l'identifiant de la company QuickBooks (multi-company support).
    -- Recupere lors du callback OAuth via le param "realmId" dans la query string.
    realm_id                    VARCHAR(100),
    status                      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    error_message               TEXT,
    connected_at                TIMESTAMP,
    created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT quickbooks_connections_status_check
        CHECK (status IN ('ACTIVE','EXPIRED','ERROR','REVOKED'))
);

CREATE INDEX idx_quickbooks_connections_org
    ON quickbooks_connections (organization_id);

CREATE UNIQUE INDEX uq_quickbooks_connections_org
    ON quickbooks_connections (organization_id);
