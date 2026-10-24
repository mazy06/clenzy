-- Baitly: permanent scope fences. No provider payload, contact, PIN or exception.
CREATE TABLE baitly_external_effect_guards (
    organization_id BIGINT NOT NULL,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('LOCK','REPORT')),
    resource_id BIGINT NOT NULL,
    PRIMARY KEY (organization_id, kind, resource_id)
);
CREATE TABLE baitly_external_effect_attempts (
    organization_id BIGINT NOT NULL,
    kind VARCHAR(16) NOT NULL,
    resource_id BIGINT NOT NULL,
    operation VARCHAR(16) NOT NULL CHECK (operation IN ('CREATE','ROTATE','REVOKE','SEND')),
    occurrence VARCHAR(80) NOT NULL,
    attempt_token UUID NOT NULL UNIQUE,
    state VARCHAR(16) NOT NULL CHECK (state IN ('STARTED','UNKNOWN','DONE')),
    attempted_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    effect_ref_id BIGINT,
    completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
    PRIMARY KEY (organization_id, kind, resource_id, operation, occurrence),
    FOREIGN KEY (organization_id, kind, resource_id)
        REFERENCES baitly_external_effect_guards(organization_id, kind, resource_id),
    CHECK ((state = 'DONE') = (completed_at IS NOT NULL)),
    CHECK (state <> 'DONE' OR effect_ref_id IS NOT NULL),
    CHECK ((kind = 'REPORT' AND operation = 'SEND') OR (kind = 'LOCK' AND operation IN ('CREATE','ROTATE','REVOKE'))),
    CHECK (effect_ref_id IS NULL OR effect_ref_id > 0)
);
