#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère le dossier « Paiement multi-fournisseurs — switch & parallèle ».

Style : importe le THÈME PDF Baitly partagé (docs/baitly_pdf_theme.py) — palette,
police Avenir, couverture, tableaux, footer, motif constellation. Ce fichier ne
contient que le CONTENU propre au document (diagrammes + sections).

Usage : python3 docs/generate_paiement_multiprovider_pdf.py
Sortie : analyse-concurrentielle/pdf/paiement-multi-fournisseurs-dossier.pdf
"""
import os
from baitly_pdf_theme import *  # noqa: F401,F403 - theme PDF Baitly partage

BASE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(os.path.dirname(BASE), "analyse-concurrentielle", "pdf")
os.makedirs(OUT_DIR, exist_ok=True)
OUT = os.path.join(OUT_DIR, "paiement-multi-fournisseurs-dossier.pdf")


# ══════════════════════════════════════════════════════════════════════════════
# Primitives de dessin propres aux diagrammes de CE document
# ══════════════════════════════════════════════════════════════════════════════

def _box(d, x, y, w, h, title, subs=None, fill=LIGHT, stroke=PRIMARY2, tcolor=INK, fs=8, bold=True):
    d.add(Rect(x, y, w, h, fillColor=fill, strokeColor=stroke, strokeWidth=0.9, rx=3, ry=3))
    fname = FONT_DEMI if bold else FONT
    d.add(String(x + w / 2, y + h - 11, title, fontName=fname, fontSize=fs,
                 fillColor=tcolor, textAnchor="middle"))
    if subs:
        for i, s in enumerate(subs):
            d.add(String(x + w / 2, y + h - 20.5 - i * 8.3, s, fontName=FONT,
                         fontSize=6.4, fillColor=MUTED, textAnchor="middle"))


def _arrow(d, x1, y1, x2, y2, color=PRIMARY2, label=None, dashed=False, w=0.9, lcolor=MUTED, ldy=2.5):
    ln = Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=w)
    if dashed:
        ln.strokeDashArray = [3, 2]
    d.add(ln)
    # Pointe : deux barbes qui repartent EN ARRIÈRE depuis la tête (x2,y2), avec un
    # petit écart angulaire (~0,42 rad). Un écart trop grand inverse la pointe.
    ang = math.atan2(y2 - y1, x2 - x1)
    head, spread = 6.0, 0.42
    for s in (spread, -spread):
        d.add(Line(x2, y2, x2 - head * math.cos(ang + s), y2 - head * math.sin(ang + s),
                   strokeColor=color, strokeWidth=w))
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        d.add(String(mx, my + ldy, label, fontName=FONT, fontSize=6.2,
                     fillColor=lcolor, textAnchor="middle"))


def _pill(d, x, y, w, h, text, fill, tcolor=colors.white, fs=7.2):
    d.add(Rect(x, y, w, h, fillColor=fill, strokeColor=fill, rx=h / 2, ry=h / 2))
    d.add(String(x + w / 2, y + h / 2 - 2.4, text, fontName=FONT_DEMI, fontSize=fs,
                 fillColor=tcolor, textAnchor="middle"))


# ── 1. Ports & adaptateurs (hexagonal) ────────────────────────────────────────

def diagram_ports():
    W, H = USABLE_W, 108 * mm
    d = Drawing(W, H)
    cx = W / 2
    # Coeur : orchestrateur (boite large pour ne pas rogner les sous-lignes)
    yorch = H - 40 * mm
    _box(d, cx - 98, yorch, 196, 24 * mm, "Orchestrateur de paiement",
         ["resolution du fournisseur", "ledger PaymentTransaction", "idempotence . transactions courtes"],
         fill=colors.HexColor("#DDE7EB"), stroke=PRIMARY, fs=8.5)
    # Flux metier au-dessus
    _box(d, 0, H - 14 * mm, W, 11 * mm,
         "Flux metier (sejour . solde . differe . interventions . upsells . boutique . credits IA . abonnements . reversements)",
         fill=colors.white, stroke=PRIMARY, fs=7.2)
    _arrow(d, cx, H - 14 * mm, cx, H - 16 * mm)

    yports = H - 78 * mm
    bw = W * 0.30
    _box(d, 0, yports, bw, 26 * mm, "PORT ENTRANT", ["PaymentProvider", "+ capabilities"],
         fill=LIGHT, stroke=ACCENT, fs=8)
    _box(d, cx - bw / 2, yports, bw, 26 * mm, "PORT ABONNEMENT", ["SubscriptionProvider", "+ capabilities"],
         fill=LIGHT, stroke=ACCENT, fs=8)
    _box(d, W - bw, yports, bw, 26 * mm, "PORT SORTANT", ["PayoutExecutor", "+ capabilities"],
         fill=LIGHT, stroke=ACCENT, fs=8)
    _arrow(d, cx - 30, yorch, W * 0.15, yports + 26 * mm)
    _arrow(d, cx, yorch, cx, yports + 26 * mm)
    _arrow(d, cx + 30, yorch, W * 0.85, yports + 26 * mm)

    # Adaptateurs sous chaque port
    yad = H - 100 * mm
    for (bx, items, c) in [
        (0, ["Stripe", "PayZone", "CMI . PayTabs"], SKY),
        (cx - bw / 2, ["Stripe Billing", "PayZone recurrent*"], WARN),
        (W - bw, ["StripeConnect . Wise", "SEPA . OpenBanking", "Manuel (Maroc)"], GREEN),
    ]:
        for i, it in enumerate(items):
            _pill(d, bx + 4, yad + (len(items) - 1 - i) * 8.5, bw - 8, 7, it, c)
        _arrow(d, bx + bw / 2, yports, bx + bw / 2, yad + len(items) * 8.5 - 1)

    d.add(String(0, 2, "Config par organisation (enabled / sandbox / cles chiffrees) : plusieurs fournisseurs actifs EN PARALLELE, la devise tranche.",
                 fontName=FONT_IT, fontSize=6.8, fillColor=MUTED))
    return d


# ── 2. Chaine d'execution (orchestration + reconciliation) ────────────────────

def diagram_orchestration():
    W, H = USABLE_W, 92 * mm
    d = Drawing(W, H)
    _box(d, 0, H - 13 * mm, W, 10 * mm, "Flux metier — appelle initiatePayment(request)  (aucun appel PSP direct)",
         fill=colors.white, stroke=PRIMARY, fs=7.4)
    _box(d, W * 0.14, H - 34 * mm, W * 0.72, 17 * mm, "Orchestrateur",
         ["1. idempotence  2. resolution (capacite/devise/pays)  3. persist PENDING (tx courte)",
          "4. appel fournisseur HORS tx  5. persist resultat + evenement (tx courte)"],
         fill=colors.HexColor("#DDE7EB"), stroke=PRIMARY, fs=8)
    _arrow(d, W / 2, H - 13 * mm, W / 2, H - 17 * mm)
    # 3 fournisseurs
    yf = H - 50 * mm
    _box(d, 0, yf, W * 0.30, 10 * mm, "Stripe (intl)", fill=colors.white, stroke=SKY, fs=7.6)
    _box(d, W * 0.35, yf, W * 0.30, 10 * mm, "PayZone / CMI (MA)", fill=colors.white, stroke=SKY, fs=7.6)
    _box(d, W * 0.70, yf, W * 0.30, 10 * mm, "PayTabs (KSA/Golfe)", fill=colors.white, stroke=SKY, fs=7.6)
    _arrow(d, W * 0.32, H - 34 * mm, W * 0.15, yf + 10 * mm)
    _arrow(d, W / 2, H - 34 * mm, W / 2, yf + 10 * mm)
    _arrow(d, W * 0.68, H - 34 * mm, W * 0.85, yf + 10 * mm)
    d.add(String(W / 2, yf - 6, "le client paie chez le fournisseur -> notification signee (webhook / IPN)",
                 fontName=FONT_IT, fontSize=6.6, fillColor=MUTED, textAnchor="middle"))
    # reconciliation
    yr = H - 78 * mm
    _box(d, 0, yr, W * 0.30, 14 * mm, "Notification signee",
         ["signature verifiee", "-> completeTransaction"], fill=colors.white, stroke=ACCENT, fs=7.4)
    _box(d, W * 0.35, yr, W * 0.30, 14 * mm, "Ledger COMPLETED",
         ["outbox -> Kafka", "PAYMENT_COMPLETED"], fill=colors.white, stroke=ACCENT, fs=7.4)
    _box(d, W * 0.70, yr, W * 0.30, 14 * mm, "Reconciliation metier",
         ["par sourceType", "entite -> PAYE (idempotent)"], fill=colors.white, stroke=ACCENT, fs=7.4)
    _arrow(d, W * 0.15, yf, W * 0.15, yr + 14 * mm)
    _arrow(d, W * 0.30, yr + 7 * mm, W * 0.35, yr + 7 * mm)
    _arrow(d, W * 0.65, yr + 7 * mm, W * 0.70, yr + 7 * mm)
    d.add(String(0, 2, "Le meme circuit de confirmation sert TOUS les fournisseurs : en ajouter un ne change ni les flux metier, ni la reconciliation.",
                 fontName=FONT_IT, fontSize=6.8, fillColor=MUTED))
    return d


# ── 3. Diagramme de sequence (parcours d'un paiement) ─────────────────────────

def diagram_sequence():
    W, H = USABLE_W, 118 * mm
    d = Drawing(W, H)
    actors = ["Voyageur", "Baitly", "Orchestr.", "PSP", "Ledger"]
    n = len(actors)
    xs = [W * (i + 0.5) / n for i in range(n)]
    top = H - 8 * mm
    bot = 6 * mm
    for i, a in enumerate(actors):
        _box(d, xs[i] - 22, top, 44, 8 * mm, a, fill=PRIMARY, stroke=PRIMARY, tcolor=colors.white, fs=7.4)
        ln = Line(xs[i], top, xs[i], bot, strokeColor=LINE, strokeWidth=0.7)
        ln.strokeDashArray = [2, 2]
        d.add(ln)

    def msg(y, i, j, label, dashed=False, color=PRIMARY2):
        _arrow(d, xs[i], y, xs[j], y, color=color, label=label, dashed=dashed, ldy=2.2)

    y = top - 6 * mm
    step = 9.2 * mm
    msg(y, 0, 1, "clique payer"); y -= step
    d.add(String(xs[1], y + 3, "recalcule le montant (serveur)", fontName=FONT_IT,
                 fontSize=6.2, fillColor=DANGER, textAnchor="middle")); y -= step * 0.55
    msg(y, 1, 2, "initiatePayment(montant serveur)"); y -= step
    d.add(String(xs[2], y + 3, "resout le fournisseur + persist PENDING", fontName=FONT_IT,
                 fontSize=6.2, fillColor=MUTED, textAnchor="middle")); y -= step * 0.55
    msg(y, 2, 3, "createPayment (HORS tx, cle idempotence)"); y -= step
    msg(y, 3, 2, "URL / clientSecret", dashed=True); y -= step
    msg(y, 2, 1, "session de paiement", dashed=True); y -= step
    msg(y, 1, 0, "redirige vers le PSP", dashed=True); y -= step
    d.add(String(xs[3], y + 3, "le voyageur paie sur la page du PSP", fontName=FONT_IT,
                 fontSize=6.2, fillColor=MUTED, textAnchor="middle")); y -= step * 0.6
    msg(y, 3, 4, "webhook SIGNE (succes)", color=ACCENT); y -= step
    d.add(String(xs[4], y + 3, "ledger COMPLETED -> event -> entite PAYE (idempotent)",
                 fontName=FONT_IT, fontSize=6.2, fillColor=ACCENT, textAnchor="middle"))
    return d


# ── 4. Machine a etats (PaymentTransaction) ───────────────────────────────────

def diagram_states():
    W, H = USABLE_W, 46 * mm
    d = Drawing(W, H)
    bw, bh = 66, 12 * mm
    y = H - 20 * mm
    # Rangée principale : PENDING -> PROCESSING -> COMPLETED -> REFUNDED
    x0 = 6
    gap = (W - 12 - 4 * bw) / 3
    xs = [x0 + i * (bw + gap) for i in range(4)]
    _box(d, xs[0], y, bw, bh, "PENDING", fill=LIGHT, stroke=PRIMARY2, fs=8)
    _box(d, xs[1], y, bw, bh, "PROCESSING", fill=LIGHT, stroke=PRIMARY2, fs=8)
    _box(d, xs[2], y, bw, bh, "COMPLETED", fill=colors.HexColor("#DDEEE9"), stroke=GREEN, fs=8)
    _box(d, xs[3], y, bw, bh, "REFUNDED", fill=colors.white, stroke=SKY, fs=8)
    _arrow(d, xs[0] + bw, y + bh / 2, xs[1], y + bh / 2, label="init")
    _arrow(d, xs[1] + bw, y + bh / 2, xs[2], y + bh / 2, label="webhook OK")
    _arrow(d, xs[2] + bw, y + bh / 2, xs[3], y + bh / 2, color=SKY, label="refund")
    # États d'échec sous PROCESSING (arrivée au centre-haut de chaque boîte)
    yb = y - 18 * mm
    failed_cx = xs[1] - bw / 2 - 6 + bw / 2
    cancelled_cx = xs[1] + bw / 2 + 6 + bw / 2
    _box(d, xs[1] - bw / 2 - 6, yb, bw, 10 * mm, "FAILED", fill=colors.white, stroke=DANGER, fs=7.6)
    _box(d, xs[1] + bw / 2 + 6, yb, bw, 10 * mm, "CANCELLED", fill=colors.white, stroke=WARN, fs=7.6)
    _arrow(d, xs[1] + bw / 2 - 6, y, failed_cx, yb + 10 * mm, color=DANGER)
    _arrow(d, xs[1] + bw / 2 + 6, y, cancelled_cx, yb + 10 * mm, color=WARN)
    ymid = (y + yb + 10 * mm) / 2
    d.add(String(failed_cx - 4, ymid, "échec / refus", fontName=FONT, fontSize=6.2,
                 fillColor=DANGER, textAnchor="end"))
    d.add(String(cancelled_cx + 4, ymid, "expiré", fontName=FONT, fontSize=6.2,
                 fillColor=WARN, textAnchor="start"))
    return d


# ── 5. Arbre de resolution du fournisseur ─────────────────────────────────────

def diagram_resolution():
    W, H = USABLE_W, 74 * mm
    d = Drawing(W, H)
    xL = 6
    step = 13 * mm
    y = H - 12 * mm
    nodes = [
        ("1. preference explicite ?", "rare - a eviter"),
        ("2. capacites requises ?", "ecarte les fournisseurs incapables (embedded, shipping, recurrent, SEPA...)"),
        ("3. devise regionale ?", "MAD -> CMI puis PayZone . SAR -> PayTabs"),
        ("4. pays de l'organisation ?", "1er fournisseur active pour le pays"),
        ("5. repli Stripe", "couvre toutes capacites, international"),
    ]
    for i, (t, s) in enumerate(nodes):
        yy = y - i * step
        c = GREEN if i == len(nodes) - 1 else PRIMARY2
        _box(d, xL, yy - 10 * mm, W * 0.52, 10 * mm, t, fill=LIGHT, stroke=c, fs=7.8)
        d.add(String(xL + W * 0.54, yy - 6, s, fontName=FONT, fontSize=6.8,
                     fillColor=MUTED, textAnchor="start"))
        if i < len(nodes) - 1:
            ax = xL + W * 0.26
            _arrow(d, ax, yy - 10 * mm, ax, yy - step)
            # label « sinon » à DROITE de la flèche verticale (évite la pointe)
            d.add(String(ax + 6, (yy - 10 * mm + yy - step) / 2 - 2, "sinon",
                         fontName=FONT, fontSize=6.2, fillColor=MUTED, textAnchor="start"))
    return d


# ── 6. Reversement mensuel + mandat SEPA ──────────────────────────────────────

def diagram_payout_sepa():
    W, H = USABLE_W, 74 * mm
    d = Drawing(W, H)

    def row3(y, boxes, labels):
        bw = W * 0.27
        xs = [0, W * 0.365, W - bw]
        for (x, (t, subs, fill, stroke)) in zip(xs, boxes):
            _box(d, x, y, bw, 12 * mm, t, subs, fill=fill, stroke=stroke, fs=7.4)
        for i, lab in enumerate(labels):
            x1, x2 = xs[i] + bw, xs[i + 1]
            _arrow(d, x1, y + 6 * mm, x2, y + 6 * mm, label=lab, ldy=3)

    # A — mise en place du mandat (une fois)
    d.add(String(4, H - 6 * mm, "A. Mise en place (une fois) — mandat SEPA",
                 fontName=FONT_DEMI, fontSize=8, fillColor=PRIMARY, textAnchor="start"))
    yA = H - 24 * mm
    row3(yA,
         [("Proprietaire", ["IBAN + signature", "mandat SEPA"], colors.white, PRIMARY2),
          ("Baitly / PSP", ["enregistre le", "mandat (UMR)"], LIGHT, PRIMARY),
          ("Banque", ["mandat actif", "(recurrent)"], colors.white, GREEN)],
         ["signe", "depose"])

    # B — reversement mensuel (recurrent) : 4 boites bien espacees
    d.add(String(4, yA - 8 * mm, "B. Chaque mois — reversement automatique",
                 fontName=FONT_DEMI, fontSize=8, fillColor=PRIMARY, textAnchor="start"))
    yB = yA - 30 * mm
    bw = W * 0.205
    xs = [0, W * 0.265, W * 0.53, W - bw]
    boxesB = [("Ledger", ["solde net du", "proprietaire"], colors.white, PRIMARY2),
              ("PayoutExecutor", ["SEPA / virement", "(idempotent)"], LIGHT, PRIMARY),
              ("PSP / Banque", None, colors.white, GREEN),
              ("Compte proprio", None, colors.white, PRIMARY2)]
    for (x, (t, subs, fill, stroke)) in zip(xs, boxesB):
        _box(d, x, yB, bw, 12 * mm, t, subs, fill=fill, stroke=stroke, fs=7.4)
    labelsB = ["", "virement", ""]
    colorsB = [PRIMARY2, PRIMARY2, GREEN]
    for i, lab in enumerate(labelsB):
        _arrow(d, xs[i] + bw, yB + 6 * mm, xs[i + 1], yB + 6 * mm,
               color=colorsB[i], label=(lab or None), ldy=3)

    d.add(String(4, 2, "Le mandat SEPA evite de re-saisir l'IBAN chaque mois : virement recurrent declenche par Baitly, trace au ledger (rail SEPA / OpenBanking).",
                 fontName=FONT_IT, fontSize=6.8, fillColor=MUTED))
    return d


# ── 7. UML composants (ports & adaptateurs) ───────────────────────────────────

def diagram_uml():
    W, H = USABLE_W, 58 * mm
    d = Drawing(W, H)

    def iface(x, y, w, name, methods):
        h = 30 + len(methods) * 7.5
        d.add(Rect(x, y - h, w, h, fillColor=colors.HexColor("#EAF0F2"), strokeColor=PRIMARY, strokeWidth=1))
        d.add(String(x + w / 2, y - 8, "<<interface>>", fontName=FONT_IT, fontSize=6.2,
                     fillColor=MUTED, textAnchor="middle"))
        d.add(String(x + w / 2, y - 16, name, fontName=FONT_DEMI, fontSize=7.6,
                     fillColor=PRIMARY, textAnchor="middle"))
        d.add(Line(x, y - 19, x + w, y - 19, strokeColor=PRIMARY, strokeWidth=0.6))
        for i, m in enumerate(methods):
            d.add(String(x + 4, y - 27 - i * 7.5, "+ " + m, fontName=FONT, fontSize=6.3,
                         fillColor=INK, textAnchor="start"))
        return h

    def impl(x, y, w, name, c):
        d.add(Rect(x, y - 10, w, 10, fillColor=colors.white, strokeColor=c, strokeWidth=0.8, rx=2, ry=2))
        d.add(String(x + w / 2, y - 7, name, fontName=FONT, fontSize=6.5,
                     fillColor=INK, textAnchor="middle"))

    colw = W * 0.31
    xs = [0, W * 0.345, W - colw]
    ifaces = [
        ("PaymentProvider", ["createPayment()", "refundPayment()", "getCapabilities()", "verifyWebhook()"]),
        ("SubscriptionProvider", ["createSubscriptionCheckout()", "getCapabilities()"]),
        ("PayoutExecutor", ["execute()", "supports()", "getCapabilities()"]),
    ]
    impls = [
        ["StripePaymentProvider", "PayzonePaymentProvider", "CmiPaymentProvider", "PayTabsPaymentProvider"],
        ["StripeBillingSubscription", "PayzoneRecurrent*"],
        ["StripeConnectExecutor", "SepaPayoutExecutor", "OpenBankingExecutor", "ManualPayoutExecutor"],
    ]
    cols = [SKY, WARN, GREEN]

    ytop = H - 6
    # Interfaces (hauteurs différentes selon le nombre de méthodes).
    iface_h = []
    for x, (name, methods) in zip(xs, ifaces):
        iface_h.append(iface(x, ytop, colw, name, methods))

    # Écart net entre le bas de l'interface la plus haute et le sommet des implémentations.
    gap = 22
    y_impl_top = ytop - max(iface_h) - gap
    impl_step = 12

    for col, (x, items, c) in enumerate(zip(xs, impls, cols)):
        iface_bottom = ytop - iface_h[col]
        # Flèche de réalisation (pointillée, pointe vers l'interface), bien visible.
        _arrow(d, x + colw / 2, y_impl_top, x + colw / 2, iface_bottom, dashed=True, w=0.8)
        for i, m in enumerate(items):
            impl(x, y_impl_top - i * impl_step, colw, m, c)

    d.add(String(0, 2, "Realisation (fleche pointillee) : chaque adaptateur implemente son port ; un registry resout l'implementation par capacite + devise + pays.",
                 fontName=FONT_IT, fontSize=6.4, fillColor=MUTED))
    return d


# ══════════════════════════════════════════════════════════════════════════════
# Contenu
# ══════════════════════════════════════════════════════════════════════════════

story = []

# ── Couverture (via le thème Baitly) ──────────────────────────────────────────
build_cover(
    story,
    eyebrow="ARCHITECTURE&nbsp;&nbsp;·&nbsp;&nbsp;DOSSIER&nbsp;&nbsp;·&nbsp;&nbsp;CONFIDENTIEL",
    title_lines=["Paiement <font color='#6B8A9A'>multi-fournisseurs</font>", "switch &amp; parallèle"],
    subtitle="Décision d'architecture, système en fonctionnement, exigences &amp; démarchage "
             "des prestataires de paiement (PSP).",
    meta_rows=[
        ("Objet", "Comprendre l'architecture de paiement multi-fournisseurs de Baitly, la présenter "
                  "aux banques / PSP, et piloter leur démarchage + certification par pays."),
        ("Fusionne", "ADR « paiement multi-fournisseurs (switch + parallèle) » + documentation système "
                     "technique &amp; métier + runbook de certification PSP + démarchage par pays."),
        ("Version", "2.0 — 14 juillet 2026 (architecture multi-fournisseurs achevée côté encaissement)."),
        ("Confidentialité", "Document interne — diffusion externe uniquement sous NDA."),
    ])

# ── Sommaire ──────────────────────────────────────────────────────────────────
story.append(Paragraph("Sommaire", H1))
toc = [
    ("I", "Décision d'architecture (switch & parallèle)", [
        "1. Contexte & enjeux métier", "2. Le problème (les gaps)",
        "3. Décisions de conception (D1–D4)", "4. Architecture cible — ports & adaptateurs",
        "5. Plan de migration (vagues V1–V6) & statut", "6. Invariants « money-safety »"]),
    ("II", "Le système en fonctionnement", [
        "7. Quatre besoins, trois ports", "8. Chaîne d'exécution & réconciliation",
        "9. Parcours d'un paiement (séquence)", "10. Cycle de vie d'une transaction (états)",
        "11. Résolution du fournisseur & matrice des capacités", "12. Flux métier & sourceTypes"]),
    ("III", "Exigences PSP & démarchage", [
        "13. Cahier des exigences (obligatoire / important / optionnel)",
        "14. Reversements mensuels & mandat SEPA (exigence)",
        "15. Démarchage des PSP par pays d'action",
        "16. PSP full-stack : couvrir les trois ports comme Stripe",
        "17. Plan de certification sandbox par PSP", "18. Grille d'évaluation (à remplir)",
        "19. Processus d'intégration"]),
    ("IV", "Annexes", ["20. UML des composants", "21. Glossaire"]),
]
for num, title, items in toc:
    story.append(Paragraph(f"<b>Partie {num} — {title}</b>", ParagraphStyle("tp", parent=BODY, textColor=PRIMARY, spaceBefore=4)))
    for it in items:
        story.append(Paragraph("&nbsp;&nbsp;&nbsp;" + it, ParagraphStyle("ti", parent=BODY, spaceAfter=1)))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════════════
# PARTIE I
# ══════════════════════════════════════════════════════════════════════════════
story.append(part_banner("I", "Décision d'architecture — switch & parallèle"))
story.append(Spacer(1, 4 * mm))

story.append(Paragraph("1. Contexte & enjeux métier", H1))
story.append(Paragraph("Baitly encaisse et reverse de l'argent sur <b>plusieurs juridictions</b>, avec des "
                       "fournisseurs différents, <b>en parallèle</b> et <b>switchables</b> sans réécrire les "
                       "flux métier. Le lancement est <b>Maroc d'abord</b> — or Stripe n'y opère pas. "
                       "L'architecture doit donc faire coexister Stripe (international) et des PSP régionaux "
                       "(PayZone/CMI au Maroc, PayTabs en Arabie Saoudite) et choisir le bon fournisseur "
                       "selon l'organisation, le pays, la devise et le type de flux.", BODY))
story.append(Paragraph("Constat d'audit : <b>la fondation existait déjà et était bien conçue</b> (ports & "
                       "adaptateurs, orchestrateur, config par organisation). La décision ne crée pas "
                       "l'architecture — elle la <b>formalise, la complète et la généralise</b> à tous les flux.", BODY))

story.append(Paragraph("2. Le problème (les gaps corrigés)", H1))
story.append(table([
    hcells("#", "Gap identifié", "Résolution"),
    [Paragraph("1", CELL), Paragraph("~41 fichiers appelaient Stripe <b>en direct</b> — le switch ne valait que pour les flux orchestrés.", CELL), ok("migré")],
    [Paragraph("2", CELL), Paragraph("Flux non couverts : caution/pré-autorisation, abonnement récurrent, checkout sessions.", CELL), ok("couvert")],
    [Paragraph("3", CELL), Paragraph("Pas de modèle de <b>capacités</b> : le resolver pouvait choisir un fournisseur incapable du flux.", CELL), ok("capabilities")],
    [Paragraph("4", CELL), Paragraph("Adaptateurs régionaux non certifiés (champs API « à confirmer à l'onboarding »).", CELL), Paragraph("runbook §17", ParagraphStyle("w", parent=CELLB, textColor=WARN, alignment=TA_CENTER))],
    [Paragraph("5", CELL), Paragraph("<b>Entorse money-safety</b> : appel HTTP externe DANS une transaction DB.", CELL), ok("corrigé")],
], [8 * mm, USABLE_W - 8 * mm - 24 * mm, 24 * mm], align_center_cols=(0, 2)))

story.append(Paragraph("3. Décisions de conception (D1–D4)", H1))
story.append(table([
    hcells("#", "Décision", "Choix retenu"),
    cells("D1", "Abonnement SaaS récurrent", "Port dédié <b>SubscriptionProvider</b> (Stripe Billing / PayZone récurrent), séparé du paiement one-shot — la sémantique récurrente diffère trop."),
    cells("D2", "Capacités des providers", "<b>Capacités déclarées</b> (PAY / PREAUTH / REFUND / PAYOUT / RECURRING / CUSTOMER / EMBEDDED / SHIPPING) + resolver capability-aware ; plus de UnsupportedOperationException dans le chemin de résolution."),
    cells("D3", "Caution au Maroc", "<b>Capability-gated</b> : pré-autorisation via Stripe uniquement ; au lancement MA, caution manuelle / empreinte (pas de pré-auth PSP local)."),
    cells("D4", "Ordre de migration", "<b>Strangler, non-breaking</b>, par vagues (§5) — tests de caractérisation avant bascule."),
], [8 * mm, 42 * mm, USABLE_W - 8 * mm - 42 * mm], align_center_cols=(0,)))

story.append(PageBreak())
story.append(Paragraph("4. Architecture cible — ports & adaptateurs", H1))
story.append(Paragraph("Tous les flux métier passent par l'orchestration ; <b>plus aucun appel Stripe direct "
                       "hors des adaptateurs</b>. Trois ports isolent le métier des fournisseurs ; chaque "
                       "adaptateur déclare ses capacités ; la configuration par organisation active plusieurs "
                       "fournisseurs en parallèle.", BODY))
story.append(fig(diagram_ports(),
                 "Figure 1 — Architecture hexagonale : un orchestrateur central, trois ports (entrant, "
                 "abonnement, sortant), des adaptateurs interchangeables. * = à venir."))

story.append(Paragraph("5. Plan de migration (vagues V1–V6) & statut", H1))
story.append(table([
    hcells("Vague", "Contenu", "Sortie", "Statut"),
    [Paragraph("<b>V1</b> Fondations", CELL), Paragraph("Capabilities + resolver + fix transactionnel", CELL), Paragraph("Socle prêt, zéro régression", CELL), ok()],
    [Paragraph("<b>V2</b> Encaissement", CELL), Paragraph("Booking checkout, cautions, balance/deferred", CELL), Paragraph("Paiements voyageur multi-provider", CELL), ok()],
    [Paragraph("<b>V3</b> Abonnement", CELL), Paragraph("SubscriptionProvider (Stripe Billing)", CELL), Paragraph("Inscription + upgrade multi-pays", CELL), ok()],
    [Paragraph("<b>V4</b> Payouts", CELL), Paragraph("Owner + housekeeper via PayoutExecutor", CELL), Paragraph("Payout multi-rail (dont Manuel MA)", CELL), ok()],
    [Paragraph("<b>V5</b> Périphérie", CELL), Paragraph("Shop, upsells, crédits IA, mobile", CELL), Paragraph("Plus aucun Stripe direct hors adaptateurs", CELL), ok()],
    [Paragraph("<b>V6</b> Certification", CELL), Paragraph("Sandbox PayZone/CMI/PayTabs + E2E", CELL), Paragraph("Adaptateurs régionaux prouvés", CELL), Paragraph("code prêt<br/>sandbox §17", ParagraphStyle("w", parent=CELL, textColor=WARN, alignment=TA_CENTER))],
], [26 * mm, 52 * mm, 52 * mm, USABLE_W - 26 * mm - 104 * mm], align_center_cols=(3,)))
story.append(Paragraph("<b>Méthode par vague</b> : tests de caractérisation -> bascule derrière l'orchestration "
                       "-> vérification E2E -> suppression du code Stripe direct devenu mort (preuve avant "
                       "suppression). Résultat : <b>plus aucun Session.create hors de la couche adaptateur</b>.", BODY))

story.append(Paragraph("6. Invariants « money-safety » (préservés)", H1))
for t in [
    "<b>Le serveur fixe le montant</b> — recalculé depuis l'entité métier ; le montant client n'est qu'un cross-check.",
    "<b>Aucun appel HTTP externe dans une transaction DB</b> — tx courte (persist PENDING) -> appel fournisseur hors tx (idempotent) -> tx courte (persist résultat) ; effets externes post-commit.",
    "<b>Idempotence de bout en bout</b> — clé d'idempotence à la création ; transitions de statut en UPDATE conditionnel (CAS) -> pas de double-crédit sur re-livraison webhook.",
    "<b>Conversion monétaire sûre</b> — arrondi HALF_UP, jamais de troncature ; attention aux devises à 3 décimales / sans sous-unité (PSP régionaux).",
    "<b>Pas de catch(Exception) avaleur</b> — un échec produit un statut de réconciliation explicite + une alerte admin.",
    "<b>Webhooks signés</b> — signature vérifiée avant tout changement d'état ; secrets par organisation, chiffrés au repos.",
]:
    story.append(Paragraph("•&nbsp; " + t, BULLET))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════════════
# PARTIE II
# ══════════════════════════════════════════════════════════════════════════════
story.append(part_banner("II", "Le système en fonctionnement"))
story.append(Spacer(1, 4 * mm))

story.append(Paragraph("7. Quatre besoins, trois ports", H1))
story.append(table([
    hcells("Besoin métier", "Exemples de flux", "Port", "Fournisseurs"),
    cells("Encaisser un paiement ponctuel", "Séjour, solde, différé, interventions, upsells, boutique, crédits IA", "PaymentProvider", "Stripe · PayZone · CMI · PayTabs"),
    cells("Abonner un client (SaaS)", "Inscription, montée en gamme de forfait", "SubscriptionProvider", "Stripe Billing (PayZone récurrent à venir)"),
    cells("Reverser de l'argent", "Reversement mensuel propriétaire, versement ménage", "PayoutExecutor", "StripeConnect · SEPA · Wise · OpenBanking · Manuel"),
    cells("Poser une caution", "Empreinte + capture différée", "— (Stripe, D3)", "Stripe (manuel au MA)"),
], [40 * mm, USABLE_W - 40 * mm - 34 * mm - 44 * mm, 34 * mm, 44 * mm]))

story.append(Paragraph("8. Chaîne d'exécution & réconciliation", H1))
story.append(fig(diagram_orchestration(),
                 "Figure 2 — De l'appel métier au marquage « PAYÉ » : l'orchestrateur résout et séquence, "
                 "le fournisseur encaisse, la notification signée alimente le ledger, un consumer unique "
                 "réconcilie l'entité — de façon provider-agnostique."))

story.append(PageBreak())
story.append(Paragraph("9. Parcours d'un paiement (séquence)", H1))
story.append(fig(diagram_sequence(),
                 "Figure 3 — Diagramme de séquence d'un encaissement. Le montant est recalculé serveur ; "
                 "l'appel au PSP se fait hors transaction ; la confirmation arrive par webhook signé et "
                 "déclenche une réconciliation idempotente."))

story.append(Paragraph("10. Cycle de vie d'une transaction (états)", H1))
story.append(fig(diagram_states(),
                 "Figure 4 — Machine à états d'une PaymentTransaction au ledger. Les transitions sont des "
                 "UPDATE conditionnels (CAS)."))

story.append(Paragraph("11. Résolution du fournisseur & matrice des capacités", H1))
story.append(fig(diagram_resolution(),
                 "Figure 5 — Ordre de résolution du fournisseur. Une fonctionnalité différenciante est "
                 "toujours exprimée en capacité (jamais un fournisseur épinglé en dur)."))
story.append(Paragraph("<b>Matrice des capacités</b> (déclarées par chaque adaptateur ; "
                       "<font color='#4A9B8E'><b>&bull;</b></font> = supporté) :", BODY))
story.append(table([
    hcells("Capacité", "Stripe", "PayZone", "CMI", "PayTabs", "Signification"),
    [Paragraph("PAY", CELL), yes(), yes(), yes(), yes(), Paragraph("encaisser un paiement one-shot", CELL)],
    [Paragraph("REFUND", CELL), yes(), yes(), no(), yes(), Paragraph("rembourser via API (CMI : manuel¹)", CELL)],
    [Paragraph("PREAUTH", CELL), yes(), no(), no(), no(), Paragraph("caution (pré-autorisation)", CELL)],
    [Paragraph("CUSTOMER", CELL), yes(), no(), no(), no(), Paragraph("carte enregistrée (off-session)", CELL)],
    [Paragraph("PAYOUT", CELL), yes(), no(), no(), no(), Paragraph("reversement via le fournisseur", CELL)],
    [Paragraph("EMBEDDED_CHECKOUT", CELL), yes(), no(), no(), no(), Paragraph("paiement inline (clientSecret)", CELL)],
    [Paragraph("SHIPPING_ADDRESS", CELL), yes(), no(), no(), no(), Paragraph("collecte d'adresse de livraison", CELL)],
    [Paragraph("RECURRING", CELL), yes(), soon(), no(), no(), Paragraph("abonnement récurrent", CELL)],
], [40 * mm, 15 * mm, 17 * mm, 12 * mm, 16 * mm, USABLE_W - 40 * mm - 60 * mm],
    align_center_cols=(1, 2, 3, 4)))
story.append(Paragraph("¹ CMI ne rembourse pas via API (back-office manuel) : la capacité REFUND n'est pas "
                       "déclarée (honnêteté des capacités).", SMALL))

story.append(PageBreak())
story.append(Paragraph("12. Flux métier & sourceTypes", H1))
story.append(Paragraph("Chaque flux est tracé au ledger par un <b>sourceType</b> + <b>sourceId</b> (clé de "
                       "réconciliation neutre, indépendante du fournisseur).", BODY))
story.append(table([
    hcells("Flux", "sourceType", "Mode", "Réconciliation"),
    cells("Différé groupé (host/logement)", "DEFERRED_INTERVENTIONS_*", "hébergé", "consumer"),
    cells("Lien de paiement réservation", "RESERVATION", "hébergé", "consumer"),
    cells("Checkout booking engine", "RESERVATION", "hébergé", "consumer"),
    cells("Solde d'acompte", "BOOKING_BALANCE", "hébergé", "consumer"),
    cells("Checkout séjour embarqué", "BOOKING_CHECKOUT", "embarqué", "webhook (hold/acompte/caution)"),
    cells("Intervention unitaire", "INTERVENTION", "hébergé + embarqué", "webhook (par session)"),
    cells("Demande de service", "SERVICE_REQUEST", "hébergé + embarqué", "consumer"),
    cells("Upsell livret / booking", "UPSELL", "embarqué / hébergé", "consumer"),
    cells("Crédits IA", "AI_CREDIT_TOPUP", "hébergé", "consumer"),
    cells("Boutique matériel IoT", "HARDWARE_ORDER", "hébergé", "webhook (adresse livraison)"),
    cells("Inscription / upgrade", "(port abonnement)", "embarqué / hébergé", "webhook"),
], [50 * mm, 42 * mm, 30 * mm, USABLE_W - 50 * mm - 72 * mm]))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════════════
# PARTIE III
# ══════════════════════════════════════════════════════════════════════════════
story.append(part_banner("III", "Exigences PSP & démarchage"))
story.append(Spacer(1, 4 * mm))

story.append(Paragraph("13. Cahier des exigences pour un PSP", H1))
story.append(Paragraph("Trois niveaux : <font color='#C97A7A'><b>OBLIGATOIRE</b></font> (éliminatoire), "
                       "<font color='#D4A574'><b>IMPORTANTE</b></font> (fortement souhaitée), "
                       "<font color='#4A9B8E'><b>OPTIONNELLE</b></font> (différenciante, avec repli).", BODY))
story.append(Paragraph("13.1 Obligatoires (éliminatoires)", H2))
must = [
    ("E1.1", "Création de paiement par API serveur-à-serveur (montant exact, devise, notre référence, URLs de retour -> page hébergée)."),
    ("E1.2", "Référence marchande restituée telle quelle dans toutes les notifications et consultations (clé de réconciliation)."),
    ("E1.3", "Webhooks / IPN signés (signature vérifiable) avec re-livraison automatique et motifs d'échec distincts."),
    ("E1.4", "Remboursement total et partiel par API, avec référence de remboursement."),
    ("E1.5", "Idempotence : deux créations identiques ne créent pas deux paiements."),
    ("E1.6", "Environnement de test complet (sandbox iso-prod, cartes de test, webhooks réels, doc en libre accès)."),
    ("E1.7", "Sécurité : PCI-DSS, page hébergée (Baitly reste SAQ-A), 3-D Secure, TLS, clés d'API par marchand."),
    ("E1.8", "Devise locale au centime exact (MAD pour le Maroc ; cartes locales + internationales)."),
    ("E1.9", "Consultation du statut par API (filet de secours si une notification se perd)."),
]
rows = [hcells("Réf.", "Exigence")]
for r, t in must:
    rows.append([Paragraph(f"<b>{r}</b>", CELL), Paragraph(t, CELL)])
story.append(table(rows, [12 * mm, USABLE_W - 12 * mm]))

story.append(Paragraph("13.2 Importantes", H2))
should = [
    ("E2.1", "Paiement intégrable en iframe dans notre tunnel (+ signal de fin) ; à défaut, redirection pleine page."),
    ("E2.2", "Paiement récurrent / abonnement par API (nécessaire pour vendre l'abonnement Baitly en dirhams)."),
    ("E2.3", "Rapports de règlement (settlement) exportables, délais de versement documentés, frais détaillés."),
    ("E2.4", "Gestion des litiges (chargebacks) : notification + procédure de contestation, idéalement par API."),
    ("E2.5", "<b>Mandat SEPA / virement bancaire pour les payouts</b> — voir §14 (exigence dédiée)."),
]
rows = [hcells("Réf.", "Exigence")]
for r, t in should:
    rows.append([Paragraph(f"<b>{r}</b>", CELL), Paragraph(t, CELL)])
story.append(table(rows, [12 * mm, USABLE_W - 12 * mm]))

story.append(Paragraph("13.3 Optionnelles (différenciantes, avec repli)", H2))
nice = [
    ("E3.1", "Pré-autorisation + capture différée (caution)", "Stripe, ou empreinte manuelle au MA"),
    ("E3.2", "Carte enregistrée (vault, off-session)", "idem E3.1"),
    ("E3.3", "Collecte d'adresse de livraison (boutique)", "Stripe"),
    ("E3.4", "Module de paiement embarqué (clientSecret)", "redirection ou iframe (E2.1)"),
    ("E3.5", "Reversements sortants (payouts) via le PSP", "SEPA / Wise / OpenBanking / Manuel"),
    ("E3.6", "Multi-devises au-delà de la devise locale", "Stripe pour l'international"),
]
rows = [hcells("Réf.", "Fonctionnalité", "Repli si absente")]
for r, t, f in nice:
    rows.append([Paragraph(f"<b>{r}</b>", CELL), Paragraph(t, CELL), Paragraph(f, CELL)])
story.append(table(rows, [12 * mm, (USABLE_W - 12 * mm) * 0.56, (USABLE_W - 12 * mm) * 0.44]))

story.append(PageBreak())
story.append(Paragraph("14. Reversements mensuels & mandat SEPA (exigence)", H1))
story.append(Paragraph("Baitly reverse chaque mois aux propriétaires/gestionnaires leur part nette. Pour "
                       "automatiser ces virements récurrents sans re-saisie d'IBAN, le PSP (ou la banque "
                       "partenaire) doit prendre en charge les <b>mandats SEPA</b> (zone euro) et, hors zone "
                       "SEPA, le <b>virement bancaire adossé à une banque</b>.", BODY))
story.append(fig(diagram_payout_sepa(),
                 "Figure 6 — Reversement mensuel : le mandat SEPA se met en place une fois (signature + "
                 "enregistrement UMR), puis chaque mois le PayoutExecutor déclenche un virement récurrent, "
                 "tracé au ledger."))
story.append(Paragraph("<b>Exigence E2.5 — détaillée</b> :", H3))
story.append(table([
    hcells("Réf.", "Attendu du PSP / de la banque", "Zone"),
    cells("E2.5a", "Enregistrement d'un <b>mandat SEPA</b> (SEPA Direct Debit / Credit) avec référence unique de mandat (UMR) et IBAN du bénéficiaire.", "UE / SEPA"),
    cells("E2.5b", "Déclenchement de <b>virements récurrents</b> (payouts mensuels) par API, idempotents, avec référence marchande restituée.", "UE / SEPA"),
    cells("E2.5c", "Hors SEPA : <b>virement bancaire</b> adossé à une banque partenaire (ex. Maroc), export de règlement rapprochable.", "MA / hors-UE"),
    cells("E2.5d", "Notifications d'issue du payout (exécuté / rejeté / retourné) pour la réconciliation et l'alerte admin.", "toutes"),
    cells("E2.5e", "Délais de règlement documentés + gestion des retours (R-transactions SEPA).", "toutes"),
], [12 * mm, USABLE_W - 12 * mm - 24 * mm, 24 * mm], align_center_cols=(2,)))
story.append(Paragraph("Côté Baitly, ces reversements passent déjà par le port <b>PayoutExecutor</b> "
                       "(rails SEPA / OpenBanking / Wise / StripeConnect / Manuel) : un PSP qui expose SEPA "
                       "+ virement récurrent devient le rail préféré pour les payouts mensuels, sans "
                       "modification des flux métier.", BODY))

story.append(PageBreak())
story.append(Paragraph("15. Démarchage des PSP par pays d'action", H1))
story.append(Paragraph("Le démarchage se pilote par <b>pays / zone d'action</b>. Pour chaque zone : la devise, "
                       "les PSP candidats, la priorité, et le point de vigilance principal.", BODY))
story.append(table([
    hcells("Zone", "Devise", "PSP candidats (priorité)", "Payout / SEPA", "Point de vigilance"),
    cells("<b>Maroc</b> (lancement)", "MAD", "1. PayZone · 2. CMI · (repli Stripe hors MA)", "Virement bancaire local + Manuel tracé ; SEPA non applicable", "Onboarding CMI (NDA + délai) ; PayZone plus rapide ; encaissement local obligatoire"),
    cells("<b>Arabie Saoudite / Golfe</b>", "SAR (+ AED, KWD…)", "1. PayTabs · (HyperPay en veille)", "Virement bancaire local", "Devises à 3 décimales (KWD/BHD/OMR) : échelle du montant"),
    cells("<b>France / UE</b>", "EUR", "1. Stripe · (banque SEPA pour payouts)", "Mandat SEPA + virement récurrent (E2.5)", "Entité juridique d'encaissement (Stripe Atlas FR/US) pour la part EUR"),
    cells("<b>International</b> (USD…)", "USD & autres", "Stripe", "Wise / OpenBanking", "Change + conformité selon pays"),
], [26 * mm, 20 * mm, 42 * mm, 34 * mm, USABLE_W - 26 * mm - 20 * mm - 42 * mm - 34 * mm]))
story.append(Paragraph("<b>Séquencement recommandé</b> : (1) Maroc — PayZone d'abord (démarrage rapide) puis "
                       "CMI (volume/confiance bancaire) ; (2) UE — banque partenaire SEPA pour les payouts "
                       "mensuels ; (3) Golfe — PayTabs si expansion KSA ; (4) international — Stripe assure la "
                       "couverture par défaut.", BODY))
story.append(Paragraph("Pour un fournisseur <b>full-stack unique</b> (3 ports + caution) alternatif à Stripe — "
                       "notamment Checkout.com pour le contexte MENA — voir la section 16.", BODY))

# ── §16 — PSP full-stack (alternatives à Stripe) ──────────────────────────────
story.append(PageBreak())
story.append(Paragraph("16. PSP full-stack : couvrir les trois ports comme Stripe", H1))
story.append(Paragraph("Les PSP régionaux intégrés (PayZone, CMI, PayTabs) ne couvrent que l'<b>encaissement</b> "
                       "(PAY / REFUND). Aujourd'hui, seul <b>Stripe</b> couvre les trois ports + caution. Mais "
                       "Stripe n'opère pas au Maroc — d'où la question : existe-t-il un autre PSP <b>full-stack</b> "
                       "aussi complet ? La réponse est <b>oui</b> : trois candidats couvrent l'ensemble "
                       "(encaissement + abonnement + payouts + caution + carte enregistrée).", BODY))
story.append(Paragraph("16.1 Couverture par capacité (full-stack)", H2))
story.append(table([
    hcells("Capacité / port", "Stripe", "Checkout.com", "Adyen", "Rapyd"),
    [Paragraph("<b>PORT ENTRANT</b> — encaissement", CELL), yes(), yes(), yes(), yes()],
    [Paragraph("<b>PORT ABONNEMENT</b> — récurrent", CELL), yes(), yes(), yes(), yes()],
    [Paragraph("<b>PORT SORTANT</b> — payouts / reversements", CELL), yes(), yes(), yes(), yes()],
    [Paragraph("Caution / pré-autorisation", CELL), yes(), yes(), yes(), part()],
    [Paragraph("Carte enregistrée (vault / card-on-file)", CELL), yes(), yes(), yes(), yes()],
    [Paragraph("Mandat SEPA / virement récurrent (payout)", CELL), yes(), yes(), yes(), yes()],
    [Paragraph("Remboursement par API", CELL), yes(), yes(), yes(), yes()],
], [USABLE_W - 4 * (24 * mm), 24 * mm, 24 * mm, 24 * mm, 24 * mm],
    align_center_cols=(1, 2, 3, 4)))
story.append(Paragraph("<font color='#4A9B8E'><b>&bull;</b></font> = supporté &nbsp;·&nbsp; "
                       "<font color='#D4A574'><b>~</b></font> = partiel (Rapyd : hold via wallet, pas une "
                       "pré-autorisation carte au sens strict).", SMALL))

story.append(Paragraph("16.2 Contexte, éligibilité et couverture Maroc", H2))
story.append(table([
    hcells("Critère", "Stripe", "Checkout.com", "Adyen", "Rapyd"),
    cells("Force régionale", "International / UE", "<b>MENA / Golfe</b>", "Entreprise, global", "Marchés émergents, payouts"),
    cells("Couverture Maroc (MAD)", "Partenariats (limité)", "Règlement MAD, présence MENA", "Réseau ~100 pays", "Virement / redirect MA"),
    cells("Acquiring LOCAL carte MAD", "Non (partenariat)", "Cross-border / partenariat", "Cross-border", "Non (virement)"),
    cells("Éligibilité startup", "Oui", "<b>Oui</b> (onboarding souple)", "Non (&gt; 10 M$/an, minimums)", "Oui"),
], [30 * mm, 26 * mm, USABLE_W - 30 * mm - 26 * mm - 2 * (30 * mm), 30 * mm, 30 * mm]))

story.append(Paragraph("16.3 Recommandation", H2))
for t in [
    "<b>Trois PSP full-stack</b> peuvent, comme Stripe, couvrir les trois ports + caution + vault + "
    "récurrent : <b>Checkout.com</b>, <b>Adyen</b> et <b>Rapyd</b>. Chacun se branche via <b>un seul "
    "adaptateur</b> qui déclare le même jeu de capacités que Stripe (PAY, PREAUTH, CUSTOMER, PAYOUT, "
    "RECURRING, REFUND) — <b>sans modifier les flux métier</b>.",
    "<b>Candidat recommandé : Checkout.com</b> — le meilleur compromis pour Baitly : full-stack, forte "
    "présence MENA / Golfe, règlement en MAD, et onboarding accessible à une startup (contrairement à "
    "Adyen, réservé à l'échelle &gt; 10 M$/an). <b>Rapyd</b> = alternative payouts / marchés émergents ; "
    "<b>Adyen</b> = option entreprise à terme.",
    "<b>Nuance Maroc (décisive)</b> : même un PSP full-stack ne remplace pas totalement l'acquiring "
    "<b>local carte MAD</b>, dominé par <b>CMI</b> — ces acteurs couvrent le Maroc surtout en "
    "cross-border / virement / partenariat. La cible reste donc l'<b>architecture multi-fournisseur</b> : "
    "un PSP full-stack (international + abonnement + payout + caution) <b>en parallèle</b> d'un acquéreur "
    "local (CMI / PayZone) pour les cartes marocaines.",
    "<b>Conséquence stratégique</b> : Baitly <b>n'est pas verrouillé sur Stripe</b>. Le port "
    "d'encaissement, le port abonnement et le port sortant acceptent tous un adaptateur Checkout.com / "
    "Adyen / Rapyd. Le « switch » de fournisseur full-stack est un changement d'adaptateur, pas de "
    "plateforme.",
]:
    story.append(Paragraph("•&nbsp; " + t, BULLET))

# ── 16.4 — Matrice complète services x PSP ────────────────────────────────────
story.append(PageBreak())
story.append(Paragraph("16.4 Matrice complète : services Baitly &times; PSP", H2))
story.append(Paragraph("Vue d'ensemble « qui couvre quoi ». Colonnes : les 4 fournisseurs déjà intégrés "
                       "(Stripe + régionaux) et les 3 candidats full-stack. Lignes : les services dont Baitly "
                       "a besoin.", BODY))


def _mk(code):
    return {"y": yes(), "n": no(), "p": part()}[code]


def _mrow(label, codes):
    return [Paragraph(label, CELL)] + [_mk(c) for c in codes]

# codes dans l'ordre : Stripe · PayZone · CMI · PayTabs · Checkout · Adyen · Rapyd
matrix_rows = [
    ("<b>Encaissement (PAY)</b>", "yyyyyyy"),
    ("Remboursement par API", "yynyyyy"),
    ("Checkout embarqué (inline)", "ypnpyyp"),
    ("Caution / pré-autorisation", "ynnpyyp"),
    ("Carte enregistrée (vault)", "ynnnyyy"),
    ("Abonnement récurrent", "ynnpyyy"),
    ("<b>Payout / reversement</b>", "ynnnyyy"),
    ("Mandat SEPA (payout récurrent)", "ynnnyyy"),
    ("3-D Secure / PCI-DSS", "yyyyyyy"),
    ("Devise MAD (Maroc)", "nyynppp"),
    ("Devise SAR (Golfe)", "ynnyyyy"),
    ("Devise EUR / USD (international)", "ypppyyy"),
    ("<b>Acquiring LOCAL carte MAD</b>", "nyynppn"),
    ("Éligibilité startup", "yyyyyny"),
]

mheader = hcells("Service dont Baitly a besoin", "Stripe", "PayZone", "CMI", "PayTabs", "Checkout", "Adyen", "Rapyd")
mdata = [mheader] + [_mrow(lab, codes) for lab, codes in matrix_rows]
pspw = (USABLE_W - 46 * mm) / 7
story.append(table(mdata, [46 * mm] + [pspw] * 7, align_center_cols=(1, 2, 3, 4, 5, 6, 7)))
story.append(Paragraph("<font color='#4A9B8E'><b>&bull;</b></font> supporté &nbsp;·&nbsp; "
                       "<font color='#D4A574'><b>~</b></font> partiel / à confirmer &nbsp;·&nbsp; "
                       "<font color='#B9C4CA'><b>&mdash;</b></font> non. "
                       "Régional (PayZone/CMI/PayTabs) : périmètre <b>réellement intégré</b> aujourd'hui "
                       "(certains supportent plus nativement — à confirmer à l'onboarding). Full-stack "
                       "(Checkout.com / Adyen / Rapyd) : capacité <b>native</b> du PSP.", SMALL))
story.append(Paragraph("<b>Lecture</b> : Stripe et les trois full-stack couvrent l'essentiel des services ; "
                       "les PSP régionaux excellent sur l'<b>acquiring local carte MAD</b> (que ni Stripe ni "
                       "les full-stack ne couvrent). D'où la cible <b>multi-fournisseur</b> : un full-stack "
                       "(Checkout.com) pour l'abonnement + payout + caution + international, <b>en parallèle</b> "
                       "d'un acquéreur local (PayZone/CMI) pour les cartes marocaines.", BODY))

# ── 16.5 — Banques marocaines & libéralisation 2026 ───────────────────────────
story.append(PageBreak())
story.append(Paragraph("16.5 Banques marocaines : une banque marocaine couvre-t-elle tout ?", H2))
story.append(Paragraph("<b>Non — mais le marché s'ouvre vite.</b> En 2026, Bank Al-Maghrib a <b>mis fin au "
                       "monopole du CMI</b> (désormais limité au traitement technique / switch) et plafonné "
                       "l'interchange domestique à <b>0,50 %</b> (au 1er oct. 2026). Le portefeuille commerçants "
                       "du CMI a été cédé à <b>six établissements de paiement adossés aux grandes banques</b>, qui "
                       "font désormais l'acquiring carte + les passerelles e-commerce.", BODY))
story.append(table([
    hcells("Établissement de paiement", "Banque", "Ce qu'il couvre"),
    cells("<b>Attijari Payment</b>", "Attijariwafa Bank", "Acquiring + gateway e-commerce + POS (licence mars 2025, « services digitaux complets ») — le plus avancé"),
    cells("<b>M2T / Chaabi Payment</b>", "Banque Populaire (BCP)", "Acquiring + gateway + POS + services de paiement"),
    cells("<b>Lana Cash</b>", "CIH Bank", "Acquiring + gateway e-commerce + POS"),
    cells("<b>CDM Pay</b>", "Crédit du Maroc", "Acquiring + gateway e-commerce"),
    cells("<b>Al Filahi Cash</b>", "Crédit Agricole du Maroc", "Acquiring + gateway e-commerce"),
    cells("<b>Damane Cash</b>", "Bank of Africa (BMCE)", "Acquiring + gateway + POS"),
    cells("<i>CMI</i>", "<i>Consortium bancaire</i>", "<i>Traitement technique (switch) — n'est plus l'acquéreur exclusif</i>"),
], [34 * mm, 40 * mm, USABLE_W - 34 * mm - 40 * mm]))
story.append(Paragraph("<b>Ce qu'ils couvrent</b> : encaissement carte (acquiring), passerelle e-commerce, "
                       "POS, règlement au compte (D+1 à D+3), 3-D Secure / PCI-DSS, tokenisation -> "
                       "<b>récurrent émergent</b>.", BODY))
story.append(Paragraph("<b>Ce qui manque encore</b> (à ce jour, non documenté chez ces acteurs) : "
                       "<b>payout-as-a-service</b> (verser des tiers par API), <b>pré-autorisation / caution</b>, "
                       "et un <b>moteur d'abonnement</b> complet. Ces briques restent couvertes par un PSP "
                       "full-stack (Checkout.com) ou séparément (virement bancaire pour les payouts, caution "
                       "manuelle au lancement — décision D3).", BODY))
story.append(Paragraph("<b>Conséquence pour Baitly</b> : aucune banque marocaine n'offre aujourd'hui le "
                       "<b>full-stack</b> (les 3 ports + caution) en une seule API. Mais la libéralisation est "
                       "une <b>bonne nouvelle</b> : plus d'acquéreurs locaux, interchange plus bas, relation "
                       "bancaire directe. Elle <b>renforce l'architecture multi-fournisseur</b> — on peut ajouter "
                       "un adaptateur « acquéreur bancaire marocain » (ex. <b>Attijari Payment</b>, à suivre) "
                       "pour l'encaissement carte MAD, tout en gardant un full-stack (Checkout.com) pour "
                       "l'abonnement + payout + caution.", BODY))

# ── 16.6 — Zoom : composer la stack marocaine ─────────────────────────────────
story.append(PageBreak())
story.append(Paragraph("16.6 Zoom technique : composer la stack marocaine (Attijari Payment, CMI, Chari Pay)", H2))
story.append(Paragraph("Aucun acteur marocain ne fait tout, mais <b>les briques existent localement</b> et "
                       "s'améliorent vite. Les ports de Baitly permettent de les <b>composer</b>.", BODY))
story.append(table([
    hcells("Acteur", "Rôle dans la stack", "Capacités confirmées", "Effort d'intégration"),
    cells("<b>Attijari Payment</b> (Attijariwafa)", "PORT ENTRANT (acquiring MAD)", "Chaîne complète émission->acquisition ; plugins + API simples ; 3DS ; reporting temps réel", "<b>Faible</b> : protocole type CMI (SHA-512 + Client ID/Store Key + callback) -> réutilise notre adaptateur CMI"),
    cells("<b>CMI</b> (a absorbé Maroc Telecommerce)", "PORT ENTRANT + tokenisation", "Acquiring MAD ; <b>tokenisation</b> (card-on-file) ; <b>récurrent + paiement en N fois</b> ; mPOS ; PayPal/UnionPay", "Faible : adaptateur CMI déjà en place (à étendre : tokenisation/récurrent)"),
    cells("<b>PayZone</b>", "PORT ENTRANT + tokenisation", "Acquiring MAD ; tokenisation ; abonnement <b>partiel</b> ; liens de paiement", "Faible : adaptateur PayZone déjà en place"),
    cells("<b>Chari Pay</b> (ChariBaaS)", "PORT ABONNEMENT (récurrent)", "<b>API d'abonnement moderne</b> : REST + webhooks, retry auto, <b>dunning</b> (email/SMS), account updater, tokenisation PCI-DSS L1", "Moyen : nouvel adaptateur SubscriptionProvider"),
    cells("<b>NAPS</b>", "PORT ENTRANT (alternatif)", "Paiement en ligne « sans friction »", "Faible (à évaluer)"),
    cells("Virement bancaire / <b>Manuel</b>", "PORT SORTANT (payouts)", "Reversement mensuel proprio par virement (déjà : ManualPayoutExecutor)", "Nul (rail existant)"),
], [40 * mm, 34 * mm, USABLE_W - 40 * mm - 34 * mm - 42 * mm, 42 * mm]))
story.append(Paragraph("<b>Deux enseignements clés</b> :", H3))
for t in [
    "<b>Intégration à faible coût</b> — Attijari Payment (et les autres établissements bancaires) "
    "utilisent le <b>même protocole que le CMI</b> (hash SHA-512, Client ID / Store Key, callback "
    "serveur-à-serveur). Notre adaptateur <code>CmiPaymentProvider</code> existant sert de base : "
    "brancher un acquéreur bancaire marocain de plus = un adaptateur quasi-identique.",
    "<b>Le récurrent local existe</b> — CMI fait déjà tokenisation + paiement en N fois, et "
    "<b>Chari Pay</b> offre une vraie API d'abonnement (retry, dunning). Pour l'abonnement SaaS "
    "marocain, on n'est donc pas obligé de passer par l'international : Chari Pay (ou une passerelle "
    "tokenisante) branché sur le <b>port abonnement</b> est une option locale crédible.",
]:
    story.append(Paragraph("•&nbsp; " + t, BULLET))
story.append(Paragraph("<b>Stack Maroc cible (composée via les ports)</b> : encaissement carte MAD = CMI / "
                       "PayZone / Attijari Payment · abonnement = Chari Pay <i>ou</i> Stripe Billing · payout = "
                       "virement (Manual) · caution = Stripe ou empreinte manuelle (D3). Aucune dépendance à un "
                       "fournisseur unique — c'est précisément ce que l'orchestration « switch &amp; parallèle » "
                       "rend possible.", BODY))

story.append(PageBreak())
story.append(Paragraph("17. Plan de certification sandbox par PSP", H1))
story.append(Paragraph("Le code des adaptateurs est prêt et audité ; il reste la <b>certification en sandbox "
                       "réel</b>, dépendante de l'onboarding marchand. Plan par PSP :", BODY))
story.append(table([
    hcells("PSP", "Pré-requis", "Identifiants", "Webhook", "Effort*", "Point-clé à confirmer"),
    cells("<b>PayZone</b> (MA)", "Compte sandbox (rapide)", "api_key + webhook_secret", "HMAC-SHA256, en-tête X-Payzone-Signature", "~1 sem.", "Noms de champs + valeurs de statut ; format du montant"),
    cells("<b>CMI</b> (MA)", "Onboarding (NDA + délai)", "client_id + store_key", "HASH SHA-512 dans le body", "~2-3 sem.", "Ordre des champs du hash ; ProcReturnCode ; refund manuel assumé"),
    cells("<b>PayTabs</b> (KSA)", "Compte sandbox", "profile_id + server_key", "HMAC-SHA256, en-tête signature", "~1 sem.", "response_status ; cart_amount (échelle 3 décimales Golfe)"),
], [22 * mm, 26 * mm, 30 * mm, 34 * mm, 14 * mm, USABLE_W - 22 * mm - 26 * mm - 30 * mm - 34 * mm - 14 * mm],
    align_center_cols=(4,)))
story.append(Paragraph("* effort côté Baitly une fois les accès obtenus (hors délai d'onboarding externe).", SMALL))
story.append(Paragraph("<b>Scénarios de certification</b> (à passer pour chaque PSP) :", H3))
story.append(table([
    hcells("#", "Scénario", "Attendu"),
    cells("C1", "Paiement accepté", "webhook signé -> COMPLETED, entité PAYÉE"),
    cells("C2", "Paiement refusé (carte de refus)", "webhook signé -> FAILED, message exploitable"),
    cells("C3", "Montant exact au centime", "débité = montant du ledger (attention devises 3 déc.)"),
    cells("C4", "Devise correcte", "pas de conversion silencieuse"),
    cells("C5 / C6", "Signature valide / invalide", "traité / rejeté 401 sans modif"),
    cells("C7", "Référence marchande restituée", "lookup transaction OK"),
    cells("C8", "Idempotence / re-livraison", "pas de double-crédit (CAS)"),
    cells("C9", "Remboursement API", "PayZone/PayTabs OK ; CMI = échec attendu (manuel)"),
    cells("C10", "Payout / mandat SEPA (si applicable)", "virement récurrent + notification d'issue (E2.5)"),
], [12 * mm, 62 * mm, USABLE_W - 12 * mm - 62 * mm], align_center_cols=(0,)))

story.append(PageBreak())
story.append(Paragraph("18. Grille d'évaluation PSP (à remplir en rendez-vous)", H1))
story.append(Paragraph("PSP : _______________________   Pays : ___________   Date : __________   "
                       "Interlocuteur : ______________________", BODY))
allreq = ([(r, "OBLIGATOIRE") for r, _ in must] +
          [("E2.1", "IMPORTANTE"), ("E2.2", "IMPORTANTE"), ("E2.3", "IMPORTANTE"),
           ("E2.4", "IMPORTANTE"), ("E2.5 (SEPA/payout)", "IMPORTANTE")] +
          [(r, "OPTIONNELLE") for r, _, _ in nice])
labels = {r: t for r, t in must}
labels.update({"E2.1": "Iframe intégrable", "E2.2": "Récurrent / abonnement",
               "E2.3": "Rapports de règlement", "E2.4": "Litiges (chargebacks)",
               "E2.5 (SEPA/payout)": "Mandat SEPA / virement payout"})
labels.update({r: t for r, t, _ in nice})
grid = [hcells("Réf.", "Exigence", "Criticité", "Oui", "Part.", "Non", "Commentaire")]
for r, crit in allreq:
    grid.append([Paragraph(f"<b>{r}</b>", CELL), Paragraph(labels.get(r, ""), CELL), crit_cell(crit),
                 Paragraph("", CELL), Paragraph("", CELL), Paragraph("", CELL), Paragraph("", CELL)])
story.append(table(grid, [20 * mm, 46 * mm, 22 * mm, 9 * mm, 11 * mm, 9 * mm,
                          USABLE_W - 20 * mm - 46 * mm - 22 * mm - 29 * mm],
                   align_center_cols=(2, 3, 4, 5)))
story.append(Paragraph("Toute E1.x à « Non » est éliminatoire en l'état -> demander la feuille de route. "
                       "Les E2.x/E3.x à « Non » n'excluent pas : le repli documenté s'applique et la "
                       "capacité pourra être activée sans re-développement.", BODY))

story.append(Paragraph("19. Processus d'intégration", H1))
story.append(table([
    hcells("Phase", "Contenu", "Charge"),
    cells("1. Cadrage", "Grille remplie, accès sandbox + doc, compte marchand de test", "~1 sem. (dépend du PSP)"),
    cells("2. Adaptateur", "Module fournisseur (create/refund/signature/capabilities)", "3–5 j"),
    cells("3. Webhook", "Endpoint dédié + vérif signature + tests de re-livraison", "1–2 j"),
    cells("4. Certification", "Scénarios C1–C10 en sandbox (§17)", "2–3 j"),
    cells("5. Pilote prod", "Org pilote, montants réels faibles, supervision", "~2 sem."),
    cells("6. Généralisation", "Activation par organisation", "—"),
], [26 * mm, USABLE_W - 26 * mm - 34 * mm, 34 * mm]))
story.append(Paragraph("Seule l'étape 2 touche notre code, bornée à l'adaptateur : ni les flux métier, ni la "
                       "comptabilité, ni la réconciliation ne changent.", BODY))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════════════
# PARTIE IV
# ══════════════════════════════════════════════════════════════════════════════
story.append(part_banner("IV", "Annexes"))
story.append(Spacer(1, 4 * mm))
story.append(Paragraph("20. UML des composants (ports & adaptateurs)", H1))
story.append(fig(diagram_uml(),
                 "Figure 7 — Vue UML : trois interfaces (ports) et leurs implémentations (adaptateurs). "
                 "Des registries résolvent l'implémentation par capacité + devise + pays. * = à venir."))

story.append(Paragraph("21. Glossaire", H1))
story.append(table([
    hcells("Terme", "Définition"),
    cells("PSP", "Prestataire de services de paiement (Stripe, CMI, PayZone, PayTabs…)."),
    cells("Port / adaptateur", "Le « port » est la prise standard côté Baitly ; l'« adaptateur » branche un PSP sur cette prise."),
    cells("Orchestrateur", "Choisit le fournisseur, trace la transaction, séquence les étapes en toute sécurité."),
    cells("Capacité", "Fonctionnalité déclarée par un adaptateur ; le resolver écarte les fournisseurs incapables."),
    cells("Ledger", "Registre interne : une ligne par tentative, avec notre référence, celle du PSP, montant, objet payé."),
    cells("sourceType / sourceId", "Le « pour quoi » du paiement — clé de réconciliation neutre."),
    cells("Webhook / IPN", "Notification serveur-à-serveur signée signalant l'issue d'un paiement."),
    cells("Idempotence", "Une même opération répétée (retry, double-clic, re-livraison) ne produit qu'un seul effet."),
    cells("CAS", "Compare-and-set : transition de statut par UPDATE conditionnel (anti double-crédit)."),
    cells("Mandat SEPA", "Autorisation récurrente de virement/prélèvement (UMR + IBAN) pour automatiser les payouts."),
    cells("Settlement", "Règlement : versement par le PSP des fonds encaissés, net de frais."),
    cells("Chargeback", "Litige : contestation d'un paiement par le porteur de carte."),
    cells("SAQ-A", "Périmètre PCI-DSS allégé : aucune donnée carte ne touche nos serveurs (saisie chez le PSP)."),
    cells("D1 / D3", "Décisions ADR : D1 = port abonnement dédié ; D3 = caution Stripe-only (empreinte manuelle au MA)."),
], [34 * mm, USABLE_W - 34 * mm]))
story.append(Spacer(1, 5 * mm))
story.append(Paragraph("Document généré depuis les sources internes Baitly (ADR paiement multi-provider, "
                       "documentation système, runbook de certification, code en vigueur au 2026-07-14). "
                       "Fusionne et remplace les PDF « ADR switch & parallèle » et « système de paiement "
                       "multi-fournisseurs ». Générateur : docs/generate_paiement_multiprovider_pdf.py.", SMALL))

make_doc(OUT, title="Baitly - Paiement multi-fournisseurs (switch & parallele)",
         footer_label="Baitly \u00b7 Paiement multi-fournisseurs (switch & parall\u00e8le) \u00b7 2026-07-14 \u00b7 Confidentiel").build(story)
print("OK ->", OUT)
