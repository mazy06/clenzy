#!/usr/bin/env bash
# Génère baitly-brand-book.pdf depuis brand-book.html.
# Prérequis : Google Chrome (macOS) et python3 avec pypdf + reportlab.
# Usage : ./build-pdf.sh  (depuis n'importe quel dossier)
set -euo pipefail

cd "$(dirname "$0")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
RAW="$(mktemp -t baitly-brand-book).pdf"

"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=8000 \
  --print-to-pdf="$RAW" "file://$PWD/brand-book.html" 2>/dev/null

python3 stamp_pdf.py "$RAW" baitly-brand-book.pdf
rm -f "$RAW"
echo "OK : $PWD/baitly-brand-book.pdf"
