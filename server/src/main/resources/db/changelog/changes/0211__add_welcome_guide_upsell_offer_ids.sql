-- ============================================================================
-- 0211 : Sélection des services affichés par livret (welcome_guides)
-- ============================================================================
-- Permet de choisir, pour CHAQUE livret, quels services payants (upsells) de
-- l'org afficher — au lieu d'un affichage « tout ou rien ».
--   NULL          → afficher TOUS les services applicables (défaut, rétro-compat ;
--                   les nouveaux services apparaissent automatiquement).
--   JSON array    → afficher exactement ces ids d'offres (intersecté avec les
--                   offres actives applicables au logement du livret).
-- Colonne JSONB nullable (le NULL porte la sémantique « tous »). Idempotent.
-- ============================================================================

ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS upsell_offer_ids JSONB;
