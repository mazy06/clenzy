-- ============================================================================
-- 0175 : Thermostats (Phase 2 — confort thermique, provider Tuya)
-- ============================================================================
-- Table org-scopee. Reutilise l'integration Tuya existante (external_device_id
-- = device Tuya). Les valeurs (temp/humidite/mode) sont mises en cache et
-- rafraichies a la demande via l'API Tuya (meme pattern que smart_lock_devices).
-- ============================================================================

CREATE TABLE thermostats (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL,
    user_id             VARCHAR(255) NOT NULL,
    name                VARCHAR(255) NOT NULL,
    property_id         BIGINT NOT NULL,
    room_name           VARCHAR(255),
    brand               VARCHAR(20) DEFAULT 'TUYA',
    external_device_id  VARCHAR(255),
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING')),
    current_temp_c      NUMERIC(4,1),
    target_temp_c       NUMERIC(4,1),
    humidity            INTEGER,
    mode                VARCHAR(20),
    preset              VARCHAR(50),
    last_seen_at        TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP
);

CREATE INDEX idx_thermostats_org_id ON thermostats(organization_id);
CREATE INDEX idx_thermostats_property_id ON thermostats(property_id);
CREATE INDEX idx_thermostats_user_id ON thermostats(user_id);
