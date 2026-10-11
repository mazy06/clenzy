#!/usr/bin/env bash
# Carte Baitly · fabrique les tuiles vectorielles OSM et les ressources de style servies sous /maps/.
#
# À quoi sert ce fichier : extraire du build quotidien Protomaps (OpenStreetMap, planète entière,
# ~140 Go, lu par requêtes Range — rien n'est téléchargé en entier) les seules zones FR + MA + SA
# décrites dans baitly-region.geojson, puis rapatrier les polices (glyphes) et les sprites que le
# style Baitly référence. Le résultat est un dossier autonome à téléverser tel quel
# (upload-baitly-tiles.sh) :
#
#   out/baitly.pmtiles                          tuiles vectorielles (schéma Protomaps v4)
#   out/assets/fonts/{fontstack}/{range}.pbf    glyphes (arabe compris)
#   out/assets/sprites/baitly/{light,dark}*     pictogrammes Baitly (scripts build-map-sprite.mjs)
#
# Utilisation :
#   bash scripts/maps/build-baitly-tiles.sh                    # FR + MA + SA, zoom 0-15
#   bash scripts/maps/build-baitly-tiles.sh --maxzoom 12       # fichier plus léger (essais)
#   bash scripts/maps/build-baitly-tiles.sh --bbox 2.2,48.8,2.45,48.92 --out client/public/maps
#                                                              # extrait de dev (Paris), servi par Vite
#   bash scripts/maps/build-baitly-tiles.sh --skip-assets      # tuiles seules
#   bash scripts/maps/build-baitly-tiles.sh --build 20261009   # build Protomaps précis
#
# Prérequis : pmtiles (brew install pmtiles), curl, python3.
# Licence des données : © OpenStreetMap contributors (ODbL) — l'attribution est affichée par la carte.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/out"
MAXZOOM=15
BUILD=""
BBOX=""
SKIP_ASSETS=0
ASSETS_ORIGIN="https://protomaps.github.io/basemaps-assets"
# Polices référencées par @protomaps/basemaps (cf. layers()) — l'arabe est couvert par « Regular ».
FONTSTACKS=("Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic" "Noto Sans Devanagari Regular v1")

while [ $# -gt 0 ]; do
  case "$1" in
    --maxzoom) MAXZOOM="$2"; shift 2 ;;
    --build) BUILD="$2"; shift 2 ;;
    --bbox) BBOX="$2"; shift 2 ;;
    --out) OUT="$(cd "$2" 2>/dev/null && pwd || { mkdir -p "$2" && cd "$2" && pwd; })"; shift 2 ;;
    --skip-assets) SKIP_ASSETS=1; shift ;;
    *) echo "Option inconnue : $1" >&2; exit 1 ;;
  esac
done

command -v pmtiles >/dev/null || { echo "pmtiles absent : brew install pmtiles" >&2; exit 1; }
mkdir -p "$OUT"

# Les builds quotidiens tournent (les plus anciens disparaissent) : on prend le dernier publié.
if [ -z "$BUILD" ]; then
  BUILD="$(curl -fsS https://build-metadata.protomaps.dev/builds.json \
    | python3 -I -c 'import json,sys; print(json.load(sys.stdin)[-1]["key"].removesuffix(".pmtiles"))')"
fi
SOURCE="https://build.protomaps.com/${BUILD}.pmtiles"

REGION_ARGS=(--region="$HERE/baitly-region.geojson")
[ -n "$BBOX" ] && REGION_ARGS=(--bbox="$BBOX")

echo "→ Tuiles : $SOURCE ⇒ $OUT/baitly.pmtiles (zoom max $MAXZOOM)"
pmtiles extract "$SOURCE" "$OUT/baitly.pmtiles.tmp" "${REGION_ARGS[@]}" --maxzoom="$MAXZOOM"
mv "$OUT/baitly.pmtiles.tmp" "$OUT/baitly.pmtiles"
pmtiles show "$OUT/baitly.pmtiles" | head -n 12

# Relief : altitude Mapterhorn (Terrarium, zooms 0-12) sur la même zone — d'après IGN
# (Licence Ouverte 2.0) et Copernicus GLO-30. Attribution « © Mapterhorn » affichée par la carte.
echo "→ Relief : https://download.mapterhorn.com/planet.pmtiles ⇒ $OUT/terrain.pmtiles"
pmtiles extract https://download.mapterhorn.com/planet.pmtiles "$OUT/terrain.pmtiles.tmp" "${REGION_ARGS[@]}" --maxzoom=12
mv "$OUT/terrain.pmtiles.tmp" "$OUT/terrain.pmtiles"

[ "$SKIP_ASSETS" = 1 ] && exit 0

echo "→ Glyphes : ${#FONTSTACKS[@]} familles × 256 plages"
for stack in "${FONTSTACKS[@]}"; do
  dir="$OUT/assets/fonts/$stack"
  mkdir -p "$dir"
  encoded="${stack// /%20}"
  for start in $(seq 0 256 65280); do
    range="${start}-$((start + 255))"
    [ -s "$dir/$range.pbf" ] && continue
    # Une plage sans glyphe répond 404 : MapLibre tolère l'absence, on n'écrit simplement rien.
    curl -fsS "$ASSETS_ORIGIN/fonts/$encoded/$range.pbf" -o "$dir/$range.pbf" 2>/dev/null || rm -f "$dir/$range.pbf"
  done
done

# Police des libellés « Baitly Sans » (Plus Jakarta Sans + Tajawal + Noto), à partir des glyphes Noto.
echo "→ Police Baitly Sans"
bash "$HERE/fonts/build-baitly-fonts.sh" "$OUT"

# Sprite Baitly (pictogrammes Lucide en pastilles, cartouches de routes) : généré, pas téléchargé.
echo "→ Sprite Baitly"
(cd "$HERE/../../client" && node scripts/build-map-sprite.mjs "$OUT/assets/sprites/baitly")

# Styles web (sites générés) et plugin RTL : consommés par clenzy-sites via /maps/.
echo "→ Styles web + plugin RTL"
(cd "$HERE/../../client" && node scripts/build-map-render-styles.mjs "$OUT/assets-build")
mkdir -p "$OUT/assets/styles" "$OUT/assets/rtl"
cp "$OUT"/assets-build/web-styles/*.json "$OUT/assets/styles/"
rm -rf "$OUT/assets-build"
curl -fsS "https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js" -o "$OUT/assets/rtl/mapbox-gl-rtl-text.js"

du -sh "$OUT/baitly.pmtiles" "$OUT/assets"
echo "OK. Étape suivante : bash scripts/maps/upload-baitly-tiles.sh"
