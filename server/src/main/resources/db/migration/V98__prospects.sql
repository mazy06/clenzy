-- ============================================================================
-- V98 : Table prospects — Prospection B2B
-- ============================================================================

CREATE TABLE prospects (
    id              BIGSERIAL       PRIMARY KEY,
    organization_id BIGINT          NOT NULL REFERENCES organizations(id),
    name            VARCHAR(255)    NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(50),
    city            VARCHAR(255),
    specialty       VARCHAR(255),
    category        VARCHAR(50)     NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'TO_CONTACT',
    notes           TEXT,
    website         VARCHAR(500),
    linked_in       VARCHAR(500),
    revenue         VARCHAR(100),
    employees       VARCHAR(50),
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prospects_org      ON prospects(organization_id);
CREATE INDEX idx_prospects_category ON prospects(category);
CREATE INDEX idx_prospects_status   ON prospects(status);
