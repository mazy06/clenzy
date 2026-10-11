#!/usr/bin/env bash
# Carte Baitly · téléverse les tuiles et les ressources de style dans le conteneur OVH public.
#
# À quoi sert ce fichier : envoyer scripts/maps/out/ (produit par build-baitly-tiles.sh) dans le
# conteneur Object Storage PUBLIC des cartes, avec les bons en-têtes, puis vérifier qu'une lecture
# par plage d'octets fonctionne (PMTiles ne lit le fichier que par requêtes Range).
# nginx relaie ensuite /maps/ vers ce conteneur : le front lit tout en MÊME ORIGINE (pas de CSP,
# pas de CORS, cache Cloudflare).
# Utilisation : bash scripts/maps/upload-baitly-tiles.sh [--dryrun]
# Prérequis : AWS CLI v2 et un profil « ovh-cartes » (clés saisies par vous, jamais dans le dépôt).
#
# Garde-fou : ce conteneur est public. Ne jamais pointer ce script sur « baitly-media », le conteneur
# privé des photos et documents des clients.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BUCKET="${BAITLY_MAPS_BUCKET:-baitly-cartes}"
REGION="${BAITLY_MAPS_REGION:-gra}"
PROFILE="${BAITLY_MAPS_PROFILE:-ovh-cartes}"
ENDPOINT="https://s3.${REGION}.io.cloud.ovh.net"
SRC="$HERE/out"

if [ "$BUCKET" = "baitly-media" ]; then
  echo "Refusé : baitly-media est le conteneur PRIVÉ des données clients." >&2
  exit 1
fi
if [ ! -s "$SRC/baitly.pmtiles" ]; then
  echo "Rien à téléverser : lancer d'abord « bash scripts/maps/build-baitly-tiles.sh »." >&2
  exit 1
fi
command -v aws >/dev/null || { echo "AWS CLI absente : brew install awscli" >&2; exit 1; }

export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
S3=(--profile "$PROFILE" --endpoint-url "$ENDPOINT" --region "$REGION" --acl public-read --no-progress)

# Les tuiles changent à chaque reconstruction : cache court, le navigateur revalide par ETag.
echo "→ baitly.pmtiles ⇒ s3://$BUCKET/maps/"
aws s3 cp "$SRC/baitly.pmtiles" "s3://$BUCKET/maps/baitly.pmtiles" "${S3[@]}" \
  --content-type application/vnd.pmtiles --cache-control 'public, max-age=86400' "$@"

if [ -s "$SRC/terrain.pmtiles" ]; then
  echo "→ terrain.pmtiles ⇒ s3://$BUCKET/maps/"
  aws s3 cp "$SRC/terrain.pmtiles" "s3://$BUCKET/maps/terrain.pmtiles" "${S3[@]}" \
    --content-type application/vnd.pmtiles --cache-control 'public, max-age=86400' "$@"
fi

# Glyphes et sprites ne changent pas d'une reconstruction à l'autre : cache long.
echo "→ assets/ ⇒ s3://$BUCKET/maps/assets/"
aws s3 sync "$SRC/assets/" "s3://$BUCKET/maps/assets/" "${S3[@]}" \
  --exclude '*' --include '*.pbf' --content-type application/x-protobuf \
  --cache-control 'public, max-age=2592000' "$@"
aws s3 sync "$SRC/assets/" "s3://$BUCKET/maps/assets/" "${S3[@]}" \
  --exclude '*' --include 'sprites/*.json' --include '*.png' \
  --cache-control 'public, max-age=2592000' "$@"
# Styles web et plugin RTL : cache court, une nouvelle palette doit arriver vite.
aws s3 sync "$SRC/assets/" "s3://$BUCKET/maps/assets/" "${S3[@]}" \
  --exclude '*' --include 'styles/*.json' --include 'rtl/*.js' \
  --cache-control 'public, max-age=300' "$@"

# Paquet du moteur de rendu d'images (styles, sprites, épingles, glyphes) : relu au démarrage
# du conteneur baitly-maps-renderer. Cache court : une nouvelle palette doit arriver vite.
if [ -s "$SRC/render-bundle.tar.gz" ]; then
  echo "→ render-bundle.tar.gz ⇒ s3://$BUCKET/maps/"
  aws s3 cp "$SRC/render-bundle.tar.gz" "s3://$BUCKET/maps/render-bundle.tar.gz" "${S3[@]}" \
    --content-type application/gzip --cache-control 'public, max-age=300' "$@"
else
  echo "(render-bundle.tar.gz absent : lancer build-render-bundle.sh pour le moteur de rendu)"
fi

case " $* " in *" --dryrun "*) exit 0 ;; esac

url="https://$BUCKET.s3.$REGION.io.cloud.ovh.net/maps/baitly.pmtiles"
status="$(curl -sS -o /dev/null -w '%{http_code}' -r 0-126 "$url")"
echo "Contrôle public : $url → HTTP $status"
if [ "$status" != "206" ]; then
  echo "Lecture par plage impossible (HTTP $status) : vérifier la lecture publique du conteneur." >&2
  exit 1
fi
echo "OK. Valeur de BAITLY_MAPS_ORIGIN : https://$BUCKET.s3.$REGION.io.cloud.ovh.net/maps"
