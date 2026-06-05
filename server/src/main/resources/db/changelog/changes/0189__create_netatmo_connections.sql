-- ============================================================================
-- 0189 : Connexions OAuth Netatmo (integration API Connect)
-- ============================================================================
-- Une connexion par user/org vers le compte Netatmo (station meteo, thermostat,
-- securite). Tokens chiffres au repos (TokenEncryptionService). Calque sur
-- minut_connections. Le callback OAuth etant public, la resolution se fait par
-- user_id (unique).
-- ============================================================================

CREATE TABLE netatmo_connections (
    id                      BIGSERIAL PRIMARY KEY,
    user_id                 VARCHAR(255) NOT NULL,
    organization_id         BIGINT,
    access_token_encrypted  TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at        TIMESTAMP,
    scopes                  VARCHAR(500),
    status                  VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    connected_at            TIMESTAMP    NOT NULL,
    last_sync_at            TIMESTAMP,
    error_message           TEXT,
    created_at              TIMESTAMP    NOT NULL,
    updated_at              TIMESTAMP
);

CREATE UNIQUE INDEX idx_netatmo_conn_user_id ON netatmo_connections (user_id);
CREATE INDEX idx_netatmo_conn_status         ON netatmo_connections (status);
