#!/usr/bin/env bash
# Carte Baitly · assemble le paquet du moteur de rendu d'images (conteneur baitly-maps-renderer).
#
# À quoi sert ce fichier : réunir ce dont tileserver-gl a besoin pour dessiner les images des
# e-mails et les tuiles raster du mobile, dans une archive téléversée avec les tuiles :
#
#   out/render-bundle.tar.gz
#     styles/baitly-paper-{fr,en,ar}.json   générés depuis le style de la carte web
#     styles/sprites/light*                  icônes des points d'intérêt
#     icons/pin-{property,key}.png           épingles Baitly (sources SVG dans render/icons/)
#     fonts/{fontstack}/{range}.pbf          glyphes
#
# Le conteneur lit l'archive PMTiles directement dans le stockage objet (requêtes Range) :
# elle n'est pas dans le paquet. Prérequis : build-baitly-tiles.sh (sans --skip-assets), Node 20.
# Utilisation : bash scripts/maps/build-render-bundle.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$HERE/out"
STAGE="$OUT/render-bundle"

[ -d "$OUT/assets/fonts" ] || { echo "Glyphes absents : lancer d'abord build-baitly-tiles.sh" >&2; exit 1; }

rm -rf "$STAGE"
mkdir -p "$STAGE/styles/sprites" "$STAGE/icons"
(cd "$ROOT/client" && node scripts/build-map-render-styles.mjs "$STAGE")
cp "$OUT"/assets/sprites/baitly/light* "$STAGE/styles/sprites/"
cp "$HERE"/render/icons/*.png "$STAGE/icons/"
cp -R "$OUT/assets/fonts" "$STAGE/fonts"

tar -czf "$OUT/render-bundle.tar.gz" -C "$STAGE" .
du -sh "$OUT/render-bundle.tar.gz"
echo "OK. Étape suivante : bash scripts/maps/upload-baitly-tiles.sh"
