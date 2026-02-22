-- Migration V15: Création de la table intervention_photos avec BYTEA pour stocker les photos binaires
-- Date: 2026-01-25
-- Description: Crée une table séparée pour stocker les photos d'intervention en BYTEA
--              et modifie les colonnes notes de VARCHAR(1000) à TEXT

-- Modifier la colonne notes de VARCHAR(1000) à TEXT
ALTER TABLE interventions ALTER COLUMN notes TYPE TEXT;

-- Modifier la colonne photos de VARCHAR(1000) à TEXT (pour compatibilité avec anciennes données)
ALTER TABLE interventions ALTER COLUMN photos TYPE TEXT;

-- Créer la table intervention_photos pour stocker les photos en BYTEA
CREATE TABLE IF NOT EXISTS intervention_photos (
    id BIGSERIAL PRIMARY KEY,
    intervention_id BIGINT NOT NULL,
    photo_data BYTEA NOT NULL,
    content_type VARCHAR(50),
    file_name VARCHAR(255),
    caption VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_intervention_photo_intervention 
        FOREIGN KEY (intervention_id) 
        REFERENCES interventions(id) 
        ON DELETE CASCADE
);

-- Créer un index sur intervention_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_intervention_photos_intervention_id 
    ON intervention_photos(intervention_id);

-- Créer un index sur created_at pour le tri chronologique
CREATE INDEX IF NOT EXISTS idx_intervention_photos_created_at 
    ON intervention_photos(created_at);

-- Log de la migration
DO $$
BEGIN
    RAISE NOTICE 'Migration V15 terminée : Table intervention_photos créée avec BYTEA, colonne notes étendue à TEXT';
END $$;
