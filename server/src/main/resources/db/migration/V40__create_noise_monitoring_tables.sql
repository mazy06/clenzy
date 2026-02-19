-- ============================================================================
-- V40 : Tables pour l'integration monitoring sonore (Minut + Tuya)
-- ============================================================================

-- Connexions OAuth2 Minut
CREATE TABLE minut_connections (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    minut_user_id VARCHAR(255),
    organization_id VARCHAR(255),
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    scopes VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE UNIQUE INDEX idx_minut_conn_user_id ON minut_connections(user_id);
CREATE INDEX idx_minut_conn_status ON minut_connections(status);

-- Connexions Tuya Cloud API
CREATE TABLE tuya_connections (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    tuya_uid VARCHAR(255),
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE UNIQUE INDEX idx_tuya_conn_user_id ON tuya_connections(user_id);
CREATE INDEX idx_tuya_conn_status ON tuya_connections(status);

-- Capteurs de bruit configures (partage entre Minut et Tuya)
CREATE TABLE noise_devices (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    device_type VARCHAR(10) NOT NULL CHECK (device_type IN ('MINUT', 'TUYA')),
    name VARCHAR(255) NOT NULL,
    property_id BIGINT NOT NULL,
    room_name VARCHAR(255),
    external_device_id VARCHAR(255),
    external_home_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_noise_device_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX idx_noise_device_user_id ON noise_devices(user_id);
CREATE INDEX idx_noise_device_property_id ON noise_devices(property_id);
CREATE INDEX idx_noise_device_type ON noise_devices(device_type);
CREATE INDEX idx_noise_device_status ON noise_devices(status);
