#!/usr/bin/env bash
# Carte Baitly · glyphes « Baitly Sans » des libellés de la carte (cf. build-baitly-fonts.mjs).
# Polices sous licence SIL OFL 1.1 : Plus Jakarta Sans (tokotype) et Tajawal (Google Fonts).
# Prérequis : Docker (conteneur node:20 x86_64, pour les binaires précompilés de fontnik),
# glyphes Noto déjà rapatriés par build-baitly-tiles.sh dans <out>/assets/fonts.
# Utilisation : bash scripts/maps/fonts/build-baitly-fonts.sh <out>
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(cd "${1:?dossier de sortie (scripts/maps/out)}" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/ttf"
for weight in Regular Medium Italic; do
  curl -fsS -o "$WORK/ttf/PlusJakartaSans-$weight.ttf" \
    "https://raw.githubusercontent.com/tokotype/PlusJakartaSans/master/fonts/ttf/PlusJakartaSans-$weight.ttf"
done
for weight in Regular Medium; do
  curl -fsS -o "$WORK/ttf/Tajawal-$weight.ttf" \
    "https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-$weight.ttf"
done
cp "$HERE/build-baitly-fonts.mjs" "$WORK/"

docker run --rm --platform linux/amd64 \
  -v "$WORK:/work" -v "$OUT/assets/fonts:/fonts" -w /work node:20 \
  sh -c "npm i --silent --no-audit --no-fund fontnik@0.7 >/dev/null && node build-baitly-fonts.mjs /work/ttf /fonts /fonts"
