#!/bin/bash

# Script pour vider le cache Redis de Clenzy
echo "🗑️  Vidage du cache Redis..."

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution. Veuillez démarrer Docker Desktop."
    exit 1
fi

# Vérifier si le conteneur Redis est en cours d'exécution
if ! docker ps | grep -q "clenzy-redis-dev"; then
    echo "⚠️  Le conteneur Redis n'est pas en cours d'exécution."
    echo "   Démarrez d'abord l'environnement avec: ./start-dev.sh"
    exit 1
fi

# Vider le cache Redis
echo "🧹 Vidage de toutes les clés Redis..."
docker exec -it clenzy-redis-dev redis-cli FLUSHALL

if [ $? -eq 0 ]; then
    echo "✅ Cache Redis vidé avec succès !"
    echo "🔄 Redémarrez le serveur Spring Boot pour que les nouvelles configurations soient prises en compte."
else
    echo "❌ Erreur lors du vidage du cache Redis."
    exit 1
fi
