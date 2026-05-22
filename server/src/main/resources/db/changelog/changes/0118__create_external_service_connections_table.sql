-- ============================================================================
-- 0118 : Uniformisation des connexions API key vers les providers externes
-- ============================================================================
-- 1. Cree la table generique external_service_connections (Yousign, Universign,
--    DocaPoste, Odoo, ...) — anciennement avec une table par provider.
-- 2. DROP l'ancienne table odoo_connections (cree par 0117) qui faisait
--    double emploi. La table n'avait aucune row en prod (0117 et 0118 sont
--    appliques au meme deploy, odoo_connections est cree puis drop dans la
--    foulee). Garantit d'eviter du code dead/inutilisable.
-- ============================================================================
-- Pourquoi une table unique au lieu d'une par provider :
--   - Tous les providers API-key ont la meme structure (org, server_url,
--     api_key chiffree, status, dates).
--   - Une seule table = un seul Repository, un seul Service, un seul
--     Controller generique. Ajouter un nouveau QTSP = juste etendre l'enum
--     SignatureProviderType (pas de migration DB).
--   - Les providers OAuth (Pennylane, DocuSign a venir) ont leurs propres
--     tables car ils stockent access_token + refresh_token + expiration.
--
-- Constraint d'unicite (organization_id, provider_type) : une seule
-- connexion par couple org x provider.
-- ============================================================================

CREATE TABLE external_service_connections (
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
    CONSTRAINT external_service_connections_status_check
        CHECK (status IN ('ACTIVE','ERROR','REVOKED')),
    CONSTRAINT external_service_connections_provider_check
        CHECK (provider_type IN (
            'PENNYLANE','DOCUSIGN','ODOO','YOUSIGN','UNIVERSIGN',
            'DOCAPOSTE','CLENZY_CUSTOM'
        ))
);

CREATE INDEX idx_external_conn_org
    ON external_service_connections (organization_id);

CREATE UNIQUE INDEX uq_external_conn_org_provider
    ON external_service_connections (organization_id, provider_type);

-- ----------------------------------------------------------------------------
-- Aussi : etendre la contrainte CHECK de org_integration_config.signature_provider
-- pour accepter les nouveaux providers ajoutes a l'enum (YOUSIGN, UNIVERSIGN,
-- DOCAPOSTE).
-- ----------------------------------------------------------------------------

ALTER TABLE org_integration_config
    DROP CONSTRAINT IF EXISTS org_integration_config_signature_provider_check;

ALTER TABLE org_integration_config
    ADD CONSTRAINT org_integration_config_signature_provider_check
    CHECK (signature_provider IS NULL OR signature_provider IN (
        'PENNYLANE','DOCUSIGN','ODOO','YOUSIGN','UNIVERSIGN',
        'DOCAPOSTE','CLENZY_CUSTOM'
    ));

-- ----------------------------------------------------------------------------
-- Drop l'ancienne table odoo_connections (cree par 0117) — uniformisee dans
-- external_service_connections.
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS odoo_connections;
