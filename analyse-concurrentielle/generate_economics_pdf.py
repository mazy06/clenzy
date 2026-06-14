#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genere le PDF 'Projection economique - cout d'exploitation Baitly'.

Modele parametre du cout d'exploitation du logiciel Baitly (PMS) : couts fixes + recurrents a
ZERO client, unit economics, et projections par paliers de clients. Tous les montants sont des
ORDRES DE GRANDEUR (estimations) - jamais des prix vendeur exacts. Sources : investigation infra
(clenzy-infra docker-compose.prod) + drivers variables (application.yml : modeles IA, caches,
budgets de tokens) + tarifs publics approximatifs (connaissance, cutoff 2026-01).

Regen : .venv/bin/python generate_economics_pdf.py
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, PageBreak)
from reportlab.graphics.shapes import Drawing, Rect, String, Line

BASE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(BASE, "pdf")
os.makedirs(PDF, exist_ok=True)

PRIMARY = colors.HexColor("#3E5A68")
PRIMARY2 = colors.HexColor("#6B8A9A")
ACCENT = colors.HexColor("#4A9B8E")
INK = colors.HexColor("#1F2A30")
MUTED = colors.HexColor("#5C6B73")
LIGHT = colors.HexColor("#EEF2F4")
LINE = colors.HexColor("#C9D4D9")
GREEN = colors.HexColor("#2C8059")
AMBER = colors.HexColor("#B07A1E")

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
CELL = ParagraphStyle("CELL", parent=BODY, fontSize=7.8, leading=9.6, spaceAfter=0)
CELLB = ParagraphStyle("CELLB", parent=CELL, fontName="Helvetica-Bold")
NUM = ParagraphStyle("NUM", parent=CELL, alignment=TA_RIGHT, fontName="Helvetica")
NUMB = ParagraphStyle("NUMB", parent=NUM, fontName="Helvetica-Bold")
TIT = ParagraphStyle("TIT", parent=BODY, fontName="Helvetica-Bold", fontSize=25,
                     textColor=PRIMARY, leading=29, alignment=TA_LEFT)
SUB = ParagraphStyle("SUB", parent=BODY, fontSize=12, textColor=MUTED, leading=16)

USABLE_W = A4[0] - 36 * mm

def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.white)  # fond opaque (anti ecran-noir en mode sombre)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, A4[1] - 6 * mm, A4[0], 6 * mm, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(18 * mm, 10 * mm, "Baitly - Projection economique d'exploitation . ordres de grandeur")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, "p. %d" % doc.page)
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
    canvas.restoreState()

def make_doc(path):
    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=16 * mm, bottomMargin=16 * mm, title="Projection economique Baitly")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=on_page)])
    return doc

def bullet(txt, style=BODY):
    return Paragraph("- " + txt, style)

# =========================================================================
#  MODELE PARAMETRE (toutes valeurs = ordres de grandeur EUR, modifiables)
# =========================================================================
HYP = {
    "listings_per_client": 8,      # logements moyens par client (conciergerie early-stage)
    "ai_eur_client": 1.0,          # IA/mois/client sous le cap 100k tokens (Sonnet, cache prompt)
    "ai_eur_client_intensif": 8.0, # scenario IA intensive (budget x10 ~1M tokens, multi-agent)
    "embed_eur_client": 0.10,      # embeddings RAG (Voyage, on-demand) - negligeable
    "domain_eur_mois": 1.5,        # nom de domaine amorti (~15-20 EUR/an)
    "emails_par_client": 96,       # ~8 logements x 3 resa x 4 emails/mois
}

def infra_eur(n):
    """Cout infra serveur (single-node -> scale vertical -> managed DB/S3)."""
    if n <= 50:   return 35    # 1 noeud 16 Go (OVH/Hetzner/Scaleway), CF Free, backups locaux
    if n <= 250:  return 75    # 1 noeud 32 Go + snapshots offsite
    if n <= 500:  return 170   # noeud + BDD managee (replica) + object storage S3 (photos)
    return 350                 # BDD managee + 2 noeuds app + S3 + CDN bande passante

def email_eur(n):
    """Brevo : free ~9000 emails/mois, puis paliers."""
    total = n * HYP["emails_par_client"]
    if total <= 9000:  return 0    # tier gratuit
    if total <= 20000: return 19   # palier Lite
    if total <= 100000: return 65  # palier Business
    return 130                     # volume

def ops_eur(n):
    """Backups offsite, monitoring (self-hosted=0), divers ops qui scalent."""
    if n <= 50:   return 5
    if n <= 250:  return 15
    if n <= 500:  return 40
    return 80

def total_row(n, ai_per_client):
    infra = infra_eur(n)
    email = email_eur(n)
    ops = ops_eur(n)
    var = n * (ai_per_client + HYP["embed_eur_client"])
    dom = HYP["domain_eur_mois"]
    total = infra + email + ops + var + dom
    return infra, email, ops, var, dom, total

TIERS = [0, 1, 10, 50, 100, 250, 500, 1000]

def projection_table(intensif=False):
    ai = HYP["ai_eur_client_intensif"] if intensif else HYP["ai_eur_client"]
    head = ["Clients", "Logements~", "Infra", "Email", "Ops/backup", "IA+RAG", "Domaine", "TOTAL /mois", "/an", "/client"]
    hdr = [Paragraph("<b>%s</b>" % h, ParagraphStyle("th", parent=CELLB, fontSize=6.8, textColor=colors.white,
            alignment=(TA_LEFT if h == "Clients" else TA_RIGHT))) for h in head]
    data = [hdr]
    style = [("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
             ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
             ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
             ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    for i, n in enumerate(TIERS, start=1):
        infra, email, ops, var, dom, total = total_row(n, ai)
        per = (total / n) if n else 0
        listings = n * HYP["listings_per_client"]
        zero = (n == 0)
        cells = [
            Paragraph("<b>%s</b>" % ("0 (base)" if zero else str(n)), ParagraphStyle("c", parent=CELL, fontSize=7.4)),
            Paragraph("-" if zero else str(listings), NUM),
            Paragraph("%d" % infra, NUM), Paragraph("%d" % email, NUM), Paragraph("%d" % ops, NUM),
            Paragraph("%d" % round(var), NUM), Paragraph("%.0f" % dom, NUM),
            Paragraph("<b>%d EUR</b>" % round(total),
                      ParagraphStyle("tot", parent=NUMB, textColor=colors.white)),
            Paragraph("%d k" % round(total * 12 / 1000) if total * 12 >= 1000 else "%d" % round(total * 12), NUM),
            Paragraph("-" if zero else "%.1f" % per, NUM),
        ]
        data.append(cells)
        bg = LIGHT if i % 2 == 0 else colors.white
        if zero:
            bg = colors.HexColor("#E6F2EC")
        style.append(("BACKGROUND", (0, i), (-1, i), bg))
        style.append(("BACKGROUND", (7, i), (7, i), colors.HexColor("#27323A")))
        style.append(("TEXTCOLOR", (7, i), (7, i), colors.white))
    t = Table(data, colWidths=[USABLE_W * x for x in (0.115, 0.10, 0.085, 0.085, 0.105, 0.09, 0.085, 0.135, 0.10, 0.095)], repeatRows=1)
    t.setStyle(TableStyle(style))
    return t

def cost_bar_chart():
    """Barres du TOTAL EUR/mois par palier (scenario standard)."""
    W, H = USABLE_W, 170
    d = Drawing(W, H)
    d.add(Rect(0, 0, W, H, fillColor=colors.white, strokeColor=LINE, strokeWidth=0.6))
    x0, y0, top = 16, 28, H - 16
    totals = [total_row(n, HYP["ai_eur_client"])[5] for n in TIERS]
    maxv = max(totals)
    n = len(TIERS)
    slot = (W - x0 - 16) / n
    bw = slot * 0.6
    for i, (tier, tot) in enumerate(zip(TIERS, totals)):
        x = x0 + i * slot + (slot - bw) / 2
        h = (tot / maxv) * (top - y0)
        col = ACCENT if tier == 0 else PRIMARY2
        d.add(Rect(x, y0, bw, h, fillColor=col, strokeColor=None))
        d.add(String(x + bw / 2, y0 + h + 3, "%d" % round(tot), fontName="Helvetica-Bold", fontSize=6.6, fillColor=INK, textAnchor="middle"))
        lbl = "0" if tier == 0 else str(tier)
        d.add(String(x + bw / 2, 14, lbl, fontName="Helvetica", fontSize=7, fillColor=MUTED, textAnchor="middle"))
    d.add(String(x0, top + 2, "TOTAL EUR/mois (scenario standard)", fontName="Helvetica", fontSize=7, fillColor=MUTED))
    d.add(String(W / 2, 3, "nombre de clients", fontName="Helvetica", fontSize=7, fillColor=MUTED, textAnchor="middle"))
    return d

# =========================================================================
#  ETUDE APPROFONDIE DU COUT IA (le cap 100k tokens n'est PAS definitif)
# =========================================================================
# Tarifs ordres de grandeur USD / 1M tokens : (nom, input, cache_read, output)
AI_MODELS = [
    ("Claude Sonnet (defaut actuel)", 3.0, 0.30, 15.0),
    ("Claude Haiku (economique)", 1.0, 0.10, 5.0),
    ("Nova Lite / OpenAI-compat (tres eco)", 0.10, 0.01, 0.40),
]
# Hypotheses par message assistant, derivees de la config : max_tokens 4096/tour,
# <=5 iterations d'outils/message (avg ~2), cache prompt 5 min (system+tools+prefixe).
AI_MSG = {"avg_calls": 2.0, "fresh_in": 1500, "cached_in": 4000, "out": 700}
AI_PROFILES = [("Leger", 20), ("Standard", 100), ("Intensif", 300), ("Power", 1000)]
USD_EUR = 0.92
AI_CAP = 100_000  # cap actuel tokens/org/mois (a recalibrer)

def cost_per_msg_usd(m):
    _, cin, cread, cout = m
    a = AI_MSG
    return a["avg_calls"] * (a["fresh_in"] * cin / 1e6 + a["cached_in"] * cread / 1e6 + a["out"] * cout / 1e6)

def tokens_per_msg():
    a = AI_MSG
    return int(a["avg_calls"] * (a["fresh_in"] + a["cached_in"] + a["out"]))

def ai_permsg_table():
    head = ["Modele", "Input $/M", "Cache $/M", "Output $/M", "$ / message", "EUR / message"]
    hdr = [Paragraph("<b>%s</b>" % h, ParagraphStyle("th", parent=CELLB, fontSize=7.2, textColor=colors.white,
            alignment=(TA_LEFT if h == "Modele" else TA_RIGHT))) for h in head]
    data = [hdr]
    style = [("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
             ("GRID", (0, 0), (-1, -1), 0.4, colors.white), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
             ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
             ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 5)]
    for m in AI_MODELS:
        c = cost_per_msg_usd(m)
        data.append([Paragraph(m[0], CELL), Paragraph("%.2f" % m[1], NUM), Paragraph("%.2f" % m[2], NUM),
                     Paragraph("%.2f" % m[3], NUM), Paragraph("$%.4f" % c, NUM),
                     Paragraph("<b>~%.3f</b>" % (c * USD_EUR), NUMB)])
    t = Table(data, colWidths=[USABLE_W * x for x in (0.34, 0.13, 0.13, 0.13, 0.135, 0.135)], repeatRows=1)
    t.setStyle(TableStyle(style))
    return t

def ai_profile_table():
    sonnet, haiku = AI_MODELS[0], AI_MODELS[1]
    cs, ch = cost_per_msg_usd(sonnet), cost_per_msg_usd(haiku)
    tpm = tokens_per_msg()
    head = ["Profil", "Msg/mois", "Tokens/mois", "EUR/client (Sonnet)", "EUR/client (Haiku)", "vs cap 100k"]
    hdr = [Paragraph("<b>%s</b>" % h, ParagraphStyle("th", parent=CELLB, fontSize=7.2, textColor=colors.white,
            alignment=(TA_LEFT if h == "Profil" else TA_RIGHT))) for h in head]
    data = [hdr]
    style = [("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
             ("GRID", (0, 0), (-1, -1), 0.4, colors.white), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
             ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
             ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 5)]
    for label, msg in AI_PROFILES:
        toks = msg * tpm
        mult = toks / AI_CAP
        data.append([Paragraph("<b>%s</b>" % label, CELL), Paragraph(str(msg), NUM),
                     Paragraph(("%.2f M" % (toks / 1e6)) if toks >= 1e6 else ("%d k" % round(toks / 1000)), NUM),
                     Paragraph("<b>~%.1f</b>" % (msg * cs * USD_EUR), NUMB),
                     Paragraph("~%.1f" % (msg * ch * USD_EUR), NUM),
                     Paragraph('<font color="%s">x%.0f</font>' % ("#A23B2E" if mult > 1 else "#2C8059", mult),
                               ParagraphStyle("m", parent=NUM, fontName="Helvetica-Bold"))])
    t = Table(data, colWidths=[USABLE_W * x for x in (0.16, 0.12, 0.16, 0.20, 0.18, 0.18)], repeatRows=1)
    t.setStyle(TableStyle(style))
    return t

def kv_table(rows, w0=0.45, total_label=None, total_val=None):
    data = []
    style = [("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
             ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
             ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5)]
    for lbl, val, note in rows:
        data.append([Paragraph(lbl, CELLB), Paragraph(val, ParagraphStyle("v", parent=CELL, alignment=TA_RIGHT)),
                     Paragraph(note, ParagraphStyle("n", parent=CELL, fontSize=7, textColor=MUTED))])
    if total_label:
        data.append([Paragraph("<b>%s</b>" % total_label, CELLB),
                     Paragraph("<b>%s</b>" % total_val, ParagraphStyle("v", parent=CELLB, alignment=TA_RIGHT)),
                     Paragraph("", CELL)])
        style.append(("BACKGROUND", (0, len(data) - 1), (-1, len(data) - 1), colors.HexColor("#E6F2EC")))
    t = Table(data, colWidths=[USABLE_W * w0, USABLE_W * 0.18, USABLE_W * (0.82 - w0)])
    t.setStyle(TableStyle(style))
    return t

def build():
    doc = make_doc(os.path.join(PDF, "projection-economique-baitly.pdf"))
    S = [Spacer(1, 54), Paragraph("Projection economique", TIT), Paragraph("Cout d'exploitation de <b>Baitly</b>", TIT),
         Spacer(1, 12), Paragraph("Couts fixes &amp; recurrents a zero client . unit economics . projections par paliers", SUB),
         Spacer(1, 26)]
    cover = Table([["Date", "14 juin 2026"],
                   ["Objet", "Combien coute l'exploitation du logiciel - a 0 client puis selon le nombre de clients"],
                   ["Methode", "Modele parametre : infra (clenzy-infra) + drivers variables (config IA/email) + tarifs publics approx."],
                   ["Unite", "EUR/mois (ordres de grandeur). 1 client = 1 organisation (conciergerie/hote)"],
                   ["Important", "Estimations - pas des prix vendeur exacts. Couts pass-through (Stripe, commissions OTA) exclus du burn."]],
                  colWidths=[USABLE_W * 0.20, USABLE_W * 0.80])
    cover.setStyle(TableStyle([("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                               ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY), ("TEXTCOLOR", (1, 0), (1, -1), INK),
                               ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                               ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    S += [cover, Spacer(1, 22),
          Paragraph('<font color="#5C6B73" size=8><i>Confidentiel - usage interne. Tous les montants sont des ORDRES DE GRANDEUR '
                    '(infra single-node, tarifs cloud/SaaS approximatifs, cutoff connaissance 2026-01). Le modele est parametre '
                    '(hypotheses explicites p.2) et ajustable. Les couts pass-through (frais Stripe sur les paiements voyageurs, '
                    'commissions OTA, abonnements IoT/compta payes par le client) ne sont PAS du cout d\'exploitation Baitly.</i></font>', SMALL),
          PageBreak()]

    # --- Synthese ---
    S.append(Paragraph("Synthese (en 30 secondes)", H1))
    base = total_row(0, HYP["ai_eur_client"])[5]
    t100 = total_row(100, HYP["ai_eur_client"])[5]
    t1000 = total_row(1000, HYP["ai_eur_client"])[5]
    for t in [
        "<b>A 0 client</b>, le logiciel coute environ <b>%d EUR/mois</b> (~%d EUR/an) : c'est le socle infra always-on "
        "(serveur unique, BDD, Redis, Kafka, Keycloak, monitoring self-hosted) + domaine. Quasiment incompressible." % (round(base), round(base * 12)),
        "<b>Les couts fixes one-time sont quasi nuls</b> pour un SaaS auto-heberge : nom de domaine (~15 EUR/an), TLS gratuit "
        "(Let's Encrypt), monitoring inclus (Prometheus/Grafana self-hosted), Cloudflare Free.",
        "<b>Le cout marginal par client est faible</b> : ~1-5 EUR/client/mois, car (1) le budget de tokens IA est aujourd'hui "
        "plafonne a 100k/org/mois (<b>valeur par defaut a recalibrer - cf. etude section 4</b>), (2) l'email Brevo a un tier "
        "gratuit genereux, (3) le monitoring ne facture rien.",
        "<b>A 100 clients : ~%d EUR/mois</b> ; <b>a 1000 clients : ~%d EUR/mois</b> (hors options activables et pass-through). "
        "L'economie d'exploitation est tres lean tant qu'on reste mono-noeud + photos a externaliser en S3 a l'echelle." % (round(t100), round(t1000)),
        "<b>Ce qui peut faire deraper</b> : IA intensive (budget releve / multi-agent active -> x6-10 le poste IA), Channex "
        "par-logement si active, e-signature QTSP / KYC par usage, et le palier infra (BDD managee + S3) au-dela de ~250-500 clients.",
    ]:
        S.append(bullet(t))
    S.append(PageBreak())

    # --- Hypotheses ---
    S.append(Paragraph("1. Hypotheses &amp; methode", H1))
    S.append(Paragraph("Le modele additionne quatre postes : <b>infra serveur</b> (paliers selon la charge), <b>email</b> "
                       "(Brevo, tier gratuit puis paliers), <b>ops/backup</b>, et <b>variable IA+RAG</b> (par client). "
                       "Hypotheses cles (ajustables) :", BODY))
    S.append(kv_table([
        ("Logements moyens / client", "%d" % HYP["listings_per_client"], "conciergerie early-stage"),
        ("Cout IA / client / mois (standard)", "~%.1f EUR" % HYP["ai_eur_client"], "sous le cap 100k tokens/org, Claude Sonnet + cache prompt 5 min"),
        ("Cout IA / client / mois (intensif)", "~%.0f EUR" % HYP["ai_eur_client_intensif"], "budget x10 (~1M tokens) ou multi-agent active (8 specialistes)"),
        ("Embeddings RAG / client / mois", "~%.2f EUR" % HYP["embed_eur_client"], "Voyage, on-demand, cache - negligeable"),
        ("Emails / client / mois", "~%d" % HYP["emails_par_client"], "confirmations + rappels (~8 logements x 3 resa x 4)"),
        ("Domaine (amorti)", "~%.1f EUR/mois" % HYP["domain_eur_mois"], "~15-20 EUR/an"),
    ]))
    S.append(Paragraph("Reperes tarifaires utilises (ordres de grandeur, tarifs publics approx.)", H3))
    for t in ["<b>Serveur</b> : OVH/Hetzner/Scaleway 16 Go ~ 20-50 EUR/mois ; 32 Go ~ 40-70 ; BDD managee + S3 a l'echelle.",
              "<b>Claude Sonnet</b> : ~3 USD / 1M tokens entree, ~15 USD / 1M sortie ; cache lecture ~10%. Cap 100k tokens/org/mois.",
              "<b>Voyage embeddings</b> : ~0,18 USD / 1M tokens. <b>Brevo</b> : free ~9k emails/mois, puis ~19-65 EUR/mois.",
              "<b>Cloudflare</b> Free (0) ; <b>Let's Encrypt</b> 0 ; <b>monitoring</b> self-hosted (0 SaaS, consomme la RAM du noeud)."]:
        S.append(bullet(t, SMALL))
    S.append(PageBreak())

    # --- Cout a 0 client ---
    S.append(Paragraph("2. Cout a ZERO client (le socle incompressible)", H1))
    S.append(Paragraph("Ce que coute le logiciel meme sans aucun utilisateur : l'infrastructure always-on doit tourner en "
                       "permanence. Le pms-server fait tourner 4 JVM cote infra (Spring, Keycloak, Kafka, kafka-ui) + Postgres "
                       "(pgvector) + Redis + la pile observabilite - d'ou un besoin RAM ~8-16 Go sur un noeud unique.", BODY))
    S.append(Paragraph("Couts FIXES (one-time / CapEx)", H3))
    S.append(kv_table([
        ("Nom de domaine (1re annee)", "~15 EUR", "clenzy.fr/baitly + sous-domaines (annuel)"),
        ("Certificat TLS", "0 EUR", "Let's Encrypt (certbot, auto)"),
        ("Mise en place serveur", "0 EUR (cash)", "self-hosted ; cout = temps d'ingenierie"),
        ("Materiel", "0 EUR", "aucun (sauf capteurs Baitly Hardware, hors logiciel)"),
    ], total_label="Total fixe one-time (cash)", total_val="~15-50 EUR"))
    S.append(Paragraph("Couts RECURRENTS a 0 client (mensuels)", H3))
    S.append(kv_table([
        ("Serveur (noeud unique 16 Go)", "~35 EUR", "OVH actuel / Hetzner / Scaleway"),
        ("Backups offsite + ops", "~5 EUR", "snapshot/objet (auj. backups locaux pg_dump)"),
        ("Cloudflare", "0 EUR", "tier Free suffisant"),
        ("Monitoring (Prometheus/Grafana/Loki)", "0 EUR", "self-hosted, inclus dans le noeud"),
        ("Domaine (amorti)", "~1,5 EUR", "~15-20 EUR/an"),
        ("Cles IA (idle)", "~0 EUR", "pay-as-you-go : 0 sans usage (hors tests dev)"),
        ("Email (Brevo)", "0 EUR", "tier gratuit"),
    ], total_label="Total recurrent / mois (0 client)", total_val="~%d EUR (~%d EUR/an)" % (round(base), round(base * 12))))
    S.append(Paragraph("<font size=8 color='#5C6B73'>Note : prevoir une petite enveloppe IA de dev/tests (~5-20 EUR/mois) tant "
                       "que vous developpez avec l'assistant. Elle disparait a l'arret de l'usage (pay-as-you-go).</font>", SMALL))
    S.append(PageBreak())

    # --- Unit economics + projection ---
    S.append(Paragraph("3. Projection par nombre de clients", H1))
    S.append(Paragraph("Scenario <b>standard</b> (IA sous le cap 100k tokens/org). Le TOTAL inclut infra + email + ops + IA/RAG "
                       "+ domaine. Hors options activables (Channex, e-signature, KYC, e-invoicing par pays) et hors pass-through "
                       "(Stripe, commissions OTA) - detailles en section 5.", BODY))
    S.append(projection_table(intensif=False))
    S.append(Spacer(1, 8))
    S.append(cost_bar_chart())
    S.append(Spacer(1, 6))
    S.append(Paragraph("Lecture : le socle (~%d EUR/mois) domine a faible volume (le cout/client tombe vite : ~%d EUR a 10 clients, "
                       "~%.1f EUR a 100, ~%.1f EUR a 1000). Le poste IA devient le 1er variable a l'echelle, mais reste borne par le "
                       "budget de tokens." % (round(base),
                       round(total_row(10, HYP['ai_eur_client'])[5] / 10),
                       total_row(100, HYP['ai_eur_client'])[5] / 100,
                       total_row(1000, HYP['ai_eur_client'])[5] / 1000), BODY))
    S.append(Paragraph("<font size=8 color='#5C6B73'>Le poste IA ci-dessus suppose l'usage <b>borne par le cap actuel</b> "
                       "(~1 EUR/client). Le cap n'etant pas definitif, la <b>section 4</b> chiffre l'usage reel : pour un assistant "
                       "reellement utilise, compter plutot ~3 EUR/client/mois (Sonnet) ou ~1 EUR (Haiku) - a recalibrer par plan.</font>", SMALL))
    S.append(PageBreak())

    # --- Etude approfondie du cout IA ---
    S.append(Paragraph("4. Etude approfondie du cout IA (tokens)", H1))
    S.append(Paragraph("<b>Le cap de 100k tokens/org/mois n'est pas definitif</b> - il doit etre recalibre. Cette section "
                       "modelise le cout reel a partir de la configuration : <b>max_tokens 4096/tour</b>, <b>jusqu'a 5 iterations "
                       "d'outils par message</b> (moyenne retenue ~%.0f appels LLM), et le <b>cache prompt</b> (system + outils + "
                       "prefixe, TTL 5 min). Hypothese par message : ~%d tokens entree frais + ~%d tokens caches (lus a ~10%%) + "
                       "~%d tokens sortie, soit <b>~%s tokens 'comptes' par message</b>." %
                       (AI_MSG["avg_calls"], AI_MSG["fresh_in"], AI_MSG["cached_in"], AI_MSG["out"],
                        "{:,}".format(tokens_per_msg()).replace(",", " ")), BODY))
    S.append(Paragraph("Cout par message selon le modele", H3))
    S.append(ai_permsg_table())
    S.append(Paragraph("<font size=7.5 color='#5C6B73'>Le choix du modele fait un facteur ~3 (Haiku) a ~30 (Nova) sur le cout/message. "
                       "Le cache prompt reduit l'input repete a ~10% de son cout (deja actif dans AnthropicChatProvider).</font>", SMALL))
    S.append(Paragraph("Cout par client/mois selon l'intensite d'usage", H3))
    S.append(ai_profile_table())
    S.append(Paragraph("<font size=8 color='#1F2A30'><b>Constat cle : le cap 100k = seulement ~%d messages/mois.</b> Il est "
                       "<b>trop bas</b> pour un usage assistant reel (profil Standard = 100 msg ≈ %.1f M tokens, soit x%.0f le cap). "
                       "Supporter un vrai assistant impose de relever le cap - le vrai sujet est donc le <b>plan tarifaire</b>, pas "
                       "une limite technique.</font>" %
                       (max(1, round(AI_CAP / tokens_per_msg())), 100 * tokens_per_msg() / 1e6,
                        (100 * tokens_per_msg()) / AI_CAP), BODY))
    S.append(Paragraph("Recommandations (etude des couts a approfondir avec vos vrais ratios)", H3))
    for t in ["<b>Calibrer le cap par plan</b> plutot qu'un 100k global : ex. Starter ~250k (~20 msg), Pro ~1M (~80 msg), "
              "Scale ~3M+, et <b>illimite en BYOK</b> (le client paie sa cle).",
              "<b>Routage par modele</b> : taches simples (resume, extraction, FAQ) -> Haiku/Nova (3-30x moins cher) ; "
              "raisonnement/outils complexes -> Sonnet. Plus gros levier de cout disponible.",
              "<b>Garder multi-agent OFF</b> en prod (sinon 1 orchestrateur + jusqu'a 8 specialistes = x4-8 le cout/message).",
              "<b>Refacturer l'IA en add-on metre</b> au-dela d'un quota inclus par plan (le cout IA devient un revenu, pas une perte).",
              "<b>A approfondir</b> : mesurer en prod les vrais (msg/client, appels/msg, tokens/appel) via les logs de tokens "
              "deja traces (AiTokenBudgetService) pour remplacer ces hypotheses par des donnees reelles."]:
        S.append(bullet(t))
    S.append(PageBreak())

    # --- Couts additionnels selon activation + pass-through ---
    S.append(Paragraph("5. Couts additionnels selon activation &amp; pass-through", H1))
    S.append(Paragraph("Ces couts ne sont PAS dans le socle ci-dessus : ils dependent de ce que chaque client active, et "
                       "certains sont payes directement par le client (pass-through).", BODY))
    S.append(Paragraph("Options activables (cout pour Baitly si Baitly les fournit/refacture)", H3))
    addon = [["Channex (channel manager)", "~1-5 EUR / logement / mois", "si la sync OTA passe par Channex (revendeur)"],
             ["e-signature QTSP (Yousign)", "~0,5-2 EUR / signature", "activate-only ; ou provider interne Clenzy = gratuit"],
             ["KYC (Sumsub/Veriff/Onfido)", "~1-3 EUR / verification", "si verification voyageur activee"],
             ["e-invoicing FR (PDP)", "~centimes / facture", "abonnement PDP + par-facture (echeance 2026-2027)"],
             ["e-invoicing KSA (ZATCA)", "~0 EUR API + KMS", "API gratuite ; cout = KMS/HSM certificats (~0-30 EUR/mois)"],
             ["WhatsApp (Meta Cloud)", "~0,01-0,08 EUR / conversation", "si messagerie WhatsApp activee"],
             ["Mapbox (cartes/geocoding)", "~0-quelques EUR", "tier gratuit genereux ; cache Redis"],
             ["Payouts (Wise/GoCardless)", "frais / virement", "reversements proprietaires (faible)"]]
    at = [[Paragraph("<b>%s</b>" % h, ParagraphStyle("th", parent=CELLB, fontSize=7.4, textColor=colors.white,
            alignment=(TA_LEFT))) for h in ["Option", "Cout (ordre de grandeur)", "Declencheur"]]]
    for r in addon:
        at.append([Paragraph(r[0], CELL), Paragraph(r[1], ParagraphStyle("c", parent=CELL, fontSize=7.4, textColor=AMBER)),
                   Paragraph(r[2], ParagraphStyle("n", parent=CELL, fontSize=7, textColor=MUTED))])
    att = Table(at, colWidths=[USABLE_W * 0.30, USABLE_W * 0.33, USABLE_W * 0.37], repeatRows=1)
    att.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
                             ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                             ("TOPPADDING", (0, 0), (-1, -1), 3.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                             ("LEFTPADDING", (0, 0), (-1, -1), 5)]))
    S.append(att)
    S.append(Paragraph("Pass-through (PAYE par le client / le voyageur - PAS un cout Baitly)", H3))
    for t in ["<b>Frais d'acquisition cartes</b> sur les paiements voyageurs : preleves sur la transaction, pas un opex Baitly. "
              "<b>Migration prevue Stripe -&gt; Airwallex</b> (cf. playbook) : tarif Airwallex sur devis, souvent competitif vs Stripe, "
              "marge FX faible (~0,5-1%) ; Airwallex peut aussi consolider FX + payouts (remplacer Wise/GoCardless).",
              "<b>Commissions OTA</b> (Airbnb/Booking/Expedia ~15%) : prelevees par l'OTA.",
              "<b>Abonnements IoT &amp; compta</b> (Nuki, Minut, Tuya, Pennylane, QuickBooks, Xero) : payes par le client a l'editeur.",
              "<b>Passerelles paiement locales</b> (CMI, Payzone, PayTabs) : frais d'acquisition par transaction, cote client/marchand."]:
        S.append(bullet(t, SMALL))
    S.append(PageBreak())

    # --- Reserves ---
    S.append(Paragraph("6. Reserves &amp; leviers d'optimisation", H1))
    S.append(Paragraph("Reserves methodologiques", H3))
    for t in ["Tous les montants sont des <b>ordres de grandeur</b> : tarifs cloud/SaaS approximatifs (cutoff 2026-01), a "
              "confirmer par devis. Le modele est parametre (section 1) et doit etre recalibre avec vos vrais ratios d'usage.",
              "Les paliers infra (16->32 Go, puis BDD managee + S3) sont des seuils indicatifs ; le vrai declencheur est la "
              "<b>croissance disque</b> (photos stockees en BYTEA dans Postgres - migrer vers S3 a l'echelle).",
              "Le cout IA standard suppose l'usage <b>borne par le cap 100k tokens/org</b> ; un usage reel plus intensif suit "
              "le scenario section 4.",
              "1 'client' = 1 organisation. Si vous raisonnez par 'utilisateur' (siege), le driver de cout reste l'usage IA "
              "des utilisateurs actifs, pas le nombre de comptes."]:
        S.append(bullet(t, SMALL))
    S.append(Paragraph("Leviers pour garder le cout bas", H3))
    for t in ["Rester <b>mono-noeud</b> le plus longtemps possible (l'archi est prete : pgBouncer, replica commente, exporter).",
              "<b>Externaliser les photos en S3/Object Storage</b> (flag deja present) pour soulager BDD + backups.",
              "Garder <b>multi-agent OFF</b> en prod ; conserver le cap de tokens ; pousser le <b>BYOK</b> pour les gros consommateurs IA.",
              "Cloudflare Free + Let's Encrypt + monitoring self-hosted = 0 EUR de SaaS recurrent au-dela du serveur."]:
        S.append(bullet(t, SMALL))
    doc.build(S)
    print("OK economics ->", os.path.join(PDF, "projection-economique-baitly.pdf"))

if __name__ == "__main__":
    build()
