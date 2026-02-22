-- Migration V16: Extension des colonnes before_photos_urls et after_photos_urls à TEXT
-- Date: 2026-01-26
-- Description: Modifie les colonnes before_photos_urls et after_photos_urls de VARCHAR(255) à TEXT
--              pour permettre le stockage de longues URLs base64 des photos

-- Modifier la colonne before_photos_urls de VARCHAR(255) à TEXT
ALTER TABLE interventions ALTER COLUMN before_photos_urls TYPE TEXT;

-- Modifier la colonne after_photos_urls de VARCHAR(255) à TEXT
ALTER TABLE interventions ALTER COLUMN after_photos_urls TYPE TEXT;

-- Log de la migration
DO $$
BEGIN
    RAISE NOTICE 'Migration V16 terminée : Colonnes before_photos_urls et after_photos_urls étendues à TEXT';
END $$;
