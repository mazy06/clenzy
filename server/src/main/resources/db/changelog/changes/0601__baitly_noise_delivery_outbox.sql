-- Baitly: committed work before the first delegation. No address, message or raw receipt.
-- Names verified against NoiseAlert/Config, Property, User, Reservation and Guest plus 0054/0037/0021.
CREATE TABLE baitly_noise_delivery_boundary (
    id INTEGER PRIMARY KEY CHECK (id=1),
    last_legacy_alert_id BIGINT NOT NULL
);
INSERT INTO baitly_noise_delivery_boundary SELECT 1, COALESCE(MAX(id),0) FROM noise_alerts;

CREATE TABLE baitly_noise_deliveries (
    alert_id BIGINT PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL,
    config_id BIGINT NOT NULL,
    config_version TIMESTAMP,
    property_version TIMESTAMP,
    owner_id BIGINT,
    owner_version TIMESTAMP,
    reservation_id BIGINT,
    guest_id BIGINT,
    guest_version TIMESTAMP,
    measured_db DOUBLE PRECISION NOT NULL,
    threshold_db INTEGER NOT NULL,
    severity VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '15' MINUTE
);
CREATE TABLE baitly_noise_delivery_items (
    alert_id BIGINT NOT NULL REFERENCES baitly_noise_deliveries(alert_id),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('GUEST','OWNER_EMAIL','OWNER_IN_APP')),
    ordinal INTEGER NOT NULL CHECK (ordinal>=0),
    state VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','STARTED','UNKNOWN','ACCEPTED','SKIPPED')),
    attempt UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    next_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (alert_id,channel,ordinal),
    CONSTRAINT ck_baitly_noise_delivery_attempt CHECK (
        (channel='OWNER_EMAIL' AND ((state IN ('STARTED','UNKNOWN','ACCEPTED') AND attempt IS NOT NULL)
            OR (state IN ('PENDING','SKIPPED') AND attempt IS NULL)))
        OR (channel<>'OWNER_EMAIL' AND attempt IS NULL AND state<>'STARTED')
    )
);
CREATE INDEX idx_baitly_noise_delivery_ready ON baitly_noise_delivery_items (state,next_at,alert_id);
