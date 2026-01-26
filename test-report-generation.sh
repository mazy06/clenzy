#!/bin/bash

# Script de test pour la génération de rapports PDF
# Usage: ./test-report-generation.sh

echo "🧪 Test de génération de rapports PDF Clenzy"
echo "=============================================="
echo ""

# Configuration
BASE_URL="http://localhost:8084"
API_BASE="${BASE_URL}/api/reports"

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour tester un endpoint
test_report_endpoint() {
    local type=$1
    local report_type=$2
    local endpoint="${API_BASE}/${type}/${report_type}"
    local output_file="test-${type}-${report_type}.pdf"
    
    echo -n "Test: ${type}/${report_type}... "
    
    # Calculer les dates (dernier mois)
    end_date=$(date +%Y-%m-%d)
    start_date=$(date -v-1m +%Y-%m-%d 2>/dev/null || date -d "1 month ago" +%Y-%m-%d)
    
    # Faire la requête
    response=$(curl -s -w "\n%{http_code}" -o "${output_file}" \
        "${endpoint}?startDate=${start_date}&endDate=${end_date}" \
        -H "Authorization: Bearer YOUR_TOKEN_HERE" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ] && [ -f "${output_file}" ] && [ -s "${output_file}" ]; then
        # Vérifier que c'est bien un PDF
        if head -c 4 "${output_file}" | grep -q "%PDF"; then
            file_size=$(stat -f%z "${output_file}" 2>/dev/null || stat -c%s "${output_file}" 2>/dev/null)
            echo -e "${GREEN}✓ OK${NC} (${file_size} bytes)"
            return 0
        else
            echo -e "${RED}✗ ERREUR${NC} (Fichier généré mais n'est pas un PDF valide)"
            rm -f "${output_file}"
            return 1
        fi
    elif [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
        echo -e "${YELLOW}⚠ AUTH REQUIRED${NC} (Code: ${http_code})"
        rm -f "${output_file}"
        return 2
    else
        echo -e "${RED}✗ ERREUR${NC} (Code HTTP: ${http_code})"
        rm -f "${output_file}"
        return 1
    fi
}

# Vérifier que le backend est accessible
echo "Vérification de la connexion au backend..."
if curl -s -f "${BASE_URL}/actuator/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend accessible${NC}"
else
    echo -e "${RED}✗ Backend non accessible sur ${BASE_URL}${NC}"
    echo ""
    echo "Assurez-vous que:"
    echo "1. Docker Desktop est démarré"
    echo "2. L'environnement de développement est lancé:"
    echo "   cd infrastructure && ./start-dev.sh"
    exit 1
fi

echo ""
echo "⚠️  Note: Ces tests nécessitent une authentification."
echo "   Pour tester avec authentification, vous devez:"
echo "   1. Vous connecter via l'interface web"
echo "   2. Récupérer le token depuis localStorage (kc_access_token)"
echo "   3. Modifier ce script pour remplacer YOUR_TOKEN_HERE"
echo ""
echo "Tests sans authentification (devraient échouer avec 401/403):"
echo "------------------------------------------------------------"

# Tests des différents types de rapports
test_report_endpoint "financial" "revenue"
test_report_endpoint "financial" "costs"
test_report_endpoint "financial" "profit"

test_report_endpoint "interventions" "performance"
test_report_endpoint "interventions" "planning"
test_report_endpoint "interventions" "completion"

test_report_endpoint "teams" "performance"
test_report_endpoint "teams" "availability"
test_report_endpoint "teams" "workload"

test_report_endpoint "properties" "status"
test_report_endpoint "properties" "maintenance"
test_report_endpoint "properties" "costs"

echo ""
echo "=============================================="
echo "✅ Tests terminés"
echo ""
echo "Pour tester avec authentification complète:"
echo "1. Ouvrez http://localhost:3000 dans votre navigateur"
echo "2. Connectez-vous"
echo "3. Ouvrez la console développeur (F12)"
echo "4. Exécutez: localStorage.getItem('kc_access_token')"
echo "5. Copiez le token et modifiez ce script"
echo ""
