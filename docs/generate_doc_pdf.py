#!/usr/bin/env python3
"""
Generates the Clenzy Technical Documentation PDF.
Covers: internal accounting workflows, external integrations (Pennylane, Airbnb, Stripe, etc.),
architecture patterns, and data lifecycle.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, ListFlowable, ListItem, HRFlowable
)
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate, Frame
from reportlab.lib.fonts import addMapping

# ── Colors ──────────────────────────────────────────────────────────────────
PRIMARY = HexColor('#1A1A2E')
ACCENT = HexColor('#4A9B8E')
ACCENT_LIGHT = HexColor('#E8F5F1')
SECTION_BG = HexColor('#F5F7FA')
DARK_TEXT = HexColor('#1A1A2E')
MID_TEXT = HexColor('#4A5568')
LIGHT_TEXT = HexColor('#718096')
BORDER = HexColor('#E2E8F0')
STATUS_DRAFT = HexColor('#D4A574')
STATUS_ACTIVE = HexColor('#4A9B8E')
STATUS_WARN = HexColor('#E67E22')
STATUS_ERROR = HexColor('#E74C3C')
TABLE_HEADER_BG = HexColor('#2D3748')
TABLE_ALT_ROW = HexColor('#F7FAFC')


# ── Styles ──────────────────────────────────────────────────────────────────
def build_styles():
    s = getSampleStyleSheet()

    cover_title = ParagraphStyle(
        'CoverTitle', parent=s['Title'],
        fontSize=32, leading=38, textColor=white,
        alignment=TA_LEFT, fontName='Helvetica-Bold',
        spaceAfter=8,
    )
    cover_subtitle = ParagraphStyle(
        'CoverSubtitle', parent=s['Normal'],
        fontSize=16, leading=22, textColor=HexColor('#B0BEC5'),
        alignment=TA_LEFT, fontName='Helvetica',
        spaceAfter=4,
    )
    cover_meta = ParagraphStyle(
        'CoverMeta', parent=s['Normal'],
        fontSize=11, leading=15, textColor=HexColor('#90A4AE'),
        alignment=TA_LEFT, fontName='Helvetica',
    )
    h1 = ParagraphStyle(
        'H1', parent=s['Heading1'],
        fontSize=22, leading=28, textColor=PRIMARY,
        fontName='Helvetica-Bold', spaceBefore=28, spaceAfter=12,
        borderPadding=(0, 0, 4, 0),
    )
    h2 = ParagraphStyle(
        'H2', parent=s['Heading2'],
        fontSize=16, leading=22, textColor=ACCENT,
        fontName='Helvetica-Bold', spaceBefore=20, spaceAfter=8,
    )
    h3 = ParagraphStyle(
        'H3', parent=s['Heading3'],
        fontSize=13, leading=18, textColor=DARK_TEXT,
        fontName='Helvetica-Bold', spaceBefore=14, spaceAfter=6,
    )
    body = ParagraphStyle(
        'Body', parent=s['Normal'],
        fontSize=10, leading=15, textColor=MID_TEXT,
        fontName='Helvetica', alignment=TA_JUSTIFY,
        spaceBefore=2, spaceAfter=6,
    )
    code = ParagraphStyle(
        'Code', parent=s['Normal'],
        fontSize=8.5, leading=12, textColor=HexColor('#2D3748'),
        fontName='Courier', backColor=HexColor('#F1F5F9'),
        borderPadding=6, spaceBefore=4, spaceAfter=6,
        leftIndent=8,
    )
    bullet = ParagraphStyle(
        'Bullet', parent=body,
        leftIndent=18, bulletIndent=6,
        spaceBefore=1, spaceAfter=2,
    )
    caption = ParagraphStyle(
        'Caption', parent=s['Normal'],
        fontSize=8.5, leading=12, textColor=LIGHT_TEXT,
        fontName='Helvetica-Oblique', alignment=TA_CENTER,
        spaceBefore=4, spaceAfter=10,
    )
    toc_item = ParagraphStyle(
        'TOCItem', parent=s['Normal'],
        fontSize=11, leading=18, textColor=DARK_TEXT,
        fontName='Helvetica', leftIndent=0,
    )
    toc_sub = ParagraphStyle(
        'TOCSub', parent=toc_item,
        fontSize=10, leading=16, textColor=MID_TEXT,
        leftIndent=16,
    )
    callout = ParagraphStyle(
        'Callout', parent=body,
        fontSize=10, leading=15, textColor=HexColor('#2C5F2D'),
        backColor=HexColor('#E8F5E9'),
        borderPadding=10, spaceBefore=8, spaceAfter=8,
        leftIndent=4,
    )
    return {
        'cover_title': cover_title, 'cover_subtitle': cover_subtitle,
        'cover_meta': cover_meta,
        'h1': h1, 'h2': h2, 'h3': h3,
        'body': body, 'code': code, 'bullet': bullet,
        'caption': caption, 'toc_item': toc_item, 'toc_sub': toc_sub,
        'callout': callout,
    }


# ── Helpers ─────────────────────────────────────────────────────────────────
def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=8, spaceBefore=8)

def spacer(h=6):
    return Spacer(1, h)

def bullet_list(items, st):
    flowables = []
    for item in items:
        flowables.append(Paragraph(f"<bullet>&bull;</bullet> {item}", st['bullet']))
    return flowables

def make_table(headers, rows, col_widths=None):
    data = [headers] + rows
    if col_widths is None:
        col_widths = [None] * len(headers)

    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('TEXTCOLOR', (0, 1), (-1, -1), MID_TEXT),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, TABLE_ALT_ROW]),
    ])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(style)
    return t

def status_flow(steps, st):
    """Creates a visual status flow: STEP1 -> STEP2 -> STEP3"""
    arrow = ' <font color="#4A9B8E">&rarr;</font> '
    text = arrow.join([f'<b>{s}</b>' for s in steps])
    return Paragraph(text, st['body'])

def info_box(text, st):
    return Paragraph(f"<b>Info :</b> {text}", st['callout'])


# ── Page Templates ──────────────────────────────────────────────────────────
def cover_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Background
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    # Accent bar
    canvas.setFillColor(ACCENT)
    canvas.rect(0, h - 8*mm, w, 8*mm, fill=1, stroke=0)
    # Bottom bar
    canvas.rect(0, 0, w, 4*mm, fill=1, stroke=0)
    # Side accent
    canvas.setFillColor(ACCENT)
    canvas.rect(0, 0, 6*mm, h, fill=1, stroke=0)
    canvas.restoreState()

def normal_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Header line
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(1.5)
    canvas.line(20*mm, h - 15*mm, w - 20*mm, h - 15*mm)
    # Header text
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(LIGHT_TEXT)
    canvas.drawString(20*mm, h - 13*mm, "Clenzy — Documentation Technique Comptabilite & Integrations")
    canvas.drawRightString(w - 20*mm, h - 13*mm, f"Page {doc.page}")
    # Footer line
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, 12*mm, w - 20*mm, 12*mm)
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(LIGHT_TEXT)
    canvas.drawString(20*mm, 7*mm, "Confidentiel — Sinatech / Clenzy")
    canvas.drawRightString(w - 20*mm, 7*mm, "Mars 2026")
    canvas.restoreState()


# ── Content Builder ─────────────────────────────────────────────────────────
def build_content(st):
    story = []
    w = A4[0] - 50*mm  # usable width

    # ═══════════════════════════════════════════════════════════════════════
    # COVER PAGE
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 120*mm))
    story.append(Paragraph("Clenzy", st['cover_title']))
    story.append(Paragraph("Documentation Technique", st['cover_title']))
    story.append(spacer(8))
    story.append(Paragraph("Comptabilite, Workflows Financiers<br/>& Integrations Externes", st['cover_subtitle']))
    story.append(spacer(20))
    story.append(Paragraph("Version 1.0 — Mars 2026", st['cover_meta']))
    story.append(Paragraph("Sinatech", st['cover_meta']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # TABLE OF CONTENTS
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("Table des matieres", st['h1']))
    story.append(hr())

    toc_entries = [
        ("1.", "Architecture generale", False),
        ("2.", "Cycle de vie des reservations", False),
        ("3.", "Cycle de vie des factures", False),
        ("  3.1", "Generation automatique (Stripe)", True),
        ("  3.2", "Generation manuelle", True),
        ("  3.3", "FEC — Fichier des Ecritures Comptables", True),
        ("4.", "Depenses prestataires", False),
        ("  4.1", "Cycle de vie", True),
        ("  4.2", "Upload de justificatifs", True),
        ("5.", "Reversements proprietaires (Payouts)", False),
        ("  5.1", "Generation d'un payout", True),
        ("  5.2", "Calcul du montant net", True),
        ("6.", "Commissions canaux (Airbnb, Booking...)", False),
        ("7.", "Exports comptables", False),
        ("8.", "Fiscalite et TVA", False),
        ("9.", "Integration Pennylane", False),
        ("  9.1", "OAuth 2.0 — Flux de connexion", True),
        ("  9.2", "Synchronisation des factures", True),
        ("  9.3", "Synchronisation des depenses", True),
        ("  9.4", "API Entreprise v2", True),
        ("10.", "Integration Airbnb", False),
        ("11.", "Integration Minut", False),
        ("12.", "Integration Stripe", False),
        ("13.", "Integration iCal", False),
        ("14.", "Integration PriceLabs", False),
        ("15.", "Infrastructure transverse", False),
        ("  15.1", "Multi-tenancy", True),
        ("  15.2", "Kafka & Outbox Pattern", True),
        ("  15.3", "Chiffrement des tokens", True),
        ("  15.4", "Stockage fichiers", True),
        ("  15.5", "Keycloak (Authentification)", True),
        ("16.", "Patterns architecturaux", False),
    ]
    for num, title, is_sub in toc_entries:
        sty = st['toc_sub'] if is_sub else st['toc_item']
        story.append(Paragraph(f"<b>{num}</b>  {title}", sty))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 1. ARCHITECTURE GENERALE
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("1. Architecture generale", st['h1']))
    story.append(hr())
    story.append(Paragraph(
        "Clenzy est une plateforme SaaS de gestion locative courte duree. "
        "Elle orchestre les reservations, la facturation, les interventions prestataires, "
        "les reversements proprietaires et les integrations avec des services externes "
        "(Airbnb, Stripe, Pennylane, Minut, PriceLabs, iCal).",
        st['body']
    ))
    story.append(spacer(4))

    story.append(Paragraph("Stack technique", st['h3']))
    story.append(make_table(
        ['Couche', 'Technologie', 'Details'],
        [
            ['Backend', 'Java 21, Spring Boot 3.2', 'API REST, JPA/Hibernate, Flyway/Liquibase'],
            ['Frontend', 'React 18, TypeScript, MUI', 'SPA, React Query, i18n (fr/en/ar)'],
            ['Base de donnees', 'PostgreSQL 15', 'Multi-tenant via organization_id'],
            ['Cache / State', 'Redis', 'OAuth state CSRF, sessions, cache'],
            ['Messaging', 'Apache Kafka', 'Outbox pattern, webhooks async'],
            ['Auth', 'Keycloak', 'OAuth 2.0, RBAC, JWT'],
            ['Paiements', 'Stripe', 'Checkout Sessions, Webhooks'],
            ['Stockage', 'Filesystem local', 'Documents PDF, justificatifs, templates'],
        ],
        col_widths=[30*mm, 45*mm, w - 75*mm]
    ))
    story.append(spacer(6))

    story.append(Paragraph("Schema des flux principaux", st['h3']))
    story.append(Paragraph(
        "Le diagramme ci-dessous illustre les flux de donnees entre les composants principaux :",
        st['body']
    ))
    story.append(Paragraph(
        "Reservation &rarr; Facture &rarr; Paiement (Stripe) &rarr; Payout proprietaire<br/>"
        "Reservation &rarr; Intervention &rarr; Depense prestataire &rarr; Payout proprietaire<br/>"
        "Facture / Depense &rarr; Sync Pennylane &rarr; Comptabilite externe<br/>"
        "Export FEC / CSV &rarr; Telechargement par le gestionnaire",
        st['code']
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 2. CYCLE DE VIE DES RESERVATIONS
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("2. Cycle de vie des reservations", st['h1']))
    story.append(hr())

    story.append(Paragraph(
        "Une reservation represente un sejour d'un voyageur dans un logement. "
        "Elle peut etre creee manuellement, importee via un flux iCal, ou synchronisee depuis Airbnb/Booking.com.",
        st['body']
    ))
    story.append(spacer(4))

    story.append(Paragraph("Sources de creation", st['h3']))
    story += bullet_list([
        "<b>Manuelle</b> — via l'interface Clenzy (formulaire gestionnaire)",
        "<b>iCal</b> — import automatique depuis un flux .ics (Airbnb, Booking, VRBO...)",
        "<b>Airbnb API</b> — synchronisation OAuth en temps reel via webhooks Kafka",
        "<b>Booking.com / Expedia</b> — webhooks Kafka dedies",
    ], st)

    story.append(spacer(4))
    story.append(Paragraph("Donnees cles d'une reservation", st['h3']))
    story.append(make_table(
        ['Champ', 'Type', 'Description'],
        [
            ['property', 'FK Property', 'Logement concerne'],
            ['guestName', 'String', 'Nom du voyageur'],
            ['checkIn / checkOut', 'LocalDate', 'Dates du sejour'],
            ['totalPrice', 'BigDecimal', 'Prix total brut (TTC)'],
            ['source', 'String', 'Canal : airbnb, booking, ical, manual'],
            ['externalUid', 'String', 'Identifiant unique du canal (deduplication)'],
            ['paymentStatus', 'Enum', 'PENDING, COMPLETED, FAILED'],
            ['status', 'String', 'confirmed ou cancelled'],
            ['roomRevenue / cleaningFee', 'BigDecimal', 'Ventilation fiscale'],
            ['taxAmount / touristTaxAmount', 'BigDecimal', 'Montants de TVA et taxe de sejour'],
        ],
        col_widths=[35*mm, 25*mm, w - 60*mm]
    ))

    story.append(spacer(4))
    story.append(Paragraph("Transitions de statut", st['h3']))
    story.append(status_flow(['confirmed', 'cancelled'], st))
    story.append(Paragraph(
        "L'annulation libere les jours dans le CalendarEngine et declenche la suppression "
        "des interventions de menage associees.",
        st['body']
    ))

    story.append(spacer(4))
    story.append(Paragraph("Auto-generation de menage", st['h3']))
    story.append(Paragraph(
        "A la creation d'une reservation, si le logement a l'auto-creation activee, "
        "une ServiceRequest de type CLEANING est automatiquement creee pour le jour du checkout, "
        "avec la duree estimee et le cout configure.",
        st['body']
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 3. CYCLE DE VIE DES FACTURES
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("3. Cycle de vie des factures", st['h1']))
    story.append(hr())

    story.append(Paragraph(
        "Les factures constituent la piece maitresse du systeme comptable. "
        "Elles sont generees a partir des reservations ou des interventions, "
        "et suivent un cycle de vie strict garantissant la conformite fiscale francaise.",
        st['body']
    ))

    story.append(spacer(4))
    story.append(Paragraph("Transitions de statut", st['h3']))
    story.append(status_flow(['DRAFT', 'SENT', 'ISSUED', 'PAID'], st))
    story.append(spacer(2))
    story.append(Paragraph(
        "Transitions alternatives : ISSUED/SENT &rarr; OVERDUE (echeance depassee), "
        "ISSUED &rarr; CREDIT_NOTE (avoir correctif). "
        "Une facture ISSUED est <b>immutable</b> — les corrections se font via CREDIT_NOTE.",
        st['body']
    ))

    story.append(spacer(4))
    story.append(Paragraph("Donnees d'une facture", st['h3']))
    story.append(make_table(
        ['Champ', 'Description'],
        [
            ['invoiceNumber', 'Numero sequentiel legal (attribue a l\'emission)'],
            ['invoiceDate / dueDate', 'Date de facture et echeance de paiement'],
            ['totalHt / totalTax / totalTtc', 'Decomposition HT / TVA / TTC'],
            ['sellerName / sellerTaxId', 'Identite du vendeur (depuis FiscalProfile)'],
            ['buyerName / buyerTaxId', 'Identite de l\'acheteur (voyageur/client)'],
            ['lines[]', 'Lignes de facture avec quantite, prix, taux TVA'],
            ['reservationId / interventionId', 'Reference a l\'entite source'],
            ['pennylaneInvoiceId', 'ID Pennylane (apres synchronisation)'],
            ['paymentMethod / paidAt', 'Mode et date de paiement'],
        ],
        col_widths=[40*mm, w - 40*mm]
    ))

    story.append(spacer(8))
    story.append(Paragraph("3.1 Generation automatique (Stripe)", st['h2']))
    story.append(Paragraph(
        "Lorsqu'un paiement Stripe est recu (webhook checkout.session.completed), "
        "le service AutoInvoiceService genere automatiquement une facture :",
        st['body']
    ))
    story += bullet_list([
        "Verification d'idempotence (facture existante pour cette reservation ?)",
        "Creation d'une facture DRAFT avec lignes fiscales via FiscalEngine",
        "Passage immediat en statut PAID (paiement deja recu)",
        "Attribution du numero sequentiel via InvoiceNumberingService",
        "Enregistrement du mode de paiement (STRIPE) et de la date",
    ], st)

    story.append(spacer(8))
    story.append(Paragraph("3.2 Generation manuelle", st['h2']))
    story.append(Paragraph(
        "Le gestionnaire peut generer une facture manuellement via l'interface :",
        st['body']
    ))
    story += bullet_list([
        "<b>DRAFT</b> : facture creee, modifiable, pas de numero legal",
        "<b>Emission</b> (POST /api/invoices/{id}/issue) : attribution du numero, statut ISSUED, facture immutable",
        "<b>Envoi</b> (POST /api/invoices/{id}/send) : envoi par email, statut SENT",
        "<b>Paiement</b> : creation de session Stripe via PaymentOrchestrationService",
        "<b>Annulation</b> : creation d'un CREDIT_NOTE (avoir), pas de suppression de l'originale",
    ], st)

    story.append(spacer(8))
    story.append(Paragraph("3.3 FEC — Fichier des Ecritures Comptables", st['h2']))
    story.append(Paragraph(
        "L'export FEC est conforme a la norme DGFiP (France). Il est genere a partir des entites Invoice "
        "(et non des reservations) pour garantir la tracabilite avec les numeros de facture officiels.",
        st['body']
    ))
    story.append(Paragraph("Ecritures comptables generees par facture :", st['h3']))
    story.append(make_table(
        ['Compte', 'Libelle', 'Debit', 'Credit'],
        [
            ['411000', 'Clients', 'Montant TTC', '—'],
            ['706000', 'Prestations de services', '—', 'Montant HT'],
            ['44571', 'TVA collectee', '—', 'Montant TVA'],
        ],
        col_widths=[22*mm, 40*mm, 30*mm, 30*mm]
    ))
    story.append(Paragraph(
        "La ligne TVA (44571) n'est generee que si le montant TVA est superieur a zero.",
        st['caption']
    ))
    story.append(Paragraph(
        "Statuts inclus dans le FEC : ISSUED, PAID, OVERDUE, SENT. "
        "Les factures DRAFT et CANCELLED sont exclues.",
        st['body']
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 4. DEPENSES PRESTATAIRES
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("4. Depenses prestataires", st['h1']))
    story.append(hr())

    story.append(Paragraph(
        "Les depenses prestataires representent les couts lies aux interventions "
        "(menage, maintenance, blanchisserie...) sur les logements. "
        "Elles impactent directement le calcul du reversement proprietaire.",
        st['body']
    ))

    story.append(spacer(4))
    story.append(Paragraph("4.1 Cycle de vie", st['h2']))
    story.append(status_flow(['DRAFT', 'APPROVED', 'INCLUDED', 'PAID'], st))
    story.append(spacer(2))
    story.append(Paragraph("Alternative : DRAFT &rarr; CANCELLED (rejet avant approbation)", st['body']))

    story.append(spacer(4))
    story.append(make_table(
        ['Statut', 'Description', 'Actions possibles'],
        [
            ['DRAFT', 'Creee, en attente de validation', 'Modifier, Approuver, Annuler'],
            ['APPROVED', 'Validee par le gestionnaire', 'Inclure dans un payout, Payer, Annuler'],
            ['INCLUDED', 'Incluse dans un reversement proprietaire', 'Marquer comme payee'],
            ['PAID', 'Paiement effectue, ref. enregistree', 'Aucune (statut final)'],
            ['CANCELLED', 'Rejetee / annulee', 'Aucune (statut final)'],
        ],
        col_widths=[22*mm, 45*mm, w - 67*mm]
    ))

    story.append(spacer(4))
    story.append(Paragraph("Calcul automatique TVA", st['h3']))
    story.append(Paragraph(
        "A la creation/modification, le systeme calcule automatiquement :<br/>"
        "<font face='Courier' size='9'>"
        "taxAmount = amountHt x taxRate  (arrondi HALF_UP, scale 2)<br/>"
        "amountTtc = amountHt + taxAmount"
        "</font>",
        st['body']
    ))

    story.append(spacer(4))
    story.append(Paragraph("Categories de depenses", st['h3']))
    story.append(make_table(
        ['Code', 'Description'],
        [
            ['CLEANING', 'Menage / nettoyage'],
            ['MAINTENANCE', 'Reparation / entretien'],
            ['LAUNDRY', 'Blanchisserie / linge'],
            ['SUPPLIES', 'Fournitures / consommables'],
            ['LANDSCAPING', 'Espaces verts / exterieur'],
            ['OTHER', 'Autre'],
        ],
        col_widths=[30*mm, w - 30*mm]
    ))

    story.append(spacer(8))
    story.append(Paragraph("4.2 Upload de justificatifs", st['h2']))
    story.append(Paragraph(
        "Chaque depense peut recevoir un justificatif (facture fournisseur, recu). "
        "Le fichier est stocke via ReceiptStorageService qui etend AbstractFileStorageService.",
        st['body']
    ))
    story += bullet_list([
        "<b>Formats acceptes</b> : PDF, JPEG, PNG, WebP",
        "<b>Taille max</b> : 10 MB",
        "<b>Structure de stockage</b> : receipts/{orgId}/{YYYY-MM}/{uuid}_{filename}",
        "<b>Securite</b> : validation anti-path-traversal, nom de fichier UUID",
        "<b>Endpoints</b> : POST /{id}/receipt (upload), GET /{id}/receipt (download), DELETE /{id}/receipt",
    ], st)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 5. REVERSEMENTS PROPRIETAIRES
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("5. Reversements proprietaires (Payouts)", st['h1']))
    story.append(hr())

    story.append(Paragraph(
        "Le reversement (payout) est le montant verse au proprietaire d'un logement "
        "pour une periode donnee, apres deduction de la commission de gestion et des depenses.",
        st['body']
    ))

    story.append(spacer(4))
    story.append(Paragraph("Transitions de statut", st['h3']))
    story.append(status_flow(['PENDING', 'APPROVED', 'PAID'], st))
    story.append(Paragraph("Alternative : APPROVED &rarr; CANCELLED", st['body']))

    story.append(spacer(8))
    story.append(Paragraph("5.1 Generation d'un payout", st['h2']))
    story.append(Paragraph(
        "Le gestionnaire declenche la generation via POST /api/accounting/payouts/generate "
        "avec les parametres ownerId, from, to :",
        st['body']
    ))
    story += bullet_list([
        "<b>1. Idempotence</b> : verification qu'un payout n'existe pas deja pour cette periode/proprietaire",
        "<b>2. Aggregation revenus</b> : somme des totalPrice de toutes les reservations du proprietaire sur la periode",
        "<b>3. Resolution du taux de commission</b> : priorite au ManagementContract (par logement), sinon 20% par defaut",
        "<b>4. Aggregation depenses</b> : somme des amountTtc des depenses APPROVED sur la periode",
        "<b>5. Calcul net</b> : grossRevenue - commissionAmount - expenses",
        "<b>6. Creation du payout</b> en statut PENDING",
        "<b>7. Marquage des depenses</b> en statut INCLUDED avec lien vers le payout",
    ], st)

    story.append(spacer(8))
    story.append(Paragraph("5.2 Calcul du montant net", st['h2']))
    story.append(Paragraph(
        "<font face='Courier' size='9'>"
        "commissionAmount = grossRevenue x commissionRate<br/>"
        "netAmount = grossRevenue - commissionAmount - totalExpenses"
        "</font>",
        st['code']
    ))
    story.append(Paragraph(
        "Exemple : pour 5 000 EUR de revenus bruts, un taux de 20%, et 300 EUR de depenses :<br/>"
        "Commission = 1 000 EUR, Net proprietaire = 3 700 EUR.",
        st['body']
    ))
    story.append(info_box(
        "La resolution des noms de proprietaires est faite en batch (anti N+1) "
        "via userRepository.findAllById() pour optimiser les performances.",
        st
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 6. COMMISSIONS CANAUX
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("6. Commissions canaux", st['h1']))
    story.append(hr())
    story.append(Paragraph(
        "Les commissions canaux representent les frais preleves par les plateformes de reservation "
        "(Airbnb ~15%, Booking.com ~15-18%, etc.). Elles sont configurables par organisation.",
        st['body']
    ))
    story.append(make_table(
        ['Champ', 'Type', 'Description'],
        [
            ['channelName', 'Enum', 'AIRBNB, BOOKING, AGODA, VRBO, etc.'],
            ['commissionRate', 'BigDecimal', 'Taux de commission (ex: 0.15 = 15%)'],
            ['vatRate', 'BigDecimal', 'Taux TVA applicable (optionnel)'],
            ['isGuestFacing', 'Boolean', 'Si le voyageur voit la commission'],
        ],
        col_widths=[30*mm, 22*mm, w - 52*mm]
    ))
    story.append(Paragraph(
        "Les commissions canaux sont utilisees pour le reporting financier. "
        "Elles ne sont pas directement deduites du payout (qui utilise le taux du ManagementContract).",
        st['body']
    ))

    story.append(spacer(12))

    # ═══════════════════════════════════════════════════════════════════════
    # 7. EXPORTS COMPTABLES
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("7. Exports comptables", st['h1']))
    story.append(hr())
    story.append(Paragraph(
        "Cinq types d'exports sont disponibles via /api/accounting/export/* :",
        st['body']
    ))
    story.append(make_table(
        ['Export', 'Endpoint', 'Format', 'Contenu'],
        [
            ['FEC', '/export/fec', 'TSV (tab)', 'Ecritures comptables (norme DGFiP)'],
            ['Reservations', '/export/reservations-csv', 'CSV (;)', 'Liste des reservations avec details'],
            ['Payouts', '/export/payouts-csv', 'CSV (;)', 'Reversements avec nom proprietaire'],
            ['Depenses', '/export/expenses-csv', 'CSV (;)', 'Depenses prestataires avec TVA'],
            ['Factures', '/export/invoices-csv', 'CSV (;)', 'Factures avec statut et paiement'],
        ],
        col_widths=[22*mm, 38*mm, 22*mm, w - 82*mm]
    ))
    story.append(Paragraph(
        "Tous les exports sont filtres par plage de dates (from/to) et par organisation (multi-tenant).",
        st['caption']
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 8. FISCALITE ET TVA
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("8. Fiscalite et TVA", st['h1']))
    story.append(hr())
    story.append(Paragraph(
        "Le moteur fiscal (FiscalEngine) gere le calcul des taxes par pays et par categorie. "
        "Il s'appuie sur un TaxCalculatorRegistry qui mappe chaque pays a son calculateur specifique.",
        st['body']
    ))
    story.append(spacer(4))

    story.append(Paragraph("Taux TVA francais", st['h3']))
    story.append(make_table(
        ['Code Pennylane', 'Taux', 'Application'],
        [
            ['FR_200', '20%', 'Taux normal (services, menage, maintenance)'],
            ['FR_100', '10%', 'Taux intermediaire (hebergement)'],
            ['FR_055', '5.5%', 'Taux reduit (alimentation, energie)'],
            ['exempt', '0%', 'Exoneration (micro-entreprise, etc.)'],
        ],
        col_widths=[30*mm, 18*mm, w - 48*mm]
    ))

    story.append(spacer(4))
    story.append(Paragraph("Reporting fiscal", st['h3']))
    story += bullet_list([
        "FiscalReportingService.getVatSummary(from, to) — resume TVA sur une periode",
        "getMonthlyVatSummary(year, month) — resume mensuel",
        "getQuarterlyVatSummary(year, quarter) — resume trimestriel (declarations TVA)",
        "getAnnualVatSummary(year) — resume annuel",
    ], st)

    story.append(spacer(4))
    story.append(Paragraph("Taxe de sejour", st['h3']))
    story.append(Paragraph(
        "La taxe de sejour est un montant forfaitaire par nuit, specifique a chaque commune. "
        "Elle est ajoutee a la reservation (touristTaxAmount) et apparait separement sur la facture.",
        st['body']
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 9. INTEGRATION PENNYLANE
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("9. Integration Pennylane", st['h1']))
    story.append(hr())
    story.append(Paragraph(
        "Pennylane est un logiciel de comptabilite en ligne francais. L'integration permet de synchroniser "
        "automatiquement les factures clients et les factures fournisseurs (depenses) de Clenzy vers Pennylane, "
        "evitant ainsi la double saisie comptable.",
        st['body']
    ))

    story.append(spacer(4))
    story.append(Paragraph("Composants de l'integration", st['h3']))
    story.append(make_table(
        ['Composant', 'Fichier', 'Role'],
        [
            ['PennylaneConfig', 'integration/pennylane/config/', 'Configuration OAuth + API'],
            ['PennylaneConnection', 'integration/pennylane/model/', 'Tokens OAuth chiffres (per-org)'],
            ['PennylaneOAuthService', 'integration/pennylane/service/', 'Flux OAuth2 complet'],
            ['PennylaneAccountingClient', 'integration/pennylane/service/', 'Client HTTP API v2'],
            ['PennylaneAccountingSyncService', 'integration/pennylane/service/', 'Logique de sync metier'],
            ['PennylaneOAuthController', 'integration/pennylane/controller/', 'Endpoints OAuth (4)'],
            ['PennylaneAccountingController', 'integration/pennylane/controller/', 'Endpoints sync (4)'],
        ],
        col_widths=[42*mm, 42*mm, w - 84*mm]
    ))

    story.append(spacer(8))
    story.append(Paragraph("9.1 OAuth 2.0 — Flux de connexion", st['h2']))
    story.append(Paragraph("Etapes du flux OAuth2 Authorization Code :", st['body']))

    story.append(make_table(
        ['Etape', 'Action', 'Detail technique'],
        [
            ['1', 'GET /api/pennylane/connect', 'Genere un UUID state, stocke en Redis (TTL 10 min)'],
            ['2', 'Redirect vers Pennylane', 'URL avec client_id, redirect_uri, scopes, state'],
            ['3', 'Utilisateur autorise', 'Pennylane redirige vers /api/pennylane/callback?code=X&state=Y'],
            ['4', 'Validation du state', 'Recuperation userId:orgId depuis Redis, suppression (single-use)'],
            ['5', 'Echange code/token', 'POST vers tokenUrl avec grant_type=authorization_code'],
            ['6', 'Chiffrement tokens', 'AES-256-GCM via TokenEncryptionService'],
            ['7', 'Stockage en DB', 'PennylaneConnection avec status=ACTIVE'],
            ['8', 'Redirect frontend', '/settings?tab=integrations&status=success'],
        ],
        col_widths=[12*mm, 38*mm, w - 50*mm]
    ))

    story.append(spacer(4))
    story.append(Paragraph("Gestion des tokens", st['h3']))
    story += bullet_list([
        "<b>Access token</b> : expire en 24h, auto-refresh si < 5 min avant expiration",
        "<b>Refresh token</b> : single-use, valide 90 jours, Pennylane en renvoie un nouveau a chaque refresh",
        "<b>Chiffrement</b> : AES-256-GCM avec support de rotation de cle (GCMv1, GCMv2...)",
        "<b>Circuit breaker</b> : Resilience4j protege contre les pannes Pennylane",
    ], st)

    story.append(spacer(4))
    story.append(Paragraph("Scopes OAuth demandes", st['h3']))
    story.append(Paragraph(
        "<font face='Courier' size='8'>"
        "customer_invoices:all  supplier_invoices:all  customers:all<br/>"
        "suppliers:all  journals:readonly  ledger_accounts:readonly"
        "</font>",
        st['code']
    ))

    story.append(spacer(8))
    story.append(Paragraph("9.2 Synchronisation des factures", st['h2']))
    story.append(Paragraph(
        "Le service PennylaneAccountingSyncService synchronise les factures Clenzy "
        "vers Pennylane en tant que customer_invoices :",
        st['body']
    ))
    story += bullet_list([
        "Filtre : factures avec pennylaneInvoiceId IS NULL et statut ISSUED, SENT ou PAID",
        "Recherche/creation du client Pennylane via external_reference = clenzy_customer_{buyerName}",
        "Mapping des lignes de facture avec label, quantity, unit_price, vat_rate",
        "Conversion TVA : 0.20 &rarr; FR_200, 0.10 &rarr; FR_100, 0.055 &rarr; FR_055, 0 &rarr; exempt",
        "Stockage du pennylane_invoice_id et pennylaneSyncedAt apres creation reussie",
    ], st)

    story.append(spacer(8))
    story.append(Paragraph("9.3 Synchronisation des depenses", st['h2']))
    story.append(Paragraph(
        "Les depenses prestataires sont synchronisees comme supplier_invoices :",
        st['body']
    ))
    story += bullet_list([
        "Filtre : depenses avec pennylaneInvoiceId IS NULL et statut APPROVED, INCLUDED ou PAID",
        "Recherche/creation du fournisseur via external_reference = clenzy_supplier_{providerId}",
        "external_reference de la facture fournisseur : clenzy_exp_{expenseId}",
        "Echeance automatique : expenseDate + 30 jours",
    ], st)

    story.append(spacer(8))
    story.append(Paragraph("9.4 API Entreprise v2", st['h2']))
    story.append(make_table(
        ['Methode', 'Endpoint Pennylane', 'Description'],
        [
            ['createCustomerInvoice', 'POST /customer_invoices', 'Creer une facture client'],
            ['listCustomerInvoices', 'GET /customer_invoices', 'Lister (pagination cursor)'],
            ['createSupplierInvoice', 'POST /supplier_invoices', 'Creer une facture fournisseur'],
            ['createCustomer', 'POST /customers', 'Creer un client'],
            ['findCustomerByExternalRef', 'GET /customers?filter', 'Recherche par ref externe'],
            ['createSupplier', 'POST /suppliers', 'Creer un fournisseur'],
            ['listJournals', 'GET /journals', 'Lister les journaux comptables'],
        ],
        col_widths=[40*mm, 38*mm, w - 78*mm]
    ))
    story.append(Paragraph(
        "Base URL : https://app.pennylane.com/api/external/v2 — "
        "Authentification : Bearer token — Pagination : cursor-based",
        st['caption']
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 10. INTEGRATION AIRBNB
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("10. Integration Airbnb", st['h1']))
    story.append(hr())
    story.append(Paragraph(
        "Integration complete via OAuth 2.0 et webhooks en temps reel. "
        "Synchronise les reservations, les listings et les messages.",
        st['body']
    ))

    story.append(spacer(4))
    story.append(Paragraph("Flux de donnees", st['h3']))
    story += bullet_list([
        "<b>OAuth</b> : meme pattern que Pennylane (state Redis, chiffrement tokens, auto-refresh)",
        "<b>Webhooks</b> : POST /api/webhooks/airbnb &rarr; publication Kafka &rarr; traitement async",
        "<b>Evenements</b> : reservation.created, reservation.updated, reservation.cancelled",
        "<b>Auto-cleaning</b> : chaque nouvelle reservation declenche une ServiceRequest de menage",
        "<b>Deduplication</b> : via externalUid (confirmation code Airbnb)",
    ], st)

    story.append(spacer(4))
    story.append(Paragraph("Architecture webhook", st['h3']))
    story.append(Paragraph(
        "<font face='Courier' size='8'>"
        "Airbnb POST &rarr; AirbnbWebhookController (200 OK &lt; 5s)<br/>"
        "  &rarr; Kafka topic: airbnb.webhooks.incoming<br/>"
        "  &rarr; AirbnbWebhookService (deserialization)<br/>"
        "  &rarr; Kafka topic: airbnb.reservations.sync<br/>"
        "  &rarr; AirbnbReservationService (upsert Reservation + ServiceRequest)"
        "</font>",
        st['code']
    ))

    story.append(spacer(12))

    # ═══════════════════════════════════════════════════════════════════════
    # 11. INTEGRATION MINUT
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("11. Integration Minut", st['h1']))
    story.append(hr())
    story.append(Paragraph(
        "Minut est un capteur de surveillance environnementale (bruit, temperature, humidite). "
        "L'integration permet de recevoir des alertes de nuisances sonores en temps reel.",
        st['body']
    ))
    story += bullet_list([
        "<b>OAuth 2.0</b> : connexion du compte Minut a l'organisation Clenzy",
        "<b>Webhook security</b> : HMAC-SHA256 (header X-Minut-Signature)",
        "<b>Evenements</b> : disturbance (bruit), device_offline/online, battery_low",
        "<b>Traitement async</b> : webhook &rarr; Kafka topic minut.webhooks.incoming &rarr; MinutWebhookConsumer",
        "<b>Alertes</b> : NoiseAlertNotification envoyee aux gestionnaires et proprietaires",
    ], st)

    story.append(spacer(12))

    # ═══════════════════════════════════════════════════════════════════════
    # 12. INTEGRATION STRIPE
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("12. Integration Stripe", st['h1']))
    story.append(hr())
    story.append(Paragraph(
        "Stripe gere tous les paiements de la plateforme : inscriptions, interventions, "
        "reservations, et paiements mobiles.",
        st['body']
    ))

    story.append(spacer(4))
    story.append(Paragraph("Types de paiement", st['h3']))
    story.append(make_table(
        ['Type', 'Mode Stripe', 'Description'],
        [
            ['Inscription', 'SUBSCRIPTION', 'Abonnement mensuel (creation de compte)'],
            ['Intervention', 'PAYMENT', 'Paiement unique pour service complete'],
            ['Grouped Deferred', 'PAYMENT', 'Lot d\'interventions payees ensemble'],
            ['Service Request', 'PAYMENT', 'Paiement avant intervention'],
            ['Reservation', 'PAYMENT', 'Depot/totalite du sejour (lien par email)'],
        ],
        col_widths=[28*mm, 25*mm, w - 53*mm]
    ))

    story.append(spacer(4))
    story.append(Paragraph("Webhooks Stripe", st['h3']))
    story += bullet_list([
        "<b>checkout.session.completed</b> : paiement reussi &rarr; AutoInvoiceService (facture auto)",
        "<b>checkout.session.async_payment_succeeded</b> : virement/prelevement confirme",
        "<b>checkout.session.async_payment_failed</b> : echec paiement asynchrone",
        "<b>payment_intent.succeeded</b> : paiement mobile (PaymentSheet)",
        "<b>Securite</b> : validation signature Stripe (Webhook.constructEvent)",
    ], st)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 13. INTEGRATION ICAL
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("13. Integration iCal", st['h1']))
    story.append(hr())
    story.append(Paragraph(
        "Import de flux calendrier .ics depuis Airbnb, Booking, VRBO ou tout autre source. "
        "Cree automatiquement des reservations et des taches de menage.",
        st['body']
    ))
    story += bullet_list([
        "<b>Validation URL</b> : HTTPS uniquement, blocage IP privees (RFC 1918), anti-SSRF",
        "<b>Deduplication</b> : via externalUid (UID iCal), pas de doublons",
        "<b>Normalisation noms</b> : noms generiques (Reserved, Not Available) &rarr; Reserved #1, #2...",
        "<b>Auto-cleaning</b> : creation ServiceRequest CLEANING au checkout si active",
        "<b>Tarification dynamique</b> : prix calcule via PriceEngine (base/saison/promo)",
        "<b>Sync periodique</b> : ICalSyncScheduler re-importe tous les flux actifs",
    ], st)

    story.append(spacer(12))

    # ═══════════════════════════════════════════════════════════════════════
    # 14. INTEGRATION PRICELABS
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("14. Integration PriceLabs", st['h1']))
    story.append(hr())
    story.append(Paragraph(
        "PriceLabs fournit des recommandations de tarification dynamique basees sur les donnees du marche, "
        "la demande et la concurrence. L'integration recupere les prix recommandes et les integre au PriceEngine.",
        st['body']
    ))
    story += bullet_list([
        "<b>API</b> : POST /v1/getpricing — recommandations par date et par logement",
        "<b>Donnees</b> : prix recommande, prix min/max, score de confiance",
        "<b>Resilience</b> : circuit breaker (retourne liste vide si PriceLabs indisponible)",
        "<b>Configuration</b> : mapping propertyId &rarr; PriceLabs listing_id via ExternalPricingConfig",
    ], st)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 15. INFRASTRUCTURE TRANSVERSE
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("15. Infrastructure transverse", st['h1']))
    story.append(hr())

    story.append(Paragraph("15.1 Multi-tenancy", st['h2']))
    story.append(Paragraph(
        "Toutes les donnees sont isolees par organisation via le champ organization_id. "
        "Le TenantContext (request-scoped) est alimente depuis le JWT Keycloak et transmis "
        "a toutes les couches service/repository.",
        st['body']
    ))
    story += bullet_list([
        "Filtre Hibernate : @Filter(name = \"organizationFilter\") sur toutes les entites",
        "Extraction du contexte : TenantFilter &rarr; JWT custom claim &rarr; TenantContext",
        "Proprietes resolues : organizationId, countryCode, defaultCurrency, vatRegistered",
    ], st)

    story.append(spacer(8))
    story.append(Paragraph("15.2 Kafka & Outbox Pattern", st['h2']))
    story.append(Paragraph(
        "Le pattern Outbox garantit la coherence entre la base de donnees et Kafka. "
        "Les evenements sont d'abord persistes en DB (table outbox_events) dans la meme transaction "
        "que la modification metier, puis publies vers Kafka par un relay asynchrone.",
        st['body']
    ))
    story.append(Paragraph("Topics Kafka principaux :", st['h3']))
    story.append(make_table(
        ['Topic', 'Producteur', 'Consommateur'],
        [
            ['airbnb.reservations.sync', 'AirbnbWebhookService', 'AirbnbReservationService'],
            ['minut.webhooks.incoming', 'MinutWebhookController', 'MinutWebhookConsumer'],
            ['minut.noise.events', 'MinutWebhookConsumer', 'NoiseAlertNotifier'],
            ['document.generate', 'OutboxRelay', 'DocumentEventService'],
            ['payment.events', 'OutboxRelay', 'PaymentEventConsumer'],
            ['notifications.send', 'OutboxRelay', 'FcmNotificationConsumer'],
            ['calendar.updates', 'OutboxRelay', 'ChannelSyncService'],
        ],
        col_widths=[38*mm, 35*mm, w - 73*mm]
    ))

    story.append(spacer(8))
    story.append(Paragraph("15.3 Chiffrement des tokens", st['h2']))
    story.append(Paragraph(
        "Tous les tokens OAuth sont chiffres avant stockage via TokenEncryptionService :",
        st['body']
    ))
    story += bullet_list([
        "<b>Algorithme</b> : AES-256-GCM (IV 96 bits, tag 128 bits)",
        "<b>Format</b> : GCMv{version}:{base64(iv+ciphertext+tag)}",
        "<b>Rotation de cles</b> : versionning (GCMv1, GCMv2...), les anciennes cles dechiffrent, la nouvelle chiffre",
        "<b>Retro-compatibilite</b> : fallback vers Jasypt AES-CBC pour les tokens legacy",
        "<b>Migration</b> : methode reEncrypt() pour migrer les tokens vers la nouvelle version",
    ], st)

    story.append(spacer(8))
    story.append(Paragraph("15.4 Stockage fichiers", st['h2']))
    story.append(Paragraph(
        "AbstractFileStorageService fournit la base commune avec securite anti-path-traversal, "
        "metriques Micrometer, et generation de noms UUID :",
        st['body']
    ))
    story.append(make_table(
        ['Service', 'Repertoire', 'Usage'],
        [
            ['DocumentStorageService', '/app/uploads/documents', 'Factures PDF, contrats, devis'],
            ['ReceiptStorageService', '/app/uploads/receipts', 'Justificatifs depenses prestataires'],
            ['DocumentTemplateStorageService', '/app/uploads/templates', 'Templates ODT de documents'],
            ['ContactFileStorageService', '/app/uploads/contacts', 'Photos et pieces contacts'],
        ],
        col_widths=[42*mm, 38*mm, w - 80*mm]
    ))

    story.append(spacer(8))
    story.append(Paragraph("15.5 Keycloak (Authentification)", st['h2']))
    story.append(Paragraph(
        "Keycloak gere l'authentification, les roles et les mots de passe :",
        st['body']
    ))
    story.append(make_table(
        ['Role', 'Description', 'Portee'],
        [
            ['SUPER_ADMIN', 'Administrateur global', 'Toutes les operations'],
            ['SUPER_MANAGER', 'Gestionnaire plateforme', 'Multi-organisation'],
            ['OWNER', 'Proprietaire de logements', 'Ses propres logements'],
            ['HOUSEKEEPER', 'Femme/homme de menage', 'Taches assignees'],
            ['TECHNICIAN', 'Technicien maintenance', 'Interventions assignees'],
            ['GUEST', 'Voyageur', 'Ses reservations uniquement'],
        ],
        col_widths=[28*mm, 35*mm, w - 63*mm]
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 16. PATTERNS ARCHITECTURAUX
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("16. Patterns architecturaux", st['h1']))
    story.append(hr())

    patterns = [
        ("OAuth2 State CSRF",
         "UUID aleatoire stocke en Redis (TTL 10 min), single-use. "
         "Empeche les attaques CSRF sur le flux OAuth. "
         "Pattern utilise par : Airbnb, Minut, Pennylane."),
        ("Token Auto-Refresh",
         "Avant chaque appel API externe, getValidAccessToken() verifie l'expiration. "
         "Si le token expire dans moins de 5 minutes, un refresh est declenche automatiquement. "
         "Transparent pour l'appelant."),
        ("Circuit Breaker (Resilience4j)",
         "Protege contre les pannes des APIs externes (PriceLabs, Pennylane, Keycloak). "
         "Seuil : 50% d'echecs sur 10 appels, attente 30s avant reouverture. "
         "Fallback configurable par service (liste vide, exception, valeur par defaut)."),
        ("Webhook Async (Kafka)",
         "Les webhooks retournent 200 OK immediatement (< 5s). "
         "Le payload est publie sur un topic Kafka pour traitement asynchrone. "
         "Decouple la logique metier de la contrainte HTTP."),
        ("Outbox Pattern",
         "Garantit la coherence entre la modification en base et la publication Kafka. "
         "L'evenement est insere dans la table outbox_events dans la meme transaction que la modification. "
         "Un relay asynchrone (OutboxRelay) publie vers Kafka et marque l'evenement comme traite."),
        ("Idempotence",
         "Toutes les operations critiques sont idempotentes : "
         "generation de factures (verifie existence), payouts (verifie periode/owner), "
         "sync Pennylane (external_reference unique)."),
        ("HMAC-SHA256 Webhook Security",
         "Validation de la signature des webhooks externes (Minut, Stripe). "
         "Le secret partage est configure dans l'application. "
         "Stripe utilise sa propre librairie (Webhook.constructEvent)."),
        ("Anti Path-Traversal",
         "Tous les stockages fichiers valident que le chemin resolu reste dans le repertoire de base. "
         "Les noms de fichiers sont prefixes par un UUID pour eviter les collisions et les injections."),
        ("Batch Resolution (Anti N+1)",
         "Les lookups de noms (proprietaires, prestataires) sont faits en batch via "
         "findAllById() puis mappes en memoire. Evite N+1 requetes SQL."),
        ("Immutabilite des factures emises",
         "Une facture ISSUED ne peut plus etre modifiee. "
         "Les corrections se font via CREDIT_NOTE (avoir). "
         "Garantit la conformite fiscale francaise."),
    ]

    for title, desc in patterns:
        story.append(Paragraph(f"<b>{title}</b>", st['h3']))
        story.append(Paragraph(desc, st['body']))
        story.append(spacer(4))

    return story


# ── Main ────────────────────────────────────────────────────────────────────
def main():
    output_path = "/Users/toufik/Desktop/env/projets/sinatech/clenzy/docs/Clenzy_Documentation_Technique_Comptabilite.pdf"

    st = build_styles()
    story = build_content(st)

    # Build the document with cover + content page templates
    doc = BaseDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=25*mm, rightMargin=25*mm,
        topMargin=22*mm, bottomMargin=18*mm,
        title="Clenzy — Documentation Technique Comptabilite & Integrations",
        author="Sinatech",
        subject="Documentation technique des workflows comptables et integrations externes",
    )

    cover_frame = Frame(
        40*mm, 20*mm,
        A4[0] - 60*mm, A4[1] - 40*mm,
        id='cover'
    )
    content_frame = Frame(
        25*mm, 18*mm,
        A4[0] - 50*mm, A4[1] - 40*mm,
        id='content'
    )

    doc.addPageTemplates([
        PageTemplate(id='cover', frames=[cover_frame], onPage=cover_page),
        PageTemplate(id='content', frames=[content_frame], onPage=normal_page),
    ])

    # Insert a NextPageTemplate after cover
    from reportlab.platypus.doctemplate import NextPageTemplate
    story.insert(0, NextPageTemplate('cover'))
    # After the first PageBreak, switch to content template
    for i, item in enumerate(story):
        if isinstance(item, PageBreak):
            story.insert(i, NextPageTemplate('content'))
            break

    doc.build(story)
    print(f"PDF generated: {output_path}")
    print(f"Size: {os.path.getsize(output_path) / 1024:.0f} KB")


if __name__ == '__main__':
    main()
