-- ============================================================================
-- 0121 : Wheelhouse (pricing) + Xero & Sage (comptabilite OAuth2)
-- ============================================================================
-- Etend pricing_connections pour accepter WHEELHOUSE, et cree 2 nouvelles
-- tables pour les providers OAuth comptables (mirror quickbooks_connections).
--
-- Pourquoi pas une seule table accounting_connections :
--   - Xero a "tenant_id" (organisation Xero choisie par l'utilisateur)
--   - Sage a "business_id" (identifiant de la business)
--   - QuickBooks a "realm_id" (company)
--   Chaque provider a un identifiant business specifique. Tables separees
--   evitent les colonnes NULL pour 2/3 des rows.
-- ============================================================================

-- ─── Wheelhouse (pricing) ──────────────────────────────────────────────────

ALTER TABLE pricing_connections
    DROP CONSTRAINT IF EXISTS pricing_connections_provider_check;

ALTER TABLE pricing_connections
    ADD CONSTRAINT pricing_connections_provider_check
    CHECK (provider_type IN ('PRICELABS','BEYOND','WHEELHOUSE'));

-- ─── Xero (OAuth2) ─────────────────────────────────────────────────────────

CREATE TABLE xero_connections (
    id                          BIGSERIAL PRIMARY KEY,
    organization_id             BIGINT NOT NULL,
    user_id                     BIGINT NOT NULL,
    access_token_encrypted      TEXT,
    refresh_token_encrypted     TEXT,
    token_expires_at            TIMESTAMP,
    refresh_token_expires_at    TIMESTAMP,
    scopes                      VARCHAR(500),
    -- tenant_id : identifiant de l'organisation Xero selectionnee par
    -- l'utilisateur (Xero supporte le multi-tenant — un utilisateur peut
    -- gerer plusieurs organisations Xero). Recupere via GET /connections
    -- apres l'echange du code OAuth.
    tenant_id                   VARCHAR(100),
    tenant_name                 VARCHAR(200),
    status                      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    error_message               TEXT,
    connected_at                TIMESTAMP,
    created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT xero_connections_status_check
        CHECK (status IN ('ACTIVE','EXPIRED','ERROR','REVOKED'))
);

CREATE INDEX idx_xero_connections_org
    ON xero_connections (organization_id);

CREATE UNIQUE INDEX uq_xero_connections_org
    ON xero_connections (organization_id);

-- ─── Sage Business Cloud Accounting (OAuth2) ──────────────────────────────

CREATE TABLE sage_connections (
    id                          BIGSERIAL PRIMARY KEY,
    organization_id             BIGINT NOT NULL,
    user_id                     BIGINT NOT NULL,
    access_token_encrypted      TEXT,
    refresh_token_encrypted     TEXT,
    token_expires_at            TIMESTAMP,
    refresh_token_expires_at    TIMESTAMP,
    scopes                      VARCHAR(500),
    -- business_id : identifiant de la business Sage (similaire a realm_id
    -- QuickBooks ou tenant_id Xero). Recupere via GET /businesses apres
    -- l'echange du code OAuth.
    business_id                 VARCHAR(100),
    business_name               VARCHAR(200),
    status                      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    error_message               TEXT,
    connected_at                TIMESTAMP,
    created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT sage_connections_status_check
        CHECK (status IN ('ACTIVE','EXPIRED','ERROR','REVOKED'))
);

CREATE INDEX idx_sage_connections_org
    ON sage_connections (organization_id);

CREATE UNIQUE INDEX uq_sage_connections_org
    ON sage_connections (organization_id);
