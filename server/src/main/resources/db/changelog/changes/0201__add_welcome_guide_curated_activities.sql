-- ============================================================================
-- 0201 : Curation d'activités par l'hôte (welcome_guides.curated_activities)
-- ============================================================================
-- L'hôte choisit quelles activités afficher sur SON livret et lesquelles mettre
-- en avant. Stocké en JSONB (pass-through comme `pois`/`sections`) :
--   [{id, source, externalId, title, imageUrl, price, bookingUrl, description, featured}]
-- `source` ('MANUAL' aujourd'hui ; 'VIATOR'/'GETYOURGUIDE'/'KLOOK' quand les clés
-- fournisseurs seront live) + `externalId` rendent le modèle forward-compatible
-- avec une sélection depuis le pool fournisseur. Défaut '[]' pour l'existant.
-- Idempotent (IF NOT EXISTS) pour cohabiter avec une colonne auto-créée par
-- Hibernate en dev (ddl-auto=update).
-- ============================================================================

ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS curated_activities JSONB NOT NULL DEFAULT '[]';
