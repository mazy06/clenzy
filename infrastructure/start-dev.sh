#!/bin/bash

# Script de démarrage pour l'environnement de développement Clenzy
echo "🚀 Démarrage de l'environnement de développement Clenzy..."

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution. Veuillez démarrer Docker Desktop."
    exit 1
fi

# Se placer dans le bon répertoire (celui du script)
cd "$(dirname "$0")"

# Arrêter et supprimer les services existants s'ils sont en cours d'exécution
echo "🛑 Arrêt des services existants..."
docker compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null

# Forcer la reconstruction du frontend (pas de cache pour les fichiers source)
echo "🧹 Nettoyage du cache frontend..."
docker compose -f docker-compose.dev.yml build --no-cache frontend

# Démarrer les services de développement
echo "🔧 Démarrage des services de développement..."
docker compose -f docker-compose.dev.yml up -d

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 10

# Vérifier le statut des services
echo "📊 Statut des services :"
docker compose -f docker-compose.dev.yml ps

echo ""
echo "✅ Environnement de développement démarré !"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:8084"
echo "🗄️  Base de données: localhost:5433"
echo "🔐 Keycloak: http://localhost:8086"
echo ""
echo "📁 Données persistantes: ./postgres-data/"
echo "🛑 Pour arrêter: ./stop-dev.sh (ou docker compose -f docker-compose.dev.yml down)"
echo ""
echo "💡 Pour voir les logs en temps réel:"
echo "   docker compose -f docker-compose.dev.yml logs -f frontend"
echo "   docker compose -f docker-compose.dev.yml logs -f server"
