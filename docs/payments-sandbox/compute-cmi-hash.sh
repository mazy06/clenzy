#!/usr/bin/env bash
#
# compute-cmi-hash.sh — Calcul du HASH SHA-512 ver3 selon la spec CMI Maroc
# ---------------------------------------------------------------------------
#
# Implémentation strictement alignée avec la classe Java
# com.clenzy.payment.provider.CmiHashService du backend Clenzy. Utile pour
# tester manuellement l'endpoint /api/webhooks/payments/cmi en local
# (curl avec un HASH valide), sans devoir attendre l'accès au sandbox CMI.
#
# Algorithme officiel CMI ver3 :
#   1. Trier les paramètres par nom de champ (case-insensitive)
#   2. Exclure les champs HASH et encoding du calcul
#   3. Échapper chaque valeur : \ → \\, puis | → \|
#   4. Joindre les valeurs échappées avec "|"
#   5. Concaténer "|" + escape(storeKey) à la fin
#   6. SHA-512 → Base64 standard
#
# Usage :
#   ./compute-cmi-hash.sh STORE_KEY "key1=value1" "key2=value2" ...
#
# Dependencies : openssl + base64 (présents nativement sur macOS et Linux).
# ---------------------------------------------------------------------------

set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 STORE_KEY KEY=VALUE [KEY=VALUE ...]

Calcule le HASH SHA-512 ver3 selon la spec CMI Maroc.

Le hash est calculé sur toutes les paires KEY=VALUE passées en argument
(sauf HASH et encoding qui sont exclus par convention CMI), triées par
clé case-insensitive, jointes par "|", avec le STORE_KEY en suffixe.

Génère aussi une commande curl prête à copier-coller pour simuler le
callback CMI sur l'endpoint webhook Clenzy.

EXEMPLE :
  $0 "STORE_KEY_LOREM_IPSUM_DOLOR_SIT_AMET" \\
    "clientid=TEST_CLIENT_001" \\
    "oid=TX-abc123" \\
    "amount=250.00" \\
    "currency=504" \\
    "ProcReturnCode=00" \\
    "Response=Approved"

OPTIONS :
  --webhook-url URL    URL de webhook pour la commande curl générée.
                       Defaut: http://localhost:8084/api/webhooks/payments/cmi
  -h, --help           Affiche cette aide
EOF
  exit "${1:-0}"
}

# ─── Parsing des arguments ────────────────────────────────────────────────

WEBHOOK_URL="http://localhost:8084/api/webhooks/payments/cmi"
POSITIONAL=()

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)
      usage 0
      ;;
    --webhook-url)
      WEBHOOK_URL="$2"
      shift 2
      ;;
    --webhook-url=*)
      WEBHOOK_URL="${1#*=}"
      shift
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

if [ "${#POSITIONAL[@]}" -lt 2 ]; then
  echo "ERREUR : il faut au minimum un STORE_KEY et une paire KEY=VALUE."
  echo ""
  usage 1
fi

STORE_KEY="${POSITIONAL[0]}"
ORIGINAL_PAIRS=("${POSITIONAL[@]:1}")

# ─── Tri + filtrage + échappement ─────────────────────────────────────────

# Construit un fichier intermédiaire "clé<TAB>valeur" pour le tri natif sort.
TMPFILE=$(mktemp -t cmi-hash.XXXXXX)
trap 'rm -f "$TMPFILE"' EXIT

for pair in "${ORIGINAL_PAIRS[@]}"; do
  if [[ "$pair" != *"="* ]]; then
    echo "ERREUR : paire mal formée (pas de '=') : $pair" >&2
    exit 1
  fi
  key="${pair%%=*}"
  value="${pair#*=}"

  # Exclusion case-insensitive de HASH et encoding (spec CMI)
  key_lower="$(printf '%s' "$key" | tr '[:upper:]' '[:lower:]')"
  if [ "$key_lower" = "hash" ] || [ "$key_lower" = "encoding" ]; then
    continue
  fi

  printf '%s\t%s\n' "$key" "$value" >> "$TMPFILE"
done

# Tri par clé, case-insensitive (-f). LC_ALL=C pour un comportement déterministe.
SORTED=$(LC_ALL=C sort -f "$TMPFILE")

# ─── Construction du plaintext SHA-512 ────────────────────────────────────

PLAINTEXT=""
FIRST=1
while IFS=$'\t' read -r _key value; do
  # Échappement spec CMI : d'abord \ → \\, ensuite | → \|
  # (ordre critique pour ne pas double-échapper les backslashes ajoutés)
  escaped="${value//\\/\\\\}"
  escaped="${escaped//|/\\|}"

  if [ $FIRST -eq 1 ]; then
    PLAINTEXT="$escaped"
    FIRST=0
  else
    PLAINTEXT="${PLAINTEXT}|${escaped}"
  fi
done <<< "$SORTED"

# Append "|" + escape(storeKey)
ESC_STORE_KEY="${STORE_KEY//\\/\\\\}"
ESC_STORE_KEY="${ESC_STORE_KEY//|/\\|}"
PLAINTEXT="${PLAINTEXT}|${ESC_STORE_KEY}"

# ─── Calcul SHA-512 + Base64 ──────────────────────────────────────────────

# -binary = sortie binaire (pas hex), pipé directement à base64.
# printf '%s' évite l'ajout d'un saut de ligne automatique qui casserait le hash.
HASH=$(printf '%s' "$PLAINTEXT" | openssl dgst -sha512 -binary | base64)

# Sur certains systèmes, base64 wrappe à 76 caractères. CMI veut une ligne.
HASH=$(printf '%s' "$HASH" | tr -d '\n')

# ─── Affichage du résultat + commande curl prête à l'emploi ───────────────

cat <<EOF

╔══════════════════════════════════════════════════════════════════════════╗
║  HASH CMI calculé (SHA-512 ver3, Base64)                                 ║
╚══════════════════════════════════════════════════════════════════════════╝

$HASH

╔══════════════════════════════════════════════════════════════════════════╗
║  Plaintext utilisé pour le hash (debug)                                  ║
╚══════════════════════════════════════════════════════════════════════════╝

$PLAINTEXT

╔══════════════════════════════════════════════════════════════════════════╗
║  Commande curl pour simuler un callback CMI                              ║
╚══════════════════════════════════════════════════════════════════════════╝

curl -X POST "$WEBHOOK_URL" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
EOF

for pair in "${ORIGINAL_PAIRS[@]}"; do
  printf '  --data-urlencode "%s" \\\n' "$pair"
done
printf '  --data-urlencode "HASH=%s"\n' "$HASH"

cat <<EOF

╔══════════════════════════════════════════════════════════════════════════╗
║  Validation attendue côté serveur Clenzy                                 ║
╚══════════════════════════════════════════════════════════════════════════╝

1. HTTP 200 "OK" si HASH valide + ProcReturnCode=00 → transaction passée en
   COMPLETED en BDD, événement PAYMENT_COMPLETED publié sur Kafka.
2. HTTP 401 "Invalid HASH" si la signature ne matche pas (mauvais store_key
   ou paramètres altérés).
3. HTTP 404 "Unknown transaction" si l'oid ne correspond à aucune
   PaymentTransaction en BDD (lance d'abord une transaction CMI réelle
   depuis le frontend Clenzy avant de simuler le callback).

EOF
