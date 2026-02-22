-- Migration V19: Ajout du champ completed_steps dans interventions
-- Date: 2026-01-26
-- Description: Ajoute un champ pour stocker les étapes complétées sous forme de JSON array

-- Ajouter la colonne completed_steps pour stocker les étapes complétées (format JSON array)
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS completed_steps TEXT;

-- Log de la migration
DO $$
BEGIN
    RAISE NOTICE 'Migration V19 terminée : Colonne completed_steps ajoutée à interventions';
END $$;
