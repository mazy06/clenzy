-- 0169 : Integration marketing (Brevo) au niveau plateforme.
-- Table marketing_integration : connexion API marketing — Brevo aujourd'hui,
-- extensible (Mailchimp, etc.) via la colonne provider. La cle API est chiffree
-- AES-256 via EncryptedFieldConverter cote JPA (jamais stockee en clair).
-- Remplace la config par variables d'env / secret (.env, PROD_ENV_FILE_B64).
CREATE TABLE IF NOT EXISTS marketing_integration (
    id                       BIGSERIAL PRIMARY KEY,
    provider                 VARCHAR(30)  NOT NULL,
    api_key_encrypted        TEXT,
    waitlist_list_id         BIGINT,
    newsletter_list_id       BIGINT,
    prospects_list_id        BIGINT,
    sync_waitlist_enabled    BOOLEAN      NOT NULL DEFAULT TRUE,
    sync_newsletter_enabled  BOOLEAN      NOT NULL DEFAULT TRUE,
    sync_prospects_enabled   BOOLEAN      NOT NULL DEFAULT TRUE,
    sync_attributes_enabled  BOOLEAN      NOT NULL DEFAULT TRUE,
    status                   VARCHAR(20)  NOT NULL DEFAULT 'UNCONFIGURED',
    error_message            TEXT,
    last_tested_at           TIMESTAMP,
    created_at               TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at               TIMESTAMP    NOT NULL DEFAULT now(),
    updated_by               VARCHAR(255),
    CONSTRAINT uq_marketing_integration_provider UNIQUE (provider)
);

-- Ligne par defaut Brevo (non configuree). Migration progressive depuis les
-- variables d'env BREVO_API_KEY / BREVO_WAITLIST_LIST_ID : le service lira
-- d'abord la BDD, puis retombera sur l'env tant que la BDD n'est pas renseignee.
INSERT INTO marketing_integration (provider, status)
VALUES ('BREVO', 'UNCONFIGURED')
ON CONFLICT (provider) DO NOTHING;
