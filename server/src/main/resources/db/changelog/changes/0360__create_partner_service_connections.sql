-- ============================================================================
-- 0360 : partner_service_connections
-- ============================================================================
-- Scaffolding des services du catalogue Integrations sans backend dedie
-- (marketing/CRM, menage, avis, fiscalite, assurance). Une seule table
-- discriminee par provider_type (meme pattern que kyc_connections / 0123) :
-- l'org enregistre ses credentials chiffrees (Jasypt AES-256) des maintenant ;
-- les flux metier par provider seront branches ulterieurement.
-- ============================================================================

CREATE TABLE partner_service_connections (
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
    -- Pas de CHECK sur provider_type : la liste des providers scaffoldes est
    -- amenee a grandir, et un CHECK enum fige provoque des echecs d'INSERT
    -- prod-only a l'ajout d'une valeur (lecon incident contraintes CHECK enum,
    -- migration 0274). La validation se fait via l'enum Java PartnerServiceType.
    CONSTRAINT partner_service_connections_status_check
        CHECK (status IN ('ACTIVE','ERROR','REVOKED'))
);

CREATE INDEX idx_partner_conn_org
    ON partner_service_connections (organization_id);

CREATE UNIQUE INDEX uq_partner_conn_org_provider
    ON partner_service_connections (organization_id, provider_type);
