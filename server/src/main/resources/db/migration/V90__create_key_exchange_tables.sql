-- ============================================================================
-- V90 : Tables pour la gestion des echanges de cles (KeyNest + Clenzy KeyVault)
-- ============================================================================

-- Points d'echange (commercants partenaires ou stores KeyNest)
CREATE TABLE key_exchange_points (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    user_id         VARCHAR(255) NOT NULL,
    property_id     BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    provider        VARCHAR(20) NOT NULL,            -- KEYNEST | CLENZY_KEYVAULT
    provider_store_id VARCHAR(100),                  -- ID externe KeyNest du store
    store_name      VARCHAR(255) NOT NULL,
    store_address   TEXT,
    store_phone     VARCHAR(50),
    store_lat       DOUBLE PRECISION,
    store_lng       DOUBLE PRECISION,
    store_opening_hours TEXT,                        -- JSON ou texte libre
    verification_token VARCHAR(100),                 -- Token unique pour la page publique de verification
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    config_json     TEXT,                            -- Config specifique (plan KeyNest, etc.)
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP
);

CREATE INDEX idx_kep_org        ON key_exchange_points(organization_id);
CREATE INDEX idx_kep_user       ON key_exchange_points(user_id);
CREATE INDEX idx_kep_property   ON key_exchange_points(property_id);
CREATE INDEX idx_kep_provider   ON key_exchange_points(provider);
CREATE INDEX idx_kep_status     ON key_exchange_points(status);
CREATE INDEX idx_kep_token      ON key_exchange_points(verification_token);

-- Codes d'echange (codes de collecte / depot)
CREATE TABLE key_exchange_codes (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    point_id        BIGINT NOT NULL REFERENCES key_exchange_points(id) ON DELETE CASCADE,
    property_id     BIGINT NOT NULL,
    reservation_id  BIGINT,                          -- Lien optionnel a une reservation
    guest_name      VARCHAR(255),
    code            VARCHAR(100) NOT NULL,
    code_type       VARCHAR(20) NOT NULL,            -- COLLECTION | DROP_OFF
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, USED, EXPIRED, CANCELLED
    valid_from      TIMESTAMP,
    valid_until     TIMESTAMP,
    collected_at    TIMESTAMP,
    returned_at     TIMESTAMP,
    provider_code_id VARCHAR(100),                   -- ID externe KeyNest
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP
);

CREATE INDEX idx_kec_org         ON key_exchange_codes(organization_id);
CREATE INDEX idx_kec_point       ON key_exchange_codes(point_id);
CREATE INDEX idx_kec_property    ON key_exchange_codes(property_id);
CREATE INDEX idx_kec_reservation ON key_exchange_codes(reservation_id);
CREATE INDEX idx_kec_status      ON key_exchange_codes(status);
CREATE INDEX idx_kec_created     ON key_exchange_codes(created_at DESC);

-- Evenements d'echange (historique des mouvements de cles)
CREATE TABLE key_exchange_events (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    code_id         BIGINT REFERENCES key_exchange_codes(id) ON DELETE SET NULL,
    point_id        BIGINT REFERENCES key_exchange_points(id) ON DELETE SET NULL,
    property_id     BIGINT NOT NULL,
    event_type      VARCHAR(30) NOT NULL,            -- KEY_DEPOSITED, KEY_COLLECTED, KEY_RETURNED, CODE_GENERATED, CODE_CANCELLED, CODE_EXPIRED
    actor_name      VARCHAR(255),                    -- Nom du voyageur ou commercant
    notes           TEXT,
    source          VARCHAR(20) NOT NULL DEFAULT 'MANUAL',  -- MANUAL, WEBHOOK, API_POLL, PUBLIC_PAGE
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kee_org      ON key_exchange_events(organization_id);
CREATE INDEX idx_kee_property ON key_exchange_events(property_id);
CREATE INDEX idx_kee_point    ON key_exchange_events(point_id);
CREATE INDEX idx_kee_code     ON key_exchange_events(code_id);
CREATE INDEX idx_kee_type     ON key_exchange_events(event_type);
CREATE INDEX idx_kee_created  ON key_exchange_events(created_at DESC);
