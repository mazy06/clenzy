-- ============================================================================
-- 0207 : Photo de couverture unique → carrousel multi-photos (welcome_guides)
-- ============================================================================
-- Le hero du livret passe d'UNE photo (`hero_photo_id`, 0206) à PLUSIEURS, affichées
-- en carrousel cote guest. On stocke un JSON array d'ids de property_photos
-- (`hero_photo_ids`, pass-through JSONB comme pois/sections/curated_activities).
-- La selection unique existante est preservee en tableau 1-element, puis l'ancienne
-- colonne est supprimee. Idempotent (IF [NOT] EXISTS) pour cohabiter avec dev.
-- ============================================================================

ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS hero_photo_ids JSONB NOT NULL DEFAULT '[]';

-- Migre l'ancienne selection unique (0206) en tableau 1-element (no-op si la colonne
-- 0206 n'a jamais ete renseignee). Le ADD COLUMN 0206 precede toujours ce changeset.
UPDATE welcome_guides
   SET hero_photo_ids = jsonb_build_array(hero_photo_id)
 WHERE hero_photo_id IS NOT NULL
   AND (hero_photo_ids IS NULL OR hero_photo_ids = '[]'::jsonb);

ALTER TABLE welcome_guides DROP COLUMN IF EXISTS hero_photo_id;
