#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genere les 2 livrables PDF de l'analyse concurrentielle Clenzy depuis les CSV de data/."""
import csv, os, re
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, PageBreak)
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle, Group

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")
PDF = os.path.join(BASE, "pdf")
os.makedirs(PDF, exist_ok=True)

PRIMARY = colors.HexColor("#3E5A68")
PRIMARY2 = colors.HexColor("#6B8A9A")
ACCENT = colors.HexColor("#4A9B8E")
INK = colors.HexColor("#1F2A30")
MUTED = colors.HexColor("#5C6B73")
LIGHT = colors.HexColor("#EEF2F4")
LINE = colors.HexColor("#C9D4D9")

def score_color(s):
    try:
        s = float(s)
    except (ValueError, TypeError):
        return None
    s = max(0.0, min(3.0, s))
    if s <= 1.5:
        t = s / 1.5
        r = 0.83 + (0.93 - 0.83) * t
        g = 0.30 + (0.71 - 0.30) * t
        b = 0.29 + (0.27 - 0.29) * t
    else:
        t = (s - 1.5) / 1.5
        r = 0.93 + (0.17 - 0.93) * t
        g = 0.71 + (0.50 - 0.71) * t
        b = 0.27 + (0.37 - 0.27) * t
    return colors.Color(r, g, b)

def text_on(c):
    lum = 0.299 * c.red + 0.587 * c.green + 0.114 * c.blue
    return colors.white if lum < 0.56 else INK

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=17,
                    textColor=PRIMARY, spaceBefore=4, spaceAfter=8, leading=20)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=12.5,
                    textColor=PRIMARY, spaceBefore=12, spaceAfter=5, leading=15)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="Helvetica-Bold", fontSize=10.5,
                    textColor=ACCENT, spaceBefore=8, spaceAfter=3, leading=13)
BODY = ParagraphStyle("BODY", parent=ss["Normal"], fontName="Helvetica", fontSize=9.2,
                      textColor=INK, leading=13, spaceAfter=5)
SMALL = ParagraphStyle("SMALL", parent=BODY, fontSize=7.6, textColor=MUTED, leading=9.5)
CELL = ParagraphStyle("CELL", parent=BODY, fontSize=7.2, leading=8.6, spaceAfter=0)
CELLB = ParagraphStyle("CELLB", parent=CELL, fontName="Helvetica-Bold")
TIT = ParagraphStyle("TIT", parent=BODY, fontName="Helvetica-Bold", fontSize=26,
                     textColor=PRIMARY, leading=30, alignment=TA_LEFT)
SUB = ParagraphStyle("SUB", parent=BODY, fontSize=12, textColor=MUTED, leading=16)

USABLE_W = A4[0] - 36 * mm

def read_csv(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return list(csv.reader(f))

def on_page(canvas, doc):
    canvas.saveState()
    # Fond blanc explicite : sans lui, le fond de page est transparent et un lecteur PDF en
    # mode sombre l'affiche en noir (texte fonce invisible -> ecran noir).
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, A4[1] - 6 * mm, A4[0], 6 * mm, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(18 * mm, 10 * mm, "Clenzy - Analyse concurrentielle PMS . 2026-06-13")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, "p. %d" % doc.page)
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
    canvas.restoreState()

def make_doc(path):
    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=16 * mm, bottomMargin=16 * mm, title="Analyse concurrentielle Clenzy")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=on_page)])
    return doc

ABBR = {"Clenzy":"Clenzy","Hostaway":"Hwy","Guesty":"Gst","Smoobu":"Smo","Lodgify":"Lod",
        "Hospitable":"Hsp","Avantio":"Avo","Smily":"Sly","TouchStay":"Touch","Duve":"Duve",
        "Chekin":"Chekin","EnsoConnect":"Enso","HostfullyGuidebooks":"Hostf"}

# Colonne "Clenzy V2" : nouveau score (post Phases 0-4) des SEULES fonctionnalites reellement
# ameliorees. Cle = libelle exact de la fonctionnalite (col 0 du CSV). Les autres = inchangees.
# Honnete : socle livre & teste ; la finition externe (APIs)/front reste tracee en HORS-PERIMETRE.
CLENZY_V2 = {
    "01-channel-management.csv": {
        "Sync temps reel dispo/prix (2-way)": "3",
        "Sync restrictions (min stay/rules)": "3",
    },
    "02-booking-engine.csv": {
        "RTL / arabe (booking direct)": "2",
        "Multi-langue interface booking": "3",
        "Email de confirmation de reservation": "3",
    },
    "03-calendrier-multitenant.csv": {
        "Edition groupee (rates / min-stay / blocages)": "3",
    },
    "04-pricing-yield.csv": {
        "Moteur IA proprietaire livre en prod": "2",
        "Recommandations occupancy-based / market data": "2",
        "Taxes auto (sejour / TVA) integrees": "3",
    },
    "07-guest-experience.csv": {
        "Collecte de caution / depot (pre-autorisation)": "2",
        "Taxe de sejour (calcul + collecte)": "3",
    },
    "08-finance-compta.csv": {
        "Gestion depot de garantie/caution (auth-hold)": "2",
        "E-invoicing Factur-X / pont PDP (reforme FR)": "2",
        "Multi-devise": "3",
    },
    "09-reporting-analytics.csv": {
        "Comparaisons periodiques (N vs N-1)": "3",
        "Report builder / rapports personnalisables": "2",
    },
    "12-admin-securite.csv": {
        "2FA / MFA": "2",
    },
    "13-ia-automatisation.csv": {
        "IA de pricing / revenue management": "2",
        "Detection d'anomalies / fraude paiement": "2",
    },
}

def matrix_table(rows, v2_overrides=None):
    """Insere une colonne 'Clenzy V2' (post Phases 0-4) juste apres la colonne Clenzy.
    Colonnes rendues : Fonctionnalite | Clenzy | Clenzy V2 | <autres acteurs> | (Conf)."""
    v2_overrides = v2_overrides or {}
    header = rows[0]
    has_conf = header[-1].strip().lower().startswith("confiance")
    actor_cols = list(range(1, len(header) - 1)) if has_conf else list(range(1, len(header)))
    clenzy_ci = actor_cols[0]
    other_cols = actor_cols[1:]
    n_render = 2 + len(other_cols)  # Clenzy + Clenzy V2 + autres
    nfeat = USABLE_W * 0.28
    nconf = USABLE_W * 0.10 if has_conf else 0
    aw = (USABLE_W - nfeat - nconf) / n_render
    colw = [nfeat, aw, aw] + [aw] * len(other_cols) + ([nconf] if has_conf else [])
    hc = ParagraphStyle("hh", parent=CELLB, alignment=TA_CENTER, fontSize=6.6)
    hdr = [Paragraph("<b>Fonctionnalite</b>", CELLB),
           Paragraph("<b>Clenzy</b>", hc),
           Paragraph("<b>Clenzy V2</b>", ParagraphStyle("hv2", parent=hc, textColor=colors.white))]
    for ci in other_cols:
        name = header[ci].strip()
        hdr.append(Paragraph("<b>%s</b>" % ABBR.get(name, name), hc))
    if has_conf:
        hdr.append(Paragraph("<b>Conf.</b>", hc))
    data = [hdr]
    style = [("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
             ("BACKGROUND", (2, 0), (2, 0), ACCENT),  # en-tete V2 a la teinte d'accent
             ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
             ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
             ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5)]
    ri = 0
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        ri += 1
        feat = row[0].strip()
        line = [Paragraph(row[0], CELL)]
        cval = row[clenzy_ci].strip() if clenzy_ci < len(row) else ""
        # Clenzy (col 1)
        cc = score_color(cval)
        cst = ParagraphStyle("cc", parent=CELL, alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=7.2)
        if cc is not None:
            cst = ParagraphStyle("cc", parent=cst, textColor=text_on(cc))
            style.append(("BACKGROUND", (1, ri), (1, ri), cc))
        line.append(Paragraph(cval, cst))
        # Clenzy V2 (col 2)
        v2 = v2_overrides.get(feat, cval)
        changed = (v2 != cval)
        vc = score_color(v2)
        vst = ParagraphStyle("v2", parent=CELL, alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=7.2)
        if vc is not None:
            vst = ParagraphStyle("v2", parent=vst, textColor=text_on(vc))
            style.append(("BACKGROUND", (2, ri), (2, ri), vc))
        line.append(Paragraph(v2, vst))
        if changed:
            style.append(("BOX", (2, ri), (2, ri), 1.1, ACCENT))
        # autres acteurs (cols 3..)
        for k, ci in enumerate(other_cols, start=3):
            val = row[ci].strip() if ci < len(row) else ""
            c = score_color(val)
            st = ParagraphStyle("oc", parent=CELL, alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=7.2)
            if c is not None:
                st = ParagraphStyle("oc", parent=st, textColor=text_on(c))
                style.append(("BACKGROUND", (k, ri), (k, ri), c))
            line.append(Paragraph(val, st))
        if has_conf:
            idx = actor_cols[-1] + 1
            conf = row[idx].strip() if idx < len(row) else ""
            line.append(Paragraph(conf, ParagraphStyle("conf", parent=CELL, alignment=TA_CENTER, fontSize=6.4, textColor=MUTED)))
        data.append(line)
        style.append(("BACKGROUND", (0, ri), (0, ri), LIGHT if ri % 2 else colors.white))
    t = Table(data, colWidths=colw, repeatRows=1)
    t.setStyle(TableStyle(style))
    return t

LEGEND = Paragraph('<font size=7 color="#5C6B73">Score : '
                   '<font backColor="#D44C4A" color="white"> 0 Absent </font> '
                   '<font backColor="#ECB545" color="#1F2A30"> 1 Basique </font> '
                   '<font backColor="#B9C24F" color="#1F2A30"> 2 Standard </font> '
                   '<font backColor="#2C8059" color="white"> 3 Avance </font> &nbsp; '
                   'Acteurs : Hwy=Hostaway . Gst=Guesty . Smo=Smoobu . Lod=Lodgify . Hsp=Hospitable . Avo=Avantio . Sly=Smily</font>', SMALL)

def positioning_map():
    W, H = USABLE_W, 235
    d = Drawing(W, H)
    d.add(Rect(0, 0, W, H, fillColor=colors.white, strokeColor=LINE, strokeWidth=0.6))
    x0, y0, x1, y1 = 70, 38, W - 18, H - 22
    d.add(Line(x0, y0, x1, y0, strokeColor=MUTED, strokeWidth=0.8))
    d.add(Line(x0, y0, x0, y1, strokeColor=MUTED, strokeWidth=0.8))
    d.add(String(x0 + (x1 - x0) / 2 - 80, 14, "Couverture fonctionnelle (breadth) ->", fontName="Helvetica", fontSize=8, fillColor=MUTED))
    g = Group(String(0, 0, "Specialisation conciergerie / conformite FR ->", fontName="Helvetica", fontSize=8, fillColor=MUTED))
    g.translate(26, y0 + 2)
    g.rotate(90)
    d.add(g)
    pts = {"Clenzy": (1.86, 3.0, ACCENT, True), "Guesty": (2.52, 1.8, PRIMARY2, False),
           "Hostaway": (2.31, 1.6, PRIMARY2, False), "Avantio": (1.96, 2.2, PRIMARY2, False),
           "Smily": (1.89, 2.1, PRIMARY2, False), "Hospitable": (1.92, 1.3, PRIMARY2, False),
           "Lodgify": (1.81, 1.2, PRIMARY2, False), "Smoobu": (1.32, 1.5, PRIMARY2, False)}
    bxmin, bxmax, symin, symax = 1.2, 2.6, 1.0, 3.1
    for name, (bx, sy, col, hi) in pts.items():
        px = x0 + (bx - bxmin) / (bxmax - bxmin) * (x1 - x0)
        py = y0 + (sy - symin) / (symax - symin) * (y1 - y0)
        d.add(Circle(px, py, 7 if hi else 5, fillColor=col, strokeColor=colors.white, strokeWidth=1.2))
        d.add(String(px + 9, py - 3, name, fontName="Helvetica-Bold" if hi else "Helvetica",
                     fontSize=8 if hi else 7.5, fillColor=INK if hi else MUTED))
    return d

def ranking_chart(ranking):
    W, H = USABLE_W, 150
    d = Drawing(W, H)
    x0, maxv = 92, 3.0
    barw = (W - x0 - 30)
    n = len(ranking)
    rowh = (H - 10) / n
    for i, (name, val) in enumerate(ranking):
        y = H - (i + 1) * rowh + 4
        c = ACCENT if name == "Clenzy" else PRIMARY2
        w = barw * (val / maxv)
        d.add(String(x0 - 6, y + rowh / 2 - 6, name, fontName="Helvetica-Bold" if name == "Clenzy" else "Helvetica",
                     fontSize=8, fillColor=INK if name == "Clenzy" else MUTED, textAnchor="end"))
        d.add(Rect(x0, y, w, rowh - 7, fillColor=c, strokeColor=None))
        d.add(String(x0 + w + 4, y + rowh / 2 - 6, "%.2f" % val, fontName="Helvetica-Bold", fontSize=8, fillColor=INK))
    return d

def swot_grid(forces, faiblesses, opportunites, menaces):
    def cell(title, items, fg):
        para = [Paragraph("<b>%s</b>" % title, ParagraphStyle("st", parent=CELL, fontSize=9, textColor=fg, spaceAfter=3))]
        for it in items:
            para.append(Paragraph("- " + it, ParagraphStyle("si", parent=CELL, fontSize=7.3, textColor=INK, leading=9.2, spaceAfter=2)))
        return para
    data = [[cell("FORCES", forces, colors.HexColor("#1E6B4F")), cell("FAIBLESSES", faiblesses, colors.HexColor("#A23B2E"))],
            [cell("OPPORTUNITES", opportunites, colors.HexColor("#2A5C7A")), cell("MENACES", menaces, colors.HexColor("#8A5A1E"))]]
    t = Table(data, colWidths=[USABLE_W / 2] * 2, rowHeights=[150, 150])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#E6F2EC")),
                           ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#FBE9E6")),
                           ("BACKGROUND", (0, 1), (0, 1), colors.HexColor("#E6EEF4")),
                           ("BACKGROUND", (1, 1), (1, 1), colors.HexColor("#FBF1E0")),
                           ("GRID", (0, 0), (-1, -1), 1.2, colors.white),
                           ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                           ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    return t

def roadmap_columns(roadmap_rows):
    by_h = {"Now": [], "Next": [], "Later": []}
    for r in roadmap_rows[1:]:
        if len(r) < 9:
            continue
        by_h.get(r[8], []).append((r[0], r[7], r[2]))
    titles = ["NOW (0-3 mois)", "NEXT (3-9 mois)", "LATER (9+ mois)"]
    head = [Paragraph("<b>%s</b>" % titles[i], ParagraphStyle("rh", parent=CELL, fontSize=9.5, textColor=colors.white, alignment=TA_CENTER)) for i in range(3)]
    def body(items):
        cells = []
        for (titre, rice, cat) in items[:14]:
            cells.append(Paragraph("<b>%s</b> <font color='#5C6B73' size=6>(%s)</font><br/><font color='#5C6B73' size=6>%s</font>" % (titre, rice, cat),
                                   ParagraphStyle("ri", parent=CELL, fontSize=6.8, leading=8.2, spaceAfter=3)))
        return cells
    data = [head, [body(by_h["Now"]), body(by_h["Next"]), body(by_h["Later"])]]
    t = Table(data, colWidths=[USABLE_W / 3] * 3)
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("BACKGROUND", (0, 0), (0, 0), PRIMARY), ("BACKGROUND", (1, 0), (1, 0), PRIMARY2),
                           ("BACKGROUND", (2, 0), (2, 0), MUTED), ("BACKGROUND", (0, 1), (-1, 1), colors.white),
                           ("ALIGN", (0, 0), (-1, 0), "CENTER"), ("TOPPADDING", (0, 0), (-1, 0), 4), ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
                           ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                           ("TOPPADDING", (0, 1), (-1, 1), 6), ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
                           ("BOX", (0, 0), (0, -1), 0.6, LINE), ("BOX", (1, 0), (1, -1), 0.6, LINE), ("BOX", (2, 0), (2, -1), 0.6, LINE)]))
    return t

def roadmap_table(roadmap_rows, top=22):
    body = sorted(roadmap_rows[1:], key=lambda r: float(r[7]) if len(r) > 7 else 0, reverse=True)[:top]
    head = ["Initiative", "Domaine", "Categorie", "RICE", "Eff.", "Horizon"]
    data = [[Paragraph("<b>%s</b>" % h, ParagraphStyle("th", parent=CELLB, fontSize=7.3, textColor=colors.white,
              alignment=TA_CENTER if h in ("RICE", "Eff.", "Horizon") else TA_LEFT)) for h in head]]
    style = [("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
             ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
             ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
             ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5)]
    for i, r in enumerate(body, start=1):
        rice = float(r[7])
        cc = score_color(min(3.0, rice / 2.7))
        data.append([Paragraph(r[0], CELL),
                     Paragraph(r[1], ParagraphStyle("d", parent=CELL, fontSize=6.6, textColor=MUTED)),
                     Paragraph(r[2], ParagraphStyle("d", parent=CELL, fontSize=6.6, textColor=MUTED)),
                     Paragraph("<b>%.2f</b>" % rice, ParagraphStyle("rc", parent=CELL, alignment=TA_CENTER, fontSize=7.4, textColor=text_on(cc))),
                     Paragraph(r[6], ParagraphStyle("e", parent=CELL, alignment=TA_CENTER, fontSize=7)),
                     Paragraph(r[8], ParagraphStyle("h", parent=CELL, alignment=TA_CENTER, fontSize=7))])
        style.append(("BACKGROUND", (3, i), (3, i), cc))
        style.append(("BACKGROUND", (0, i), (2, i), LIGHT if i % 2 else colors.white))
        style.append(("BACKGROUND", (4, i), (5, i), LIGHT if i % 2 else colors.white))
    t = Table(data, colWidths=[USABLE_W * x for x in (0.40, 0.18, 0.16, 0.09, 0.07, 0.10)], repeatRows=1)
    t.setStyle(TableStyle(style))
    return t

def bullet(txt, style=BODY):
    return Paragraph("- " + txt, style)

def evolution_callout(g_before, g_after, rank_before, rank_after):
    """Bandeau avant -> apres du score global pondere + rang."""
    def cell(label, value, sub):
        return [Paragraph("<b>%s</b>" % label, ParagraphStyle("el", parent=CELL, fontSize=8, textColor=colors.white, alignment=TA_CENTER)),
                Paragraph("<b>%s</b>" % value, ParagraphStyle("ev", parent=CELL, fontSize=22, textColor=colors.white, alignment=TA_CENTER, leading=24)),
                Paragraph(sub, ParagraphStyle("es", parent=CELL, fontSize=7, textColor=colors.white, alignment=TA_CENTER))]
    arrow = [Paragraph("", CELL), Paragraph("->", ParagraphStyle("ar", parent=CELL, fontSize=20, textColor=ACCENT, alignment=TA_CENTER)), Paragraph("", CELL)]
    data = [[cell("Score global - AVANT", "%.2f" % g_before, "/3 . rang %s" % rank_before),
             arrow,
             cell("Score global - APRES", "%.2f" % g_after, "/3 . rang %s" % rank_after)]]
    t = Table(data, colWidths=[USABLE_W * 0.42, USABLE_W * 0.16, USABLE_W * 0.42])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), MUTED), ("BACKGROUND", (2, 0), (2, 0), colors.HexColor("#2C8059")),
                           ("BACKGROUND", (1, 0), (1, 0), colors.white), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                           ("BOX", (1, 0), (1, 0), 0.6, LINE),
                           ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    return t

def evolution_table(rows):
    """rows = CSV 60-evolution-scores : Domaine, Avant, Apres, Realisations (derniere = total)."""
    head = [Paragraph("<b>%s</b>" % h, ParagraphStyle("th", parent=CELLB, fontSize=7.4, textColor=colors.white,
            alignment=(TA_CENTER if h in ("Avant", "Apres", "Δ") else TA_LEFT)))
            for h in ["Domaine", "Avant", "Apres", "Δ", "Realisations (Phases 0-4)"]]
    data = [head]
    style = [("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
             ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
             ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
             ("TOPPADDING", (0, 0), (-1, -1), 2.6), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6)]
    body = rows[1:]
    last = len(body) - 1
    for i, r in enumerate(body):
        is_total = (i == last)
        before, after = float(r[1]), float(r[2])
        delta = after - before
        cb, ca = score_color(before), score_color(after)
        dtxt = ("+%.1f" % delta) if delta > 0.001 else ("0" if abs(delta) <= 0.001 else "%.1f" % delta)
        dcol = colors.HexColor("#2C8059") if delta > 0.001 else MUTED
        if is_total:
            line = [Paragraph("<b>%s</b>" % r[0], ParagraphStyle("d", parent=CELL, fontSize=7.6, textColor=colors.white)),
                    Paragraph("<b>%.2f</b>" % before, ParagraphStyle("a", parent=CELL, alignment=TA_CENTER, fontSize=7.8, textColor=colors.white)),
                    Paragraph("<b>%.2f</b>" % after, ParagraphStyle("b", parent=CELL, alignment=TA_CENTER, fontSize=7.8, textColor=colors.white)),
                    Paragraph("<b>%s</b>" % dtxt, ParagraphStyle("dd", parent=CELL, alignment=TA_CENTER, fontSize=7.8, textColor=colors.white)),
                    Paragraph(r[3], ParagraphStyle("rz", parent=CELL, fontSize=6.8, textColor=colors.white))]
            data.append(line)
            style.append(("BACKGROUND", (0, i + 1), (-1, i + 1), colors.HexColor("#27323A")))
            continue
        line = [Paragraph(r[0], ParagraphStyle("d", parent=CELL, fontSize=7.2)),
                Paragraph("%.1f" % before, ParagraphStyle("a", parent=CELL, alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=7.4, textColor=text_on(cb))),
                Paragraph("%.1f" % after, ParagraphStyle("b", parent=CELL, alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=7.4, textColor=text_on(ca))),
                Paragraph("<b>%s</b>" % dtxt, ParagraphStyle("dd", parent=CELL, alignment=TA_CENTER, fontSize=7.4, textColor=dcol)),
                Paragraph(r[3], ParagraphStyle("rz", parent=CELL, fontSize=6.6, textColor=INK, leading=8))]
        data.append(line)
        style.append(("BACKGROUND", (1, i + 1), (1, i + 1), cb))
        style.append(("BACKGROUND", (2, i + 1), (2, i + 1), ca))
        style.append(("BACKGROUND", (0, i + 1), (0, i + 1), LIGHT if i % 2 else colors.white))
        style.append(("BACKGROUND", (4, i + 1), (4, i + 1), LIGHT if i % 2 else colors.white))
    t = Table(data, colWidths=[USABLE_W * x for x in (0.26, 0.08, 0.08, 0.07, 0.51)], repeatRows=1)
    t.setStyle(TableStyle(style))
    return t

def build_full():
    doc = make_doc(os.path.join(PDF, "analyse-concurrentielle.pdf"))
    S = [Spacer(1, 60), Paragraph("Analyse concurrentielle", TIT), Paragraph("du PMS <b>Clenzy</b>", TIT), Spacer(1, 14),
         Paragraph("Positionnement vs PMS concurrents et societes de service . Strategie &amp; roadmap priorisee", SUB), Spacer(1, 30)]
    cover = Table([["Date", "13 juin 2026"],
                   ["Perimetre", "13 domaines fonctionnels . inventaire adosse au code"],
                   ["Panel PMS", "Hostaway, Guesty, Smoobu, Lodgify, Hospitable, Avantio, Smily"],
                   ["Specialistes livret", "Touch Stay, Duve, Chekin, Enso Connect, Hostfully"],
                   ["Societes de service", "GuestReady, Houst, Pass the Keys, Cocoonr, Welkeys..."],
                   ["Methode", "Scoring 0-3, donnees concurrents datees + sourcees + confiance"]],
                  colWidths=[USABLE_W * 0.28, USABLE_W * 0.72])
    cover.setStyle(TableStyle([("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                               ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY), ("TEXTCOLOR", (1, 0), (1, -1), INK),
                               ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                               ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    S += [cover, Spacer(1, 28),
          Paragraph('<font color="#5C6B73" size=8><i>Confidentiel - usage interne. Donnees concurrents = veille datee '
                    '(2025-2026), chaque chiffre porte un niveau de confiance. Aucune donnee concurrent inventee : '
                    '"non documente" le cas echeant.</i></font>', SMALL), PageBreak()]

    S.append(Paragraph("Sommaire", H1))
    for it in ["1. Synthese executive", "2. Matrice de comparaison globale (heatmap) &amp; classement",
               "3. Carte de positionnement (double axe)", "4. SWOT consolidee",
               "5. Matrices detaillees par domaine (13)", "6. Axes strategiques",
               "7. Roadmap priorisee (RICE) - Now / Next / Later",
               "8. Plan multi-pays &amp; execution technique (amendement 2026-06-14)",
               "9. Evolution post-implementation (Phases 0-4) - avant / apres",
               "10. Annexe - sources datees &amp; reserves"]:
        S.append(Paragraph(it, ParagraphStyle("toc", parent=BODY, fontSize=10.5, spaceAfter=7, leftIndent=6)))
    S.append(PageBreak())

    S.append(Paragraph("1. Synthese executive", H1))
    S.append(Paragraph("Positionnement en une phrase", H3))
    S.append(Paragraph("<b>Clenzy n'est pas le PMS le plus complet du marche - il est le PMS le plus complet pour faire "
                       "tourner une conciergerie francaise en conformite</b> (reversements multi-proprietaires, fiscalite NF, "
                       "operations terrain), a condition d'assumer cette niche, de deverrouiller son IA deja construite, et "
                       "de corriger son pricing sous-valorise.", BODY))
    S.append(Paragraph("Constats cles", H3))
    for t in ["Sur la couverture fonctionnelle brute, Clenzy se classe <b>6e/8</b> (score pondere 1,86) - mais son profil est "
              "<b>pointu, pas plat</b> : n.1 du panel sur Mobile (2,5), Finance/Compta (2,2) et Operations (2,2), co-leader sur "
              "le Calendrier/multi-tenant (2,6).",
              "Une grande partie du retard (IA, pricing, reporting) est du <b>potentiel verrouille</b> : fonctions codees mais "
              "coupees par feature-flag. Les activer ferait passer le score a ~2,0 a cout faible.",
              "<b>Fosse defendable</b> : la conformite fiscale francaise (NF, FEC, facture de commission) - qu'aucun concurrent "
              "du panel n'adresse - couplee a un trust accounting reel (Wallet/grand livre en partie double/escrow).",
              "<b>Axe societes de service</b> : Clenzy est un <b>outil B2B2C (l'OS de la conciergerie), pas un substitut</b>. "
              "Il arme le back-office (reversements, releves, terrain) que les conciergeries operent au manuel.",
              "<b>Risques</b> : pricing par siege massivement sous-valorise vs marche par logement ; ecarts marketing/realite "
              "(4 QTSP FR, 39 EUR/bien, SMS) ; echeances reglementaires FR/UE (registre, Factur-X) proches."]:
        S.append(bullet(t))
    S.append(PageBreak())

    S.append(Paragraph("2. Matrice de comparaison globale", H1))
    S.append(Paragraph("Score par domaine (0-3) et score global pondere. Vert = avance, rouge = absent. La colonne "
                       "<b>Clenzy V2</b> (en-tete a la teinte d'accent) = score apres les Phases 0-4 (detail section 9) ; "
                       "cellules encadrees = domaines ameliores.", BODY))
    rows = read_csv("00-matrice-globale.csv")
    last = len(rows) - 1
    ev = read_csv("60-evolution-scores.csv")
    v2map = {r[0].strip(): r[2].strip() for r in ev[1:] if r}
    n_actors = len(rows[0]) - 2  # acteurs (Clenzy + concurrents)
    hc = ParagraphStyle("p", parent=CELLB, alignment=TA_CENTER, fontSize=6.8)
    hdr2 = [Paragraph("<b>Domaine</b>", CELLB),
            Paragraph("<b>Pds</b>", ParagraphStyle("pw", parent=hc, fontSize=7))]
    for idx, nm in enumerate(rows[0][2:]):
        hdr2.append(Paragraph("<b>%s</b>" % ABBR.get(nm, nm), hc))
        if idx == 0:  # apres Clenzy
            hdr2.append(Paragraph("<b>Clenzy V2</b>", ParagraphStyle("pv2", parent=hc, fontSize=6.2, textColor=colors.white)))
    gh = [hdr2]
    style = [("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("FONTSIZE", (0, 0), (-1, -1), 7.4),
             ("BACKGROUND", (3, 0), (3, 0), ACCENT),  # en-tete V2
             ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
             ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
             ("TOPPADDING", (0, 0), (-1, -1), 3.2), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.2)]
    for ri, r in enumerate(rows[1:], start=1):
        is_total = ri == last
        tcol = colors.white if is_total else INK
        line = [Paragraph(("<b>%s</b>" if is_total else "%s") % r[0], ParagraphStyle("gd", parent=CELL, fontSize=7.2, textColor=tcol)),
                Paragraph(r[1], ParagraphStyle("gw", parent=CELL, alignment=TA_CENTER, fontSize=7, textColor=tcol))]
        col = 2
        for j, val in enumerate(r[2:]):
            c = score_color(val) if not is_total else None
            st = ParagraphStyle("gc", parent=CELL, alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=7.4,
                                textColor=(colors.white if is_total else INK))
            if c is not None:
                st = ParagraphStyle("gc", parent=st, textColor=text_on(c))
                style.append(("BACKGROUND", (col, ri), (col, ri), c))
            line.append(Paragraph(val, st))
            col += 1
            if j == 0:  # inserer Clenzy V2 juste apres Clenzy
                v2val = v2map.get(r[0].strip(), val)
                changed = (v2val != val)
                vc = score_color(v2val) if not is_total else None
                vst = ParagraphStyle("gv2", parent=CELL, alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=7.4,
                                     textColor=(colors.white if is_total else INK))
                if vc is not None:
                    vst = ParagraphStyle("gv2", parent=vst, textColor=text_on(vc))
                    style.append(("BACKGROUND", (col, ri), (col, ri), vc))
                line.append(Paragraph(v2val, vst))
                if changed and not is_total:
                    style.append(("BOX", (col, ri), (col, ri), 1.1, ACCENT))
                col += 1
        gh.append(line)
        if is_total:
            style.append(("BACKGROUND", (0, ri), (-1, ri), colors.HexColor("#27323A")))
            style.append(("TEXTCOLOR", (0, ri), (-1, ri), colors.white))
    nc = n_actors + 1  # +1 pour Clenzy V2
    cw = [USABLE_W * 0.30, USABLE_W * 0.06] + [USABLE_W * 0.64 / nc] * nc
    gt = Table(gh, colWidths=cw, repeatRows=1)
    gt.setStyle(TableStyle(style))
    S += [gt, Spacer(1, 4), LEGEND, Spacer(1, 12), Paragraph("Classement global (score pondere /3)", H3)]
    ranking = sorted([(rows[0][2 + i], float(rows[last][2 + i])) for i in range(8)], key=lambda x: x[1], reverse=True)
    S += [ranking_chart(ranking), PageBreak()]

    S.append(Paragraph("3. Carte de positionnement (double axe)", H1))
    S.append(Paragraph("Couverture fonctionnelle (breadth) en abscisse . specialisation conciergerie / conformite FR en "
                       "ordonnee. Clenzy occupe un coin distinct : breadth moyenne mais specialisation la plus haute du panel "
                       "- une niche defendable que les leaders generalistes (Guesty, Hostaway) n'occupent pas.", BODY))
    S += [Spacer(1, 6), positioning_map(), Spacer(1, 10), Paragraph("Lecture strategique", H3)]
    for t in ["Guesty / Hostaway dominent la <b>breadth</b> mais restent au milieu sur la specialisation FR/conciergerie.",
              "Clenzy doit <b>assumer la niche</b> (haut-gauche) plutot que courir la breadth - sinon risque de stuck in the middle.",
              "Avantio et Smily sont les concurrents les plus proches du coin de Clenzy (presence FR/EU + orientation agences)."]:
        S.append(bullet(t))
    S.append(PageBreak())

    S.append(Paragraph("4. SWOT consolidee", H1))
    S.append(swot_grid(
        ["Conformite fiscale FR de bunker (NF + FEC + facture de commission) - unique au panel.",
         "Trust accounting reel &amp; inclus (Wallet, grand livre partie double, escrow, split).",
         "Reversements multi-proprietaires : 4 rails payout (Stripe Connect, Wise, Open Banking, SEPA XML).",
         "Operations terrain : pipeline check-out vers menage auto + routing geo + app mobile native (85 ecrans).",
         "Calendrier anti-overbooking transactionnel ; multi-tenant fail-closed.",
         "Socle IA moderne : assistant multi-provider + RAG pgvector + 27 tools + memoire."],
        ["Capacites IA livrees mais desactivees (pricing, messagerie, multi-agent, analytics).",
         "Channel = modele revendeur (Channex) sans statut partenaire OTA fort ; OTA traine/MENA en stub.",
         "Booking sans site builder / SEO -> promesse moins d'OTA affaiblie.",
         "Communication : SMS absent, pas d'autopilot, pas de KB messagerie.",
         "Caution/depot absent (seul acteur a 0) ; KYC voyageur non branche (stubs).",
         "Pricing par siege : sous-valorisation forte vs marche per-listing ; pas de Zapier/Make."],
        ["Vague reglementaire FR/UE : loi Le Meur (registre), UE 2024/1028, Factur-X 2026-2027.",
         "Conciergeries sous-outillees sur le back-office -> marche B2B2C adressable.",
         "Direct booking comme levier anti-commission OTA (si booking engine complete).",
         "Deverrouillage IA : activer l'existant pour rattraper la perception PMS IA-natif.",
         "Trust accounting / reversements : besoin marche sous-servi hors Guesty."],
        ["Consolidation (Hostaway licorne 2025, HomeToGo-Interhome) -> course capital/features.",
         "Banalisation de l'IA (Guesty built on AI, AI-natifs Jurny/Enso).",
         "Desintermediation OTA (co-hosting Airbnb, partenariat Airbnb-Guesty) - a verifier.",
         "Contraction du parc STR FR (loi Le Meur, plafond 120 nuits) -> TAM amateur reduit.",
         "Ecarts marketing/realite = risque de credibilite commerciale."]))
    S.append(PageBreak())

    S.append(Paragraph("5. Matrices detaillees par domaine", H1))
    S.append(Paragraph("Comparaison a la fonctionnalite pres (score 0-3 + niveau de confiance). "
                       "Source : rapports benchmark/ et CSV data/. La colonne <b>Clenzy V2</b> (en-tete a la teinte d'accent) "
                       "donne le score <b>apres les Phases 0-4</b> ; les cellules <b>encadrees</b> marquent une fonctionnalite "
                       "amelioree (les autres = identiques a Clenzy V1). Re-evaluation interne honnete : seules les "
                       "fonctionnalites reellement livrees &amp; testees bougent.", BODY))
    S += [Spacer(1, 2), LEGEND]
    domains = [("01-channel-management.csv", "Domaine 1 - Channel Management"),
               ("02-booking-engine.csv", "Domaine 2 - Moteur de reservation &amp; site direct"),
               ("03-calendrier-multitenant.csv", "Domaine 3 - Calendrier &amp; multi-logements / multi-tenant"),
               ("04-pricing-yield.csv", "Domaine 4 - Tarification dynamique / Yield"),
               ("05-operations.csv", "Domaine 5 - Operations : Menage &amp; Maintenance"),
               ("06-communication.csv", "Domaine 6 - Communication voyageurs"),
               ("07-guest-experience.csv", "Domaine 7 - Guest Experience &amp; Livret d'accueil"),
               ("08-finance-compta.csv", "Domaine 8 - Finance &amp; Comptabilite"),
               ("09-reporting-analytics.csv", "Domaine 9 - Reporting &amp; Analytics / BI"),
               ("10-integrations-api.csv", "Domaine 10 - Integrations &amp; API / IoT"),
               ("11-mobile.csv", "Domaine 11 - Application mobile"),
               ("12-admin-securite.csv", "Domaine 12 - Admin, securite &amp; conformite"),
               ("13-ia-automatisation.csv", "Domaine 13 - IA &amp; automatisation")]
    for fname, title in domains:
        try:
            rws = read_csv(fname)
        except FileNotFoundError:
            continue
        S += [Spacer(1, 8), Paragraph(title, H2), matrix_table(rws, CLENZY_V2.get(fname))]
    S.append(PageBreak())

    S.append(Paragraph("6. Axes strategiques", H1))
    for t, d in [("Axe 1 - Assumer et armer la niche conciergerie FR conforme",
                  "Capitaliser sur la domination Finance/Operations/Mobile et la conformite FR (que personne ne couvre). "
                  "Packager une offre conciergerie + programme partenaire B2B2C. Garde-fou : ne jamais prendre de mandat en propre."),
                 ("Axe 2 - Faire de la conformite FR/UE un fosse date (fenetre 2026-2027)",
                  "Livrer Factur-X + pont PDP, cabler la declaration voyageurs, packager un kit conformite facture electronique B2B. "
                  "Brancher Yousign/DocuSeal (deja codes) ou retirer les claims faux."),
                 ("Axe 3 - Deverrouiller l'IA deja construite (rattrapage a cout faible)",
                  "Activer les flags (suggestion de reponse, analytics, pricing shadow), brancher le RAG a l'inbox, "
                  "puis multi-agent beta et detection d'anomalies/fraude. Socle technique deja superieur aux PMS classiques."),
                 ("Axe 4 - Reparer le moins d'OTA : booking direct + channel credibles",
                  "Site builder + SEO + email de confirmation ; mapping complet des restrictions Channex + statut partenaire Airbnb ; "
                  "Zapier/Make sur les webhooks existants."),
                 ("Axe 5 - Realigner le business model sur la valeur",
                  "Basculer la metrique vers le per-listing (hybride, sieges inclus) avec grandfathering ; synchro OTA au socle, "
                  "IA/IoT/signature en add-ons ; aligner le pitch sur le code.")]:
        S += [Paragraph(t, H3), Paragraph(d, BODY)]
    S.append(Paragraph("Les 3 decisions a prendre", H3))
    for t in ["<b>Niche assumee vs generaliste ?</b> -> Niche conciergerie FR conforme (pas la course breadth).",
              "<b>Activer l'IA maintenant vs attendre ?</b> -> Activer l'existant en quick wins (cout marginal, retard percu cher).",
              "<b>Repricer (per-listing) malgre le risque de churn ?</b> -> Oui, avec grandfathering des clients actuels."]:
        S.append(bullet(t))
    S.append(PageBreak())

    S.append(Paragraph("7. Roadmap priorisee (RICE)", H1))
    S.append(Paragraph("RICE = (Reach x Impact x Confiance) / Effort. Les meilleurs scores sont souvent des "
                       "<b>deverrouillages</b> (activer l'existant) : impact fort, effort minime.", BODY))
    rmap = read_csv("30-roadmap.csv")
    S += [Spacer(1, 4), roadmap_columns(rmap), Spacer(1, 12), Paragraph("Top 22 initiatives par score RICE", H3), roadmap_table(rmap, 22), PageBreak()]

    # ===== 8. Plan multi-pays & execution technique =====
    S.append(Paragraph("8. Plan multi-pays &amp; execution technique", H1))
    S.append(Paragraph("<b>Amendement 2026-06-14.</b> Le positionnement passe d'un ancrage France a un cap "
                       "<b>MULTI-PAYS : France + Maroc + Arabie Saoudite</b>. Le multi-pays est un <b>deverrouillage + "
                       "completion</b> (fondations presentes mais desactivees), pas un chantier from-scratch. Plan a la "
                       "feature pres : data/40-feature-evolution.csv (189 features) ; architecture : 41-strategie-multipays.md ; "
                       "objectifs : 42-objectifs-techniques.md.", BODY))
    fe = read_csv("40-feature-evolution.csv")[1:]
    sec_count = {}
    for r in fe:
        sec_count.setdefault(r[0], [0, 0])
        sec_count[r[0]][0] += 1
        if r[11] == "P0":
            sec_count[r[0]][1] += 1
    def _ord(s):
        m = re.match(r"\s*(\d+)", s)
        return int(m.group(1)) if m else 999
    ctr = ParagraphStyle("ctr", parent=CELL, alignment=TA_CENTER)
    ov = [[Paragraph("<b>Section</b>", CELLB),
           Paragraph("<b>Features</b>", ParagraphStyle("c", parent=CELLB, alignment=TA_CENTER, fontSize=7)),
           Paragraph("<b>dont P0</b>", ParagraphStyle("c", parent=CELLB, alignment=TA_CENTER, fontSize=7))]]
    for s in sorted(sec_count, key=_ord):
        ov.append([Paragraph(s, CELL), Paragraph(str(sec_count[s][0]), ctr), Paragraph(str(sec_count[s][1]), ctr)])
    tov = Table(ov, colWidths=[USABLE_W * 0.6, USABLE_W * 0.2, USABLE_W * 0.2], repeatRows=1)
    tov.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                             ("GRID", (0, 0), (-1, -1), 0.4, colors.white), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                             ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                             ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5), ("LEFTPADDING", (0, 0), (-1, -1), 4)]))
    S.append(Paragraph("Couverture du plan d'evolution (189 features)", H3))
    S.append(tov)
    S.append(Spacer(1, 4))
    S.append(Paragraph("<font size=8 color='#5C6B73'>Priorite : P0=23 . P1=76 . P2=73 . P3=17 &nbsp;|&nbsp; "
                       "Effort : S=29 . M=101 . L=51 . XL=8 &nbsp;|&nbsp; Cible : Parite=125 . Differenciation=64</font>", SMALL))
    S.append(Paragraph("Plan de mise en oeuvre phase", H3))
    phases = [["Phase 0", "0-3 mois", "Socle Country + branchement registries + activations quick-win (flags IA, biometrie, 2FA, N/N-1, Zapier, emails booking)", "Non-regression FR + ROI immediat"],
              ["Phase 1", "3-9 mois", "i18n/RTL complet, EInvoicingProvider + Factur-X FR, FX, routage paiement, caution Stripe, IA pricing/messagerie", "Parite Hostaway/Guesty"],
              ["Phase 2", "6-12 mois", "Maroc : CMI/Payzone, MoroccoDgiProvider, fiche police DGSN, TVA, UI arabe", "Lancement Maroc"],
              ["Phase 3", "9-18 mois", "KSA : POC sandbox ZATCA -> ZatcaProvider Phase 2, Shomoos/Absher, mada, week-end ven/sam, yield Hijri", "Lancement Arabie Saoudite"],
              ["Phase 4", "12+ mois", "Multi-agent GA, detection anomalies, marketplace ouvert, SOC 2, CM natif top-tier", "Depasser la parite"]]
    ph = [[Paragraph("<b>%s</b>" % h, ParagraphStyle("th", parent=CELLB, fontSize=7, textColor=colors.white)) for h in ["Phase", "Horizon", "Contenu technique", "But"]]]
    for p in phases:
        ph.append([Paragraph("<b>%s</b>" % p[0], ParagraphStyle("p", parent=CELL, fontSize=7.2)),
                   Paragraph(p[1], ParagraphStyle("p", parent=CELL, fontSize=7)),
                   Paragraph(p[2], CELL), Paragraph(p[3], ParagraphStyle("p", parent=CELL, fontSize=7))])
    tph = Table(ph, colWidths=[USABLE_W * 0.10, USABLE_W * 0.13, USABLE_W * 0.54, USABLE_W * 0.23], repeatRows=1)
    tph.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
                             ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                             ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                             ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4)]))
    S.append(tph)
    S.append(Paragraph("Risques techniques majeurs", H3))
    for t in ["<b>ZATCA Phase 2 (KSA) - risque #1</b> : crypto XAdES/CSID, chaine PIH/ICV atomique, clearance bloquante, certificats KMS -> POC sandbox avant engagement client.",
              "<b>RTL arabe diffus</b> : sx inline, planning Gantt, graphiques, PDF iText, mobile I18nManager (a architecturer d'emblee).",
              "<b>Fiscalite Maroc</b> : API DGI et seuils non finalises (spec mouvante).",
              "<b>Residence des donnees</b> : RGPD (FR) / loi 09-08 (MA) / PDPL (KSA)."]:
        S.append(bullet(t, SMALL))
    try:
        bl = read_csv("50-backlog-P0.csv")[1:]
        S.append(PageBreak())
        S.append(Paragraph("Backlog d'amorcage - 23 tickets P0 (data/50-backlog-P0.csv)", H3))
        bt = [[Paragraph("<b>%s</b>" % h, ParagraphStyle("th", parent=CELLB, fontSize=7, textColor=colors.white,
                alignment=(TA_CENTER if h in ("Phase", "Est.") else TA_LEFT))) for h in ["ID", "Titre", "Phase", "Est."]]]
        for r in bl:
            if len(r) < 6:
                continue
            bt.append([Paragraph(r[0], ParagraphStyle("i", parent=CELL, fontSize=6.8)),
                       Paragraph(r[1], CELL),
                       Paragraph(r[2], ParagraphStyle("p", parent=CELL, fontSize=6.8, alignment=TA_CENTER)),
                       Paragraph(r[5], ParagraphStyle("e", parent=CELL, fontSize=6.8, alignment=TA_CENTER))])
        tbl = Table(bt, colWidths=[USABLE_W * 0.14, USABLE_W * 0.61, USABLE_W * 0.15, USABLE_W * 0.10], repeatRows=1)
        tbl.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
                                 ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                                 ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                                 ("LEFTPADDING", (0, 0), (-1, -1), 4)]))
        S.append(tbl)
    except Exception:
        pass
    S.append(PageBreak())

    # ===== 9. Evolution post-implementation (avant / apres) =====
    S.append(Paragraph("9. Evolution post-implementation (Phases 0-4)", H1))
    S.append(Paragraph("<b>Etat livre au 2026-06-14.</b> Apres execution du plan multi-pays (Phases 0 a 4), "
                       "ce barometre compare le niveau de Clenzy <b>avant</b> (matrice de la section 2, veille 2026-06-13) "
                       "et <b>apres</b> les chantiers livres et verifies en repo. Re-evaluation <b>interne</b> des seuls "
                       "domaines reellement impactes ; les scores concurrents sont inchanges. Les hausses refletent un "
                       "<b>socle livre &amp; teste</b> - la finition externe (APIs PDP/DGI/Fatoora, hold Stripe) et front (RTL, UIs) "
                       "reste tracee dans backlog/HORS-PERIMETRE.md (HP-07 a HP-20).", BODY))
    try:
        ev = read_csv("60-evolution-scores.csv")
        S += [Spacer(1, 6), evolution_callout(1.86, 2.01, "6e / 8", "3e / 8"), Spacer(1, 12),
              Paragraph("Evolution par domaine (score 0-3)", H3), evolution_table(ev), Spacer(1, 4), LEGEND, Spacer(1, 10),
              Paragraph("Lecture", H3)]
        for t in ["<b>Finance &amp; Compta 2,2 -&gt; 2,5</b> : abstraction e-invoicing + 3 providers pays (Factur-X FR, DGI Maroc, "
                  "ZATCA KSA) + chaine PIH/ICV atomique + caution/depot (gap \"absent\" comble) + consolidation multi-devise.",
                  "<b>Channel Management 2,0 -&gt; 2,2</b> : sync 2-way fiabilisee (DLT propagee, audit #7) + sync restrictions "
                  "completee (min_stay_arrival) et reconciliee (watchdog de divergence Clenzy ↔ OTA).",
                  "<b>Reporting 1,7 -&gt; 2,0</b> : report builder (socle whitelist + CRUD), comparaison N/N-1 calculee serveur, "
                  "agregation multi-devise EUR/MAD/SAR.",
                  "<b>Admin &amp; conformite 1,6 -&gt; 1,9</b> : 2FA (policy org) + socle Country multi-pays + validation fail-fast au boot.",
                  "<b>Global 1,86 -&gt; 2,01</b> : Clenzy passe du 6e au 3e rang en depassant le peloton resserre "
                  "(Avantio 1,96 . Hospitable 1,92 . Smily 1,89) - sans rattraper Guesty (2,52) ni Hostaway (2,31).",
                  "<b>Honnetete du barometre</b> : les domaines non travailles (Integrations, Mobile, Operations, Communication) "
                  "restent inchanges - aucun gonflage. Le potentiel verrouille (IA) attend HP-12."]:
            S.append(bullet(t))
    except FileNotFoundError:
        S.append(Paragraph("(donnees d'evolution absentes : data/60-evolution-scores.csv)", SMALL))
    S.append(PageBreak())

    S.append(Paragraph("10. Annexe - sources datees &amp; reserves", H1))
    S.append(Paragraph("Faits reglementaires structurants (confiance Confirme sauf mention)", H3))
    for t in ["<b>Loi Le Meur</b> (n.2024-1039, 19 nov. 2024, FR) : enregistrement + n. sur annonces, registre national au plus "
              "tard 20/05/2026, plafond 120 nuits (90 a Paris), micro-BIC rabote, DPE.",
              "<b>Reglement (UE) 2024/1028</b> : application 20 mai 2026 - n. d'enregistrement unique, point d'entree numerique "
              "national, partage mensuel standardise des donnees par les plateformes.",
              "<b>Facturation electronique FR (Factur-X via PDP)</b> : reception GE/ETI au 01/09/2026, emission PME/TPE/micro au 01/09/2027."]:
        S.append(bullet(t, SMALL))
    S.append(Paragraph("Reperes marche (confiance Probable)", H3))
    for t in ["Hostaway : licorne (valorisation ~1 Md$, oct. 2025) ; HomeToGo acquiert Interhome (~200 M$, aout 2025).",
              "IA : Guesty built on AI + Copilot (avr. 2026) ; Hospitable AI messaging ; Lodgify pricing IA (avr. 2025) ; AI-natifs Jurny/Enso.",
              "Conciergeries : commission 15-30% du CA locatif (dominante 20-25% FR) ; GuestReady a bati son PMS RentalReady.",
              "Pricing PMS : modele per-listing dominant (Guesty Lite ~9$/logement, Smoobu 29 EUR+9,60/unite, Hostaway ~40$/logement)."]:
        S.append(bullet(t, SMALL))
    S.append(Paragraph("Reserves methodologiques", H3))
    for t in ["Scores concurrents = veille 2025-2026, confiance par cellule dans les CSV ; certains details fins a verifier.",
              "Domaine 7 : les 5 PMS hors Hostaway/Guesty sont estimes (le benchmark a compare Clenzy aux specialistes du livret).",
              "Inventaire interne adosse au code (preuve fichier:ligne dans inventaire/). Detail des sources URL dans chaque benchmark/*.md.",
              "Scoring par fonctionnalite (moyenne fine) ; les scores domaine holistiques du cadrage peuvent differer (profondeur vs breadth)."]:
        S.append(bullet(t, SMALL))
    doc.build(S)
    print("OK full ->", os.path.join(PDF, "analyse-concurrentielle.pdf"))

def build_summary():
    doc = make_doc(os.path.join(PDF, "synthese-executive.pdf"))
    S = [Spacer(1, 6), Paragraph("Synthese executive", TIT),
         Paragraph("Clenzy - analyse concurrentielle PMS . 13 juin 2026", SUB), Spacer(1, 12),
         Paragraph("Positionnement", H2),
         Paragraph("<b>Clenzy n'est pas le PMS le plus complet - il est le PMS le plus complet pour faire tourner une "
                   "conciergerie francaise en conformite</b> (reversements multi-proprietaires, fiscalite NF, operations "
                   "terrain), a condition d'assumer cette niche, de deverrouiller son IA deja construite et de corriger son "
                   "pricing sous-valorise. Sur la breadth brute il est 6e/8 (1,86/3) ; sur sa niche il est n.1.", BODY),
         positioning_map(), Spacer(1, 8)]
    forces = ["Conformite fiscale FR (NF + FEC + facture de commission) - unique au panel",
              "Trust accounting reel inclus (grand livre partie double, escrow, split)",
              "Reversements multi-proprietaires (4 rails payout)",
              "Operations terrain + app mobile native (85 ecrans, offline)",
              "Socle IA moderne (multi-provider + RAG + 27 tools + memoire)"]
    gaps = ["IA livree mais desactivee (pricing, messagerie, multi-agent)",
            "Channel revendeur (Channex), pas de statut partenaire OTA fort",
            "Booking sans site builder / SEO ; pas de Zapier/Make",
            "Caution absente ; KYC voyageur non branche",
            "Pricing par siege sous-valorise vs marche per-listing"]
    def col(title, items, fg):
        cells = [Paragraph("<b>%s</b>" % title, ParagraphStyle("c", parent=CELL, fontSize=10, textColor=fg))]
        for it in items:
            cells.append(Paragraph("- " + it, ParagraphStyle("ci", parent=CELL, fontSize=8, leading=10.5, spaceAfter=3)))
        return cells
    tbl = Table([[col("Top 5 forces", forces, colors.HexColor("#1E6B4F")), col("Top 5 gaps", gaps, colors.HexColor("#A23B2E"))]],
                colWidths=[USABLE_W / 2] * 2)
    tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                             ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#E6F2EC")),
                             ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#FBE9E6")),
                             ("GRID", (0, 0), (-1, -1), 1.2, colors.white),
                             ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                             ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    S += [tbl, PageBreak(), Paragraph("Top 10 initiatives (roadmap RICE)", H2)]
    rmap = read_csv("30-roadmap.csv")
    S += [roadmap_table(rmap, 10), Spacer(1, 14), Paragraph("Les 3 decisions strategiques a prendre", H2)]
    for i, t in enumerate(["<b>Assumer la niche conciergerie FR conforme</b> plutot que courir la breadth contre Guesty / Hostaway.",
                           "<b>Deverrouiller l'IA deja construite</b> en quick wins (flags ON) - cout marginal, retard percu couteux.",
                           "<b>Repricer vers le per-listing</b> (hybride, sieges inclus) avec grandfathering - la sous-valorisation "
                           "actuelle est le principal frein a la viabilite economique sur la cible."], start=1):
        box = Table([[Paragraph("<b>%d</b>" % i, ParagraphStyle("n", parent=CELL, fontSize=15, textColor=colors.white, alignment=TA_CENTER)),
                      Paragraph(t, ParagraphStyle("dt", parent=BODY, fontSize=9.5))]], colWidths=[14 * mm, USABLE_W - 14 * mm])
        box.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), PRIMARY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                 ("BACKGROUND", (1, 0), (1, 0), LIGHT),
                                 ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                                 ("LEFTPADDING", (1, 0), (1, 0), 9), ("RIGHTPADDING", (1, 0), (1, 0), 9)]))
        S += [box, Spacer(1, 6)]
    S += [Spacer(1, 8), Paragraph('<font color="#5C6B73" size=8><i>Detail complet : analyse-concurrentielle.pdf (matrices par '
                                  'domaine, SWOT, axes strategiques, roadmap Now/Next/Later, sources datees).</i></font>', SMALL)]
    doc.build(S)
    print("OK synthese ->", os.path.join(PDF, "synthese-executive.pdf"))

if __name__ == "__main__":
    build_full()
    build_summary()
