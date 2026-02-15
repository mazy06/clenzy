#!/bin/bash

# Script pour appliquer les permissions supplémentaires pour les rapports
# Ce script exécute la migration SQL manuellement dans la base de données

echo "🔧 Application des permissions supplémentaires pour les rapports..."

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution. Veuillez démarrer Docker Desktop."
    exit 1
fi

# Vérifier que le conteneur PostgreSQL est en cours d'exécution
if ! docker ps | grep -q clenzy-postgres-dev; then
    echo "❌ Le conteneur PostgreSQL n'est pas en cours d'exécution."
    echo "   Veuillez démarrer l'environnement avec: docker-compose -f docker-compose.dev.yml up -d"
    exit 1
fi

# Exécuter le script SQL
echo "📝 Exécution du script SQL..."
docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev < add-report-permissions-manual.sql

if [ $? -eq 0 ]; then
    echo "✅ Permissions appliquées avec succès !"
    echo ""
    echo "📊 Vérification des permissions reports:"
    docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev -c "SELECT name, description, module FROM permissions WHERE name LIKE 'reports:%' ORDER BY name;"
    echo ""
    echo "🔄 Veuillez rafraîchir la page de gestion des permissions dans l'interface."
else
    echo "❌ Erreur lors de l'application des permissions."
    exit 1
fi
