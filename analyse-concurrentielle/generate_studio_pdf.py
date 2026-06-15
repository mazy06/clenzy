"""Genere le PDF 'Baitly Studio - blueprint de refonte frontend (Baitly Signature)'.

Synthese presentable du blueprint (source : REFONTE-FRONTEND-BAITLY-STUDIO.md). Accent indigo
signature pour incarner l'identite. Fond blanc (anti mode-sombre).

Regen : .venv/bin/python generate_studio_pdf.py
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, PageBreak)

BASE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(BASE, "pdf")
os.makedirs(PDF, exist_ok=True)

# Palette = Baitly Signature (indigo-violet) sur neutres tintes
PRIMARY = colors.HexColor("#4341BE")   # indigo deep
SIGNATURE = colors.HexColor("#5453D6")  # indigo signature
INK = colors.HexColor("#15242D")
MUTED = colors.HexColor("#5C6B73")
LIGHT = colors.HexColor("#EFEFFB")      # indigo soft
LINE = colors.HexColor("#DDE3E7")
GREEN = colors.HexColor("#2C8059")
AMBER = colors.HexColor("#B07A1E")
RED = colors.HexColor("#B5524E")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=16,
                    textColor=PRIMARY, spaceBefore=4, spaceAfter=7, leading=19)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="Helvetica-Bold", fontSize=10,
                    textColor=SIGNATURE, spaceBefore=7, spaceAfter=3, leading=12)
BODY = ParagraphStyle("BODY", parent=ss["Normal"], fontName="Helvetica", fontSize=9,
                      textColor=INK, leading=12.6, spaceAfter=4)
SMALL = ParagraphStyle("SMALL", parent=BODY, fontSize=7.6, textColor=MUTED, leading=9.6)
MONO = ParagraphStyle("MONO", parent=BODY, fontName="Courier", fontSize=7.6, leading=10, textColor=INK)
CELL = ParagraphStyle("CELL", parent=BODY, fontSize=7.7, leading=9.6, spaceAfter=0)
CELLW = ParagraphStyle("CELLW", parent=CELL, fontName="Helvetica-Bold", textColor=colors.white)
TIT = ParagraphStyle("TIT", parent=BODY, fontName="Helvetica-Bold", fontSize=26,
                     textColor=PRIMARY, leading=30, alignment=TA_LEFT)
SUB = ParagraphStyle("SUB", parent=BODY, fontSize=12.5, textColor=MUTED, leading=16)

USABLE_W = A4[0] - 36 * mm


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(SIGNATURE)
    canvas.rect(0, A4[1] - 6 * mm, A4[0], 6 * mm, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(18 * mm, 10 * mm, "Baitly Studio - blueprint refonte frontend . Baitly Signature")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, "p. %d" % doc.page)
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
    canvas.restoreState()


def make_doc(path):
    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=16 * mm, bottomMargin=16 * mm, title="Baitly Studio - blueprint")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=on_page)])
    return doc


def P(t, s=CELL):
    return Paragraph(t, s)


def bullet(t, s=BODY):
    return Paragraph("&bull;&nbsp; " + t, s)


def hrow(cells):
    return [Paragraph(c, CELLW) for c in cells]


def mktable(rows, widths, accent_rows=None):
    accent_rows = accent_rows or set()
    t = Table(rows, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3.4), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.4),
    ]
    for r in accent_rows:
        style.append(("BACKGROUND", (0, r), (-1, r), LIGHT))
    t.setStyle(TableStyle(style))
    return t


def swatch_table():
    """Petit tableau des teintes signature avec pastilles colorees."""
    rows = [hrow(["", "Role", "Clair", "Sombre"])]
    data = [
        (SIGNATURE, "Signature (accent)", "#5453D6", "#8584F0"),
        (LIGHT, "Signature soft", "rgba(84,83,214,.10)", "—"),
        (colors.HexColor("#15242D"), "Texte", "#15242D", "#EAF0F3"),
        (GREEN, "Success", "#4A9B8E", "—"),
        (AMBER, "Warning", "#C28A52", "—"),
        (RED, "Error", "#C97A7A", "—"),
    ]
    style_rows = []
    for i, (col, role, lt, dk) in enumerate(data, start=1):
        rows.append([P(""), P("<b>%s</b>" % role), P(lt, MONO), P(dk, MONO)])
        style_rows.append(("BACKGROUND", (0, i), (0, i), col))
    t = Table(rows, colWidths=[USABLE_W * 0.06, USABLE_W * 0.40, USABLE_W * 0.30, USABLE_W * 0.24], repeatRows=1)
    base = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
        ("ROWBACKGROUNDS", (1, 1), (-1, -1), [colors.white, colors.HexColor("#F7F7FC")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ] + style_rows
    t.setStyle(TableStyle(base))
    return t


def build():
    S = []

    # Cover
    S += [Spacer(1, 28 * mm)]
    S.append(Paragraph("Baitly Studio", TIT))
    S.append(Paragraph("Blueprint de refonte frontend &mdash; identit&eacute; <b>Baitly Signature</b>", SUB))
    S += [Spacer(1, 8)]
    S.append(Paragraph("L'outil admin o&ugrave; l'h&ocirc;te / la conciergerie <b>con&ccedil;oit</b> son booking engine et ses sites "
                       "de r&eacute;servation directe via templates, &agrave; travers les <b>3 modes</b> (site h&eacute;berg&eacute; SSR &middot; "
                       "widget embarquable &middot; SDK headless).",
                       ParagraphStyle("lead", parent=BODY, fontSize=10.5, leading=15)))
    S += [Spacer(1, 12)]
    box = [[Paragraph("<b>Principe directeur</b>", CELL)],
           [Paragraph("L'outil <b>dispara&icirc;t dans la t&acirc;che</b>. Test : un utilisateur fluent dans Webflow/Framer/Shopify "
                      "fait confiance &agrave; l'interface imm&eacute;diatement. Registre <b>product</b> (Linear/Figma/Notion) : "
                      "couleur restrained + 1 accent signature, earned familiarity, preview-first, progressive disclosure.", BODY)]]
    bt = Table(box, colWidths=[USABLE_W])
    bt.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), LIGHT), ("BOX", (0, 0), (-1, -1), 1.1, SIGNATURE),
                            ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    S.append(bt)
    S += [Spacer(1, 10)]
    S.append(Paragraph("Pr&eacute;par&eacute; le 2026-06-14 &middot; skills design (impeccable / ui-ux-pro-max) &middot; r&eacute;f&eacute;rence : "
                       "REFONTE-FRONTEND-BAITLY-STUDIO.md &middot; approche : blueprint d'abord, build incr&eacute;mental.", SMALL))
    S.append(PageBreak())

    # B. Langage Baitly Signature
    S.append(Paragraph("Langage visuel &laquo; Baitly Signature &raquo;", H1))
    S.append(Paragraph("Registre product : sobre, dense, pro. Couleur <b>restrained</b> par d&eacute;faut ; une surface peut &ecirc;tre "
                       "<i>committed</i> (onboarding). Accent r&eacute;serv&eacute; aux actions/s&eacute;lection/&eacute;tats &mdash; jamais d&eacute;coratif.", BODY))
    S.append(Paragraph("Couleur (OKLCH, indigo-violet signature)", H3))
    S.append(swatch_table())
    S.append(Paragraph("Pas de #000/#fff purs (tint&eacute;s) &middot; pas de gradient text / glassmorphism / side-stripe (bans impeccable).", SMALL))
    S.append(Paragraph("Typographie &middot; espacement &middot; motion", H3))
    for t in ["<b>Une famille UI</b> : Inter (variable), repli system-ui. &Eacute;chelle rem fixe, ratio 1.2 (12&hellip;30). Wordmark : "
              "display g&eacute;om&eacute;trique r&eacute;serv&eacute; au logotype. tabular-nums sur prix/dates/m&eacute;triques.",
              "<b>Grille 4px</b> ; rayons 6/10/14 ; <b>&eacute;l&eacute;vation teint&eacute;e</b> (jamais ombre noire) ; <b>motion 150&ndash;250ms</b> "
              "(transform/opacity, convoie un &eacute;tat) ; lucide-react (24&times;24) ; aucune emoji.",
              "<b>&Eacute;tats complets</b> (default/hover/focus/active/disabled/loading/error) ; skeletons (pas de spinner) ; "
              "empty states qui enseignent ; focus clavier visible ; prefers-reduced-motion."]:
        S.append(bullet(t))

    # C/D. IA + builder
    S.append(Paragraph("Architecture &amp; UX c&oelig;ur (preview-first)", H1))
    S.append(Paragraph("Navigation : topbar (projet + breakpoint + langue/devise de preview + Publier) &middot; rail gauche par sections "
                       "(Design / Contenu / R&eacute;servation / Croissance / Diffusion) &middot; palette de commandes &#8984;K.", BODY))
    diagram = ("Topbar : Projet | Design | &#8984;K | breakpoint | fr/en/ar | EUR/MAD | [Publier]\n"
               "----------------------------------------------------------------------\n"
               "LEFT (pages + arbre de blocs) | CANVAS / PREVIEW (WYSIWYG, rendu reel,\n"
               "                              | selection -> halo, reorder, + Ajouter bloc) | INSPECTOR\n"
               "                              | multi-breakpoint, RTL, devise live          | (bloc / theme)")
    S.append(Paragraph(diagram.replace("\n", "<br/>"), MONO))
    for t in ["<b>Composeur par blocs</b> (Hero, Recherche, Grille propri&eacute;t&eacute;s, D&eacute;tail, Galerie, Carte, Avis, FAQ, Blog, "
              "Newsletter/Lead, CTA, Rich text) &mdash; pas de drag-drop freeform.",
              "<b>Galerie de templates</b> par vertical (appart urbain, villa, riad/MENA&hellip;), RTL/arabe natifs (diff&eacute;renciateur).",
              "<b>Canvas = vrai WYSIWYG</b> : r&eacute;utilise le moteur de rendu du widget/site (m&ecirc;mes blocs que la sortie publique)."]:
        S.append(bullet(t))
    S.append(PageBreak())

    # E. Surfaces par feature
    S.append(Paragraph("Surfaces par feature (refonte &rarr; &eacute;crans)", H1))
    rows = [hrow(["Feature", "O&ugrave; dans le Studio", "Pattern"])]
    feats = [
        ("Site inclus / builder / templates", "Design &rarr; Builder + Galerie", "3-pane + gallery"),
        ("Multi-devise", "Topbar + R&eacute;servation &rarr; Devises", "switcher + toggles"),
        ("Panier multi-s&eacute;jours", "R&eacute;servation &rarr; Panier", "toggle + aper&ccedil;u flux"),
        ("SEO (meta/schema/sitemap/hreflang)", "Croissance &rarr; SEO", "panneau/page + global, score + preview SERP"),
        ("Blog", "Contenu &rarr; Blog", "liste + &eacute;diteur bloc + IA"),
        ("Anti-fraude / caution", "R&eacute;servation &rarr; Protection", "presets caution/waiver + Radar/3DS"),
        ("Capture leads / email", "Croissance &rarr; Leads &amp; Email", "formulaires, consentement, abandoned-cart"),
        ("SDK / API", "Diffusion &rarr; SDK/API", "cl&eacute;s + snippet + doc OpenAPI + webhooks"),
        ("Outils IA (contenu/SEO/design)", "inline (boutons &laquo; G&eacute;n&eacute;rer &raquo;) + Design &rarr; IA", "g&eacute;n&eacute;ration fr/en/ar, budget visible"),
        ("Diffusion 3 modes", "Diffusion", "3 cartes : site h&eacute;berg&eacute; / widget / headless"),
    ]
    for f, w, p in feats:
        rows.append([P("<b>%s</b>" % f), P(w), P(p)])
    S.append(mktable(rows, [USABLE_W * 0.30, USABLE_W * 0.40, USABLE_W * 0.30]))

    # H. Roadmap
    S.append(Paragraph("Roadmap phas&eacute;e (build incr&eacute;mental)", H1))
    rows = [hrow(["Phase", "Livrable", "Dep."])]
    roadmap = [
        ("F0 Fondation", "Th&egrave;me Baitly Signature (tokens indigo clair+sombre) + StudioShell (topbar+rail) + palette &#8984;K + primitives", "&mdash;"),
        ("F1 Accueil + Galerie", "&laquo; Mes booking engines &raquo; + galerie de templates + cr&eacute;ation de projet", "F0"),
        ("F2 Builder", "3-pane (arbre de blocs + canvas/preview + inspector) + biblioth&egrave;que de blocs + th&egrave;me/tokens", "F0 + moteur rendu"),
        ("F3 Croissance + R&eacute;servation", "SEO + Leads/abandoned-cart + Devises + Caution/anti-fraude (features Lot 0 c&acirc;bl&eacute;es)", "F2"),
        ("F4 Contenu + IA", "Blog (&eacute;diteur bloc) + boutons IA contextuels (contenu/SEO)", "F2/F3"),
        ("F5 Diffusion 3 modes", "3 cartes site h&eacute;berg&eacute;/widget/SDK + cl&eacute;s/snippet/webhooks/doc", "F1 + Lot 1 SSR"),
    ]
    for ph, liv, dep in roadmap:
        rows.append([P("<b>%s</b>" % ph), P(liv), P(dep, ParagraphStyle("c", parent=CELL, alignment=TA_CENTER))])
    S.append(mktable(rows, [USABLE_W * 0.22, USABLE_W * 0.62, USABLE_W * 0.16], accent_rows={1}))
    S.append(Paragraph("F0-F2 buildables sur l'existant. F0 (re-teintage indigo) <b>fait</b>. F5 (site h&eacute;berg&eacute;) d&eacute;pend du Lot 1 backend (SSR).", SMALL))

    S.append(Paragraph("D&eacute;cisions arr&ecirc;t&eacute;es", H3))
    for d in ["<b>Teinte</b> : indigo-violet (#5453D6 / #8584F0) &mdash; vibe builder moderne.",
              "<b>Port&eacute;e</b> : tout le PMS (Baitly Signature devient le th&egrave;me ; couleurs hardcod&eacute;es migr&eacute;es au fil de l'eau).",
              "<b>Clair/sombre</b> : les deux d&egrave;s F0, clair valid&eacute; en premier.",
              "<b>Builder</b> : composeur par blocs ; freeform diff&eacute;r&eacute;.",
              "<b>Densit&eacute;</b> : &eacute;quilibr&eacute;e (pro mais accessible)."]:
        S.append(bullet(d, SMALL))

    return S


def main():
    doc = make_doc(os.path.join(PDF, "baitly-studio-blueprint.pdf"))
    doc.build(build())
    print("OK studio -> %s" % os.path.join(PDF, "baitly-studio-blueprint.pdf"))


if __name__ == "__main__":
    main()
