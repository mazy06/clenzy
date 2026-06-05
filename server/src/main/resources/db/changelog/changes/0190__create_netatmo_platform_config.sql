-- ============================================================================
-- 0190 : Configuration plateforme Netatmo (credentials OAuth, editables depuis l'UI)
-- ============================================================================
-- Singleton (une seule ligne) : credentials de l'app Netatmo (une app pour tout
-- Clenzy). NON org-scopee. client_secret chiffre (TokenEncryptionService), jamais
-- renvoye au front. Remplace les variables d'environnement NETATMO_* : la config
-- est desormais saisie + persistee chiffree, modifiable sans redeploiement.
-- Meme pattern que tuya_platform_config.
-- ============================================================================

CREATE TABLE netatmo_platform_config (
    id                      BIGSERIAL PRIMARY KEY,
    client_id               VARCHAR(255),
    client_secret_encrypted TEXT,
    redirect_uri            VARCHAR(500),
    updated_at              TIMESTAMP    NOT NULL,
    updated_by              VARCHAR(255)
);
