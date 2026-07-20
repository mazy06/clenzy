-- Fondations RMS (R1) : funnel du booking engine — telemetrie de demande capturee
-- SERVER-SIDE sur les endpoints publics existants (aucun nouvel endpoint public).
-- L'evenement cle est SEARCH_NO_RESULT : dates demandees sans disponibilite
-- (denied demand) — le signal de demande que les RMS a scraping ne voient pas.
-- Les conversions finales se lisent dans reservations (source direct, confirmee) :
-- pas d'evenement de succes duplique. Payload JSONB sans PII par construction
-- (cles whitelistees a l'ecriture). Retention 13 mois (purge scheduler).
CREATE TABLE booking_funnel_events (
    id               BIGSERIAL   PRIMARY KEY,
    organization_id  BIGINT      NOT NULL,
    engine_config_id BIGINT,
    session_key      VARCHAR(64),
    event_type       VARCHAR(24) NOT NULL,
    property_id      BIGINT,
    payload          JSONB,
    occurred_at      TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE INDEX idx_bfe_org_time ON booking_funnel_events (organization_id, occurred_at);
CREATE INDEX idx_bfe_type ON booking_funnel_events (event_type);
