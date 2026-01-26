#!/bin/bash

# Script pour vérifier l'état de la base de données sans appliquer de modifications

echo "🔍 Vérification de l'état de la base de données Clenzy..."
echo ""

# Vérifier que le conteneur PostgreSQL est en cours d'exécution
if ! docker ps | grep -q clenzy-postgres-dev; then
    echo "❌ Le conteneur PostgreSQL n'est pas en cours d'exécution."
    echo "   Veuillez démarrer l'environnement avec: ./start-dev.sh"
    exit 1
fi

echo "✅ Conteneur PostgreSQL trouvé"
echo ""

# Vérifier si la table intervention_photos existe
TABLE_EXISTS=$(docker exec clenzy-postgres-dev psql -U clenzy -d clenzy_dev -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'intervention_photos');")

if [ "$TABLE_EXISTS" = "t" ]; then
    echo "✅ Table 'intervention_photos' existe"
    
    # Vérifier le type de la colonne photo_data
    COLUMN_TYPE=$(docker exec clenzy-postgres-dev psql -U clenzy -d clenzy_dev -tAc "SELECT data_type FROM information_schema.columns WHERE table_name = 'intervention_photos' AND column_name = 'photo_data';")
    
    if [ "$COLUMN_TYPE" = "bytea" ]; then
        echo "   ✅ Colonne 'photo_data': BYTEA (correct)"
    else
        echo "   ⚠️  Colonne 'photo_data': $COLUMN_TYPE (attendu: bytea)"
    fi
    
    # Compter le nombre de photos
    PHOTO_COUNT=$(docker exec clenzy-postgres-dev psql -U clenzy -d clenzy_dev -tAc "SELECT COUNT(*) FROM intervention_photos;")
    echo "   📊 Nombre de photos stockées: $PHOTO_COUNT"
else
    echo "❌ Table 'intervention_photos' n'existe pas"
fi

echo ""

# Vérifier le type des colonnes notes et photos dans la table interventions
NOTES_TYPE=$(docker exec clenzy-postgres-dev psql -U clenzy -d clenzy_dev -tAc "SELECT data_type FROM information_schema.columns WHERE table_name = 'interventions' AND column_name = 'notes';")
PHOTOS_TYPE=$(docker exec clenzy-postgres-dev psql -U clenzy -d clenzy_dev -tAc "SELECT data_type FROM information_schema.columns WHERE table_name = 'interventions' AND column_name = 'photos';")

echo "📋 État des colonnes dans la table 'interventions':"
if [ "$NOTES_TYPE" = "text" ]; then
    echo "   ✅ Colonne 'notes': TEXT (correct)"
else
    echo "   ⚠️  Colonne 'notes': $NOTES_TYPE (attendu: text)"
fi

if [ "$PHOTOS_TYPE" = "text" ]; then
    echo "   ✅ Colonne 'photos': TEXT (correct)"
else
    echo "   ⚠️  Colonne 'photos': $PHOTOS_TYPE (attendu: text)"
fi

echo ""
echo "📊 Résumé:"
if [ "$TABLE_EXISTS" = "t" ] && [ "$COLUMN_TYPE" = "bytea" ] && [ "$NOTES_TYPE" = "text" ] && [ "$PHOTOS_TYPE" = "text" ]; then
    echo "✅ Toutes les migrations sont appliquées correctement"
else
    echo "⚠️  Des migrations sont nécessaires"
    echo "   Exécutez: ./apply-migration-v15.sh"
fi
