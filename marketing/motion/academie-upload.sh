#!/usr/bin/env bash
# Baitly Académie · téléverse les vidéos web dans le conteneur OVH public, puis vérifie une URL.
#
# À quoi sert ce fichier : envoyer out/academie-web/ (généré par academie-web.mjs) dans le conteneur
# Object Storage PUBLIC de l'Académie, avec les bons en-têtes (video/mp4, cache 30 jours, lecture
# publique), puis contrôler qu'une vidéo se lit bien depuis Internet.
# Utilisation : bash marketing/motion/academie-upload.sh [--dryrun]
# Prérequis : AWS CLI v2 et un profil « ovh-academie » (clés saisies par vous, jamais dans le dépôt),
# voir marketing/academie/PUBLICATION.md § 3.
# À qui il s'adresse : la personne qui publie un épisode (marketing / développeur).
#
# Garde-fou : ce conteneur est public. Ne jamais pointer ce script sur « baitly-media », le conteneur
# privé des photos et documents des clients.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BUCKET="${BAITLY_ACADEMY_BUCKET:-baitly-academie}"
REGION="${BAITLY_ACADEMY_REGION:-gra}"
PROFILE="${BAITLY_ACADEMY_PROFILE:-ovh-academie}"
ENDPOINT="https://s3.${REGION}.io.cloud.ovh.net"
SRC="$HERE/out/academie-web/"

if [ "$BUCKET" = "baitly-media" ]; then
  echo "Refusé : baitly-media est le conteneur PRIVÉ des données clients." >&2
  exit 1
fi
if [ ! -d "$SRC" ]; then
  echo "Rien à téléverser : lancer d'abord « node marketing/motion/academie-web.mjs »." >&2
  exit 1
fi
command -v aws >/dev/null || { echo "AWS CLI absente : brew install awscli" >&2; exit 1; }

# AWS CLI 2.23+ ajoute par défaut des sommes de contrôle que les stockages S3 tiers peuvent refuser.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required

echo "→ $SRC  ⇒  s3://$BUCKET/academie/  ($ENDPOINT, profil $PROFILE)"
aws s3 sync "$SRC" "s3://$BUCKET/academie/" \
  --profile "$PROFILE" --endpoint-url "$ENDPOINT" --region "$REGION" \
  --exclude '*' --include '*.mp4' \
  --acl public-read --content-type video/mp4 --cache-control 'public, max-age=2592000' \
  --no-progress "$@"

case " $* " in *" --dryrun "*) exit 0 ;; esac

# Contrôle : une requête anonyme sur une plage d'octets doit répondre 206 (ou 200) en video/mp4.
url="https://$BUCKET.s3.$REGION.io.cloud.ovh.net/academie/fr/01-kpi-16x9-720.mp4"
headers="$(curl -sS -o /dev/null -D - -r 0-1 "$url")"
status="$(printf '%s' "$headers" | head -n 1 | awk '{print $2}')"
ctype="$(printf '%s' "$headers" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2}')"
echo "Contrôle public : $url → HTTP $status, $ctype"
if [ "$status" != "206" ] && [ "$status" != "200" ]; then
  echo "Les vidéos ne sont pas lisibles publiquement (HTTP $status) : vérifier la lecture publique du conteneur." >&2
  exit 1
fi
echo "OK. Valeur de BAITLY_ACADEMY_MEDIA_ORIGIN : https://$BUCKET.s3.$REGION.io.cloud.ovh.net/academie"
