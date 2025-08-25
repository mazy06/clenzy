#!/bin/bash

# Script de démarrage détaché pour l'environnement de développement Clenzy
echo "🚀 Démarrage de l'environnement de développement Clenzy (mode détaché)..."

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution. Veuillez démarrer Docker Desktop."
    exit 1
fi

# Arrêter les services existants s'ils sont en cours d'exécution
echo "🛑 Arrêt des services existants..."
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.dev.yml down

# Démarrer les services de développement en mode détaché
echo "🔧 Démarrage des services de développement (mode détaché)..."
docker-compose -f docker-compose.dev.yml up -d --build

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 10

# Vérifier le statut des services
echo "📊 Statut des services :"
docker-compose -f docker-compose.dev.yml ps

echo "✅ Environnement de développement démarré en mode détaché !"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:8084"
echo "🗄️  Base de données: localhost:5433"
echo "🔐 Keycloak: http://localhost:8083"
echo ""
echo "📁 Données persistantes: ./postgres-data/"
echo "📋 Pour voir les logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "🛑 Pour arrêter: docker-compose -f docker-compose.dev.yml down"
