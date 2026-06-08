-- ============================================================================
-- 0213 : Livret d'accueil rattaché à une réservation
-- ============================================================================
-- Un livret est désormais lié à une réservation précise :
--   - reservation_id NULL = livret « orphelin » (ancien modèle par logement) →
--     servi côté voyageur comme « non disponible » (réservation requise / révolue).
--   - Un seul livret par réservation : index unique partiel sur reservation_id.
-- FK ON DELETE SET NULL : si la réservation est supprimée, le livret devient
-- orphelin (non disponible) plutôt que supprimé. Idempotent.
-- ============================================================================

ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS reservation_id BIGINT;

ALTER TABLE welcome_guides DROP CONSTRAINT IF EXISTS fk_welcome_guides_reservation;
ALTER TABLE welcome_guides
    ADD CONSTRAINT fk_welcome_guides_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_welcome_guides_reservation
    ON welcome_guides(reservation_id) WHERE reservation_id IS NOT NULL;
