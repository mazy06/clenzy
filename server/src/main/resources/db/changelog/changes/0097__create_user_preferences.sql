-- Table des preferences utilisateur (timezone, devise, langue, notifications)
-- Remplace les settings localStorage qui n'avaient pas de persistence serveur.

CREATE TABLE IF NOT EXISTS user_preferences (
    id              BIGSERIAL PRIMARY KEY,
    keycloak_id     VARCHAR(255) NOT NULL,
    organization_id BIGINT,

    -- Business preferences
    timezone        VARCHAR(50)  NOT NULL DEFAULT 'Europe/Paris',
    currency        VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    language        VARCHAR(5)   NOT NULL DEFAULT 'fr',

    -- Notification global toggles
    notify_email    BOOLEAN NOT NULL DEFAULT TRUE,
    notify_push     BOOLEAN NOT NULL DEFAULT FALSE,
    notify_sms      BOOLEAN NOT NULL DEFAULT FALSE,

    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_user_preferences_keycloak UNIQUE (keycloak_id)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_org ON user_preferences(organization_id);
