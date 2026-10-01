"""Finalise le PDF du brand book Baitly produit par Chrome headless.

Chrome n'écrit ni numéros de page propres ni signets de navigation : ce script
ajoute un pied de page « Baitly · Brand book · p. X / Y » (sauf sur la
couverture) et des signets PDF pointant sur la première page de chaque section,
retrouvée par le texte de son eyebrow.

Usage : python3 stamp_pdf.py <entree.pdf> <sortie.pdf>
"""
import io
import re
import sys

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

SECTIONS = [
    ("Sommaire", "Sommaire"),
    ("01 · Vision & positionnement", "01 · Vision"),
    ("02 · Couleurs", "02 · Couleurs"),
    ("03 · Typographies", "03 · Typographies"),
    ("04 · Logo & assets graphiques", "04 · Logo"),
    ("05 · Composants UI", "05 · Composants"),
    ("05 bis · Le planning, pièce par pièce", "Règles de construction reprises du code"),
    ("06 · Motion design", "06 · Principes de motion"),
    ("07 · Templates sociaux", "07 · Templates"),
    ("08 · Voix off & storytelling", "08 · Voix off"),
    ("Annexes", "Références,"),
]


def footer_overlay(width, height, page_no, total):
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(width, height))
    pdf.setFont("Helvetica", 7.5)
    pdf.setFillColor(HexColor("#4D5A64"))
    pdf.drawString(48, 28, "Baitly · Brand book · v1.0 · 26 septembre 2026")
    pdf.drawRightString(width - 48, 28, f"p. {page_no} / {total}")
    pdf.setStrokeColor(HexColor("#CAD6DD"))
    pdf.setLineWidth(0.5)
    pdf.line(48, 40, width - 48, 40)
    pdf.save()
    buffer.seek(0)
    return PdfReader(buffer).pages[0]


def find_section_pages(reader):
    texts = [re.sub(r"\s+", "", (page.extract_text() or "").upper()) for page in reader.pages]
    found = []
    for title, needle in SECTIONS:
        for index, text in enumerate(texts):
            if index == 0:
                continue
            if re.sub(r"\s+", "", needle.upper()) in text:
                found.append((title, index))
                break
    return found


def main(source, target):
    reader = PdfReader(source)
    writer = PdfWriter()
    total = len(reader.pages)
    # Avant la fusion des pieds de page : elle réécrit les flux de contenu.
    sections = find_section_pages(reader)
    for index, page in enumerate(reader.pages):
        if index > 0:
            box = page.mediabox
            page.merge_page(footer_overlay(float(box.width), float(box.height), index + 1, total))
        writer.add_page(page)
    writer.add_outline_item("Couverture", 0)
    for title, index in sections:
        writer.add_outline_item(title, index)
    writer.add_metadata({"/Title": "Baitly · Brand book", "/Author": "Baitly", "/Subject": "Identité visuelle et guide de création"})
    writer.page_mode = "/UseOutlines"
    with open(target, "wb") as handle:
        writer.write(handle)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
