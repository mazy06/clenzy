-- Assisted review only: these items are never consumed by the background geocoding worker.
CREATE TABLE baitly_crm_location_review (
    organization_id BIGINT NOT NULL,
    actor VARCHAR(255) NOT NULL,
    prospect_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CONFIRMED', 'SKIPPED', 'NOT_FOUND')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, actor, prospect_id),
    FOREIGN KEY (organization_id, prospect_id) REFERENCES prospects(organization_id, id) ON DELETE CASCADE
);
