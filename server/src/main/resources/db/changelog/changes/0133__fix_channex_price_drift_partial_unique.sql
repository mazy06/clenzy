-- ============================================================================
-- 0133 : Fix unique constraint trop strict sur channex_price_drifts (Phase 5 audit)
-- ----------------------------------------------------------------------------
-- Bug : la contrainte uq_channex_price_drift_unresolved cree en 0131 etait
-- nommee "unresolved" mais n'avait pas de WHERE resolved_at IS NULL. Donc des
-- qu'un drift etait resolu pour (property=42, date=2026-07-15), TOUTE nouvelle
-- detection de drift sur la meme date crashait avec UNIQUE violation et le
-- watchdog echouait silencieusement.
--
-- Fix : drop la contrainte plain + cree un partial unique index qui n'unique
-- que les drifts non-resolus (resolved_at IS NULL). Cela permet :
--   - Plusieurs drifts historiques resolus sur la meme (property, date)
--   - Un seul drift actif a la fois par (property, date) ← comportement voulu
-- ============================================================================

-- Drop l'ancienne contrainte mal nommee
ALTER TABLE channex_price_drifts
    DROP CONSTRAINT IF EXISTS uq_channex_price_drift_unresolved;

-- Cree le partial unique index qui ne s'applique qu'aux drifts non-resolus
CREATE UNIQUE INDEX IF NOT EXISTS uq_channex_price_drift_active
    ON channex_price_drifts (clenzy_property_id, drift_date)
    WHERE resolved_at IS NULL;

COMMENT ON INDEX uq_channex_price_drift_active IS
    'Partial unique : empeche les doublons de drifts actifs par (property, date) '
    'tout en autorisant un historique de drifts resolus.';
