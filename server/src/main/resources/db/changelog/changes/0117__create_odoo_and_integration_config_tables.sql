-- ============================================================================
-- 0117 : Tables pour l'integration Odoo + choix radio des integrations
-- ============================================================================
-- Cree :
--   1. odoo_connections        : credentials Odoo par organisation
--                                (API key chiffree, multi-tenant via
--                                 organization_id + Hibernate @Filter)
--   2. org_integration_config  : choix du provider radio par type de service
--                                (signature, et plus tard accounting, etc.)
--
-- Contraintes :
--   - Une seule connexion Odoo par organisation (unique sur organization_id
--     dans odoo_connections — index unique partiel par convention).
--   - Une seule row de config par organisation (organization_id UNIQUE
--     dans org_integration_config).
--
-- Anticipation : la table org_integration_config ne contient pour l'instant
-- que signature_provider, mais on ajoutera accounting_provider,
-- invoicing_provider, etc. via des changesets ulterieurs.
-- ============================================================================

CREATE TABLE odoo_connections (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL,
    user_id             BIGINT NOT NULL,
    server_url          VARCHAR(500) NOT NULL,
    database_name       VARCHAR(200) NOT NULL,
    user_login          VARCHAR(200) NOT NULL,
    api_key_encrypted   TEXT NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    error_message       TEXT,
    last_tested_at      TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT odoo_connections_status_check
        CHECK (status IN ('ACTIVE','ERROR','REVOKED'))
);

CREATE INDEX idx_odoo_connections_org
    ON odoo_connections (organization_id);

-- Une seule connexion Odoo par org (multi-tenant)
CREATE UNIQUE INDEX uq_odoo_connections_org
    ON odoo_connections (organization_id);

-- ----------------------------------------------------------------------------

CREATE TABLE org_integration_config (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL UNIQUE,
    signature_provider  VARCHAR(30),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT org_integration_config_signature_provider_check
        CHECK (signature_provider IS NULL OR signature_provider IN (
            'PENNYLANE','DOCUSIGN','ODOO','CLENZY_CUSTOM'
        ))
);

CREATE INDEX idx_org_integration_config_org
    ON org_integration_config (organization_id);
