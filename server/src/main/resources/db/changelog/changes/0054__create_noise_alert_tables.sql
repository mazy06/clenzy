-- ============================================================================
-- V58 : Tables for noise alert configuration and alert history
-- ============================================================================

-- Per-property noise alert configuration
CREATE TABLE noise_alert_configs (
    id                      BIGSERIAL PRIMARY KEY,
    organization_id         BIGINT NOT NULL,
    property_id             BIGINT NOT NULL,
    enabled                 BOOLEAN NOT NULL DEFAULT TRUE,

    -- Notification channels
    notify_in_app           BOOLEAN NOT NULL DEFAULT TRUE,
    notify_email            BOOLEAN NOT NULL DEFAULT TRUE,
    notify_guest_message    BOOLEAN NOT NULL DEFAULT FALSE,
    notify_whatsapp         BOOLEAN NOT NULL DEFAULT FALSE,
    notify_sms              BOOLEAN NOT NULL DEFAULT FALSE,

    -- Cooldown between alerts (minutes) to avoid spam
    cooldown_minutes        INT NOT NULL DEFAULT 30,

    -- Email recipients (comma-separated, nullable = use property owner)
    email_recipients        VARCHAR(1000),

    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP,

    CONSTRAINT fk_noise_alert_config_property
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT uq_noise_alert_config_property
        UNIQUE (organization_id, property_id)
);

CREATE INDEX idx_noise_alert_config_org ON noise_alert_configs(organization_id);
CREATE INDEX idx_noise_alert_config_property ON noise_alert_configs(property_id);

-- Time windows with per-window thresholds
CREATE TABLE noise_alert_time_windows (
    id                      BIGSERIAL PRIMARY KEY,
    config_id               BIGINT NOT NULL,
    label                   VARCHAR(100) NOT NULL,
    start_time              TIME NOT NULL,
    end_time                TIME NOT NULL,
    warning_threshold_db    INT NOT NULL DEFAULT 70,
    critical_threshold_db   INT NOT NULL DEFAULT 85,

    CONSTRAINT fk_noise_time_window_config
        FOREIGN KEY (config_id) REFERENCES noise_alert_configs(id) ON DELETE CASCADE
);

CREATE INDEX idx_noise_time_window_config ON noise_alert_time_windows(config_id);

-- Alert history (audit trail)
CREATE TABLE noise_alerts (
    id                      BIGSERIAL PRIMARY KEY,
    organization_id         BIGINT NOT NULL,
    property_id             BIGINT NOT NULL,
    device_id               BIGINT,
    severity                VARCHAR(20) NOT NULL CHECK (severity IN ('WARNING', 'CRITICAL')),
    measured_db             DOUBLE PRECISION NOT NULL,
    threshold_db            INT NOT NULL,
    time_window_label       VARCHAR(100),
    source                  VARCHAR(20) NOT NULL CHECK (source IN ('WEBHOOK', 'SCHEDULER', 'MANUAL')),

    -- Notification status
    notified_in_app         BOOLEAN NOT NULL DEFAULT FALSE,
    notified_email          BOOLEAN NOT NULL DEFAULT FALSE,
    notified_guest          BOOLEAN NOT NULL DEFAULT FALSE,
    notified_whatsapp       BOOLEAN NOT NULL DEFAULT FALSE,
    notified_sms            BOOLEAN NOT NULL DEFAULT FALSE,

    -- Resolution
    acknowledged            BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by         VARCHAR(255),
    acknowledged_at         TIMESTAMP,
    notes                   TEXT,

    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_noise_alert_property
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT fk_noise_alert_device
        FOREIGN KEY (device_id) REFERENCES noise_devices(id) ON DELETE SET NULL
);

CREATE INDEX idx_noise_alert_org ON noise_alerts(organization_id);
CREATE INDEX idx_noise_alert_property ON noise_alerts(property_id);
CREATE INDEX idx_noise_alert_device ON noise_alerts(device_id);
CREATE INDEX idx_noise_alert_severity ON noise_alerts(severity);
CREATE INDEX idx_noise_alert_created ON noise_alerts(created_at DESC);
CREATE INDEX idx_noise_alert_ack ON noise_alerts(acknowledged);
