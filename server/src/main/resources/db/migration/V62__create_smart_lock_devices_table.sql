-- ============================================================================
-- V62 : Table pour les serrures connectees (Tuya Smart Lock)
-- ============================================================================

CREATE TABLE smart_lock_devices (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    property_id BIGINT NOT NULL,
    room_name VARCHAR(255),
    external_device_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    lock_state VARCHAR(20) DEFAULT 'UNKNOWN',
    battery_level INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_smart_lock_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX idx_smart_lock_user_id ON smart_lock_devices(user_id);
CREATE INDEX idx_smart_lock_property_id ON smart_lock_devices(property_id);
CREATE INDEX idx_smart_lock_status ON smart_lock_devices(status);
CREATE INDEX idx_smart_lock_org_id ON smart_lock_devices(organization_id);
