#!/bin/bash

# Script pour appliquer la migration V15 manuellement
# Ce script vérifie l'état de la base de données et applique la migration si nécessaire

echo "🔍 Vérification de l'état de la base de données..."

# Vérifier que le conteneur PostgreSQL est en cours d'exécution
if ! docker ps | grep -q clenzy-postgres-dev; then
    echo "❌ Le conteneur PostgreSQL n'est pas en cours d'exécution."
    echo "   Veuillez démarrer l'environnement avec: ./start-dev.sh"
    exit 1
fi

echo "✅ Conteneur PostgreSQL trouvé"
echo ""
echo "📊 Vérification de l'état actuel de la base de données..."

# Vérifier si la table intervention_photos existe
TABLE_EXISTS=$(docker exec clenzy-postgres-dev psql -U clenzy -d clenzy_dev -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'intervention_photos');")

if [ "$TABLE_EXISTS" = "t" ]; then
    echo "✅ La table 'intervention_photos' existe déjà"
    
    # Vérifier le type de la colonne photo_data
    COLUMN_TYPE=$(docker exec clenzy-postgres-dev psql -U clenzy -d clenzy_dev -tAc "SELECT data_type FROM information_schema.columns WHERE table_name = 'intervention_photos' AND column_name = 'photo_data';")
    
    if [ "$COLUMN_TYPE" = "bytea" ]; then
        echo "✅ La colonne 'photo_data' est déjà de type BYTEA"
    else
        echo "⚠️  La colonne 'photo_data' est de type: $COLUMN_TYPE (attendu: bytea)"
        echo "   Application de la migration..."
    fi
else
    echo "⚠️  La table 'intervention_photos' n'existe pas"
    echo "   Application de la migration..."
fi

# Vérifier le type des colonnes notes et photos dans la table interventions
NOTES_TYPE=$(docker exec clenzy-postgres-dev psql -U clenzy -d clenzy_dev -tAc "SELECT data_type FROM information_schema.columns WHERE table_name = 'interventions' AND column_name = 'notes';")
PHOTOS_TYPE=$(docker exec clenzy-postgres-dev psql -U clenzy -d clenzy_dev -tAc "SELECT data_type FROM information_schema.columns WHERE table_name = 'interventions' AND column_name = 'photos';")

echo ""
echo "📋 État actuel des colonnes dans la table 'interventions':"
echo "   - notes: $NOTES_TYPE"
echo "   - photos: $PHOTOS_TYPE"
echo ""

# Demander confirmation avant d'appliquer la migration
read -p "Voulez-vous appliquer la migration V15 ? (o/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
    echo "❌ Migration annulée"
    exit 0
fi

echo ""
echo "🚀 Application de la migration V15..."

# Exécuter la migration
docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev <<EOF
-- Migration V15: Création de la table intervention_photos avec BYTEA pour stocker les photos binaires
-- Date: 2026-01-25
-- Description: Crée une table séparée pour stocker les photos d'intervention en BYTEA
--              et modifie les colonnes notes de VARCHAR(1000) à TEXT

-- Modifier la colonne notes de VARCHAR(1000) à TEXT
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'interventions' 
               AND column_name = 'notes' 
               AND data_type != 'text') THEN
        ALTER TABLE interventions ALTER COLUMN notes TYPE TEXT;
        RAISE NOTICE 'Colonne notes modifiée en TEXT';
    ELSE
        RAISE NOTICE 'Colonne notes déjà de type TEXT';
    END IF;
END \$\$;

-- Modifier la colonne photos de VARCHAR(1000) à TEXT (pour compatibilité avec anciennes données)
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'interventions' 
               AND column_name = 'photos' 
               AND data_type != 'text') THEN
        ALTER TABLE interventions ALTER COLUMN photos TYPE TEXT;
        RAISE NOTICE 'Colonne photos modifiée en TEXT';
    ELSE
        RAISE NOTICE 'Colonne photos déjà de type TEXT';
    END IF;
END \$\$;

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

-- Vérifier que la colonne photo_data est bien de type BYTEA
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'intervention_photos' 
               AND column_name = 'photo_data' 
               AND data_type != 'bytea') THEN
        ALTER TABLE intervention_photos ALTER COLUMN photo_data TYPE BYTEA USING photo_data::bytea;
        RAISE NOTICE 'Colonne photo_data modifiée en BYTEA';
    ELSE
        RAISE NOTICE 'Colonne photo_data déjà de type BYTEA';
    END IF;
END \$\$;

-- Log de la migration
DO \$\$
BEGIN
    RAISE NOTICE 'Migration V15 terminée : Table intervention_photos créée avec BYTEA, colonne notes étendue à TEXT';
END \$\$;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration V15 appliquée avec succès !"
    echo ""
    echo "📊 Vérification finale..."
    
    # Vérifier l'état final
    TABLE_EXISTS_FINAL=$(docker exec clenzy-postgres-dev psql -U clenzy -d clenzy_dev -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'intervention_photos');")
    COLUMN_TYPE_FINAL=$(docker exec clenzy-postgres-dev psql -U clenzy -d clenzy_dev -tAc "SELECT data_type FROM information_schema.columns WHERE table_name = 'intervention_photos' AND column_name = 'photo_data';")
    NOTES_TYPE_FINAL=$(docker exec clenzy-postgres-dev psql -U clenzy -d clenzy_dev -tAc "SELECT data_type FROM information_schema.columns WHERE table_name = 'interventions' AND column_name = 'notes';")
    
    echo "   - Table intervention_photos existe: $TABLE_EXISTS_FINAL"
    echo "   - Type de photo_data: $COLUMN_TYPE_FINAL"
    echo "   - Type de notes: $NOTES_TYPE_FINAL"
    echo ""
    echo "✅ Tout est prêt ! Vous pouvez maintenant relancer l'application."
else
    echo ""
    echo "❌ Erreur lors de l'application de la migration"
    exit 1
fi
