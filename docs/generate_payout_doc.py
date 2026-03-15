#!/usr/bin/env python3
"""
Generate PDF documentation for the Owner Payouts feature (Phase 1 & 2).
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether,
)
from reportlab.platypus.frames import Frame
from reportlab.platypus.doctemplate import PageTemplate
from datetime import datetime
import os

# ─── Output path ─────────────────────────────────────────────────────────────

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "Clenzy_Reversements_Documentation.pdf")

# ─── Colors ──────────────────────────────────────────────────────────────────

CLENZY_PRIMARY = colors.HexColor("#1a1a2e")
CLENZY_ACCENT = colors.HexColor("#4A9B8E")
CLENZY_ACCENT_LIGHT = colors.HexColor("#E8F5F1")
CLENZY_BLUE = colors.HexColor("#1976d2")
CLENZY_PURPLE = colors.HexColor("#635bff")
CLENZY_ORANGE = colors.HexColor("#D4A574")
CLENZY_RED = colors.HexColor("#f44336")
CLENZY_GRAY = colors.HexColor("#f5f5f5")
CLENZY_DARK_GRAY = colors.HexColor("#616161")
CLENZY_LIGHT_BORDER = colors.HexColor("#e0e0e0")
WHITE = colors.white
BLACK = colors.black

# ─── Styles ──────────────────────────────────────────────────────────────────

styles = getSampleStyleSheet()

style_cover_title = ParagraphStyle(
    "CoverTitle", parent=styles["Title"],
    fontSize=28, leading=34, textColor=CLENZY_PRIMARY,
    spaceAfter=6, alignment=TA_LEFT,
    fontName="Helvetica-Bold",
)
style_cover_subtitle = ParagraphStyle(
    "CoverSubtitle", parent=styles["Normal"],
    fontSize=14, leading=20, textColor=CLENZY_DARK_GRAY,
    spaceAfter=30, alignment=TA_LEFT,
    fontName="Helvetica",
)
style_cover_meta = ParagraphStyle(
    "CoverMeta", parent=styles["Normal"],
    fontSize=10, leading=14, textColor=CLENZY_DARK_GRAY,
    alignment=TA_LEFT, fontName="Helvetica",
)

style_h1 = ParagraphStyle(
    "H1Custom", parent=styles["Heading1"],
    fontSize=20, leading=26, textColor=CLENZY_PRIMARY,
    spaceBefore=24, spaceAfter=12,
    fontName="Helvetica-Bold",
    borderPadding=(0, 0, 4, 0),
)
style_h2 = ParagraphStyle(
    "H2Custom", parent=styles["Heading2"],
    fontSize=15, leading=20, textColor=CLENZY_PRIMARY,
    spaceBefore=18, spaceAfter=8,
    fontName="Helvetica-Bold",
)
style_h3 = ParagraphStyle(
    "H3Custom", parent=styles["Heading3"],
    fontSize=12, leading=16, textColor=CLENZY_ACCENT,
    spaceBefore=12, spaceAfter=6,
    fontName="Helvetica-Bold",
)
style_body = ParagraphStyle(
    "BodyCustom", parent=styles["Normal"],
    fontSize=10, leading=15, textColor=BLACK,
    spaceAfter=6, alignment=TA_JUSTIFY,
    fontName="Helvetica",
)
style_bullet = ParagraphStyle(
    "BulletCustom", parent=style_body,
    leftIndent=20, bulletIndent=8,
    spaceBefore=2, spaceAfter=2,
)
style_code = ParagraphStyle(
    "CodeCustom", parent=styles["Normal"],
    fontSize=9, leading=13, textColor=colors.HexColor("#333333"),
    fontName="Courier", backColor=CLENZY_GRAY,
    leftIndent=12, rightIndent=12,
    spaceBefore=4, spaceAfter=4,
    borderPadding=6,
)
style_note = ParagraphStyle(
    "NoteCustom", parent=style_body,
    fontSize=9, leading=13, textColor=CLENZY_DARK_GRAY,
    leftIndent=12, rightIndent=12,
    backColor=CLENZY_ACCENT_LIGHT,
    borderPadding=8,
    spaceBefore=8, spaceAfter=8,
)
style_table_header = ParagraphStyle(
    "TableHeader", parent=styles["Normal"],
    fontSize=9, leading=12, textColor=WHITE,
    fontName="Helvetica-Bold", alignment=TA_LEFT,
)
style_table_cell = ParagraphStyle(
    "TableCell", parent=styles["Normal"],
    fontSize=9, leading=12, textColor=BLACK,
    fontName="Helvetica", alignment=TA_LEFT,
)
style_table_cell_code = ParagraphStyle(
    "TableCellCode", parent=style_table_cell,
    fontName="Courier", fontSize=8,
)
style_footer = ParagraphStyle(
    "Footer", parent=styles["Normal"],
    fontSize=8, textColor=CLENZY_DARK_GRAY,
    fontName="Helvetica",
)

# ─── Table helpers ───────────────────────────────────────────────────────────

BASE_TABLE_STYLE = TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), CLENZY_PRIMARY),
    ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, 0), 9),
    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE", (0, 1), (-1, -1), 9),
    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("GRID", (0, 0), (-1, -1), 0.5, CLENZY_LIGHT_BORDER),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, CLENZY_GRAY]),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
])


def p(text, style=style_body):
    return Paragraph(text, style)


def h1(text):
    return Paragraph(text, style_h1)


def h2(text):
    return Paragraph(text, style_h2)


def h3(text):
    return Paragraph(text, style_h3)


def bullet(text):
    return Paragraph(f"<bullet>&bull;</bullet> {text}", style_bullet)


def code(text):
    return Paragraph(text, style_code)


def note(text):
    return Paragraph(f"<b>Note :</b> {text}", style_note)


def hr():
    return HRFlowable(width="100%", thickness=1, color=CLENZY_LIGHT_BORDER,
                       spaceBefore=8, spaceAfter=8)


def spacer(h=6):
    return Spacer(1, h)


def make_table(data, col_widths=None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(BASE_TABLE_STYLE)
    return t


# ─── Page templates ──────────────────────────────────────────────────────────

def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Header line
    canvas.setStrokeColor(CLENZY_ACCENT)
    canvas.setLineWidth(2)
    canvas.line(2 * cm, h - 1.5 * cm, w - 2 * cm, h - 1.5 * cm)
    # Header text
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(CLENZY_DARK_GRAY)
    canvas.drawString(2 * cm, h - 1.3 * cm, "Clenzy PMS")
    canvas.drawRightString(w - 2 * cm, h - 1.3 * cm,
                           "Documentation Technique - Reversements")
    # Footer
    canvas.setStrokeColor(CLENZY_LIGHT_BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, 1.5 * cm, w - 2 * cm, 1.5 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(CLENZY_DARK_GRAY)
    canvas.drawString(2 * cm, 1 * cm, f"Confidentiel - {datetime.now().strftime('%d/%m/%Y')}")
    canvas.drawRightString(w - 2 * cm, 1 * cm, f"Page {doc.page}")
    canvas.restoreState()


def cover_footer(canvas, doc):
    canvas.saveState()
    w, _ = A4
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(CLENZY_DARK_GRAY)
    canvas.drawString(2 * cm, 1 * cm, "Document confidentiel - Sinatech SARL")
    canvas.restoreState()


# ─── Build document ──────────────────────────────────────────────────────────

def build():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        title="Clenzy PMS - Documentation Reversements Proprietaires",
        author="Sinatech",
    )

    w, h = A4
    content_width = w - 4 * cm

    frame_cover = Frame(2 * cm, 2 * cm, content_width, h - 4 * cm, id="cover")
    frame_normal = Frame(2 * cm, 2 * cm, content_width, h - 4 * cm, id="normal")

    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=frame_cover, onPage=cover_footer),
        PageTemplate(id="Content", frames=frame_normal, onPage=header_footer),
    ])

    story = []

    # ═══════════════════════════════════════════════════════════════════════
    #  COVER PAGE
    # ═══════════════════════════════════════════════════════════════════════

    story.append(spacer(80))

    # Accent bar
    accent_bar = Table(
        [[""]],
        colWidths=[content_width],
        rowHeights=[4],
    )
    accent_bar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CLENZY_ACCENT),
        ("LINEBELOW", (0, 0), (-1, -1), 0, WHITE),
    ]))
    story.append(accent_bar)
    story.append(spacer(20))

    story.append(p("CLENZY PMS", style_cover_title))
    story.append(p("Systeme de Reversements Proprietaires", ParagraphStyle(
        "CoverFeature", parent=style_cover_title,
        fontSize=22, leading=28, textColor=CLENZY_ACCENT,
    )))
    story.append(spacer(12))
    story.append(p(
        "Documentation technique des evolutions Phase 1 et Phase 2 : "
        "generation automatique, execution des virements (Stripe Connect / SEPA), "
        "configuration proprietaires et interface utilisateur.",
        style_cover_subtitle,
    ))
    story.append(spacer(40))

    # Meta info
    meta_data = [
        ["Version", "2.0"],
        ["Date", datetime.now().strftime("%d/%m/%Y")],
        ["Auteur", "Equipe Sinatech"],
        ["Projet", "Clenzy PMS - Module Comptabilite"],
        ["Statut", "Implemente - Phase 1 + Phase 2"],
    ]
    meta_table = Table(meta_data, colWidths=[4 * cm, 10 * cm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), CLENZY_DARK_GRAY),
        ("TEXTCOLOR", (1, 0), (1, -1), BLACK),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, CLENZY_LIGHT_BORDER),
    ]))
    story.append(meta_table)

    story.append(spacer(60))

    # Tech stack badges
    stack_text = (
        '<font color="#1a1a2e"><b>Stack :</b></font> '
        '<font color="#4A9B8E">Java 21</font> | '
        '<font color="#4A9B8E">Spring Boot 3.2</font> | '
        '<font color="#4A9B8E">React 18</font> | '
        '<font color="#4A9B8E">TypeScript</font> | '
        '<font color="#4A9B8E">MUI</font> | '
        '<font color="#4A9B8E">Stripe SDK 24.16</font>'
    )
    story.append(p(stack_text, ParagraphStyle(
        "StackLine", parent=style_body, fontSize=10,
    )))

    # ─── Switch to content template ──────────────────────────────────────
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  TABLE OF CONTENTS
    # ═══════════════════════════════════════════════════════════════════════

    from reportlab.platypus.doctemplate import NextPageTemplate
    story.append(NextPageTemplate("Content"))

    story.append(h1("Table des matieres"))
    story.append(hr())

    toc_items = [
        ("1.", "Vue d'ensemble"),
        ("2.", "Architecture technique"),
        ("3.", "Phase 1 - Generation automatique et notifications"),
        ("  3.1", "Generation automatique des payouts"),
        ("  3.2", "Calcul du montant net"),
        ("  3.3", "Cycle de vie des payouts"),
        ("  3.4", "Notifications"),
        ("  3.5", "Dashboard et KPIs"),
        ("  3.6", "Exports comptables"),
        ("4.", "Phase 2 - Execution des reversements"),
        ("  4.1", "Configuration proprietaire (OwnerPayoutConfig)"),
        ("  4.2", "Stripe Connect"),
        ("  4.3", "Virement SEPA"),
        ("  4.4", "Service d'execution (PayoutExecutionService)"),
        ("  4.5", "Mecanisme de retry"),
        ("5.", "API Reference"),
        ("6.", "Securite"),
        ("7.", "Base de donnees"),
        ("8.", "Interface utilisateur"),
        ("9.", "Internationalisation"),
    ]
    for num, title in toc_items:
        indent = 24 if num.startswith("  ") else 0
        weight = "Bold" if not num.startswith("  ") else ""
        font = f"Helvetica-{weight}" if weight else "Helvetica"
        story.append(p(
            f"<font name='{font}'>{num.strip()}</font>  {title}",
            ParagraphStyle("TOC", parent=style_body, leftIndent=indent, fontSize=10),
        ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  1. VUE D'ENSEMBLE
    # ═══════════════════════════════════════════════════════════════════════

    story.append(h1("1. Vue d'ensemble"))
    story.append(hr())
    story.append(p(
        "Le module de reversements proprietaires de Clenzy PMS permet de calculer, "
        "suivre et executer les paiements dus aux proprietaires de biens immobiliers "
        "geres par la conciergerie. Il couvre l'ensemble du cycle de vie d'un reversement, "
        "de la generation automatique jusqu'a l'execution du virement bancaire."
    ))
    story.append(spacer(8))
    story.append(p("<b>Objectifs principaux :</b>"))
    story.append(bullet("Automatiser la generation periodique des reversements"))
    story.append(bullet("Calculer precisement : revenus - commission - depenses = montant net"))
    story.append(bullet("Supporter plusieurs methodes de paiement (Stripe Connect, SEPA, Manuel)"))
    story.append(bullet("Notifier proprietaires et admins a chaque etape"))
    story.append(bullet("Garantir la securite des donnees bancaires (chiffrement AES-256)"))
    story.append(bullet("Respecter l'architecture multi-tenant"))

    story.append(spacer(12))

    # Summary table
    summary_data = [
        [p("Phase", style_table_header), p("Composant", style_table_header), p("Description", style_table_header)],
        [p("Phase 1", style_table_cell), p("Generation auto", style_table_cell),
         p("Scheduler configurable, calcul automatique des montants", style_table_cell)],
        [p("Phase 1", style_table_cell), p("Notifications", style_table_cell),
         p("Alertes in-app proprietaires + admins (approbation, paiement, echec)", style_table_cell)],
        [p("Phase 1", style_table_cell), p("Dashboard", style_table_cell),
         p("KPI 'Reversements en attente' dans les Action Counters", style_table_cell)],
        [p("Phase 2", style_table_cell), p("Config proprietaire", style_table_cell),
         p("Choix methode (Manuel/Stripe/SEPA), IBAN chiffre, verification admin", style_table_cell)],
        [p("Phase 2", style_table_cell), p("Stripe Connect", style_table_cell),
         p("Compte Express, onboarding, transferts automatiques, webhooks", style_table_cell)],
        [p("Phase 2", style_table_cell), p("SEPA / Manuel", style_table_cell),
         p("Workflow semi-automatique avec notification admin", style_table_cell)],
        [p("Phase 2", style_table_cell), p("Execution", style_table_cell),
         p("Orchestration, retry max 3, notifications echec", style_table_cell)],
    ]
    story.append(make_table(summary_data, col_widths=[2.5 * cm, 4 * cm, 10.5 * cm]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  2. ARCHITECTURE TECHNIQUE
    # ═══════════════════════════════════════════════════════════════════════

    story.append(h1("2. Architecture technique"))
    story.append(hr())

    story.append(h3("Stack technologique"))
    stack_data = [
        [p("Couche", style_table_header), p("Technologie", style_table_header), p("Version", style_table_header)],
        [p("Backend", style_table_cell), p("Java / Spring Boot / JPA Hibernate", style_table_cell), p("21 / 3.2.x", style_table_cell)],
        [p("Migrations", style_table_cell), p("Liquibase", style_table_cell), p("4.x", style_table_cell)],
        [p("Paiement", style_table_cell), p("Stripe SDK (stripe-java)", style_table_cell), p("24.16.0", style_table_cell)],
        [p("Resilience", style_table_cell), p("Resilience4j (Circuit Breaker)", style_table_cell), p("2.x", style_table_cell)],
        [p("Frontend", style_table_cell), p("React / TypeScript / MUI", style_table_cell), p("18 / 5.x / 5.x", style_table_cell)],
        [p("State", style_table_cell), p("TanStack Query (React Query)", style_table_cell), p("5.x", style_table_cell)],
        [p("Chiffrement", style_table_cell), p("Jasypt (AES-256)", style_table_cell), p("3.x", style_table_cell)],
        [p("Auth", style_table_cell), p("Keycloak / Spring Security", style_table_cell), p("-", style_table_cell)],
    ]
    story.append(make_table(stack_data, col_widths=[3 * cm, 9 * cm, 5 * cm]))
    story.append(spacer(12))

    story.append(h3("Architecture multi-tenant"))
    story.append(p(
        "Chaque entite porte un <font name='Courier'>organization_id</font>. "
        "Un filtre Hibernate <font name='Courier'>@Filter(name=\"organizationFilter\")</font> "
        "est applique automatiquement. Toutes les queries de repository prennent un parametre "
        "<font name='Courier'>orgId</font> explicite pour garantir l'isolation des donnees."
    ))

    story.append(spacer(8))
    story.append(h3("Diagramme des composants"))
    story.append(spacer(4))

    arch_text = """
<font name="Courier" size="8">
+------------------------------------------------------------------+
|                        Frontend (React)                          |
|  AccountingPage  |  OwnerPayoutSettings  |  ActionCountersWidget |
+--------+---------+-----------+-----------+-----------+-----------+
         |                     |                       |
    accountingApi.ts     useOwnerPayoutConfig     useAccounting
         |                     |                       |
+--------v---------+-----------v-----------+-----------v-----------+
|                      Spring Boot Backend                         |
|  AccountingController  |  OwnerPayoutConfigController            |
+--------+---------------+-----------+-----------------------------+
         |                           |
+--------v--------+    +-------------v--------------+
| AccountingService|    | PayoutExecutionService     |
| (generation,     |    | (orchestration,            |
|  approbation)    |    |  retry, notifications)     |
+--------+--------+    +------+----------+----------+
         |                     |          |
         |              +------v---+ +---v--------------+
         |              | Stripe   | | NotificationSvc  |
         |              | Connect  | | (in-app + email)  |
         |              | Service  | +------------------+
         |              +----------+
+--------v-------------------------------------------------+
|              PostgreSQL (multi-tenant, Liquibase)         |
|  owner_payouts | owner_payout_config | users | ...       |
+------------------------------------------------------+
</font>"""
    story.append(p(arch_text, ParagraphStyle("Arch", parent=style_code, fontSize=8, leading=11)))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  3. PHASE 1
    # ═══════════════════════════════════════════════════════════════════════

    story.append(h1("3. Phase 1 - Generation automatique et notifications"))
    story.append(hr())

    # 3.1
    story.append(h2("3.1 Generation automatique des payouts"))
    story.append(p(
        "Un scheduler Spring (<font name='Courier'>PayoutSchedulerService</font>) "
        "genere automatiquement les reversements selon un calendrier configurable par le SUPER_ADMIN."
    ))
    story.append(spacer(4))
    story.append(p("<b>Configuration (PayoutScheduleConfig) :</b>"))
    story.append(bullet("<b>Jours du mois</b> : selection des jours de generation (1-28), ex: [1, 15]"))
    story.append(bullet("<b>Periode de grace</b> : delai (en jours) avant envoi d'un rappel d'approbation"))
    story.append(bullet("<b>Activation</b> : toggle on/off pour la generation automatique"))
    story.append(spacer(4))
    story.append(note(
        "Le scheduler s'execute via <font name='Courier'>@Scheduled</font> et genere un payout "
        "par proprietaire pour la periode ecoulee (depuis le dernier payout ou le debut du mois)."
    ))

    # 3.2
    story.append(h2("3.2 Calcul du montant net"))
    story.append(p("La formule de calcul du reversement est :"))
    story.append(code(
        "Net = Revenus bruts - Commission conciergerie - Depenses approuvees"
    ))
    story.append(spacer(4))
    story.append(p("<b>Resolution du taux de commission :</b>"))
    story.append(bullet("1. <b>ManagementContract.commissionRate</b> (par propriete, configure par SUPER_ADMIN)"))
    story.append(bullet("2. <b>Fallback</b> : 20% (DEFAULT_COMMISSION_RATE) si aucun contrat"))
    story.append(spacer(4))
    story.append(p("<b>Depenses :</b>"))
    story.append(bullet("Seules les depenses au statut <b>APPROVED</b> sont incluses"))
    story.append(bullet("Elles passent au statut <b>INCLUDED</b> et sont liees au payout"))
    story.append(bullet("Montant TTC (amountTtc) utilise pour le calcul"))

    # 3.3
    story.append(h2("3.3 Cycle de vie des payouts"))
    story.append(spacer(4))

    lifecycle_text = """
<font name="Courier" size="9">
  +----------+     approvePayout()     +----------+
  |  PENDING | ----------------------> | APPROVED |
  +----------+                         +-----+----+
                                             |
                              executePayout() |
                                             v
                                       +-----------+
                                       | PROCESSING|
                                       +-----+-----+
                                             |
                          +------------------+------------------+
                          |                                     |
                    Stripe OK                             Exception
                          |                                     |
                          v                                     v
                     +--------+                           +--------+
                     |  PAID  |                           | FAILED |
                     +--------+                           +---+----+
                                                              |
                                                   retryPayout() (max 3)
                                                              |
                                                              v
                                                        +-----------+
                                                        | APPROVED  |
                                                        | (re-exec) |
                                                        +-----------+
</font>"""
    story.append(p(lifecycle_text, ParagraphStyle("Lifecycle", parent=style_code, fontSize=9, leading=12)))
    story.append(spacer(6))

    status_data = [
        [p("Statut", style_table_header), p("Description", style_table_header), p("Actions possibles", style_table_header)],
        [p("PENDING", style_table_cell), p("Payout genere, en attente de validation", style_table_cell), p("Approuver", style_table_cell)],
        [p("APPROVED", style_table_cell), p("Valide par un admin, pret pour execution", style_table_cell), p("Executer, Marquer paye", style_table_cell)],
        [p("PROCESSING", style_table_cell), p("Virement en cours (Stripe ou SEPA)", style_table_cell), p("Attendre confirmation", style_table_cell)],
        [p("PAID", style_table_cell), p("Paiement effectue et confirme", style_table_cell), p("-", style_table_cell)],
        [p("FAILED", style_table_cell), p("Echec de l'execution", style_table_cell), p("Relancer (max 3 fois)", style_table_cell)],
        [p("CANCELLED", style_table_cell), p("Annule par un admin", style_table_cell), p("-", style_table_cell)],
    ]
    story.append(make_table(status_data, col_widths=[3 * cm, 8 * cm, 6 * cm]))

    # 3.4
    story.append(h2("3.4 Notifications"))
    story.append(p(
        "Le systeme envoie des notifications in-app a deux audiences distinctes :"
    ))
    story.append(spacer(4))

    notif_data = [
        [p("Evenement", style_table_header), p("Admins/Managers", style_table_header), p("Proprietaire", style_table_header)],
        [p("Payout genere", style_table_cell), p("PAYOUT_PENDING_APPROVAL", style_table_cell), p("-", style_table_cell)],
        [p("Payout approuve", style_table_cell), p("PAYOUT_APPROVED", style_table_cell), p("PAYOUT_APPROVED", style_table_cell)],
        [p("Payout execute", style_table_cell), p("PAYOUT_EXECUTED", style_table_cell), p("PAYOUT_EXECUTED (avec ref.)", style_table_cell)],
        [p("SEPA en attente", style_table_cell), p("PAYOUT_PENDING_APPROVAL", style_table_cell), p("-", style_table_cell)],
        [p("Echec execution", style_table_cell), p("PAYOUT_FAILED", style_table_cell), p("PAYOUT_FAILED", style_table_cell)],
    ]
    story.append(make_table(notif_data, col_widths=[4 * cm, 6.5 * cm, 6.5 * cm]))
    story.append(spacer(4))
    story.append(note(
        "Les notifications proprietaire utilisent <font name='Courier'>NotificationService.sendByOrgId()</font> "
        "avec le keycloakId du proprietaire, ce qui fonctionne meme sans TenantContext (depuis les schedulers)."
    ))

    # 3.5
    story.append(h2("3.5 Dashboard et KPIs"))
    story.append(bullet("Compteur <b>'Reversements en attente'</b> dans la section Action Counters du dashboard"))
    story.append(bullet("Couleur : <font color='#8B7EC8'>#8B7EC8</font> (violet)"))
    story.append(bullet("Clic : navigation vers <font name='Courier'>/billing?tab=3</font>"))
    story.append(bullet("Endpoint : <font name='Courier'>GET /api/accounting/payouts/pending-count</font>"))

    # 3.6
    story.append(h2("3.6 Exports comptables"))
    story.append(bullet("<b>FEC</b> : Fichier des Ecritures Comptables (norme DGFiP, tab-separated)"))
    story.append(bullet("<b>CSV Payouts</b> : reversements avec commissions et depenses"))
    story.append(bullet("<b>CSV Depenses</b> : depenses prestataires avec montants HT/TTC/TVA"))
    story.append(bullet("<b>CSV Factures</b> : toutes les factures sur la periode"))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  4. PHASE 2
    # ═══════════════════════════════════════════════════════════════════════

    story.append(h1("4. Phase 2 - Execution des reversements"))
    story.append(hr())

    # 4.1
    story.append(h2("4.1 Configuration proprietaire (OwnerPayoutConfig)"))
    story.append(p(
        "Chaque proprietaire dispose d'une configuration de paiement stockee dans la table "
        "<font name='Courier'>owner_payout_config</font>. Cette configuration determine "
        "comment le reversement sera execute."
    ))
    story.append(spacer(4))

    config_data = [
        [p("Champ", style_table_header), p("Type", style_table_header), p("Description", style_table_header)],
        [p("payoutMethod", style_table_cell_code), p("ENUM", style_table_cell), p("MANUAL | STRIPE_CONNECT | SEPA_TRANSFER", style_table_cell)],
        [p("stripeConnectedAccountId", style_table_cell_code), p("VARCHAR", style_table_cell), p("ID du compte Stripe Express connecte", style_table_cell)],
        [p("stripeOnboardingComplete", style_table_cell_code), p("BOOLEAN", style_table_cell), p("True quand l'onboarding Stripe est termine", style_table_cell)],
        [p("iban", style_table_cell_code), p("VARCHAR(512)", style_table_cell), p("IBAN chiffre AES-256 (EncryptedFieldConverter)", style_table_cell)],
        [p("bic", style_table_cell_code), p("VARCHAR(20)", style_table_cell), p("Code BIC/SWIFT de la banque", style_table_cell)],
        [p("bankAccountHolder", style_table_cell_code), p("VARCHAR", style_table_cell), p("Nom du titulaire du compte bancaire", style_table_cell)],
        [p("verified", style_table_cell_code), p("BOOLEAN", style_table_cell), p("Validation manuelle par SUPER_ADMIN", style_table_cell)],
    ]
    story.append(make_table(config_data, col_widths=[5 * cm, 3 * cm, 9 * cm]))
    story.append(spacer(8))

    story.append(h3("Securite des donnees bancaires"))
    story.append(bullet("<b>Chiffrement</b> : l'IBAN est chiffre en AES-256 via <font name='Courier'>@Convert(converter = EncryptedFieldConverter.class)</font>"))
    story.append(bullet("<b>Masquage API</b> : le DTO renvoie <font name='Courier'>****XXXX</font> (4 derniers caracteres)"))
    story.append(bullet("<b>Validation</b> : regex serveur <font name='Courier'>^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$</font>"))
    story.append(bullet("<b>Verification</b> : un SUPER_ADMIN doit valider la config avant toute execution"))

    # 4.2
    story.append(h2("4.2 Stripe Connect"))
    story.append(p(
        "Stripe Connect permet d'executer des transferts automatiques vers les comptes bancaires "
        "des proprietaires, sans manipulation manuelle."
    ))
    story.append(spacer(4))

    story.append(h3("Flux d'onboarding"))
    story.append(code(
        "1. Admin cree un compte Express -> Account.create(type=EXPRESS, country=FR)\n"
        "2. Generation du lien onboarding -> AccountLink.create(type=ACCOUNT_ONBOARDING)\n"
        "3. Proprietaire complete l'onboarding sur Stripe\n"
        "4. Webhook account.updated -> stripeOnboardingComplete = true, verified = true"
    ))
    story.append(spacer(8))

    story.append(h3("Flux de transfert"))
    story.append(code(
        "1. Admin clique 'Executer le virement' sur un payout APPROVED\n"
        "2. PayoutExecutionService charge la config proprietaire\n"
        "3. Switch STRIPE_CONNECT -> StripeConnectService.createTransfer()\n"
        "4. Transfer.create(amount=centimes, currency, destination=acct_xxx)\n"
        "5. Statut passe a PAID, stripeTransferId stocke\n"
        "6. Notifications envoyes (admin + proprietaire)"
    ))
    story.append(spacer(8))

    story.append(h3("Webhooks Stripe Connect"))
    stripe_wh_data = [
        [p("Evenement", style_table_header), p("Handler", style_table_header), p("Action", style_table_header)],
        [p("account.updated", style_table_cell_code), p("handleAccountUpdated()", style_table_cell),
         p("Met a jour stripeOnboardingComplete et verified", style_table_cell)],
        [p("transfer.failed", style_table_cell_code), p("handleTransferFailed()", style_table_cell),
         p("Logging de l'echec (traitement deja fait cote execution)", style_table_cell)],
    ]
    story.append(make_table(stripe_wh_data, col_widths=[4.5 * cm, 5 * cm, 7.5 * cm]))
    story.append(spacer(4))
    story.append(note(
        "Tous les appels Stripe sont proteges par un circuit breaker Resilience4j "
        "(<font name='Courier'>@CircuitBreaker(name=\"stripe-api\")</font>) "
        "pour eviter les cascades d'echecs en cas d'indisponibilite Stripe."
    ))

    # 4.3
    story.append(h2("4.3 Virement SEPA"))
    story.append(p(
        "Pour les proprietaires en virement SEPA, le workflow est semi-automatique :"
    ))
    story.append(spacer(4))
    story.append(code(
        "1. Proprietaire ou admin saisit IBAN / BIC / Titulaire\n"
        "2. Validation regex + chiffrement AES-256 en base\n"
        "3. SUPER_ADMIN verifie la config (bouton 'Verifier')\n"
        "4. Admin clique 'Executer' -> statut passe a PROCESSING\n"
        "5. Notification envoyee a l'admin : 'Virement SEPA a effectuer'\n"
        "6. Admin effectue le virement bancaire manuellement\n"
        "7. Admin clique 'Marquer comme paye' avec reference bancaire\n"
        "8. Statut passe a PAID, notifications envoyes"
    ))

    story.append(PageBreak())

    # 4.4
    story.append(h2("4.4 Service d'execution (PayoutExecutionService)"))
    story.append(p(
        "Le service d'execution orchestre le paiement selon la methode configuree du proprietaire."
    ))
    story.append(spacer(4))

    exec_text = """
<font name="Courier" size="8">
executePayout(payoutId, orgId):
  |
  +-- Charger OwnerPayout (doit etre APPROVED)
  +-- Charger OwnerPayoutConfig (doit etre verified)
  |
  +-- switch (config.payoutMethod):
  |     |
  |     +-- STRIPE_CONNECT:
  |     |     1. Statut -> PROCESSING
  |     |     2. StripeConnectService.createTransfer(netAmount, currency, accountId)
  |     |     3. Stocker stripeTransferId
  |     |     4. Statut -> PAID + paidAt = now()
  |     |     5. Notifier succes (admins + proprietaire)
  |     |
  |     +-- SEPA_TRANSFER:
  |     |     1. Statut -> PROCESSING
  |     |     2. Notifier admin "Virement SEPA a effectuer"
  |     |     3. (Admin effectue le virement manuellement)
  |     |
  |     +-- MANUAL:
  |           -> IllegalStateException("Manual payouts cannot be auto-executed")
  |
  +-- En cas d'exception:
        1. Statut -> FAILED
        2. failureReason = e.getMessage()
        3. retryCount++
        4. Notifier echec (admins + proprietaire)
</font>"""
    story.append(p(exec_text, ParagraphStyle("Exec", parent=style_code, fontSize=8, leading=11)))

    # 4.5
    story.append(h2("4.5 Mecanisme de retry"))
    story.append(p(
        "Les payouts en echec peuvent etre relances jusqu'a 3 fois maximum."
    ))
    story.append(spacer(4))
    story.append(code(
        "retryPayout(payoutId, orgId):\n"
        "  1. Verifier statut == FAILED\n"
        "  2. Verifier retryCount < MAX_RETRY_COUNT (3)\n"
        "  3. Reset statut -> APPROVED, failureReason -> null\n"
        "  4. Appeler executePayout(payoutId, orgId)"
    ))
    story.append(spacer(4))
    story.append(note(
        "Apres 3 echecs, le payout reste en FAILED de maniere definitive. "
        "Les admins et le proprietaire recoivent une notification PAYOUT_FAILED a chaque tentative."
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  5. API REFERENCE
    # ═══════════════════════════════════════════════════════════════════════

    story.append(h1("5. API Reference"))
    story.append(hr())

    story.append(h3("Endpoints Comptabilite (AccountingController)"))
    api_data = [
        [p("Methode", style_table_header), p("Endpoint", style_table_header), p("Role", style_table_header), p("Description", style_table_header)],
        [p("GET", style_table_cell), p("/api/accounting/payouts", style_table_cell_code), p("Auth", style_table_cell), p("Liste des payouts (filtres: ownerId, status)", style_table_cell)],
        [p("GET", style_table_cell), p("/api/accounting/payouts/{id}", style_table_cell_code), p("Auth", style_table_cell), p("Detail d'un payout", style_table_cell)],
        [p("POST", style_table_cell), p("/api/accounting/payouts/generate", style_table_cell_code), p("Auth", style_table_cell), p("Generer un payout (ownerId, from, to)", style_table_cell)],
        [p("PUT", style_table_cell), p("/api/accounting/payouts/{id}/approve", style_table_cell_code), p("Auth", style_table_cell), p("Approuver un payout PENDING", style_table_cell)],
        [p("PUT", style_table_cell), p("/api/accounting/payouts/{id}/pay", style_table_cell_code), p("Auth", style_table_cell), p("Marquer un payout comme paye", style_table_cell)],
        [p("POST", style_table_cell), p("/api/accounting/payouts/{id}/execute", style_table_cell_code), p("ADMIN / MGR", style_table_cell), p("Executer le virement (Stripe/SEPA)", style_table_cell)],
        [p("POST", style_table_cell), p("/api/accounting/payouts/{id}/retry", style_table_cell_code), p("ADMIN / MGR", style_table_cell), p("Relancer un payout FAILED", style_table_cell)],
        [p("GET", style_table_cell), p("/api/accounting/payouts/pending-count", style_table_cell_code), p("Auth", style_table_cell), p("Nombre + montant des payouts en attente", style_table_cell)],
    ]
    story.append(make_table(api_data, col_widths=[1.8 * cm, 6.8 * cm, 2.8 * cm, 5.6 * cm]))

    story.append(spacer(12))
    story.append(h3("Endpoints Configuration (OwnerPayoutConfigController)"))
    config_api_data = [
        [p("Methode", style_table_header), p("Endpoint", style_table_header), p("Role", style_table_header), p("Description", style_table_header)],
        [p("GET", style_table_cell), p("/api/owner-payout-config/{ownerId}", style_table_cell_code), p("Auth", style_table_cell), p("Lire la config d'un proprietaire", style_table_cell)],
        [p("GET", style_table_cell), p("/api/owner-payout-config", style_table_cell_code), p("Auth", style_table_cell), p("Lister toutes les configs (org)", style_table_cell)],
        [p("PUT", style_table_cell), p("/api/owner-payout-config/{ownerId}/method", style_table_cell_code), p("Auth", style_table_cell), p("Changer la methode de paiement", style_table_cell)],
        [p("PUT", style_table_cell), p("/api/owner-payout-config/{ownerId}/sepa", style_table_cell_code), p("Auth", style_table_cell), p("Saisir IBAN/BIC/titulaire", style_table_cell)],
        [p("PUT", style_table_cell), p("/api/owner-payout-config/{ownerId}/verify", style_table_cell_code), p("SUPER_ADMIN", style_table_cell), p("Verifier la configuration", style_table_cell)],
    ]
    story.append(make_table(config_api_data, col_widths=[1.8 * cm, 7.5 * cm, 3 * cm, 4.7 * cm]))

    story.append(spacer(12))
    story.append(h3("Endpoints Webhook (StripeWebhookController)"))
    story.append(p("Endpoint : <font name='Courier'>POST /api/webhooks/stripe</font> (public, signature verification)"))
    wh_data = [
        [p("Evenement Stripe", style_table_header), p("Handler", style_table_header)],
        [p("checkout.session.completed", style_table_cell_code), p("handleCheckoutCompleted()", style_table_cell)],
        [p("payment_intent.succeeded", style_table_cell_code), p("handlePaymentIntentSucceeded()", style_table_cell)],
        [p("payment_intent.payment_failed", style_table_cell_code), p("handlePaymentIntentFailed()", style_table_cell)],
        [p("account.updated", style_table_cell_code), p("handleAccountUpdated() [Connect]", style_table_cell)],
        [p("transfer.failed", style_table_cell_code), p("handleTransferFailed() [Connect]", style_table_cell)],
    ]
    story.append(make_table(wh_data, col_widths=[7 * cm, 10 * cm]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  6. SECURITE
    # ═══════════════════════════════════════════════════════════════════════

    story.append(h1("6. Securite"))
    story.append(hr())

    sec_data = [
        [p("Mesure", style_table_header), p("Implementation", style_table_header)],
        [p("Authentification", style_table_cell), p("@PreAuthorize('isAuthenticated()') sur tous les controllers metier", style_table_cell)],
        [p("Autorisation execute/retry", style_table_cell), p("@PreAuthorize(\"hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')\") sur execute et retry", style_table_cell)],
        [p("Autorisation verify", style_table_cell), p("@PreAuthorize(\"hasAnyRole('SUPER_ADMIN')\") sur la verification de config", style_table_cell)],
        [p("Chiffrement IBAN", style_table_cell), p("AES-256 via EncryptedFieldConverter (Jasypt), meme pattern que User.email", style_table_cell)],
        [p("Masquage IBAN", style_table_cell), p("DTO renvoie ****XXXX (4 derniers caracteres uniquement)", style_table_cell)],
        [p("Webhook Stripe", style_table_cell), p("Verification de signature via Webhook.constructEvent(payload, sig, secret)", style_table_cell)],
        [p("Multi-tenant", style_table_cell), p("@Filter organizationFilter + orgId explicite dans toutes les queries", style_table_cell)],
        [p("Circuit breaker", style_table_cell), p("@CircuitBreaker(name='stripe-api') sur tous les appels Stripe", style_table_cell)],
        [p("Validation IBAN", style_table_cell), p("Regex serveur : ^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$", style_table_cell)],
    ]
    story.append(make_table(sec_data, col_widths=[5 * cm, 12 * cm]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  7. BASE DE DONNEES
    # ═══════════════════════════════════════════════════════════════════════

    story.append(h1("7. Base de donnees"))
    story.append(hr())

    story.append(h3("Migration : 0084__owner_payout_config.sql"))
    story.append(spacer(4))
    story.append(code(
        "CREATE TABLE IF NOT EXISTS owner_payout_config (\n"
        "    id                           BIGSERIAL PRIMARY KEY,\n"
        "    organization_id              BIGINT NOT NULL,\n"
        "    owner_id                     BIGINT NOT NULL REFERENCES users(id),\n"
        "    payout_method                VARCHAR(20) NOT NULL DEFAULT 'MANUAL',\n"
        "    stripe_connected_account_id  VARCHAR(255),\n"
        "    stripe_onboarding_complete   BOOLEAN NOT NULL DEFAULT false,\n"
        "    iban                         VARCHAR(512),  -- Chiffre AES-256\n"
        "    bic                          VARCHAR(20),\n"
        "    bank_account_holder          VARCHAR(255),\n"
        "    verified                     BOOLEAN NOT NULL DEFAULT false,\n"
        "    created_at                   TIMESTAMPTZ DEFAULT NOW(),\n"
        "    updated_at                   TIMESTAMPTZ DEFAULT NOW(),\n"
        "    UNIQUE(organization_id, owner_id)\n"
        ");\n"
        "\n"
        "-- Extensions sur owner_payouts\n"
        "ALTER TABLE owner_payouts ADD COLUMN IF NOT EXISTS payout_method VARCHAR(20);\n"
        "ALTER TABLE owner_payouts ADD COLUMN IF NOT EXISTS stripe_transfer_id VARCHAR(255);"
    ))

    story.append(spacer(12))
    story.append(h3("Schema relationnel"))
    story.append(spacer(4))

    schema_text = """
<font name="Courier" size="8">
+-------------------+         +-------------------------+
|   users           |         |  owner_payout_config    |
+-------------------+         +-------------------------+
| id           (PK) |<--------| owner_id        (FK)    |
| email             |         | organization_id         |
| keycloak_id       |         | payout_method           |
| ...               |         | stripe_connected_acct   |
+-------------------+         | iban (chiffre)          |
        |                     | bic                     |
        |                     | verified                |
        |                     +-------------------------+
        |
        |         +-------------------------+
        +-------->|  owner_payouts          |
                  +-------------------------+
                  | id               (PK)   |
                  | organization_id         |
                  | owner_id         (FK)   |
                  | period_start            |
                  | period_end              |
                  | gross_revenue           |
                  | commission_rate/amount  |
                  | expenses                |
                  | net_amount              |
                  | status                  |
                  | payout_method    (NEW)  |
                  | stripe_transfer_id(NEW) |
                  | payment_reference       |
                  | paid_at                 |
                  | failure_reason          |
                  | retry_count             |
                  +-------------------------+
</font>"""
    story.append(p(schema_text, ParagraphStyle("Schema", parent=style_code, fontSize=8, leading=11)))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  8. INTERFACE UTILISATEUR
    # ═══════════════════════════════════════════════════════════════════════

    story.append(h1("8. Interface utilisateur"))
    story.append(hr())

    story.append(h2("8.1 Page Comptabilite (AccountingPage)"))
    story.append(p(
        "La page principale de comptabilite comprend 5 onglets : Payouts, Commissions, "
        "Depenses, Rapport fiscal, Exports."
    ))
    story.append(spacer(4))
    story.append(h3("Onglet Payouts - Actions par statut"))

    ui_actions = [
        [p("Statut", style_table_header), p("Bouton", style_table_header), p("Action", style_table_header), p("Icone", style_table_header)],
        [p("PENDING", style_table_cell), p("Approuver", style_table_cell), p("approvePayout(id)", style_table_cell_code), p("CheckCircle (bleu)", style_table_cell)],
        [p("APPROVED", style_table_cell), p("Executer le virement", style_table_cell), p("executePayout(id)", style_table_cell_code), p("AccountBalance (bleu)", style_table_cell)],
        [p("APPROVED", style_table_cell), p("Marquer paye", style_table_cell), p("markAsPaid(id, ref)", style_table_cell_code), p("Payment (vert)", style_table_cell)],
        [p("PROCESSING", style_table_cell), p("Chip 'En cours...'", style_table_cell), p("-", style_table_cell), p("Chip outlined", style_table_cell)],
        [p("FAILED", style_table_cell), p("Relancer", style_table_cell), p("retryPayout(id)", style_table_cell_code), p("Build (orange)", style_table_cell)],
        [p("PAID", style_table_cell), p("Reference affichee", style_table_cell), p("-", style_table_cell), p("Tooltip ref.", style_table_cell)],
    ]
    story.append(make_table(ui_actions, col_widths=[3 * cm, 4.5 * cm, 5 * cm, 4.5 * cm]))

    story.append(spacer(12))
    story.append(h2("8.2 Parametres Reversements (Settings, tab 8)"))
    story.append(p("Accessible uniquement aux <b>SUPER_ADMIN</b>, l'onglet 'Reversements' contient :"))
    story.append(spacer(4))
    story.append(p("<b>Section 1 : Calendrier de reversement (PayoutScheduleSettings)</b>"))
    story.append(bullet("Toggle activation/desactivation de la generation automatique"))
    story.append(bullet("Selection des jours du mois (chips cliquables, 1-28)"))
    story.append(bullet("Configuration du delai de rappel (grace period)"))
    story.append(spacer(4))
    story.append(p("<b>Section 2 : Configuration proprietaires (OwnerPayoutSettings)</b>"))
    story.append(bullet("Tableau listant toutes les configs proprietaires de l'organisation"))
    story.append(bullet("Colonnes : Proprietaire, Methode (Chip colore), Details, Statut, Actions"))
    story.append(bullet("Badge 'Verifie' (vert) ou 'En attente' (orange)"))
    story.append(bullet("Bouton 'Modifier SEPA' : ouvre un dialog avec champs IBAN/BIC/Titulaire"))
    story.append(bullet("Bouton 'Verifier' (CheckCircle vert) : valide la configuration"))

    story.append(spacer(12))
    story.append(h2("8.3 Hooks React (TanStack Query)"))

    hooks_data = [
        [p("Hook", style_table_header), p("Type", style_table_header), p("Usage", style_table_header)],
        [p("usePayouts()", style_table_cell_code), p("Query", style_table_cell), p("Liste des payouts avec filtres", style_table_cell)],
        [p("useExecutePayout()", style_table_cell_code), p("Mutation", style_table_cell), p("Executer un virement", style_table_cell)],
        [p("useRetryPayout()", style_table_cell_code), p("Mutation", style_table_cell), p("Relancer un payout echoue", style_table_cell)],
        [p("useOwnerPayoutConfig(ownerId)", style_table_cell_code), p("Query", style_table_cell), p("Config d'un proprietaire", style_table_cell)],
        [p("useAllOwnerPayoutConfigs()", style_table_cell_code), p("Query", style_table_cell), p("Toutes les configs (org)", style_table_cell)],
        [p("useUpdatePayoutMethod()", style_table_cell_code), p("Mutation", style_table_cell), p("Changer la methode", style_table_cell)],
        [p("useUpdateSepaDetails()", style_table_cell_code), p("Mutation", style_table_cell), p("Modifier IBAN/BIC/titulaire", style_table_cell)],
        [p("useVerifyOwnerConfig()", style_table_cell_code), p("Mutation", style_table_cell), p("Verifier une config", style_table_cell)],
    ]
    story.append(make_table(hooks_data, col_widths=[6 * cm, 2.5 * cm, 8.5 * cm]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    #  9. INTERNATIONALISATION
    # ═══════════════════════════════════════════════════════════════════════

    story.append(h1("9. Internationalisation"))
    story.append(hr())
    story.append(p(
        "L'ensemble des textes de l'interface est traduit en 3 langues via les fichiers i18n :"
    ))
    story.append(spacer(4))

    i18n_data = [
        [p("Fichier", style_table_header), p("Langue", style_table_header), p("Cles ajoutees", style_table_header)],
        [p("fr.json", style_table_cell), p("Francais", style_table_cell), p("settings.ownerPayout.*, accounting.executePayout, .executeSuccess, .retrySuccess, .processing, .failedPayout", style_table_cell)],
        [p("en.json", style_table_cell), p("Anglais", style_table_cell), p("Memes cles, traductions anglaises", style_table_cell)],
        [p("ar.json", style_table_cell), p("Arabe", style_table_cell), p("Memes cles, traductions arabes (RTL)", style_table_cell)],
    ]
    story.append(make_table(i18n_data, col_widths=[3 * cm, 3 * cm, 11 * cm]))

    story.append(spacer(20))
    story.append(hr())
    story.append(spacer(8))

    # Closing note
    story.append(p(
        "<i>Ce document a ete genere automatiquement a partir de la codebase Clenzy PMS. "
        f"Derniere mise a jour : {datetime.now().strftime('%d/%m/%Y %H:%M')}.</i>",
        ParagraphStyle("Closing", parent=style_body, textColor=CLENZY_DARK_GRAY, fontSize=9),
    ))

    # ─── Build ───────────────────────────────────────────────────────────
    doc.build(story)
    return OUTPUT_PATH


if __name__ == "__main__":
    path = build()
    print(f"PDF generated: {path}")
