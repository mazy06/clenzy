-- Journal d'activité de la constellation Superviseur (feed + métriques réelles).
-- Une ligne par action observée d'un module (agent), org/property-scopée.
-- Alimentée d'abord par l'activité pendant un chat opérateur (pont AG-UI),
-- puis par la boucle de scan autonome (Phase 3-B.2).

CREATE TABLE IF NOT EXISTS supervision_activity (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT      NOT NULL,
    property_id     BIGINT      NOT NULL,
    module_key      VARCHAR(40) NOT NULL,
    kind            VARCHAR(20) NOT NULL DEFAULT 'ACT',
    tool_name       VARCHAR(120),
    summary         VARCHAR(500),
    reservation_id  BIGINT,
    created_at      TIMESTAMP   NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supervision_activity_org_prop_created
    ON supervision_activity (organization_id, property_id, created_at);
