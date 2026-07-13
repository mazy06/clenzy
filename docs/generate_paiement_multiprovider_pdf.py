#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genere le PDF « Systeme de paiement multi-fournisseurs » (doc technique + metier).

Public vise : equipes metier Baitly qui presentent le systeme a des banques /
PSP, avec le cahier des exigences complet et la grille d'evaluation a remplir.
Source de verite : server/docs/PAIEMENT-SYSTEME-MULTI-FOURNISSEURS.md (+ ADR).

Usage : python3 docs/generate_paiement_multiprovider_pdf.py
Sortie : analyse-concurrentielle/pdf/systeme-paiement-multi-fournisseurs.pdf
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, PageBreak, KeepTogether)
from reportlab.graphics.shapes import Drawing, Rect, String, Line

BASE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(os.path.dirname(BASE), "analyse-concurrentielle", "pdf")
os.makedirs(OUT_DIR, exist_ok=True)
OUT = os.path.join(OUT_DIR, "systeme-paiement-multi-fournisseurs.pdf")

# ── Palette maison (identique aux autres livrables Baitly) ─────────────────────
PRIMARY = colors.HexColor("#3E5A68")
PRIMARY2 = colors.HexColor("#6B8A9A")
ACCENT = colors.HexColor("#4A9B8E")
WARN = colors.HexColor("#D4A574")
DANGER = colors.HexColor("#C97A7A")
INK = colors.HexColor("#1F2A30")
MUTED = colors.HexColor("#5C6B73")
LIGHT = colors.HexColor("#EEF2F4")
LINE = colors.HexColor("#C9D4D9")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=16,
                    textColor=PRIMARY, spaceBefore=6, spaceAfter=8, leading=19)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=12,
                    textColor=PRIMARY, spaceBefore=11, spaceAfter=5, leading=15)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="Helvetica-Bold", fontSize=10,
                    textColor=ACCENT, spaceBefore=8, spaceAfter=3, leading=12.5)
BODY = ParagraphStyle("BODY", parent=ss["Normal"], fontName="Helvetica", fontSize=9.2,
                      textColor=INK, leading=13.2, spaceAfter=5)
BULLET = ParagraphStyle("BULLET", parent=BODY, leftIndent=5 * mm, bulletIndent=1.5 * mm,
                        spaceAfter=2.5)
SMALL = ParagraphStyle("SMALL", parent=BODY, fontSize=7.6, textColor=MUTED, leading=9.6)
CELL = ParagraphStyle("CELL", parent=BODY, fontSize=7.6, leading=9.4, spaceAfter=0)
CELLB = ParagraphStyle("CELLB", parent=CELL, fontName="Helvetica-Bold")
CELLW = ParagraphStyle("CELLW", parent=CELLB, textColor=colors.white)
TIT = ParagraphStyle("TIT", parent=BODY, fontName="Helvetica-Bold", fontSize=25,
                     textColor=PRIMARY, leading=30, alignment=TA_LEFT)
SUB = ParagraphStyle("SUB", parent=BODY, fontSize=11.5, textColor=MUTED, leading=16)

USABLE_W = A4[0] - 36 * mm


def on_page(canvas, doc):
    canvas.saveState()
    # Fond blanc explicite (lecteurs PDF en mode sombre).
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, A4[1] - 6 * mm, A4[0], 6 * mm, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(18 * mm, 10 * mm,
                      "Baitly - Systeme de paiement multi-fournisseurs . 2026-07-13 . Confidentiel")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, "p. %d" % doc.page)
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
    canvas.restoreState()


def make_doc(path):
    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=16 * mm, bottomMargin=16 * mm,
                          title="Baitly - Systeme de paiement multi-fournisseurs",
                          author="Baitly")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=on_page)])
    return doc


def table(data, widths, header=True, zebra=True, align_center_cols=()):
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
    ]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), PRIMARY)]
    if zebra:
        for i in range(1 if header else 0, len(data)):
            if i % 2 == (0 if header else 1):
                style.append(("BACKGROUND", (0, i), (-1, i), LIGHT))
    for c in align_center_cols:
        style.append(("ALIGN", (c, 0), (c, -1), "CENTER"))
    t.setStyle(TableStyle(style))
    return t


def hcells(*labels):
    return [Paragraph(l, CELLW) for l in labels]


def cells(*texts):
    return [Paragraph(t, CELL) for t in texts]


def crit_cell(level):
    """Pastille de criticite coloree."""
    color = {"OBLIGATOIRE": DANGER, "IMPORTANTE": WARN, "OPTIONNELLE": ACCENT}[level]
    p = ParagraphStyle("crit", parent=CELLB, textColor=color)
    return Paragraph(level, p)


# ── Schema d'architecture (dessin vectoriel simple) ───────────────────────────

def архi_diagram():  # nom volontairement unique
    W = USABLE_W
    H = 96 * mm
    d = Drawing(W, H)

    def box(x, y, w, h, label, sub=None, fill=LIGHT, stroke=PRIMARY2, bold=True, fs=8):
        d.add(Rect(x, y, w, h, fillColor=fill, strokeColor=stroke, strokeWidth=0.8, rx=3, ry=3))
        f = "Helvetica-Bold" if bold else "Helvetica"
        d.add(String(x + w / 2, y + h - 11, label, fontName=f, fontSize=fs,
                     fillColor=INK, textAnchor="middle"))
        if sub:
            for i, line in enumerate(sub):
                d.add(String(x + w / 2, y + h - 21 - i * 9, line, fontName="Helvetica",
                             fontSize=6.7, fillColor=MUTED, textAnchor="middle"))

    def arrow(x1, y1, x2, y2, label=None):
        d.add(Line(x1, y1, x2, y2, strokeColor=PRIMARY2, strokeWidth=0.9))
        # pointe
        import math
        ang = math.atan2(y2 - y1, x2 - x1)
        for da in (2.6, -2.6):
            d.add(Line(x2, y2, x2 - 4 * math.cos(ang + da), y2 - 4 * math.sin(ang + da),
                       strokeColor=PRIMARY2, strokeWidth=0.9))
        if label:
            d.add(String((x1 + x2) / 2 + 2, (y1 + y2) / 2 + 2, label, fontName="Helvetica",
                         fontSize=6.5, fillColor=MUTED, textAnchor="start"))

    # Rangee 1 : flux metier
    box(0, H - 16 * mm, W, 12 * mm,
        "Flux metier Baitly (sejour, solde, differe, interventions, upsells, boutique, credits IA, abonnements, reversements)",
        fill=colors.white, stroke=PRIMARY, fs=7.6)

    # Rangee 2 : orchestrateur
    box(W * 0.18, H - 34 * mm, W * 0.64, 14 * mm, "Orchestrateur de paiement",
        sub=["idempotence . choix du fournisseur (capacites, devise, pays) . registre des transactions (ledger)"],
        fill=LIGHT, stroke=PRIMARY)
    arrow(W / 2, H - 16 * mm, W / 2, H - 20 * mm)

    # Rangee 3 : les 3 familles de fournisseurs
    bw = W * 0.30
    box(0, H - 56 * mm, bw, 17 * mm, "Encaissement",
        sub=["Stripe . PayZone . CMI", "PayTabs (PayPal prevu)"], fill=colors.white)
    box(W * 0.35, H - 56 * mm, bw, 17 * mm, "Abonnement SaaS",
        sub=["Stripe Billing", "(PayZone recurrent prevu)"], fill=colors.white)
    box(W * 0.70, H - 56 * mm, bw, 17 * mm, "Reversement",
        sub=["Stripe Connect . SEPA . Wise", "Open Banking . Manuel (Maroc)"], fill=colors.white)
    arrow(W * 0.34, H - 34 * mm, W * 0.15, H - 39 * mm)
    arrow(W / 2, H - 34 * mm, W / 2, H - 39 * mm)
    arrow(W * 0.66, H - 34 * mm, W * 0.85, H - 39 * mm)

    # Rangee 4 : retour webhook -> ledger -> reconciliation
    box(0, H - 78 * mm, W * 0.30, 15 * mm, "Notification signee",
        sub=["webhook / IPN du fournisseur", "(succes ou echec)"], fill=colors.white, stroke=ACCENT)
    box(W * 0.35, H - 78 * mm, W * 0.30, 15 * mm, "Ledger interne",
        sub=["PaymentTransaction", "COMPLETED + evenement"], fill=colors.white, stroke=ACCENT)
    box(W * 0.70, H - 78 * mm, W * 0.30, 15 * mm, "Reconciliation metier",
        sub=["reservation / intervention / credits", "passes PAYE - idempotent"], fill=colors.white, stroke=ACCENT)
    arrow(W * 0.15, H - 56 * mm, W * 0.15, H - 63 * mm, "paiement confirme")
    arrow(W * 0.30, H - 70.5 * mm, W * 0.35, H - 70.5 * mm)
    arrow(W * 0.65, H - 70.5 * mm, W * 0.70, H - 70.5 * mm)

    d.add(String(0, 2, "Le meme circuit de confirmation sert TOUS les fournisseurs : "
                       "en ajouter un ne change ni les flux metier, ni la reconciliation.",
                 fontName="Helvetica-Oblique", fontSize=7.2, fillColor=MUTED))
    return d


# ═══════════════════════════════════════════════════════════════════════════════
# Contenu
# ═══════════════════════════════════════════════════════════════════════════════

story = []

# ── Couverture ────────────────────────────────────────────────────────────────
story.append(Spacer(1, 30 * mm))
story.append(Paragraph("Système de paiement<br/>multi-fournisseurs", TIT))
story.append(Spacer(1, 6 * mm))
story.append(Paragraph("Documentation technique &amp; métier — présentation aux partenaires "
                       "bancaires et prestataires de paiement (PSP)", SUB))
story.append(Spacer(1, 10 * mm))
cover = table([
    hcells("Document", "Détail"),
    cells("Objet", "Comprendre le système de paiement Baitly et évaluer l'adéquation d'un PSP "
                   "à nos exigences (cahier des exigences + grille d'évaluation en sections 5 et 6)."),
    cells("Public", "Équipes métier Baitly, direction, partenaires bancaires, PSP candidats."),
    cells("Version", "1.0 — 13 juillet 2026 (après refonte multi-fournisseurs, vagues 1 à 5)."),
    cells("Références internes", "ADR paiement multi-provider · PAIEMENT-SYSTEME-MULTI-FOURNISSEURS.md · "
                                 "PAIEMENT-MODES-INTEGRATION-EMBEDDED.md"),
    cells("Confidentialité", "Document interne — diffusion externe uniquement sous NDA."),
], [32 * mm, USABLE_W - 32 * mm])
story.append(cover)
story.append(PageBreak())

# ── Sommaire ──────────────────────────────────────────────────────────────────
story.append(Paragraph("Sommaire", H1))
for i, (num, titre) in enumerate([
    ("1", "Contexte et enjeux métier"),
    ("2", "Ce que le système sait faire"),
    ("3", "Architecture en clair"),
    ("4", "Parcours d'un paiement, de bout en bout"),
    ("5", "Cahier des exigences pour un PSP"),
    ("6", "Grille d'évaluation PSP (à remplir en rendez-vous)"),
    ("7", "Processus d'intégration et certification"),
    ("8", "Sécurité, conformité et règles d'or « money-safety »"),
    ("9", "Questions types à poser au PSP"),
    ("10", "Glossaire"),
]):
    story.append(Paragraph(f"<b>{num}.</b>  {titre}", BODY))
story.append(Spacer(1, 4 * mm))
story.append(Paragraph(
    "<b>Comment utiliser ce document :</b> les sections 1 à 4 donnent la compréhension du système "
    "(15 minutes de lecture). Les sections 5 et 6 sont l'outil de travail en rendez-vous : le cahier "
    "des exigences dit précisément ce qu'un PSP doit savoir faire, la grille permet de noter ses "
    "réponses. Les sections 7 à 9 préparent l'intégration.", BODY))

# ── 1. Contexte ───────────────────────────────────────────────────────────────
story.append(Paragraph("1. Contexte et enjeux métier", H1))
story.append(Paragraph(
    "Baitly est une plateforme SaaS de gestion locative courte durée (PMS) : elle permet à des "
    "conciergeries et des hôtes de gérer logements, réservations, ménage, facturation et encaissements. "
    "Chaque client de Baitly est une <b>organisation</b> indépendante (multi-tenant) : les paiements "
    "de l'un ne se mélangent jamais avec ceux de l'autre, et chaque organisation dispose de "
    "<b>ses propres comptes</b> chez les fournisseurs de paiement.", BODY))
story.append(Paragraph(
    "Le lancement commercial est <b>Maroc d'abord</b>. Or Stripe — notre fournisseur historique — "
    "n'opère pas au Maroc. Le système de paiement a donc été refondu pour être "
    "<b>multi-fournisseurs</b> :", BODY))
for txt in [
    "faire coexister <b>Stripe</b> (international : EUR, USD…) et des <b>PSP régionaux</b> "
    "(PayZone / CMI au Maroc, PayTabs en Arabie Saoudite) <b>en parallèle</b> — une même organisation "
    "peut encaisser des euros via Stripe et des dirhams via un PSP marocain ;",
    "<b>choisir automatiquement</b> le bon fournisseur pour chaque paiement, selon la devise, le pays, "
    "la configuration de l'organisation et les fonctionnalités requises ;",
    "pouvoir <b>ajouter un nouveau PSP sans réécrire la plateforme</b> : l'intégration d'un fournisseur "
    "est un module isolé (« adaptateur »), le reste du système ne change pas.",
]:
    story.append(Paragraph("•  " + txt, BULLET))
story.append(Paragraph(
    "<b>Ce que cela signifie pour un PSP partenaire :</b> l'intégration est encadrée par un contrat "
    "technique précis (section 5). Si le PSP répond aux exigences obligatoires, l'intégration est "
    "rapide et sans dérogation d'architecture ; les exigences optionnelles ouvrent des cas d'usage "
    "supplémentaires (caution, abonnement, reversements).", BODY))

# ── 2. Ce que le systeme sait faire ──────────────────────────────────────────
story.append(Paragraph("2. Ce que le système sait faire", H1))
story.append(Paragraph(
    "Le système couvre quatre besoins d'argent distincts. Chacun est isolé derrière une "
    "interface (« port ») à laquelle plusieurs fournisseurs peuvent se brancher.", BODY))
story.append(table([
    hcells("Besoin métier", "Exemples de flux Baitly", "Fournisseurs branchés aujourd'hui"),
    cells("<b>Encaisser un paiement ponctuel</b>",
          "Séjour réservé sur le moteur de réservation, solde d'un acompte, lien de paiement d'une "
          "réservation, interventions (ménage/maintenance), services additionnels (upsells), "
          "boutique matériel IoT, recharge de crédits IA",
          "Stripe · PayZone · CMI · PayTabs"),
    cells("<b>Abonner un client</b> (SaaS récurrent)",
          "Inscription d'une nouvelle organisation (mensuel / annuel / 2 ans, code promo), "
          "montée en gamme de forfait",
          "Stripe Billing (PayZone récurrent prévu pour le Maroc)"),
    cells("<b>Reverser de l'argent</b>",
          "Reversement mensuel au propriétaire, versement au personnel de ménage après mission",
          "Stripe Connect · virement SEPA · Wise · Open Banking · <b>Manuel</b> "
          "(= versé hors plateforme mais tracé — le rail Maroc au lancement)"),
    cells("<b>Poser une caution</b>",
          "Empreinte bancaire avec capture différée en cas de dégâts",
          "Stripe uniquement (décision assumée « D3 » — voir section 5, exigence E3.1)"),
], [34 * mm, USABLE_W - 34 * mm - 52 * mm, 52 * mm]))
story.append(Spacer(1, 2 * mm))
story.append(Paragraph(
    "Chaque paiement, quel que soit le fournisseur, est tracé dans un <b>registre interne unique</b> "
    "(le « ledger ») : une ligne par tentative, avec notre référence, la référence du fournisseur, "
    "le montant, la devise et l'objet payé. C'est la base de la comptabilité, de la réconciliation "
    "et des reversements.", BODY))

# ── 3. Architecture en clair ─────────────────────────────────────────────────
story.append(Paragraph("3. Architecture en clair", H1))
story.append(архi_diagram())
story.append(Spacer(1, 3 * mm))
story.append(Paragraph("Trois principes structurants", H2))
story.append(Paragraph(
    "<b>1. Un adaptateur par fournisseur.</b> Tout le dialogue avec un PSP (création du paiement, "
    "remboursement, vérification des notifications) vit dans un module dédié. Le reste de la "
    "plateforme ignore quel fournisseur encaisse. Ajouter un PSP = écrire cet adaptateur, rien d'autre.", BODY))
story.append(Paragraph(
    "<b>2. Des capacités déclarées, jamais de câblage en dur.</b> Chaque adaptateur déclare ce que "
    "son fournisseur sait faire (payer, rembourser, pré-autoriser, encaisser en récurrent, collecter "
    "une adresse de livraison…). Quand un flux a besoin d'une fonctionnalité, l'orchestrateur ne "
    "choisit que parmi les fournisseurs <b>capables</b>. Conséquence : dès qu'un PSP acquiert une "
    "capacité, il devient éligible <b>sans modification des flux métier</b>.", BODY))
story.append(Paragraph(
    "<b>3. Une confirmation unique pour tous.</b> Le fournisseur notifie le paiement par un message "
    "signé (webhook). Ce message met à jour le ledger, qui publie un événement interne ; un "
    "« réconciliateur » unique passe alors l'objet métier (réservation, intervention…) au statut "
    "PAYÉ — de façon <b>idempotente</b> (une notification livrée deux fois ne crédite jamais deux fois).", BODY))
story.append(Paragraph("Règles de choix du fournisseur (dans l'ordre)", H2))
story.append(table([
    hcells("Ordre", "Règle", "Exemple"),
    cells("1", "Capacités requises par le flux : les fournisseurs incapables sont écartés",
          "La boutique exige la collecte d'adresse de livraison → seuls les PSP qui la proposent restent en lice"),
    cells("2", "Devise régionale forte", "MAD → CMI puis PayZone · SAR → PayTabs (s'ils sont activés pour l'organisation)"),
    cells("3", "Pays de l'organisation", "Premier fournisseur activé pour le pays"),
    cells("4", "Repli Stripe", "Couvre toutes les capacités, toutes devises internationales"),
], [12 * mm, 72 * mm, USABLE_W - 12 * mm - 72 * mm], align_center_cols=(0,)))

# ── 4. Parcours d'un paiement ────────────────────────────────────────────────
story.append(Paragraph("4. Parcours d'un paiement, de bout en bout", H1))
story.append(Paragraph(
    "Exemple concret : un voyageur règle le solde de son acompte pour un séjour à Marrakech "
    "(réservation en dirhams, organisation ayant activé un PSP marocain).", BODY))
story.append(table([
    hcells("Étape", "Ce qui se passe", "Garantie"),
    cells("1. Demande de paiement",
          "Le voyageur clique « payer le solde ». Baitly <b>recalcule le montant côté serveur</b> "
          "(jamais le montant envoyé par le navigateur).",
          "Anti-fraude : montant inviolable"),
    cells("2. Choix du fournisseur",
          "Devise MAD + PSP marocain activé → le PSP local est retenu. Une ligne est créée au ledger "
          "(notre référence unique + l'objet payé).",
          "Traçabilité complète"),
    cells("3. Paiement",
          "Le voyageur est dirigé vers la page de paiement du fournisseur (redirection, iframe ou "
          "module intégré selon le fournisseur). Baitly ne voit <b>jamais</b> le numéro de carte.",
          "Conformité PCI (SAQ-A)"),
    cells("4. Notification",
          "Le fournisseur envoie une notification serveur-à-serveur <b>signée</b> (succès ou échec), "
          "contenant notre référence. Baitly vérifie la signature puis met le ledger à jour.",
          "Authenticité vérifiée"),
    cells("5. Réconciliation",
          "Un événement interne déclenche la mise à jour métier : réservation soldée, facture émise, "
          "répartition comptable, notifications. Rejouable sans double effet.",
          "Idempotence de bout en bout"),
], [30 * mm, USABLE_W - 30 * mm - 38 * mm, 38 * mm]))
story.append(Paragraph(
    "En cas de notification perdue, un <b>filet de secours</b> interroge le statut du paiement "
    "directement par API chez le fournisseur — d'où l'exigence E1.9.", BODY))

# ── 5. Cahier des exigences ──────────────────────────────────────────────────
story.append(PageBreak())
story.append(Paragraph("5. Cahier des exigences pour un PSP", H1))
story.append(Paragraph(
    "Cette section liste <b>tout ce que notre système attend d'un fournisseur de paiement</b>, en "
    "trois niveaux : <font color='#C97A7A'><b>OBLIGATOIRE</b></font> (éliminatoire — sans cela, "
    "l'intégration est impossible), <font color='#D4A574'><b>IMPORTANTE</b></font> (fortement "
    "souhaitée — son absence dégrade l'expérience ou reporte des cas d'usage), "
    "<font color='#4A9B8E'><b>OPTIONNELLE</b></font> (différenciante — ouvre des fonctionnalités "
    "supplémentaires ; en son absence, un repli existe).", BODY))

story.append(Paragraph("5.1 Exigences obligatoires (éliminatoires)", H2))
req_must = [
    ("E1.1", "Création de paiement par API serveur-à-serveur",
     "API REST/HTTPS : montant exact (en plus petite unité de la devise, sans arrondi silencieux), devise, "
     "<b>notre référence marchande</b>, e-mail client, description, URLs de retour (succès / annulation). "
     "En retour : une page de paiement hébergée par le PSP (URL de redirection)."),
    ("E1.2", "Référence marchande de bout en bout",
     "Notre référence de transaction (ex. « TX-a1b2c3 ») doit être attachée au paiement et "
     "<b>restituée telle quelle</b> dans toutes les notifications et consultations. C'est la clé de "
     "réconciliation entre le PSP et notre ledger."),
    ("E1.3", "Notifications serveur-à-serveur signées (webhook / IPN)",
     "Notification à chaque changement d'état (payé, refusé, erreur) avec <b>signature cryptographique "
     "vérifiable</b> (HMAC, hash avec clé secrète…) et <b>re-livraison automatique</b> si notre serveur "
     "ne répond pas. Les motifs d'échec doivent être distingués (refus carte vs erreur technique)."),
    ("E1.4", "Remboursement par API",
     "Remboursement total <b>et partiel</b> d'un paiement, par API, avec référence de remboursement restituée."),
    ("E1.5", "Protection contre les doublons (idempotence)",
     "Deux appels identiques de création (re-essai réseau, double clic) ne doivent pas créer deux "
     "paiements : clé d'idempotence API, ou unicité garantie sur notre référence marchande."),
    ("E1.6", "Environnement de test complet",
     "Sandbox fonctionnellement identique à la production : cartes de test (succès / refus), webhooks "
     "réels, documentation technique en libre accès. Notre certification (section 7) s'y déroule "
     "intégralement avant toute mise en production."),
    ("E1.7", "Sécurité et conformité",
     "PSP certifié <b>PCI-DSS</b> ; page de paiement hébergée chez le PSP (Baitly reste en périmètre "
     "SAQ-A : aucune donnée carte ne transite par nos serveurs) ; <b>3-D Secure</b> ; TLS partout ; "
     "identifiants d'API <b>par marchand</b> (chaque organisation Baitly = un marchand distinct, "
     "clés stockées chiffrées chez nous)."),
    ("E1.8", "Devise locale",
     "Pour le Maroc : encaissement en <b>MAD</b>, cartes locales (CMI) et internationales (Visa / "
     "Mastercard). Montants au centime exact."),
    ("E1.9", "Consultation du statut par API",
     "Pouvoir interroger l'état d'un paiement à partir de notre référence (filet de secours si une "
     "notification se perd)."),
]
rows = [hcells("Réf.", "Exigence", "Détail attendu")]
for ref, t, dtl in req_must:
    rows.append([Paragraph(f"<b>{ref}</b>", CELL), Paragraph(f"<b>{t}</b>", CELL), Paragraph(dtl, CELL)])
story.append(table(rows, [11 * mm, 44 * mm, USABLE_W - 11 * mm - 44 * mm]))

story.append(Paragraph("5.2 Exigences importantes", H2))
req_should = [
    ("E2.1", "Paiement intégrable dans notre tunnel (iframe)",
     "Page de paiement affichable dans une iframe sur notre site (en-têtes l'autorisant), avec "
     "signal de fin de paiement (postMessage ou équivalent). À défaut, la redirection pleine page "
     "(E1.1) reste utilisée — expérience moins fluide."),
    ("E2.2", "Paiement récurrent / abonnement",
     "Prélèvement récurrent (mensuel / annuel) initié par API, avec gestion du cycle de vie "
     "(échec de prélèvement, annulation). Nécessaire pour vendre l'abonnement Baitly en dirhams ; "
     "à défaut, l'abonnement des clients marocains reste sur circuit international."),
    ("E2.3", "Rapports de règlement et réconciliation",
     "Relevés des règlements (settlement) exportables (API ou fichiers), délais de versement "
     "documentés, frais détaillés par transaction."),
    ("E2.4", "Gestion des litiges (chargebacks)",
     "Notification des litiges/impayés, procédure de contestation documentée, idéalement par API."),
]
rows = [hcells("Réf.", "Exigence", "Détail attendu")]
for ref, t, dtl in req_should:
    rows.append([Paragraph(f"<b>{ref}</b>", CELL), Paragraph(f"<b>{t}</b>", CELL), Paragraph(dtl, CELL)])
story.append(table(rows, [11 * mm, 44 * mm, USABLE_W - 11 * mm - 44 * mm]))

story.append(Paragraph("5.3 Exigences optionnelles (différenciantes)", H2))
story.append(Paragraph(
    "Chacune correspond à une « capacité » de notre système : si le PSP la propose, elle est activée "
    "par simple déclaration dans son adaptateur ; sinon un repli existe.", BODY))
req_nice = [
    ("E3.1", "Pré-autorisation + capture différée", "Caution / dépôt de garantie sur empreinte bancaire",
     "Caution gérée via Stripe, ou en manuel (empreinte papier) au Maroc"),
    ("E3.2", "Carte enregistrée (vault, off-session)", "Prélèvement ultérieur sans re-saisie (caution après séjour)",
     "Idem E3.1"),
    ("E3.3", "Collecte d'adresse de livraison", "Vente de matériel physique (boutique IoT)",
     "Boutique servie par Stripe"),
    ("E3.4", "Module de paiement embarqué", "Paiement inline dans nos pages (équivalent « clientSecret »)",
     "Redirection ou iframe (E2.1)"),
    ("E3.5", "Reversements sortants (payouts)", "Verser propriétaires / personnel via le PSP",
     "Rails existants : SEPA, Wise, Open Banking, Manuel tracé"),
    ("E3.6", "Multi-devises au-delà de la devise locale", "Encaisser EUR/USD via le même PSP",
     "Stripe assure l'international"),
]
rows = [hcells("Réf.", "Fonctionnalité", "Cas d'usage Baitly", "Repli si absente")]
for ref, t, u, f in req_nice:
    rows.append([Paragraph(f"<b>{ref}</b>", CELL), Paragraph(f"<b>{t}</b>", CELL),
                 Paragraph(u, CELL), Paragraph(f, CELL)])
story.append(table(rows, [11 * mm, 46 * mm, 58 * mm, USABLE_W - 11 * mm - 46 * mm - 58 * mm]))

# ── 6. Grille d'evaluation ───────────────────────────────────────────────────
story.append(Paragraph("6. Grille d'évaluation PSP (à remplir en rendez-vous)", H1))
story.append(Paragraph(
    "PSP évalué : ______________________________    Date : ____________    Interlocuteur : "
    "______________________________", BODY))
story.append(Spacer(1, 1.5 * mm))
grid_rows = [hcells("Réf.", "Exigence", "Criticité", "Oui", "Partiel", "Non", "Commentaires / conditions")]
all_reqs = ([(r, t, "OBLIGATOIRE") for r, t, _ in req_must] +
            [(r, t, "IMPORTANTE") for r, t, _ in req_should] +
            [(r, t, "OPTIONNELLE") for r, t, _, _ in req_nice])
for ref, t, crit in all_reqs:
    grid_rows.append([Paragraph(f"<b>{ref}</b>", CELL), Paragraph(t, CELL), crit_cell(crit),
                      Paragraph("", CELL), Paragraph("", CELL), Paragraph("", CELL), Paragraph("", CELL)])
story.append(table(grid_rows,
                   [11 * mm, 52 * mm, 22 * mm, 9 * mm, 12 * mm, 9 * mm,
                    USABLE_W - 11 * mm - 52 * mm - 22 * mm - 30 * mm],
                   align_center_cols=(2, 3, 4, 5)))
story.append(Spacer(1, 2 * mm))
story.append(Paragraph(
    "<b>Lecture du résultat :</b> toute exigence E1.x à « Non » est éliminatoire en l'état — demander "
    "la feuille de route du PSP. Les E2.x/E3.x à « Non » ne bloquent pas : le repli documenté "
    "s'applique, et la capacité pourra être activée plus tard sans re-développement de notre côté.", BODY))
story.append(Paragraph(
    "<b>Questions financières à traiter en parallèle</b> (hors périmètre technique) : frais par "
    "transaction et par remboursement, frais fixes / minimums mensuels, délai et fréquence des "
    "règlements, devise de règlement, rétention / rolling reserve, frais de litige.", BODY))

# ── 7. Integration & certification ───────────────────────────────────────────
story.append(Paragraph("7. Processus d'intégration et certification", H1))
story.append(table([
    hcells("Phase", "Contenu", "Charge indicative"),
    cells("1. Cadrage", "Grille d'évaluation complétée, accès sandbox + documentation, "
                        "création du compte marchand de test", "1 semaine (dépend du PSP)"),
    cells("2. Adaptateur", "Développement du module fournisseur chez Baitly : création de paiement, "
                           "remboursement, vérification de signature, déclaration des capacités", "3 à 5 jours"),
    cells("3. Webhook", "Branchement de l'endpoint de notification dédié + vérification de signature "
                        "+ tests de re-livraison", "1 à 2 jours"),
    cells("4. Certification sandbox", "Scénarios obligatoires : paiement accepté · carte refusée · "
                                      "remboursement total · remboursement partiel · notification signée valide / invalide · "
                                      "re-livraison après panne simulée · exactitude des montants au centime · "
                                      "référence marchande restituée · consultation de statut", "2 à 3 jours"),
    cells("5. Pilote production", "Activation pour une organisation pilote, montants réels faibles, "
                                  "supervision renforcée, vérification des règlements bancaires", "2 semaines"),
    cells("6. Généralisation", "Ouverture à toutes les organisations éligibles (activation par "
                               "organisation, dans leurs réglages)", "—"),
], [30 * mm, USABLE_W - 30 * mm - 34 * mm, 34 * mm]))
story.append(Paragraph(
    "<b>Point clé pour le PSP :</b> l'étape 2 est la seule qui touche notre code, et elle est "
    "strictement bornée à l'adaptateur. Ni les flux métier, ni la comptabilité, ni la réconciliation "
    "ne sont modifiés — c'est la garantie d'une intégration courte et sans régression.", BODY))

# ── 8. Securite / money-safety ───────────────────────────────────────────────
story.append(Paragraph("8. Sécurité, conformité et règles d'or « money-safety »", H1))
story.append(Paragraph("Ce que Baitly garantit par construction", H3))
for txt in [
    "<b>Le serveur fixe les montants.</b> Aucun montant venant d'un navigateur ou d'une application "
    "n'est facturé tel quel : tout est recalculé depuis nos données (devis, réservation, catalogue).",
    "<b>Aucune donnée carte chez Baitly.</b> La saisie se fait toujours sur les pages ou modules du "
    "PSP (périmètre PCI SAQ-A pour Baitly).",
    "<b>Idempotence de bout en bout.</b> Doubles clics, re-essais réseau, notifications livrées deux "
    "fois, rejeux d'événements internes : aucun ne produit de double encaissement ni de double crédit.",
    "<b>Traçabilité intégrale.</b> Chaque tentative de paiement laisse une ligne au ledger avec les "
    "deux références (la nôtre et celle du PSP) — auditable et réconciliable.",
    "<b>Alertes de réconciliation.</b> Toute incohérence (paiement confirmé mais écriture comptable "
    "en échec) déclenche une alerte humaine — jamais un simple message dans un journal technique.",
    "<b>Identifiants chiffrés, par organisation.</b> Les clés d'API de chaque organisation sont "
    "chiffrées au repos et fournies au fournisseur appel par appel.",
]:
    story.append(Paragraph("•  " + txt, BULLET))
story.append(Paragraph("Ce que Baitly attend du PSP en miroir", H3))
for txt in [
    "Signatures de notification robustes et documentées (algorithme, encodage, exemples).",
    "Aucune exigence de stocker des secrets partagés en clair ou d'ouvrir des ports entrants exotiques.",
    "Séparation stricte sandbox / production (clés, URLs, données).",
    "Engagements de disponibilité (SLA) et canal de support technique avec délais de réponse.",
]:
    story.append(Paragraph("•  " + txt, BULLET))

# ── 9. Questions types ───────────────────────────────────────────────────────
story.append(Paragraph("9. Questions types à poser au PSP", H1))
story.append(table([
    hcells("Thème", "Questions"),
    cells("Couverture", "Quelles devises et quels moyens de paiement (cartes locales, internationales, "
                        "wallets) ? Des restrictions sur la location courte durée / conciergerie ?"),
    cells("Intégration", "API REST documentée publiquement ? Sandbox en libre accès ? Peut-on attacher "
                         "notre référence et la retrouver partout ? L'iframe est-elle autorisée ?"),
    cells("Notifications", "Comment sont signés les webhooks ? Politique de re-livraison (combien de "
                           "tentatives, sur quelle durée) ? Les échecs portent-ils un motif exploitable ?"),
    cells("Multi-marchand", "Chaque organisation Baitly peut-elle avoir son propre compte marchand ? "
                            "Quel parcours et quels délais d'onboarding (KYC/KYB) pour nos clients ?"),
    cells("Argent", "Délais et fréquence des règlements ? Frais complets (transaction, remboursement, "
                    "litige, change) ? Rétention / réserve ? Devise de règlement ?"),
    cells("Litiges", "Processus de chargeback ? Notification par API ? Délais et pièces attendues ?"),
    cells("Évolutions", "Feuille de route : récurrent, pré-autorisation, vault, payouts ? "
                        "(chaque « oui » futur = une capacité activable chez nous sans re-développement)"),
    cells("Contrat & support", "SLA de disponibilité ? Support technique dédié à l'intégration ? "
                               "Environnement de test permanent après mise en production ?"),
], [30 * mm, USABLE_W - 30 * mm]))

# ── 10. Glossaire ────────────────────────────────────────────────────────────
story.append(Paragraph("10. Glossaire", H1))
story.append(table([
    hcells("Terme", "Définition"),
    cells("PSP", "Prestataire de services de paiement : l'acteur qui encaisse la carte (Stripe, CMI, "
                 "PayZone, PayTabs…)."),
    cells("Port / adaptateur", "Le « port » est la prise standard côté Baitly ; l'« adaptateur » est le "
                               "module qui branche un PSP donné sur cette prise."),
    cells("Orchestrateur", "Le composant qui choisit le fournisseur, trace la transaction et séquence "
                           "les étapes en toute sécurité."),
    cells("Capacité", "Fonctionnalité déclarée par un adaptateur (payer, rembourser, pré-autoriser, "
                      "récurrent, iframe, adresse de livraison…). Le choix du fournisseur en dépend."),
    cells("Ledger", "Registre interne des transactions : une ligne par tentative de paiement, avec notre "
                    "référence, celle du PSP, le montant et l'objet payé."),
    cells("Webhook / IPN", "Notification serveur-à-serveur envoyée par le PSP pour signaler l'issue d'un "
                           "paiement. Toujours signée, toujours vérifiée."),
    cells("Référence marchande", "Notre identifiant unique de transaction, attaché au paiement chez le "
                                 "PSP et restitué dans chaque notification."),
    cells("Idempotence", "Propriété qui garantit qu'une même opération répétée (re-essai, double clic, "
                         "notification dupliquée) ne produit qu'un seul effet."),
    cells("Réconciliation", "Mise à jour de l'objet métier (réservation, intervention…) après confirmation "
                            "du paiement, avec écritures comptables et notifications."),
    cells("Pré-autorisation", "Blocage temporaire d'un montant sur la carte (caution) avec capture "
                              "ultérieure totale, partielle ou nulle."),
    cells("Vault / carte enregistrée", "Conservation sécurisée de la carte chez le PSP pour un prélèvement "
                                       "ultérieur sans re-saisie (« off-session »)."),
    cells("Settlement", "Règlement : versement par le PSP des fonds encaissés, net de frais, sur le compte "
                        "bancaire du marchand."),
    cells("Chargeback", "Litige : contestation d'un paiement par le porteur de carte auprès de sa banque."),
    cells("SAQ-A", "Périmètre PCI-DSS allégé : les données carte ne touchent jamais les serveurs du "
                   "marchand (saisie chez le PSP)."),
    cells("Sandbox", "Environnement de test du PSP, sans argent réel, utilisé pour la certification."),
], [36 * mm, USABLE_W - 36 * mm]))

story.append(Spacer(1, 6 * mm))
story.append(Paragraph(
    "Document généré depuis les sources internes Baitly (ADR paiement multi-provider, documentation "
    "métier du système, code en vigueur au 2026-07-13). Pour toute question technique : équipe "
    "plateforme Baitly.", SMALL))

make_doc(OUT).build(story)
print("OK ->", OUT)
