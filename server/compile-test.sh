#!/bin/bash

echo "🔨 Compilation du projet Clenzy..."
echo "=================================="

# Nettoyer et compiler
mvn clean compile -DskipTests

if [ $? -eq 0 ]; then
    echo "✅ Compilation réussie !"
    echo "🚀 Le service de synchronisation Keycloak est prêt."
else
    echo "❌ Erreur de compilation. Vérifiez les logs ci-dessus."
    exit 1
fi
