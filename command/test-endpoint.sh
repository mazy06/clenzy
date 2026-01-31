#!/bin/bash

# Test de l'endpoint /api/properties/with-managers
echo "🔍 Test de l'endpoint /api/properties/with-managers"

# Test sans authentification (devrait retourner 401)
echo "1. Test sans authentification:"
curl -s -w "\nStatus: %{http_code}\n" "http://localhost:8084/api/properties/with-managers?ownerId=4"

echo -e "\n2. Test avec authentification basique (admin:admin):"
curl -s -w "\nStatus: %{http_code}\n" -u "admin:admin" "http://localhost:8084/api/properties/with-managers?ownerId=4"

echo -e "\n3. Test de l'endpoint standard /api/properties:"
curl -s -w "\nStatus: %{http_code}\n" -u "admin:admin" "http://localhost:8084/api/properties?ownerId=4"
