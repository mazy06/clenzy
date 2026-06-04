-- ============================================================================
-- 0177 : Configuration plateforme Tuya (credentials du projet Tuya Cloud)
-- ============================================================================
-- Permet de configurer le projet Tuya (access_id / access_secret) DEPUIS l'UI au
-- lieu de variables d'environnement (plus de redeploiement). Singleton (1 ligne) :
-- credentials PLATEFORME (un projet Tuya pour tout Clenzy), NON org-scope. Le secret
-- est chiffre (AES-256-GCM, comme les tokens). Lu en DB-first, fallback env.
-- ============================================================================

CREATE TABLE tuya_platform_config (
    id                       BIGSERIAL PRIMARY KEY,
    access_id                VARCHAR(255),
    access_secret_encrypted  TEXT,
    base_url                 VARCHAR(255),
    region                   VARCHAR(20),
    updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by               VARCHAR(255)
);
