-- Baitly: minimal durable Minut progress; no payload, provider id or secret is retained.
CREATE TABLE baitly_minut_events (
    id UUID PRIMARY KEY,
    event_key VARCHAR(64) NOT NULL UNIQUE,
    fingerprint VARCHAR(64) NOT NULL,
    organization_id BIGINT NOT NULL,
    device_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('DISTURBANCE','OFFLINE','ONLINE')),
    measured_db DOUBLE PRECISION,
    transitioned BOOLEAN NOT NULL,
    next_step INTEGER NOT NULL DEFAULT 0 CHECK (next_step BETWEEN 0 AND 2),
    state VARCHAR(12) NOT NULL CHECK (state IN ('READY','STARTED','DONE','UNKNOWN','SUPERSEDED','REVIEW')),
    attempt UUID,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((state IN ('STARTED','UNKNOWN') AND attempt IS NOT NULL)
        OR (state IN ('READY','DONE','SUPERSEDED','REVIEW') AND attempt IS NULL)),
    CHECK ((event_type = 'DISTURBANCE' AND measured_db IS NOT NULL AND measured_db > 0 AND measured_db < 'Infinity'::float8)
        OR (event_type <> 'DISTURBANCE' AND measured_db IS NULL))
);
CREATE INDEX idx_baitly_minut_events_ready ON baitly_minut_events (state, updated_at, id);

-- Only a real local transition replaces the episode; duplicate offline reports do not.
CREATE TABLE baitly_minut_device_cursor (
    device_id BIGINT PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    event_id UUID NOT NULL REFERENCES baitly_minut_events(id)
);

-- Historical messages have no durable proof from the former consumer: never auto-replay them.
CREATE TABLE baitly_minut_recovery_boundary (
    id INTEGER PRIMARY KEY CHECK (id=1),
    not_before TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO baitly_minut_recovery_boundary (id) VALUES (1);
