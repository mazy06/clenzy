-- ============================================================================
-- 0119 : Table docusign_connections pour l'integration OAuth2 DocuSign
-- ============================================================================
-- DocuSign utilise OAuth2 (Authorization Code Grant) comme Pennylane.
-- Structure parallele a pennylane_connections — partage le pattern via
-- l'interface OAuthConnectionLike + le moteur OAuthFlowEngine cote Java.
--
-- Pourquoi pas une table unique oauth_connections discriminee par provider ?
--   - Chaque provider OAuth a des champs business specifiques :
--       Pennylane : pennylane_company_id, last_sync_at
--       DocuSign  : account_id, account_base_uri (geo-dependant)
--     Une table unique forcerait des colonnes NULL pour la moitie des rows.
--   - La mutualisation se fait au niveau LOGIQUE (OAuthFlowEngine) et non
--     au niveau persistance — chaque entite reste maitresse de sa structure
--     (Single Responsibility Principle).
--   - Si on standardise un jour les champs, la migration sera triviale via
--     Liquibase (CREATE oauth_connections + INSERT-SELECT).
--
-- Contraintes :
--   - Une seule connexion DocuSign active par organisation (UNIQUE sur
--     organization_id, partial sur status = 'ACTIVE' n'est pas necessaire car
--     la logique applicative empeche les rows simultanees).
--   - Filtre Hibernate organizationFilter applique automatiquement.
-- ============================================================================

CREATE TABLE docusign_connections (
    id                          BIGSERIAL PRIMARY KEY,
    organization_id             BIGINT NOT NULL,
    user_id                     BIGINT NOT NULL,
    access_token_encrypted      TEXT,
    refresh_token_encrypted     TEXT,
    token_expires_at            TIMESTAMP,
    refresh_token_expires_at    TIMESTAMP,
    scopes                      VARCHAR(500),
    account_id                  VARCHAR(100),
    account_base_uri            VARCHAR(500),
    status                      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    error_message               TEXT,
    connected_at                TIMESTAMP,
    created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT docusign_connections_status_check
        CHECK (status IN ('ACTIVE','EXPIRED','ERROR','REVOKED'))
);

CREATE INDEX idx_docusign_connections_org
    ON docusign_connections (organization_id);

-- Une seule connexion DocuSign par organisation (multi-tenant)
CREATE UNIQUE INDEX uq_docusign_connections_org
    ON docusign_connections (organization_id);
