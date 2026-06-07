-- ============================================================================
-- 0200 : "Autour de moi" structure (welcome_guides.pois)
-- ============================================================================
-- Points d'interet structures du livret (restaurants, transports, attractions…)
-- stockes en JSONB : [{id, category, name, address, lat, lng, note}]. Affiches
-- sur la page guest avec carte + pins par categorie. Pass-through cote backend
-- (comme la colonne `sections`). Defaut '[]' = aucun POI pour les livrets existants.
-- Idempotent (IF NOT EXISTS) pour cohabiter avec une colonne eventuellement
-- auto-creee par Hibernate en dev (ddl-auto=update).
-- ============================================================================

ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS pois JSONB NOT NULL DEFAULT '[]';
