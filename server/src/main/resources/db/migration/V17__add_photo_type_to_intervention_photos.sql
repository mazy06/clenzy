-- Migration V17: Ajout de la colonne photo_type dans intervention_photos
-- Date: 2026-01-26
-- Description: Ajoute une colonne photo_type pour distinguer les photos avant (BEFORE) et après (AFTER) intervention

-- Étape 1: Supprimer la colonne si elle existe déjà (créée par Hibernate avec NOT NULL)
-- Cela permet de repartir de zéro si Hibernate a déjà créé la colonne incorrectement
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'intervention_photos' AND column_name = 'photo_type'
    ) THEN
        -- Supprimer la contrainte NOT NULL si elle existe
        ALTER TABLE intervention_photos ALTER COLUMN photo_type DROP NOT NULL;
        -- Supprimer la colonne pour la recréer correctement
        ALTER TABLE intervention_photos DROP COLUMN photo_type;
    END IF;
END $$;

-- Étape 2: Ajouter la colonne photo_type comme nullable d'abord
ALTER TABLE intervention_photos ADD COLUMN photo_type VARCHAR(10);

-- Étape 3: Mettre à jour les photos existantes pour qu'elles soient toutes en BEFORE par défaut
UPDATE intervention_photos SET photo_type = 'BEFORE' WHERE photo_type IS NULL;

-- Étape 4: Maintenant que toutes les valeurs sont remplies, rendre la colonne NOT NULL
ALTER TABLE intervention_photos ALTER COLUMN photo_type SET NOT NULL;

-- Étape 5: Ajouter une valeur par défaut pour les futures insertions
ALTER TABLE intervention_photos ALTER COLUMN photo_type SET DEFAULT 'BEFORE';

-- Étape 6: Ajouter une contrainte pour s'assurer que photo_type est soit 'BEFORE' soit 'AFTER'
-- Supprimer la contrainte si elle existe déjà
ALTER TABLE intervention_photos DROP CONSTRAINT IF EXISTS chk_photo_type_valid;
ALTER TABLE intervention_photos ADD CONSTRAINT chk_photo_type_valid 
    CHECK (photo_type IN ('BEFORE', 'AFTER'));

-- Étape 7: Créer un index pour améliorer les performances des requêtes filtrées par type
CREATE INDEX IF NOT EXISTS idx_intervention_photos_photo_type 
    ON intervention_photos(intervention_id, photo_type);

-- Log de la migration
DO $$
BEGIN
    RAISE NOTICE 'Migration V17 terminée : Colonne photo_type ajoutée à intervention_photos';
END $$;
