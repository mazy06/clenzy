#!/bin/bash

# Script d'arrêt pour l'environnement de développement Clenzy
echo "🛑 Arrêt de l'environnement de développement Clenzy..."

# Se placer dans le bon répertoire (celui du script)
cd "$(dirname "$0")"

# Arrêter et supprimer les conteneurs
docker compose -f docker-compose.dev.yml down --remove-orphans

echo ""
echo "✅ Tous les services ont été arrêtés."
echo "💡 Les données PostgreSQL sont conservées dans ./postgres-data/"
echo "🚀 Pour relancer: ./start-dev.sh"
