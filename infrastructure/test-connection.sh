#!/bin/bash

# Script de test de connexion pour vérifier l'état des services Clenzy
echo "🔍 Test de connexion des services Clenzy..."

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution."
    exit 1
fi

# Déterminer quelle configuration est active
if docker ps | grep -q "clenzy-postgres-dev"; then
    CONFIG="dev"
    COMPOSE_FILE="docker-compose.dev.yml"
    echo "📋 Configuration détectée : DÉVELOPPEMENT"
elif docker ps | grep -q "clenzy-postgres-prod"; then
    CONFIG="prod"
    COMPOSE_FILE="docker-compose.prod.yml"
    echo "📋 Configuration détectée : PRODUCTION"
elif docker ps | grep -q "clenzy-postgres"; then
    CONFIG="main"
    COMPOSE_FILE="docker-compose.yml"
    echo "📋 Configuration détectée : PRINCIPALE"
else
    echo "❌ Aucun service Clenzy détecté. Veuillez démarrer les services d'abord."
    exit 1
fi

echo "🔧 Fichier de configuration : $COMPOSE_FILE"
echo ""

# Vérifier le statut des services
echo "📊 Statut des services :"
docker-compose -f $COMPOSE_FILE ps
echo ""

# Tester la connexion PostgreSQL
echo "🗄️  Test de connexion PostgreSQL..."
if docker exec $(docker ps -q -f name="clenzy-postgres") pg_isready -U clenzy > /dev/null 2>&1; then
    echo "✅ PostgreSQL : Connecté"
else
    echo "❌ PostgreSQL : Erreur de connexion"
fi

# Tester la connexion Keycloak
echo "🔐 Test de connexion Keycloak..."
if curl -s http://localhost:8081/health/ready > /dev/null 2>&1; then
    echo "✅ Keycloak : Accessible"
elif curl -s http://localhost:8083/health/ready > /dev/null 2>&1; then
    echo "✅ Keycloak : Accessible (dev)"
else
    echo "❌ Keycloak : Non accessible"
fi

# Tester la connexion Serveur
echo "🔧 Test de connexion Serveur..."
if curl -s http://localhost:8080/actuator/health > /dev/null 2>&1; then
    echo "✅ Serveur : Accessible"
elif curl -s http://localhost:8084/actuator/health > /dev/null 2>&1; then
    echo "✅ Serveur : Accessible (dev)"
else
    echo "❌ Serveur : Non accessible"
fi

# Tester la connexion Frontend
echo "🌐 Test de connexion Frontend..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend : Accessible"
else
    echo "❌ Frontend : Non accessible"
fi

echo ""
echo "🎯 Résumé des tests terminé !"
echo "📋 Pour voir les logs en temps réel : docker-compose -f $COMPOSE_FILE logs -f"
echo "🛑 Pour arrêter les services : docker-compose -f $COMPOSE_FILE down"
