-- ============================================================================
-- 0197 : Config d'affiliation des providers d'activites (Viator/GYG/Klook)
-- ============================================================================
-- Une ligne par (organization_id, provider). Cle API chiffree au repos
-- (EncryptedFieldConverter, colonne TEXT). `enabled` = provider actif sur le
-- livret. Sans cle, le client provider est inerte (renvoie une liste vide).
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_affiliate_configs (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id BIGINT       NOT NULL,
    provider        VARCHAR(30)  NOT NULL,
    api_key         TEXT,
    affiliate_id    VARCHAR(200),
    enabled         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_aff_org_provider
    ON activity_affiliate_configs (organization_id, provider);
