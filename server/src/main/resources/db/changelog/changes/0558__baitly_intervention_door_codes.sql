CREATE TABLE baitly_intervention_door_codes (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    intervention_id BIGINT NOT NULL REFERENCES interventions(id),
    property_id BIGINT NOT NULL REFERENCES properties(id),
    device_id BIGINT NOT NULL REFERENCES smart_lock_devices(id),
    code TEXT,
    external_code_id VARCHAR(255),
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','ACTIVE','FAILED')),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT baitly_intervention_door_unique UNIQUE (intervention_id,device_id),
    CONSTRAINT baitly_intervention_door_window CHECK (valid_until>valid_from)
);
