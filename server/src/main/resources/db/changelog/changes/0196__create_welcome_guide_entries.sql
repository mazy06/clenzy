-- ============================================================================
-- 0196 : Livre d'or du livret d'accueil (welcome_guide_entries)
-- ============================================================================
-- Entree signee par un voyageur depuis le livret public. Entite dediee (pas
-- guest_reviews, couple a la synchro OTA). Liee au livret + a la reservation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS welcome_guide_entries (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT       NOT NULL,
    guide_id        BIGINT       NOT NULL,
    reservation_id  BIGINT,
    author_name     VARCHAR(200),
    message         TEXT,
    rating          INTEGER,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_welcome_guide_entries_guide_id ON welcome_guide_entries (guide_id);
CREATE INDEX IF NOT EXISTS idx_welcome_guide_entries_org_id   ON welcome_guide_entries (organization_id);
