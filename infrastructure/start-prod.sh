#!/bin/bash

# Script de démarrage pour l'environnement de production Clenzy
echo "🚀 Démarrage de l'environnement de production Clenzy..."

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution. Veuillez démarrer Docker Desktop."
    exit 1
fi

# Vérifier que les variables d'environnement sont définies
if [ -z "$POSTGRES_PASSWORD" ] || [ -z "$KEYCLOAK_HOSTNAME" ] || [ -z "$KEYCLOAK_CLIENT_SECRET" ]; then
    echo "❌ Variables d'environnement manquantes. Veuillez définir :"
    echo "   - POSTGRES_PASSWORD"
    echo "   - KEYCLOAK_HOSTNAME"
    echo "   - KEYCLOAK_CLIENT_SECRET"
    echo "   - JWT_SECRET"
    echo "   - DOMAIN"
    echo "   - KEYCLOAK_ADMIN"
    echo "   - KEYCLOAK_ADMIN_PASSWORD"
    echo "   - KEYCLOAK_DB_PASSWORD"
    exit 1
fi

# Arrêter les services existants s'ils sont en cours d'exécution
echo "🛑 Arrêt des services existants..."
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.dev.yml down

# Démarrer les services de production
echo "🔧 Démarrage des services de production..."
docker-compose -f docker-compose.prod.yml up --build

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 15

# Vérifier le statut des services
echo "📊 Statut des services :"
docker-compose -f docker-compose.prod.yml ps

echo "✅ Environnement de production démarré !"
echo "🌐 Frontend: http://localhost:80 (HTTP) / https://localhost:443 (HTTPS)"
echo "🔧 Backend: http://localhost:8080"
echo "🗄️  Base de données: localhost:5432"
echo "🔐 Keycloak: https://localhost:8081"
echo ""
echo "📁 Données persistantes: ./postgres-data/"
echo "🛑 Pour arrêter: docker-compose -f docker-compose.prod.yml down"
