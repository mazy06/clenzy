-- Migration V18: Ajout du champ validated_rooms dans interventions
-- Date: 2026-01-26
-- Description: Ajoute un champ pour stocker les indices des pièces validées sous forme de JSON array

-- Ajouter la colonne validated_rooms pour stocker les indices des pièces validées (format JSON array)
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS validated_rooms TEXT;

-- Log de la migration
DO $$
BEGIN
    RAISE NOTICE 'Migration V18 terminée : Colonne validated_rooms ajoutée à interventions';
END $$;
