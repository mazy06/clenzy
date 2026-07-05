-- ============================================================================
-- 0314 : Ventilation adultes / enfants sur les reservations
-- ============================================================================
-- La taxe de sejour francaise n'est due QUE par les adultes ; les mineurs en
-- sont exoneres. La reservation ne stockait qu'un total (guest_count), ce qui
-- rendait le champ exempt_minors de tourist_tax_configs sans effet (0311).
--
-- On ajoute deux colonnes NULLABLES :
--   - adults_count   : nombre d'adultes (personnes taxables)
--   - children_count : nombre d'enfants (potentiellement exoneres)
--
-- NULLABLE et NON backfille a dessein : NULL = ventilation inconnue → le calcul
-- de taxe retombe sur guest_count (comportement historique, zero regression).
-- Seuls les chemins qui CONNAISSENT la ventilation (imports OTA, widget booking,
-- saisie manuelle) alimentent ces colonnes ; la taxe ne baisse pour un sejour
-- que lorsque la ventilation est reellement connue ET exempt_minors actif.
-- guest_count reste le total autoritaire (capacite, affichage).
-- ============================================================================

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS adults_count INTEGER;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS children_count INTEGER;
