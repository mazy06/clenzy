-- ============================================================================
-- 0208 : Message d'accueil dédié du livret (welcome_guides)
-- ============================================================================
-- Le design "welcome book" prévoit une note d'accueil personnelle de l'hôte
-- (message + signature), affichée en serif italique sous le hero — distincte des
-- sections éditoriales. On ajoute deux colonnes nullables :
--   welcome_message : le mot d'accueil (texte libre).
--   host_names      : la signature (ex: "Camille & Antoine"), affichée au-dessus.
-- Idempotent (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS host_names VARCHAR(200);
