-- File de suggestions ORG-scopée de la constellation Superviseur.
-- Alimentée par les scans AUTONOMES (identité système, sans opérateur) : les
-- actions proposées y atterrissent pour atteindre les opérateurs (le store HITL
-- user-scopé ne convient pas hors d'un run opérateur). Informationnelles :
-- l'opérateur lit + agit, ou rejette (status DISMISSED).

CREATE TABLE IF NOT EXISTS supervision_suggestion (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT       NOT NULL,
    property_id     BIGINT       NOT NULL,
    module_key      VARCHAR(40)  NOT NULL,
    tool_name       VARCHAR(120),
    title           VARCHAR(300) NOT NULL,
    motif           VARCHAR(500),
    reservation_id  BIGINT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMP    NOT NULL,
    expires_at      TIMESTAMP    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supervision_suggestion_org_prop_status
    ON supervision_suggestion (organization_id, property_id, status);
