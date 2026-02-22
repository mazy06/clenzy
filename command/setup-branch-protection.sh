#!/bin/bash
# ===========================================
# Clenzy — Configuration Branch Protection Rules
# ===========================================
# Configure les regles de protection de la branche 'production' sur GitHub.
#
# Prerequis :
#   - gh CLI authentifie (gh auth login)
#   - Droits admin sur le repository
#
# Usage : bash command/setup-branch-protection.sh
#
# Ce script configure :
#   1. PR obligatoire pour merger dans production
#   2. Au moins 1 review approuvee requise
#   3. Status checks requis : CI Backend, CI Frontend, Performance Tests
#   4. Branche a jour requise avant merge
#   5. Pas de push direct force

set -euo pipefail

REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null)

if [ -z "$REPO" ]; then
    echo "❌ Impossible de detecter le repository. Verifiez que vous etes dans le bon repertoire et que gh est authentifie."
    exit 1
fi

echo "=== Configuration Branch Protection pour ${REPO} ==="
echo ""

# Utiliser l'API REST de GitHub pour configurer la protection
gh api \
  --method PUT \
  "repos/${REPO}/branches/production/protection" \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Build & Test",
      "TypeCheck & Build",
      "K6 Performance Tests"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "required_conversation_resolution": false
}
EOF

echo ""
echo "✅ Branch protection configuree pour '${REPO}' branche 'production'"
echo ""
echo "   Regles actives :"
echo "   • PR obligatoire pour merger dans production"
echo "   • 1 review approuvee requise"
echo "   • Status checks requis : Build & Test, TypeCheck & Build, K6 Performance Tests"
echo "   • Branche doit etre a jour avant merge"
echo "   • Force push interdit"
echo "   • Suppression de branche interdite"
echo ""
