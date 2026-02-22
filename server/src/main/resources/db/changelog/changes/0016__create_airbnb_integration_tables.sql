-- Migration V20: Creation des tables pour l'integration Airbnb Partner
-- Date: 2026-02-11
-- Description: Tables pour la connexion OAuth, les webhooks et le mapping listings Airbnb

-- ====================================================================
-- Table 1 : airbnb_connections
-- Stocke les connexions OAuth2 entre utilisateurs Clenzy et comptes Airbnb
-- Les tokens sont chiffres en AES-256 via Jasypt avant stockage
-- ====================================================================
CREATE TABLE IF NOT EXISTS airbnb_connections (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    airbnb_user_id VARCHAR(255),
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    scopes VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_sync_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Index unique sur user_id (1 connexion Airbnb par utilisateur Clenzy)
CREATE UNIQUE INDEX IF NOT EXISTS idx_airbnb_conn_user_id ON airbnb_connections(user_id);
-- Index pour recherche par airbnb_user_id
CREATE INDEX IF NOT EXISTS idx_airbnb_conn_airbnb_user_id ON airbnb_connections(airbnb_user_id);

-- Contrainte de check sur le statut
ALTER TABLE airbnb_connections ADD CONSTRAINT chk_airbnb_conn_status
    CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED', 'ERROR'));

-- ====================================================================
-- Table 2 : airbnb_webhook_events
-- Stocke les evenements webhook bruts recus d'Airbnb
-- Supporte l'idempotence via eventId unique et le retry
-- ====================================================================
CREATE TABLE IF NOT EXISTS airbnb_webhook_events (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    payload TEXT,
    signature VARCHAR(512),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    received_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index unique pour idempotence (pas de traitement en double)
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_event_id ON airbnb_webhook_events(event_id);
-- Index composite pour le monitoring (type + statut)
CREATE INDEX IF NOT EXISTS idx_webhook_event_type_status ON airbnb_webhook_events(event_type, status);
-- Index pour le nettoyage par date
CREATE INDEX IF NOT EXISTS idx_webhook_received_at ON airbnb_webhook_events(received_at);

-- Contrainte de check sur le statut
ALTER TABLE airbnb_webhook_events ADD CONSTRAINT chk_webhook_status
    CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'));

-- ====================================================================
-- Table 3 : airbnb_listing_mappings
-- Lie une propriete Clenzy a un listing Airbnb
-- Gere les parametres de synchronisation
-- ====================================================================
CREATE TABLE IF NOT EXISTS airbnb_listing_mappings (
    id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL,
    airbnb_listing_id VARCHAR(255) NOT NULL,
    airbnb_listing_title VARCHAR(500),
    airbnb_listing_url VARCHAR(1000),
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_create_interventions BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP,
    CONSTRAINT fk_listing_map_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

-- Index sur property_id pour les requetes de listing par propriete
CREATE INDEX IF NOT EXISTS idx_listing_map_property_id ON airbnb_listing_mappings(property_id);
-- Index unique sur airbnb_listing_id (1 listing Airbnb = 1 propriete Clenzy)
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_map_airbnb_listing_id ON airbnb_listing_mappings(airbnb_listing_id);

-- ====================================================================
-- Log de la migration
-- ====================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration V20 terminee : Tables airbnb_connections, airbnb_webhook_events, airbnb_listing_mappings creees';
END $$;
