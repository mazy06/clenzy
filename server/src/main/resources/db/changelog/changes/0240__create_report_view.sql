-- Report builder (CLZ-P0-15) : vues de rapport sauvegardées, org-scopées.
-- dimensions/metrics = codes whitelistés (ReportFieldCatalog), pas de SQL utilisateur. Idempotent.
CREATE TABLE IF NOT EXISTS report_views (
    id                BIGSERIAL PRIMARY KEY,
    organization_id   BIGINT       NOT NULL,
    name              VARCHAR(120) NOT NULL,
    owner_keycloak_id VARCHAR(64),
    dimensions        VARCHAR(255) NOT NULL,
    metrics           VARCHAR(255) NOT NULL,
    filters_json      TEXT,
    granularity       VARCHAR(16)  NOT NULL DEFAULT 'MONTH',
    created_at        TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_view_org ON report_views (organization_id);
