-- ============================================================================
-- 0188 : Capteurs d'environnement generiques (temp/humidite, contact, mouvement, fumee)
-- ============================================================================
-- Un seul modele pour les 4 capteurs Tuya/Zigbee du catalogue absents du hub
-- (CLENZY-TH-01, DW-01, MO-01, SM-01). Le discriminant `sensor_type` evite 4
-- tables/services dupliques (DRY). L'etat est mis en cache et rafraichi via
-- l'API Tuya (meme pattern que thermostats / serrures). `online` NULL = jamais
-- synchronise. `last_alert_at` sert de cooldown anti-spam pour les alertes
-- fumee / mouvement.
-- ============================================================================

CREATE TABLE environment_sensors (
    id                 BIGSERIAL PRIMARY KEY,
    organization_id    BIGINT,
    user_id            VARCHAR(255) NOT NULL,
    name               VARCHAR(255) NOT NULL,
    property_id        BIGINT       NOT NULL,
    room_name          VARCHAR(255),
    sensor_type        VARCHAR(20)  NOT NULL,   -- TEMP_HUMIDITY | CONTACT | MOTION | SMOKE
    brand              VARCHAR(20)  DEFAULT 'TUYA',
    external_device_id VARCHAR(255),
    status             VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | INACTIVE | PENDING
    online             BOOLEAN,
    battery_level      INTEGER,
    temperature_c      NUMERIC(5,1),            -- TEMP_HUMIDITY
    humidity           INTEGER,                 -- TEMP_HUMIDITY
    contact_open       BOOLEAN,                 -- CONTACT (porte/fenetre ouverte)
    motion_detected    BOOLEAN,                 -- MOTION (presence detectee)
    smoke_detected     BOOLEAN,                 -- SMOKE (fumee/vape detectee)
    last_seen_at       TIMESTAMP,
    last_event_at      TIMESTAMP,               -- dernier changement d'etat detecte
    last_alert_at      TIMESTAMP,               -- derniere notification (cooldown)
    created_at         TIMESTAMP    NOT NULL,
    updated_at         TIMESTAMP
);

CREATE INDEX idx_environment_sensors_org_id      ON environment_sensors (organization_id);
CREATE INDEX idx_environment_sensors_property_id ON environment_sensors (property_id);
CREATE INDEX idx_environment_sensors_user_id     ON environment_sensors (user_id);
CREATE INDEX idx_environment_sensors_type        ON environment_sensors (sensor_type);
