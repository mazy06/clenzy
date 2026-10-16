CREATE TABLE baitly_iot_devices (
    id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL CHECK (organization_id > 0),
    property_id BIGINT NOT NULL CHECK (property_id > 0),
    name VARCHAR(120) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    reporting_interval_seconds INTEGER NOT NULL CHECK (reporting_interval_seconds BETWEEN 10 AND 3600),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_received_at TIMESTAMP WITH TIME ZONE,
    last_measured_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_baitly_iot_devices_org ON baitly_iot_devices (organization_id, property_id);

CREATE TABLE baitly_iot_noise_measurements (
    device_id UUID NOT NULL REFERENCES baitly_iot_devices(id),
    event_id UUID NOT NULL,
    measured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    window_seconds INTEGER NOT NULL CHECK (window_seconds BETWEEN 1 AND 300),
    laeq_db_a DOUBLE PRECISION NOT NULL CHECK (laeq_db_a BETWEEN 0 AND 150),
    PRIMARY KEY (device_id, event_id)
);
CREATE INDEX idx_baitly_iot_noise_time ON baitly_iot_noise_measurements (device_id, measured_at, event_id);
