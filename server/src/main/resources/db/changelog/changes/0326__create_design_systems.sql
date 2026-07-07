-- Systèmes de design réutilisables (direction de design Baitly, inspiré d'open-design).
-- Un système = tokens --bt-* + un DESIGN.md (prose : atmosphère, palette, typo, voix & ton…) + source.
-- organization_id NULL = catalogue GLOBAL (staff plateforme) ; sinon privé à l'organisation.

CREATE TABLE design_systems (
    id               BIGSERIAL PRIMARY KEY,
    organization_id  BIGINT,
    name             VARCHAR(120) NOT NULL,
    category         VARCHAR(60),
    description      VARCHAR(500),
    status           VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    tokens_json      TEXT,          -- map --bt-* (contrat de tokens unifié)
    design_markdown  TEXT,          -- le DESIGN.md (prose de direction)
    source_type      VARCHAR(20),   -- MANUAL | BRAND | PASTE | URL
    source_ref       VARCHAR(1000), -- URL analysée / référence de la source (le cas échéant)
    created_by       VARCHAR(64),
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_design_systems_org ON design_systems (organization_id);
CREATE INDEX idx_design_systems_status ON design_systems (status);
