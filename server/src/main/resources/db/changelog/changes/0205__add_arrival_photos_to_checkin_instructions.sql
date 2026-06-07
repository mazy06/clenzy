-- ============================================================================
-- 0205 : Photos d'indication d'acces (check_in_instructions.arrival_photos)
-- ============================================================================
-- Photos pour aider le voyageur a trouver / acceder au logement, stockees en
-- JSONB : [{key, caption}] ou `key` est une cle PhotoStorageService (S3 ou
-- BYTEA). Servies a la page guest via un endpoint public token-scope. Pass-
-- through cote backend (comme welcome_guides.pois). Defaut '[]' = aucune photo
-- pour les instructions existantes. Idempotent (IF NOT EXISTS) pour cohabiter
-- avec une colonne eventuellement auto-creee par Hibernate en dev (ddl-auto=update).
-- ============================================================================

ALTER TABLE check_in_instructions ADD COLUMN IF NOT EXISTS arrival_photos JSONB NOT NULL DEFAULT '[]';
