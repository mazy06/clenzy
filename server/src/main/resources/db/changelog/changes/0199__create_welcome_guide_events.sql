-- ============================================================================
-- 0199 : Analytics du livret (welcome_guide_events)
-- ============================================================================
-- Journal append-only des interactions guest sur la page publique du livret :
-- ouverture, clic activite, message chatbot, avis, clic check-in. Alimente les
-- statistiques cote hote (WelcomeGuideAnalyticsService). Toujours interroge par
-- guide_id + org explicite (pas de filtre tenant Hibernate sur cette table).
-- Idempotent (IF NOT EXISTS) pour cohabiter avec une table eventuellement
-- auto-creee par Hibernate en dev (ddl-auto=update).
-- ============================================================================

CREATE TABLE IF NOT EXISTS welcome_guide_events (
    id              BIGSERIAL   PRIMARY KEY,
    organization_id BIGINT      NOT NULL,
    guide_id        BIGINT      NOT NULL,
    reservation_id  BIGINT,
    event_type      VARCHAR(40) NOT NULL,
    detail          VARCHAR(255),
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wg_events_guide      ON welcome_guide_events (guide_id);
CREATE INDEX IF NOT EXISTS idx_wg_events_guide_type ON welcome_guide_events (guide_id, event_type);
CREATE INDEX IF NOT EXISTS idx_wg_events_created    ON welcome_guide_events (created_at);
