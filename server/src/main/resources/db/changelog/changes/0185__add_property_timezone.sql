-- ============================================================================
-- 0185 : Fuseau horaire par logement (properties.timezone)
-- ============================================================================
-- Pilote la fenetre de validite des codes d'acces serrure en heure LOCALE du
-- logement (ex: Africa/Casablanca pour Marrakech) au lieu de l'heure serveur.
-- DEFAULT 'Europe/Paris' : Postgres remplit aussi les lignes existantes.
-- ============================================================================

ALTER TABLE properties ADD COLUMN timezone VARCHAR(64) DEFAULT 'Europe/Paris';
