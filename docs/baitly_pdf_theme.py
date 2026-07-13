#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Thème PDF Baitly — design system partagé pour TOUS les documents PDF Baitly.

Formalise le style du PDF de référence « Paiement multi-fournisseurs — switch &
parallèle » afin que tout futur document ait la même identité visuelle.

Usage minimal :

    from baitly_pdf_theme import *   # palette, polices, styles, helpers, make_doc

    story = []
    build_cover(story,
        eyebrow="ARCHITECTURE · DOSSIER · CONFIDENTIEL",
        title_lines=["Mon <font color='#6B8A9A'>titre</font>", "sous-titre du titre"],
        subtitle="Une phrase de description.",
        meta_rows=[("Objet", "…"), ("Version", "1.0 — …")])
    story.append(Paragraph("1. Section", H1))
    story.append(Paragraph("Texte…", BODY))
    story.append(table([hcells("A", "B"), cells("1", "2")], [40*mm, USABLE_W-40*mm]))
    make_doc("sortie.pdf", title="Mon doc", footer_label="Mon doc · 2026 · Confidentiel").build(story)

Règles de style (voir aussi docs/BAITLY-PDF-STYLE.md) :
- Police : Avenir Next (géométrique) ; repli Helvetica si absente.
- JAMAIS d'emoji dans les cellules/dessins reportlab (rendus en carrés noirs).
  Marqueurs : yes()/no()/part()/soon() ; puces via « &bull; ».
- JAMAIS le glyphe « → » (U+2192) : Avenir ne l'a pas (tofu). Utiliser « -> ».
- Ne PAS utiliser client/src/assets/Baitly_logo.png (ancien logo Clenzy) :
  le logo est dessiné par baitly_logo().
"""
import os
import math
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, PageBreak, KeepTogether,
                                NextPageTemplate, HRFlowable)
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle
from reportlab.pdfgen import canvas as _canvas

__all__ = [
    # palette
    "PRIMARY", "PRIMARY2", "ACCENT", "WARN", "DANGER", "INK", "MUTED", "LIGHT", "LINE",
    "GREEN", "SKY", "HEADER_BG", "CODE_BG", "GRAD0", "GRAD1", "FAINT",
    # polices
    "FONT", "FONT_MED", "FONT_DEMI", "FONT_BOLD", "FONT_IT",
    # styles
    "PART", "H1", "H2", "H3", "BODY", "BULLET", "CAP", "SMALL",
    "CELL", "CELLB", "CELLH", "EYEBROW", "TIT", "SUB", "USABLE_W",
    # helpers texte/tableaux
    "table", "hcells", "cells", "crit_cell", "part_banner", "fig",
    "yes", "no", "part", "soon", "ok", "code",
    # dessin & chrome
    "constellation", "baitly_logo", "make_doc", "build_cover",
    # ré-exports pratiques
    "mm", "colors", "Paragraph", "Spacer", "PageBreak", "KeepTogether", "NextPageTemplate",
    "HRFlowable", "Drawing", "Rect", "String", "Line", "Circle", "ParagraphStyle",
    "TA_LEFT", "TA_CENTER", "math",
]

# ── Palette Baitly ─────────────────────────────────────────────────────────────
PRIMARY = colors.HexColor("#3E5A68")     # bleu-gris principal (titres, en-têtes)
PRIMARY2 = colors.HexColor("#6B8A9A")    # bleu-gris clair (accent titre, traits)
ACCENT = colors.HexColor("#4A9B8E")      # teal (filets d'accent, « oui »)
WARN = colors.HexColor("#D4A574")        # ambre (partiel / important)
DANGER = colors.HexColor("#C97A7A")      # rouge doux (obligatoire / échec)
INK = colors.HexColor("#26333B")         # texte courant (pas de noir pur)
MUTED = colors.HexColor("#6A7A82")       # texte secondaire
LIGHT = colors.HexColor("#EEF2F4")       # fond très clair
LINE = colors.HexColor("#DDE4E8")        # bordures fines
GREEN = ACCENT
SKY = colors.HexColor("#7BA3C2")
HEADER_BG = colors.HexColor("#EAF0F2")   # en-tête de tableau (clair)
CODE_BG = colors.HexColor("#EEF1F3")     # surlignage code inline
GRAD0 = colors.HexColor("#5B7A8C")       # barre gradient couverture (début)
GRAD1 = colors.HexColor("#93B0C2")       # barre gradient couverture (fin)
FAINT = colors.HexColor("#D9E1E5")       # motif constellation en filigrane (couverture)

# ── Police géométrique Avenir Next (repli Helvetica si absente) ────────────────
FONT, FONT_MED, FONT_DEMI, FONT_BOLD = "Helvetica", "Helvetica", "Helvetica-Bold", "Helvetica-Bold"
FONT_IT = "Helvetica-Oblique"
try:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfbase.pdfmetrics import registerFontFamily
    _AV = "/System/Library/Fonts/Avenir Next.ttc"
    if os.path.exists(_AV):
        pdfmetrics.registerFont(TTFont("Avenir", _AV, subfontIndex=7))        # Regular
        pdfmetrics.registerFont(TTFont("Avenir-Med", _AV, subfontIndex=5))    # Medium
        pdfmetrics.registerFont(TTFont("Avenir-Demi", _AV, subfontIndex=2))   # Demi Bold
        pdfmetrics.registerFont(TTFont("Avenir-Bold", _AV, subfontIndex=0))   # Bold
        pdfmetrics.registerFont(TTFont("Avenir-It", _AV, subfontIndex=4))     # Italic
        registerFontFamily("Avenir", normal="Avenir", bold="Avenir-Bold",
                           italic="Avenir-It", boldItalic="Avenir-Bold")
        FONT, FONT_MED, FONT_DEMI, FONT_BOLD, FONT_IT = \
            "Avenir", "Avenir-Med", "Avenir-Demi", "Avenir-Bold", "Avenir-It"
except Exception:
    pass

# ── Styles de paragraphe ───────────────────────────────────────────────────────
_ss = getSampleStyleSheet()
PART = ParagraphStyle("PART", parent=_ss["Heading1"], fontName=FONT_BOLD, fontSize=13,
                      textColor=colors.white, leading=16, alignment=TA_LEFT)
H1 = ParagraphStyle("H1", parent=_ss["Heading1"], fontName=FONT_DEMI, fontSize=15,
                    textColor=PRIMARY, spaceBefore=6, spaceAfter=7, leading=18)
H2 = ParagraphStyle("H2", parent=_ss["Heading2"], fontName=FONT_DEMI, fontSize=11.5,
                    textColor=PRIMARY, spaceBefore=10, spaceAfter=4, leading=14)
H3 = ParagraphStyle("H3", parent=_ss["Heading3"], fontName=FONT_DEMI, fontSize=10,
                    textColor=ACCENT, spaceBefore=7, spaceAfter=3, leading=12.5)
BODY = ParagraphStyle("BODY", parent=_ss["Normal"], fontName=FONT, fontSize=9.2,
                      textColor=INK, leading=14.6, spaceAfter=7)
BULLET = ParagraphStyle("BULLET", parent=BODY, leftIndent=5 * mm, bulletIndent=1.5 * mm,
                        spaceAfter=4)
CAP = ParagraphStyle("CAP", parent=BODY, fontSize=7.6, textColor=MUTED, leading=9.5,
                     alignment=TA_CENTER, spaceBefore=1, spaceAfter=6)
SMALL = ParagraphStyle("SMALL", parent=BODY, fontSize=7.6, textColor=MUTED, leading=9.6)
CELL = ParagraphStyle("CELL", parent=BODY, fontSize=7.6, leading=9.6, spaceAfter=0)
CELLB = ParagraphStyle("CELLB", parent=CELL, fontName=FONT_DEMI)
CELLH = ParagraphStyle("CELLH", parent=CELL, fontName=FONT_DEMI, textColor=PRIMARY)
EYEBROW = ParagraphStyle("EYEBROW", parent=BODY, fontName=FONT_DEMI, fontSize=9,
                         textColor=PRIMARY2, leading=12, spaceAfter=3)
TIT = ParagraphStyle("TIT", parent=BODY, fontName=FONT_BOLD, fontSize=27,
                     textColor=PRIMARY, leading=31, alignment=TA_LEFT)
SUB = ParagraphStyle("SUB", parent=BODY, fontName=FONT, fontSize=11.5, textColor=MUTED, leading=16)

USABLE_W = A4[0] - 36 * mm


# ══════════════════════════════════════════════════════════════════════════════
# Classes de base : tableau à coins arrondis + pagination « p. X / Y »
# ══════════════════════════════════════════════════════════════════════════════

class RoundedTable(Table):
    """Table dont le contour est un rectangle ARRONDI (le contenu est clippé aux
    coins ; un liseré arrondi est tracé par-dessus). Les lignes internes restent."""
    _radius = 6

    def draw(self):
        c = self.canv
        w, h = self._width, self._height
        c.saveState()
        pth = c.beginPath()
        pth.roundRect(0, 0, w, h, self._radius)
        c.clipPath(pth, stroke=0, fill=0)
        Table.draw(self)
        c.restoreState()
        c.saveState()
        c.setStrokeColor(LINE)
        c.setLineWidth(0.8)
        c.roundRect(0, 0, w, h, self._radius, stroke=1, fill=0)
        c.restoreState()


class NumberedCanvas(_canvas.Canvas):
    """Canvas qui connaît le nombre total de pages → footer « p. X / Y »."""

    def __init__(self, *a, **k):
        _canvas.Canvas.__init__(self, *a, **k)
        self._saved = []

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            self.setFont(FONT, 7)
            self.setFillColor(MUTED)
            self.drawRightString(A4[0] - 18 * mm, 9.4 * mm, "p. %d / %d" % (self._pageNumber, total))
            _canvas.Canvas.showPage(self)
        _canvas.Canvas.save(self)


# ══════════════════════════════════════════════════════════════════════════════
# Helpers texte / tableaux
# ══════════════════════════════════════════════════════════════════════════════

def table(data, widths, header=True, zebra=True, align_center_cols=()):
    """Tableau Baitly : COINS ARRONDIS, en-tête CLAIR (gris-bleu) + texte foncé +
    filet d'accent teal sous l'en-tête. Bordures internes fines, zébrures douces.
    Utiliser hcells() pour l'en-tête."""
    t = RoundedTable(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),   # séparateurs de lignes (pas la dernière)
        ("LINEAFTER", (0, 0), (-2, -1), 0.4, LINE),   # séparateurs de colonnes
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), HEADER_BG))
        style.append(("LINEBELOW", (0, 0), (-1, 0), 1.1, ACCENT))
    if zebra:
        for i in range(1 if header else 0, len(data)):
            if i % 2 == (0 if header else 1):
                style.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F6F8F9")))
    for c in align_center_cols:
        style.append(("ALIGN", (c, 0), (c, -1), "CENTER"))
    t.setStyle(TableStyle(style))
    return t


def hcells(*labels):
    """Cellules d'en-tête de tableau (texte foncé sur fond clair)."""
    return [Paragraph(l, CELLH) for l in labels]


def cells(*texts):
    return [Paragraph(t, CELL) for t in texts]


def code(txt):
    """Code inline surligné (gris clair) — façon `identifiant`."""
    return "<font face='Courier' backColor='#EEF1F3'>&nbsp;%s&nbsp;</font>" % txt


def crit_cell(level):
    """Pastille de criticité colorée : OBLIGATOIRE / IMPORTANTE / OPTIONNELLE."""
    color = {"OBLIGATOIRE": DANGER, "IMPORTANTE": WARN, "OPTIONNELLE": ACCENT}[level]
    return Paragraph(level, ParagraphStyle("crit", parent=CELLB, textColor=color))


_YES = ParagraphStyle("yes", parent=CELLB, textColor=GREEN, alignment=TA_CENTER, fontSize=9)
_NO = ParagraphStyle("no", parent=CELL, textColor=colors.HexColor("#B9C4CA"), alignment=TA_CENTER)
_SOON = ParagraphStyle("soon", parent=CELL, textColor=WARN, alignment=TA_CENTER, fontSize=6.6)
_PART = ParagraphStyle("part", parent=CELLB, textColor=WARN, alignment=TA_CENTER)
_OK = ParagraphStyle("ok", parent=CELLB, textColor=GREEN, alignment=TA_CENTER)


def yes():
    return Paragraph("&bull;", _YES)


def no():
    return Paragraph("&mdash;", _NO)


def part(txt="~"):
    return Paragraph(txt, _PART)


def soon(txt="prévu"):
    return Paragraph(txt, _SOON)


def ok(txt="fait"):
    return Paragraph(txt, _OK)


def part_banner(num, title):
    """Bandeau de partie pleine largeur (fond PRIMARY, texte blanc)."""
    t = Table([[Paragraph("PARTIE %s" % num,
                          ParagraphStyle("pn", parent=PART, fontSize=9,
                                         textColor=colors.HexColor("#BCCDD4"))),
                Paragraph(title, PART)]],
              colWidths=[26 * mm, USABLE_W - 26 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (0, 0), 8),
    ]))
    return t


def fig(drawing, caption):
    """Figure : dessin + légende centrée, gardés ensemble."""
    return KeepTogether([drawing, Paragraph(caption, CAP)])


# ══════════════════════════════════════════════════════════════════════════════
# Motif Baitly + chrome de page (couverture, footer, gabarit)
# ══════════════════════════════════════════════════════════════════════════════

def constellation(canvas, cx, cy, r, color, node_r=2.2, lw=0.7, center_scale=1.7):
    """Motif Baitly : 8 nœuds en octogone + nœud central + arêtes (orchestration)."""
    canvas.saveState()
    canvas.setStrokeColor(color)
    canvas.setFillColor(color)
    canvas.setLineWidth(lw)
    pts = []
    for k in range(8):
        a = math.pi / 2 - k * math.pi / 4
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    for (px, py) in pts:
        canvas.line(cx, cy, px, py)
    for (px, py) in pts:
        canvas.circle(px, py, node_r, fill=1, stroke=0)
    canvas.circle(cx, cy, node_r * center_scale, fill=1, stroke=0)
    canvas.restoreState()


def baitly_logo():
    """Logo Baitly dessiné (mark « orchestration » fin + wordmark « baitly »).
    Rendu délicat façon ADR : rayons minces + petits nœuds.
    NE PAS utiliser client/src/assets/Baitly_logo.png (ancien logo Clenzy)."""
    w, h = 70 * mm, 17 * mm
    d = Drawing(w, h)
    cx, cy, r = 8.5 * mm, h / 2, 6.2 * mm
    for k in range(8):
        a = math.pi / 2 - k * math.pi / 4
        px, py = cx + r * math.cos(a), cy + r * math.sin(a)
        d.add(Line(cx, cy, px, py, strokeColor=PRIMARY2, strokeWidth=0.7))
    for k in range(8):
        a = math.pi / 2 - k * math.pi / 4
        px, py = cx + r * math.cos(a), cy + r * math.sin(a)
        d.add(Circle(px, py, 1.15, fillColor=PRIMARY, strokeColor=None))
    d.add(Circle(cx, cy, 2.0, fillColor=PRIMARY, strokeColor=None))
    d.add(String(cx + r + 5 * mm, cy - 7.5, "baitly", fontName=FONT_BOLD, fontSize=23, fillColor=PRIMARY))
    return d


def _footer(canvas, doc):
    """Footer : filet fin + glyphe constellation + libellé. La pagination
    « p. X / Y » est tracée par NumberedCanvas (nombre total de pages)."""
    label = getattr(doc, "_footer_label", "Baitly")
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
    constellation(canvas, 19 * mm, 10.4 * mm, 2.4, colors.HexColor("#AEBEC6"),
                  node_r=0.8, lw=0.4, center_scale=1.6)
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 7)
    canvas.drawString(23 * mm, 9.4 * mm, label)
    canvas.restoreState()


def _on_content(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(2)
    canvas.line(18 * mm, A4[1] - 12 * mm, 42 * mm, A4[1] - 12 * mm)
    canvas.restoreState()
    _footer(canvas, doc)


def _on_cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    # Barre gradient arrondie.
    x, w, h = 18 * mm, A4[0] - 36 * mm, 7 * mm
    y = A4[1] - 24 * mm
    canvas.saveState()
    p = canvas.beginPath()
    p.roundRect(x, y, w, h, h / 2)
    canvas.clipPath(p, stroke=0, fill=0)
    canvas.linearGradient(x, y, x + w, y, [GRAD0, GRAD1], extend=True)
    canvas.restoreState()
    # Motif constellation en filigrane, grand, bas-droite (partiellement hors-page).
    constellation(canvas, A4[0] - 18 * mm, 24 * mm, 40 * mm, FAINT,
                  node_r=6.2, lw=1.6, center_scale=1.7)
    # Ligne de référence (source) au-dessus du footer, façon ADR.
    ref = getattr(doc, "_cover_ref", None)
    if ref:
        constellation(canvas, 19 * mm, 20.4 * mm, 2.4, colors.HexColor("#AEBEC6"),
                      node_r=0.8, lw=0.4, center_scale=1.6)
        canvas.setFillColor(MUTED)
        canvas.setFont(FONT, 7.5)
        canvas.drawString(23 * mm, 19.2 * mm, ref)
    canvas.restoreState()
    _footer(canvas, doc)


def make_doc(path, title="Baitly", footer_label=None, cover_ref=None):
    """Document Baitly : gabarit « cover » (1re page) + « content » (reste), pagination
    « p. X / Y » automatique. `cover_ref` = ligne de référence source sur la couverture.
    Le story bascule sur content via build_cover (NextPageTemplate)."""
    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=18 * mm, bottomMargin=16 * mm, title=title, author="Baitly")
    doc._footer_label = footer_label or title
    doc._cover_ref = cover_ref
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame], onPage=_on_cover),
        PageTemplate(id="content", frames=[frame], onPage=_on_content),
    ])
    # Pagination « p. X / Y » automatique (NumberedCanvas) sans changer l'appel .build().
    _orig_build = doc.build

    def _build(flowables, **kw):
        kw.setdefault("canvasmaker", NumberedCanvas)
        return _orig_build(flowables, **kw)

    doc.build = _build
    return doc


def build_cover(story, eyebrow, title_lines, subtitle, meta_rows, meta_label_w=32 * mm):
    """Ajoute la couverture Baitly au story (logo + eyebrow + titre bi-ton + filet teal
    + sous-titre + table meta SANS en-tête façon ADR), puis bascule sur le gabarit
    content et saute une page.

    title_lines : liste de lignes HTML (bi-ton via <font color='#6B8A9A'>…</font>).
    meta_rows   : liste de (label, valeur) ; la 1re valeur est mise en gras."""
    story.append(Spacer(1, 22 * mm))
    story.append(baitly_logo())
    story.append(Spacer(1, 15 * mm))
    story.append(Paragraph(eyebrow, EYEBROW))
    for ln in title_lines:
        story.append(Paragraph(ln, TIT))
    story.append(Spacer(1, 3 * mm))
    story.append(HRFlowable(width=22 * mm, thickness=2.4, color=ACCENT,
                            spaceBefore=1, spaceAfter=5, hAlign="LEFT"))
    story.append(Paragraph(subtitle, SUB))
    story.append(Spacer(1, 12 * mm))
    # Table meta façon ADR : COINS ARRONDIS, pas de ligne d'en-tête ; colonne label sur
    # fond clair, colonne valeur ; 1re valeur en gras.
    _lab = ParagraphStyle("mlab", parent=CELL, fontName=FONT_DEMI, textColor=MUTED, fontSize=8.5, leading=11)
    _val = ParagraphStyle("mval", parent=CELL, fontSize=8.5, leading=11.5, textColor=INK)
    _valb = ParagraphStyle("mvalb", parent=_val, fontName=FONT_DEMI)
    rows = [[Paragraph(k, _lab), Paragraph(v, _valb if i == 0 else _val)]
            for i, (k, v) in enumerate(meta_rows)]
    mt = RoundedTable(rows, colWidths=[meta_label_w, USABLE_W - meta_label_w])
    mt.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("BACKGROUND", (0, 0), (0, -1), LIGHT),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINE),
        ("LINEAFTER", (0, 0), (0, -1), 0.5, LINE),
    ]))
    story.append(mt)
    story.append(NextPageTemplate("content"))
    story.append(PageBreak())
