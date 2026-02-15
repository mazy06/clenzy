#!/bin/bash

# Script pour vérifier que toutes les permissions sont présentes dans la base de données

echo "🔍 Vérification des permissions dans la base de données..."

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

echo ""
echo "📊 Permissions pour les rapports:"
docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev -c "SELECT name, description, module FROM permissions WHERE name LIKE 'reports:%' ORDER BY name;"

echo ""
echo "📊 Total de permissions dans la base de données:"
docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev -c "SELECT COUNT(*) as total_permissions FROM permissions;"

echo ""
echo "📊 Permissions par module:"
docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev -c "SELECT module, COUNT(*) as count FROM permissions GROUP BY module ORDER BY module;"

echo ""
echo "✅ Vérification terminée !"
