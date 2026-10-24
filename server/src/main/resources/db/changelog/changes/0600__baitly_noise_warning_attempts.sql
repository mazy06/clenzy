-- Baitly: durable guest-warning fence. Internal references only; no contact or payload.
-- Existing table/columns checked against NoiseAlert, Reservation, Guest and changesets 0021/0037/0047/0054.
CREATE TABLE baitly_noise_warning_boundary (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_legacy_alert_id BIGINT NOT NULL CHECK (last_legacy_alert_id >= 0)
);
INSERT INTO baitly_noise_warning_boundary (id, last_legacy_alert_id)
    SELECT 1, COALESCE(MAX(id), 0) FROM noise_alerts;

CREATE TABLE baitly_noise_warning_attempts (
    alert_id BIGINT PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL,
    reservation_id BIGINT NOT NULL,
    guest_id BIGINT NOT NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL','WHATSAPP_META','WHATSAPP_OPENWA')),
    state VARCHAR(20) NOT NULL CHECK (state IN ('STARTED','UNKNOWN','ACCEPTED','REVIEW')),
    attempt UUID,
    receipt_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_baitly_noise_warning_state CHECK (
        (state='REVIEW' AND attempt IS NULL AND accepted_at IS NULL AND receipt_hash IS NULL)
        OR (state IN ('STARTED','UNKNOWN') AND attempt IS NOT NULL AND accepted_at IS NULL AND receipt_hash IS NULL)
        OR (state='ACCEPTED' AND attempt IS NOT NULL AND accepted_at IS NOT NULL
            AND ((channel='EMAIL' AND receipt_hash IS NULL) OR (channel<>'EMAIL' AND receipt_hash IS NOT NULL AND length(receipt_hash)=64)))
    )
);
-- Locking the reservation serializes all warning sources; this index bounds its history check.
CREATE INDEX idx_baitly_noise_warning_stay ON baitly_noise_warning_attempts (reservation_id, state, accepted_at);
CREATE INDEX idx_baitly_noise_warning_state ON baitly_noise_warning_attempts (state, updated_at);
