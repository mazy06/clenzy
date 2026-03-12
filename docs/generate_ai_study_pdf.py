#!/usr/bin/env python3
"""
Clenzy - Etude Complete IA : Tarification, Consommation & Strategie
Generateur PDF professionnel avec graphiques
"""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black, Color
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, KeepTogether, HRFlowable
)
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.legends import Legend

# ─── Colors ────────────────────────────────────────────────────────────────
CLENZY_PRIMARY = HexColor('#1A1A2E')
CLENZY_ACCENT = HexColor('#4F46E5')
CLENZY_LIGHT = HexColor('#EEF2FF')
OPENAI_GREEN = HexColor('#10A37F')
CLAUDE_TERRA = HexColor('#DA7756')
GRAY_100 = HexColor('#F3F4F6')
GRAY_200 = HexColor('#E5E7EB')
GRAY_300 = HexColor('#D1D5DB')
GRAY_500 = HexColor('#6B7280')
GRAY_600 = HexColor('#4B5563')
GRAY_700 = HexColor('#374151')
GRAY_800 = HexColor('#1F2937')
SUCCESS = HexColor('#059669')
WARNING = HexColor('#D97706')
DANGER = HexColor('#DC2626')
INFO_BLUE = HexColor('#2563EB')
WHITE = white
BLACK = black

# ─── Setup ─────────────────────────────────────────────────────────────────
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "Clenzy_Etude_IA_2026.pdf")

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle(
    'CoverTitle', parent=styles['Title'],
    fontSize=32, leading=38, textColor=WHITE, alignment=TA_LEFT,
    fontName='Helvetica-Bold', spaceAfter=8
))
styles.add(ParagraphStyle(
    'CoverSubtitle', parent=styles['Normal'],
    fontSize=14, leading=18, textColor=HexColor('#C7D2FE'), alignment=TA_LEFT,
    fontName='Helvetica', spaceAfter=4
))
styles.add(ParagraphStyle(
    'SectionTitle', parent=styles['Heading1'],
    fontSize=20, leading=26, textColor=CLENZY_PRIMARY,
    fontName='Helvetica-Bold', spaceBefore=24, spaceAfter=12,
    borderPadding=(0, 0, 4, 0)
))
styles.add(ParagraphStyle(
    'SubSection', parent=styles['Heading2'],
    fontSize=14, leading=18, textColor=CLENZY_ACCENT,
    fontName='Helvetica-Bold', spaceBefore=16, spaceAfter=8
))
styles.add(ParagraphStyle(
    'SubSubSection', parent=styles['Heading3'],
    fontSize=12, leading=15, textColor=GRAY_700,
    fontName='Helvetica-Bold', spaceBefore=12, spaceAfter=6
))
styles['BodyText'].fontSize = 10
styles['BodyText'].leading = 14.5
styles['BodyText'].textColor = GRAY_700
styles['BodyText'].fontName = 'Helvetica'
styles['BodyText'].spaceAfter = 8
styles['BodyText'].alignment = TA_JUSTIFY
styles.add(ParagraphStyle(
    'BodyBold', parent=styles['Normal'],
    fontSize=10, leading=14.5, textColor=GRAY_800,
    fontName='Helvetica-Bold', spaceAfter=6
))
styles.add(ParagraphStyle(
    'SmallText', parent=styles['Normal'],
    fontSize=8.5, leading=11, textColor=GRAY_500,
    fontName='Helvetica', spaceAfter=4
))
styles.add(ParagraphStyle(
    'BulletText', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=GRAY_700,
    fontName='Helvetica', spaceAfter=4, leftIndent=16,
    bulletIndent=4, bulletFontSize=10
))
styles.add(ParagraphStyle(
    'TableHeader', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=WHITE,
    fontName='Helvetica-Bold', alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'TableCell', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=GRAY_700,
    fontName='Helvetica', alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'TableCellLeft', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=GRAY_700,
    fontName='Helvetica', alignment=TA_LEFT
))
styles.add(ParagraphStyle(
    'TableCellBold', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=GRAY_800,
    fontName='Helvetica-Bold', alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'KPI', parent=styles['Normal'],
    fontSize=22, leading=26, textColor=CLENZY_ACCENT,
    fontName='Helvetica-Bold', alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'KPILabel', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=GRAY_500,
    fontName='Helvetica', alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'FooterStyle', parent=styles['Normal'],
    fontSize=8, leading=10, textColor=GRAY_500,
    fontName='Helvetica', alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'InfoBox', parent=styles['Normal'],
    fontSize=9.5, leading=13, textColor=GRAY_700,
    fontName='Helvetica', spaceAfter=6,
    leftIndent=12, rightIndent=12, borderPadding=8
))

# ─── Helper Functions ──────────────────────────────────────────────────────

def make_table(headers, rows, col_widths=None, header_color=CLENZY_ACCENT):
    """Create a professional styled table."""
    h = [Paragraph(h, styles['TableHeader']) for h in headers]
    data = [h]
    for row in rows:
        data.append([
            Paragraph(str(c), styles['TableCell']) if not isinstance(c, Paragraph) else c
            for c in row
        ])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), header_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY_200),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, header_color),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY_100]),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]
    t.setStyle(TableStyle(style_cmds))
    return t


def make_kpi_row(kpis, total_width=170*mm):
    """Create a row of KPI cards. kpis = [(value, label, color), ...]"""
    n = len(kpis)
    w = total_width / n
    cards = []
    for val, label, color in kpis:
        cards.append([
            Paragraph(str(val), ParagraphStyle(
                'kpi_val', parent=styles['KPI'], textColor=color
            )),
            Paragraph(label, styles['KPILabel'])
        ])

    data = [cards]
    t = Table(data, colWidths=[w]*n)
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BOX', (0, 0), (0, 0), 0.5, GRAY_200),
        ('BOX', (1, 0), (1, 0), 0.5, GRAY_200),
        ('BOX', (2, 0), (2, 0), 0.5, GRAY_200) if n > 2 else ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), WHITE),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    return t


def make_info_box(text, color=INFO_BLUE):
    """Create a colored info/tip box."""
    data = [[Paragraph(text, styles['InfoBox'])]]
    t = Table(data, colWidths=[170*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#F0F4FF')),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LINEBEFOREDECORATEDWIDTH', (0, 0), (0, -1), 3),
        ('LINEBEFORE', (0, 0), (0, -1), 3, color),
        ('ROUNDEDCORNERS', [0, 6, 6, 0]),
    ]))
    return t


def make_chart_image(fig, width=160*mm, height=90*mm):
    """Convert matplotlib figure to ReportLab Image."""
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    return Image(buf, width=width, height=height)


def section_divider():
    return HRFlowable(width="100%", thickness=1, color=GRAY_200,
                      spaceBefore=6, spaceAfter=12)


# ─── Chart Generators ──────────────────────────────────────────────────────

def chart_token_repartition():
    """Pie chart: token consumption by feature."""
    fig, ax = plt.subplots(figsize=(7, 4))
    labels = ['Messaging\n60K', 'Design\n25K', 'Pricing\n18K',
              'Sentiment\n15K', 'Analytics\n4K']
    sizes = [60, 25, 18, 15, 4]
    colors_list = ['#4F46E5', '#10A37F', '#DA7756', '#D97706', '#6B7280']
    explode = (0.05, 0, 0, 0, 0)

    wedges, texts, autotexts = ax.pie(
        sizes, explode=explode, labels=labels, colors=colors_list,
        autopct='%1.0f%%', shadow=False, startangle=140,
        textprops={'fontsize': 9}, pctdistance=0.75
    )
    for at in autotexts:
        at.set_fontsize(8)
        at.set_color('white')
        at.set_fontweight('bold')

    ax.set_title('Repartition de la consommation tokens par feature\n(usage moyen, 1 propriete)',
                 fontsize=12, fontweight='bold', color='#1A1A2E', pad=15)
    fig.tight_layout()
    return make_chart_image(fig, width=155*mm, height=88*mm)


def chart_cost_comparison():
    """Bar chart: cost per account by model."""
    fig, ax = plt.subplots(figsize=(8, 4.2))
    models = ['GPT-4o mini', 'Claude Haiku', 'GPT-4o', 'Claude Sonnet', 'Claude Opus']
    costs_eur = [0.15, 1.20, 2.53, 3.60, 9.20]
    colors_list = ['#10A37F', '#DA7756', '#10A37F', '#DA7756', '#DA7756']

    bars = ax.barh(models, costs_eur, color=colors_list, height=0.55, edgecolor='white', linewidth=0.5)
    ax.set_xlabel('Cout par compte / mois (EUR)', fontsize=10, color='#374151')
    ax.set_title('Cout mensuel par compte (500K tokens)\npar modele LLM',
                 fontsize=12, fontweight='bold', color='#1A1A2E', pad=12)
    ax.set_xlim(0, max(costs_eur) * 1.25)
    ax.xaxis.set_major_formatter(mticker.FormatStrFormatter('%.2f EUR'))
    ax.tick_params(axis='both', labelsize=9, colors='#4B5563')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#E5E7EB')
    ax.spines['bottom'].set_color('#E5E7EB')
    ax.grid(axis='x', linestyle='--', alpha=0.3)

    for bar, cost in zip(bars, costs_eur):
        ax.text(bar.get_width() + 0.1, bar.get_y() + bar.get_height()/2,
                f'{cost:.2f} EUR', va='center', fontsize=9, fontweight='bold', color='#374151')

    fig.tight_layout()
    return make_chart_image(fig, width=160*mm, height=85*mm)


def chart_scaling_projection():
    """Line chart: monthly cost by number of accounts."""
    fig, ax = plt.subplots(figsize=(8, 4.5))
    accounts = [10, 25, 50, 100, 250, 500]

    # Costs per account (EUR)
    cost_mini = 0.15
    cost_4o = 2.53
    cost_sonnet = 3.60

    y_mini = [a * cost_mini for a in accounts]
    y_4o = [a * cost_4o for a in accounts]
    y_sonnet = [a * cost_sonnet for a in accounts]

    ax.plot(accounts, y_mini, 'o-', color='#10A37F', linewidth=2.5,
            markersize=6, label='GPT-4o mini (0.15 EUR/compte)')
    ax.plot(accounts, y_4o, 's-', color='#2563EB', linewidth=2.5,
            markersize=6, label='GPT-4o (2.53 EUR/compte)')
    ax.plot(accounts, y_sonnet, '^-', color='#DA7756', linewidth=2.5,
            markersize=6, label='Claude Sonnet (3.60 EUR/compte)')

    ax.fill_between(accounts, y_mini, alpha=0.08, color='#10A37F')
    ax.fill_between(accounts, y_4o, alpha=0.06, color='#2563EB')

    ax.set_xlabel('Nombre de comptes', fontsize=10, color='#374151')
    ax.set_ylabel('Cout mensuel total (EUR)', fontsize=10, color='#374151')
    ax.set_title('Projection des couts IA mensuels selon le nombre de comptes',
                 fontsize=12, fontweight='bold', color='#1A1A2E', pad=12)
    ax.legend(fontsize=9, loc='upper left')
    ax.tick_params(axis='both', labelsize=9, colors='#4B5563')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#E5E7EB')
    ax.spines['bottom'].set_color('#E5E7EB')
    ax.grid(axis='y', linestyle='--', alpha=0.3)
    ax.yaxis.set_major_formatter(mticker.FormatStrFormatter('%d EUR'))

    fig.tight_layout()
    return make_chart_image(fig, width=160*mm, height=90*mm)


def chart_budget_analysis():
    """Stacked bar: current budget vs recommended vs avg usage."""
    fig, ax = plt.subplots(figsize=(8, 4.2))
    features = ['Design', 'Pricing', 'Messaging', 'Analytics', 'Sentiment']
    current = [100, 100, 100, 100, 100]
    recommended = [50, 30, 200, 20, 100]
    avg_usage = [25, 18, 60, 4, 15]

    x = range(len(features))
    w = 0.25

    bars1 = ax.bar([i - w for i in x], current, w, label='Budget actuel (100K chacun)',
                   color='#E5E7EB', edgecolor='white')
    bars2 = ax.bar([i for i in x], recommended, w, label='Budget recommande',
                   color='#4F46E5', alpha=0.8, edgecolor='white')
    bars3 = ax.bar([i + w for i in x], avg_usage, w, label='Usage moyen reel',
                   color='#10A37F', alpha=0.8, edgecolor='white')

    ax.set_ylabel('Tokens (K)', fontsize=10, color='#374151')
    ax.set_title('Budget tokens : actuel vs recommande vs usage reel',
                 fontsize=12, fontweight='bold', color='#1A1A2E', pad=12)
    ax.set_xticks(x)
    ax.set_xticklabels(features, fontsize=10)
    ax.legend(fontsize=9, loc='upper right')
    ax.tick_params(axis='both', labelsize=9, colors='#4B5563')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#E5E7EB')
    ax.spines['bottom'].set_color('#E5E7EB')
    ax.grid(axis='y', linestyle='--', alpha=0.3)

    fig.tight_layout()
    return make_chart_image(fig, width=160*mm, height=85*mm)


def chart_monetization():
    """Stacked bar: subscription price vs AI cost for each plan."""
    fig, ax = plt.subplots(figsize=(7.5, 4))
    plans = ['Starter\n(29 EUR)', 'Pro\n(79 EUR)', 'Business\n(199 EUR)', 'Enterprise\n(499 EUR)']
    sub_price = [29, 79, 199, 499]
    ai_cost_mini = [0.15, 0.45, 1.80, 9.00]
    ai_cost_sonnet = [3.60, 10.80, 43.20, 216.00]
    margin_mini = [p - c for p, c in zip(sub_price, ai_cost_mini)]
    margin_sonnet = [p - c for p, c in zip(sub_price, ai_cost_sonnet)]

    x = range(len(plans))
    w = 0.35

    ax.bar([i - w/2 for i in x], ai_cost_mini, w, label='Cout IA (GPT-4o mini)',
           color='#10A37F', alpha=0.9)
    ax.bar([i - w/2 for i in x], margin_mini, w, bottom=ai_cost_mini,
           label='Marge (GPT-4o mini)', color='#D1FAE5', alpha=0.9)
    ax.bar([i + w/2 for i in x], ai_cost_sonnet, w, label='Cout IA (Claude Sonnet)',
           color='#DA7756', alpha=0.9)
    ax.bar([i + w/2 for i in x], margin_sonnet, w, bottom=ai_cost_sonnet,
           label='Marge (Claude Sonnet)', color='#FED7AA', alpha=0.9)

    ax.set_xticks(x)
    ax.set_xticklabels(plans, fontsize=9)
    ax.set_ylabel('EUR / mois', fontsize=10, color='#374151')
    ax.set_title("Impact du cout IA sur la marge par plan d'abonnement",
                 fontsize=12, fontweight='bold', color='#1A1A2E', pad=12)
    ax.legend(fontsize=8, loc='upper left', ncol=2)
    ax.tick_params(axis='both', labelsize=9, colors='#4B5563')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.grid(axis='y', linestyle='--', alpha=0.3)

    fig.tight_layout()
    return make_chart_image(fig, width=158*mm, height=85*mm)


# ─── Page Templates ────────────────────────────────────────────────────────

def cover_page_bg(canvas_obj, doc):
    """Draw cover page background."""
    w, h = A4
    # Full background gradient (solid approximation)
    canvas_obj.setFillColor(CLENZY_PRIMARY)
    canvas_obj.rect(0, 0, w, h, fill=1, stroke=0)
    # Accent bar
    canvas_obj.setFillColor(CLENZY_ACCENT)
    canvas_obj.rect(0, h - 8*mm, w, 8*mm, fill=1, stroke=0)
    # Bottom strip
    canvas_obj.setFillColor(HexColor('#2D2D4E'))
    canvas_obj.rect(0, 0, w, 35*mm, fill=1, stroke=0)


def regular_page(canvas_obj, doc):
    """Header and footer for content pages."""
    w, h = A4
    # Header line
    canvas_obj.setStrokeColor(CLENZY_ACCENT)
    canvas_obj.setLineWidth(1.5)
    canvas_obj.line(20*mm, h - 18*mm, w - 20*mm, h - 18*mm)
    # Header text
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.setFillColor(GRAY_500)
    canvas_obj.drawString(20*mm, h - 16*mm, "Clenzy - Etude IA 2026")
    canvas_obj.drawRightString(w - 20*mm, h - 16*mm, "Confidentiel")
    # Footer
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.setFillColor(GRAY_500)
    canvas_obj.drawString(20*mm, 12*mm, "SinaTech SARL - Mars 2026")
    canvas_obj.drawRightString(w - 20*mm, 12*mm, f"Page {doc.page}")
    canvas_obj.setStrokeColor(GRAY_200)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(20*mm, 17*mm, w - 20*mm, 17*mm)


# ─── Build Document ────────────────────────────────────────────────────────

def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        topMargin=25*mm,
        bottomMargin=22*mm,
        leftMargin=20*mm,
        rightMargin=20*mm,
        title="Clenzy - Etude IA 2026",
        author="SinaTech SARL"
    )

    story = []
    W = 170*mm  # usable width

    # ═══════════════════════════════════════════════════════════════════════
    # COVER PAGE
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 55*mm))
    story.append(Paragraph("Etude Complete", styles['CoverTitle']))
    story.append(Paragraph("Intelligence Artificielle", styles['CoverTitle']))
    story.append(Spacer(1, 8*mm))
    story.append(Paragraph(
        "Tarification, Consommation & Strategie de Monetisation",
        styles['CoverSubtitle']
    ))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "Plateforme Clenzy - Property Management SaaS",
        styles['CoverSubtitle']
    ))
    story.append(Spacer(1, 25*mm))
    story.append(Paragraph("Version 1.0 - Mars 2026", ParagraphStyle(
        'cv', parent=styles['CoverSubtitle'], fontSize=11, textColor=HexColor('#94A3B8')
    )))
    story.append(Paragraph("SinaTech SARL", ParagraphStyle(
        'cv2', parent=styles['CoverSubtitle'], fontSize=11, textColor=HexColor('#94A3B8')
    )))
    story.append(Paragraph("Document confidentiel", ParagraphStyle(
        'cv3', parent=styles['CoverSubtitle'], fontSize=10, textColor=HexColor('#64748B')
    )))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # TABLE OF CONTENTS
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("Sommaire", styles['SectionTitle']))
    story.append(section_divider())

    toc_items = [
        ("1.", "Introduction et Contexte"),
        ("2.", "Architecture Technique IA"),
        ("3.", "Tarification API 2026 - OpenAI vs Anthropic"),
        ("4.", "Analyse Detaillee par Feature IA"),
        ("5.", "Estimation de Consommation Mensuelle"),
        ("6.", "Analyse du Budget Tokens"),
        ("7.", "Projections Financieres"),
        ("8.", "Strategie de Monetisation"),
        ("9.", "Optimisations et Bonnes Pratiques"),
        ("10.", "Recommandations et Conclusion"),
    ]
    for num, title in toc_items:
        story.append(Paragraph(
            f"<b>{num}</b>&nbsp;&nbsp;&nbsp;{title}",
            ParagraphStyle('toc_item', parent=styles['BodyText'],
                           fontSize=11, leading=20, spaceAfter=2)
        ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 1. INTRODUCTION
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("1. Introduction et Contexte", styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph(
        "<b>Clenzy</b> est une plateforme SaaS de gestion immobiliere (Property Management) "
        "destinee aux proprietaires, gestionnaires et agences de location courte et moyenne duree. "
        "La plateforme integre 5 modules d'intelligence artificielle qui assistent les utilisateurs "
        "dans leurs operations quotidiennes.",
        styles['BodyText']
    ))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("Les 5 Modules IA de Clenzy", styles['SubSection']))

    features_data = [
        ["Feature", "Description", "Menu"],
        ["DESIGN", "Extraction de design tokens depuis un site web\net generation CSS pour le moteur de reservation", "Booking Engine"],
        ["PRICING", "Recommandations de prix dynamiques basees\nsur l'historique, la saisonnalite et l'occupation", "Prix Dynamiques"],
        ["MESSAGING", "Detection d'intention des messages guests\net suggestion de reponses automatiques", "Contact"],
        ["ANALYTICS", "Analyses et insights IA sur les performances\ndes proprietes (occupation, revenus, tendances)", "Dashboard"],
        ["SENTIMENT", "Analyse de sentiment des avis clients\navec themes et recommandations d'action", "Avis"],
    ]
    story.append(make_table(
        features_data[0], features_data[1:],
        col_widths=[28*mm, 95*mm, 47*mm]
    ))

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("Objectif de cette etude", styles['SubSection']))
    story.append(Paragraph(
        "Ce document analyse en profondeur la consommation de tokens IA par utilisateur, "
        "compare les tarifications des providers (OpenAI et Anthropic), projette les couts "
        "a differentes echelles, et propose une strategie de monetisation viable pour "
        "integrer le cout de l'IA dans les abonnements Clenzy.",
        styles['BodyText']
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 2. ARCHITECTURE TECHNIQUE
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("2. Architecture Technique IA", styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph("Modele Hybride BYOK (Bring Your Own Key)", styles['SubSection']))
    story.append(Paragraph(
        "Clenzy implemente un modele hybride de gestion des cles API qui offre une flexibilite "
        "maximale. Chaque organisation peut soit utiliser la cle plateforme (mutualisee), "
        "soit configurer sa propre cle API (BYOK) pour un controle total de ses couts.",
        styles['BodyText']
    ))

    arch_data = [
        ["Composant", "Role", "Technologie"],
        ["AiKeyResolver", "Resolution de la cle API : org key > plateforme > erreur", "Spring Service"],
        ["KeySource", "Tracking de l'origine de la cle (PLATFORM vs ORGANIZATION)", "Enum Java"],
        ["AiTokenBudgetService", "Controle des budgets mensuels par feature", "Spring + JPA"],
        ["OrgAiApiKeyService", "CRUD + validation des cles API par organisation", "Spring + Jasypt"],
        ["OpenAiProvider", "Client REST pour l'API OpenAI (GPT-4o)", "RestClient"],
        ["AnthropicProvider", "Client REST pour l'API Anthropic (Claude)", "RestClient"],
    ]
    story.append(make_table(
        arch_data[0], arch_data[1:],
        col_widths=[42*mm, 85*mm, 43*mm]
    ))

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("Flux de Resolution des Cles", styles['SubSection']))
    story.append(make_info_box(
        "<b>Priorite de resolution :</b> "
        "1) Cle propre de l'organisation (BYOK) "
        "&#8594; 2) Cle plateforme partagee "
        "&#8594; 3) AiNotConfiguredException (pas de cle disponible)<br/><br/>"
        "Avantage BYOK : le client paie directement au provider, cout nul pour Clenzy."
    ))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("Suivi et Budget", styles['SubSection']))
    story.append(Paragraph(
        "Chaque appel IA est trace dans la table <b>ai_token_usage</b> avec : provider, modele, "
        "tokens prompt, tokens completion, feature, et source de la cle. Un budget mensuel "
        "par feature et par organisation permet de controler la consommation.",
        styles['BodyText']
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 3. TARIFICATION API 2026
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("3. Tarification API 2026", styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph("Comparatif OpenAI vs Anthropic", styles['SubSection']))
    story.append(Paragraph(
        "Les prix ci-dessous sont exprimes en dollars US par million de tokens (MTok). "
        "Taux de change applique : 1 USD = 0.92 EUR.",
        styles['BodyText']
    ))

    pricing_data = [
        ["Modele", "Provider", "Input\n($/MTok)", "Output\n($/MTok)", "Input\n(EUR/MTok)", "Output\n(EUR/MTok)"],
        [Paragraph("<b>GPT-4o mini</b>", styles['TableCellBold']), "OpenAI", "$0.15", "$0.60", "0.14 EUR", "0.55 EUR"],
        ["Claude Haiku 4.5", "Anthropic", "$1.00", "$5.00", "0.92 EUR", "4.60 EUR"],
        [Paragraph("<b>GPT-4o</b>", styles['TableCellBold']), "OpenAI", "$2.50", "$10.00", "2.30 EUR", "9.20 EUR"],
        [Paragraph("<b>Claude Sonnet 4.5</b>", styles['TableCellBold']), "Anthropic", "$3.00", "$15.00", "2.76 EUR", "13.80 EUR"],
        ["Claude Opus 4.6", "Anthropic", "$5.00", "$25.00", "4.60 EUR", "23.00 EUR"],
        ["GPT-4 Turbo", "OpenAI", "$10.00", "$30.00", "9.20 EUR", "27.60 EUR"],
    ]
    story.append(make_table(
        pricing_data[0], pricing_data[1:],
        col_widths=[35*mm, 25*mm, 22*mm, 22*mm, 28*mm, 28*mm]
    ))

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("Reductions Disponibles", styles['SubSection']))

    discounts = [
        ["Mecanisme", "Reduction", "Description"],
        ["Batch API", "- 50%", "Traitement asynchrone (delai jusqu'a 24h). Ideal pour analytics/sentiment."],
        ["Prompt Caching", "- 90%", "Cache les prompts systeme repetes. Duree : 5 min (1.25x) ou 1h (2x)."],
        ["Tokens comptes", "Gratuit", "Les tokens du prompt systeme ne sont factures qu'une fois avec le cache."],
    ]
    story.append(make_table(
        discounts[0], discounts[1:],
        col_widths=[35*mm, 25*mm, 110*mm]
    ))

    story.append(Spacer(1, 5*mm))
    story.append(make_info_box(
        "<b>Conseil :</b> Le Prompt Caching est particulierement efficace pour Clenzy car "
        "les prompts systeme sont identiques pour tous les utilisateurs d'une meme feature. "
        "Avec le cache, le cout reel peut etre <b>30-50% inferieur</b> aux prix catalogue."
    ))

    story.append(Spacer(1, 4*mm))
    story.append(chart_cost_comparison())

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 4. ANALYSE DETAILLEE PAR FEATURE
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("4. Analyse Detaillee par Feature IA", styles['SectionTitle']))
    story.append(section_divider())

    # -- DESIGN --
    story.append(Paragraph("4.1 DESIGN - Generation de CSS pour Booking Engine", styles['SubSection']))
    story.append(Paragraph(
        "Le module Design fonctionne en <b>deux etapes</b> : (1) extraction des design tokens "
        "depuis le site web du client via GPT-4o, puis (2) generation du CSS du widget de "
        "reservation via Claude Sonnet.",
        styles['BodyText']
    ))

    design_data = [
        ["Etape", "Modele", "Input tokens", "Output tokens", "Total"],
        ["Extraction tokens", "GPT-4o", "3 800 - 20 500", "500 - 800", "4 300 - 21 300"],
        ["Generation CSS", "Claude Sonnet", "750 - 1 250", "2 000 - 3 500", "2 750 - 4 650"],
        [Paragraph("<b>Total par appel</b>", styles['TableCellBold']), "-", "-", "-",
         Paragraph("<b>7 050 - 25 950</b>", styles['TableCellBold'])],
    ]
    story.append(make_table(
        design_data[0], design_data[1:],
        col_widths=[35*mm, 30*mm, 32*mm, 32*mm, 35*mm]
    ))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "<b>Declencheur :</b> Upload d'URL lors de la configuration du booking engine.<br/>"
        "<b>Frequence :</b> 1-3 fois/mois par propriete (setup initial + iterations).<br/>"
        "<b>Cache :</b> Oui, par hash du contenu HTML/CSS - evite les retraitements.",
        styles['BodyText']
    ))

    # -- PRICING --
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("4.2 PRICING - Recommandations de Prix Dynamiques", styles['SubSection']))
    story.append(Paragraph(
        "Le module Pricing analyse l'historique de reservations, le taux d'occupation "
        "et la saisonnalite pour generer des recommandations de prix sur une periode donnee.",
        styles['BodyText']
    ))

    pricing_detail = [
        ["Composant", "Taille estimee"],
        ["Prompt systeme", "~200 tokens"],
        ["Donnees propriete (occupation, revenus, historique)", "600 - 1 200 tokens"],
        ["Reponse (JSON, 1 recommandation/jour sur 30 jours)", "3 000 - 4 500 tokens"],
        [Paragraph("<b>Total par appel</b>", styles['TableCellBold']),
         Paragraph("<b>3 800 - 5 700 tokens</b>", styles['TableCellBold'])],
    ]
    story.append(make_table(
        pricing_detail[0], pricing_detail[1:],
        col_widths=[90*mm, 80*mm]
    ))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "<b>Declencheur :</b> Manuel, l'utilisateur demande une analyse.<br/>"
        "<b>Frequence :</b> 2-5 fois/mois par propriete.",
        styles['BodyText']
    ))

    # -- MESSAGING --
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("4.3 MESSAGING - Intent Detection & Reponses Automatiques", styles['SubSection']))
    story.append(Paragraph(
        "Le module Messaging est le <b>plus gros consommateur de tokens</b> car il est "
        "appele a chaque message guest entrant. Deux operations IA sont effectuees :",
        styles['BodyText']
    ))

    msg_data = [
        ["Operation", "Input tokens", "Output tokens", "Total/appel"],
        ["Detection d'intention", "250 - 550", "200 - 300", "450 - 850"],
        ["Suggestion de reponse", "330 - 680", "300 - 600", "630 - 1 280"],
        [Paragraph("<b>Total par message</b>", styles['TableCellBold']), "-", "-",
         Paragraph("<b>1 080 - 2 130</b>", styles['TableCellBold'])],
    ]
    story.append(make_table(
        msg_data[0], msg_data[1:],
        col_widths=[42*mm, 38*mm, 38*mm, 42*mm]
    ))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "<b>Declencheur :</b> Automatique a chaque message guest recu.<br/>"
        "<b>Frequence :</b> 20-50 messages/mois par propriete (40-100 appels IA).<br/>"
        "<b>Fallback :</b> Detection d'intention rule-based disponible (0 tokens).",
        styles['BodyText']
    ))

    # -- ANALYTICS --
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("4.4 ANALYTICS - Insights et Recommandations", styles['SubSection']))
    story.append(Paragraph(
        "Le module Analytics genere des insights a partir des metriques de performance "
        "(occupation, ADR, RevPAR, sources de reservation).<br/>"
        "<b>Total par appel :</b> 1 500 - 2 600 tokens | "
        "<b>Frequence :</b> 1-2 fois/mois | <b>Status :</b> Backend actif, UI en cours.",
        styles['BodyText']
    ))

    # -- SENTIMENT --
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("4.5 SENTIMENT - Analyse des Avis Clients", styles['SubSection']))
    story.append(Paragraph(
        "Le module Sentiment analyse les avis guests avec un score, des themes, "
        "et des recommandations d'action.<br/>"
        "<b>Total par appel :</b> 920 - 1 920 tokens | "
        "<b>Frequence :</b> 5-15 avis/mois | <b>Fallback :</b> Rule-based (0 tokens).",
        styles['BodyText']
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 5. ESTIMATION CONSOMMATION MENSUELLE
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("5. Estimation de Consommation Mensuelle", styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph("Consommation par propriete (tokens/mois)", styles['SubSection']))

    conso_data = [
        ["Feature", "Usage leger", "Usage moyen", "Usage intensif"],
        ["DESIGN", "7 000", "25 000", "75 000"],
        ["PRICING", "8 000", "18 000", "30 000"],
        ["MESSAGING", "30 000", "60 000", "120 000"],
        ["ANALYTICS", "1 500", "4 000", "10 000"],
        ["SENTIMENT", "5 000", "15 000", "30 000"],
        [Paragraph("<b>TOTAL / propriete</b>", styles['TableCellBold']),
         Paragraph("<b>51 500</b>", styles['TableCellBold']),
         Paragraph("<b>122 000</b>", styles['TableCellBold']),
         Paragraph("<b>265 000</b>", styles['TableCellBold'])],
    ]
    story.append(make_table(
        conso_data[0], conso_data[1:],
        col_widths=[42*mm, 42*mm, 42*mm, 42*mm]
    ))

    story.append(Spacer(1, 5*mm))
    story.append(chart_token_repartition())

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("Profils Utilisateurs Types", styles['SubSection']))

    profiles = [
        ["Profil", "Proprietes", "Tokens/mois", "Claude Sonnet", "GPT-4o", "GPT-4o mini"],
        ["Petit loueur", "1-2", "~80 000", "0.60 EUR", "0.42 EUR", "0.02 EUR"],
        ["Pro moyen", "3-5", "~250 000", "1.90 EUR", "1.30 EUR", "0.06 EUR"],
        ["Agence", "10-20", "~800 000", "6.00 EUR", "4.20 EUR", "0.18 EUR"],
        ["Grand groupe", "50+", "~3 000 000", "22.50 EUR", "15.75 EUR", "0.68 EUR"],
    ]
    story.append(make_table(
        profiles[0], profiles[1:],
        col_widths=[25*mm, 22*mm, 28*mm, 30*mm, 30*mm, 30*mm]
    ))

    story.append(Spacer(1, 4*mm))
    story.append(make_info_box(
        "<b>Constat cle :</b> Meme avec Claude Sonnet (le modele le plus qualitatif), "
        "le cout IA reste <b>inferieur a 6 EUR/mois</b> pour 90% des utilisateurs. "
        "Avec GPT-4o mini, le cout est quasi negligeable (<b>moins de 0.20 EUR/mois</b>)."
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 6. ANALYSE DU BUDGET TOKENS
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("6. Analyse du Budget Tokens", styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph("Budget Actuel : 500K tokens (100K par feature)", styles['SubSection']))

    budget_data = [
        ["Feature", "Budget actuel", "Usage moyen", "Taux\nd'utilisation", "Verdict"],
        ["DESIGN", "100 000", "25 000", "25%", "Surdimensionne"],
        ["PRICING", "100 000", "18 000", "18%", "Surdimensionne"],
        ["MESSAGING", "100 000", "60 000", "60%", "Risque de depassement"],
        ["ANALYTICS", "100 000", "4 000", "4%", "Tres surdimensionne"],
        ["SENTIMENT", "100 000", "15 000", "15%", "Suffisant"],
    ]
    story.append(make_table(
        budget_data[0], budget_data[1:],
        col_widths=[30*mm, 28*mm, 28*mm, 24*mm, 50*mm]
    ))

    story.append(Spacer(1, 5*mm))
    story.append(chart_budget_analysis())

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("Repartition Recommandee", styles['SubSection']))

    recom_data = [
        ["Feature", "Budget\nactuel", "Budget\nrecommande", "Variation", "Justification"],
        ["DESIGN", "100K", "50K", "-50%", "Cache actif, peu d'appels"],
        ["PRICING", "100K", "30K", "-70%", "Usage faible et previsible"],
        ["MESSAGING", "100K", "200K", "+100%", "Gros consommateur, critique"],
        ["ANALYTICS", "100K", "20K", "-80%", "Tres peu utilise"],
        ["SENTIMENT", "100K", "100K", "=", "Bien dimensionne"],
        [Paragraph("<b>TOTAL</b>", styles['TableCellBold']),
         Paragraph("<b>500K</b>", styles['TableCellBold']),
         Paragraph("<b>400K</b>", styles['TableCellBold']),
         Paragraph("<b>-20%</b>", styles['TableCellBold']),
         Paragraph("<b>Mieux reparti</b>", styles['TableCellBold'])],
    ]
    story.append(make_table(
        recom_data[0], recom_data[1:],
        col_widths=[28*mm, 22*mm, 28*mm, 22*mm, 62*mm]
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 7. PROJECTIONS FINANCIERES
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("7. Projections Financieres", styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph("Cout Mensuel Total par Nombre de Comptes (EUR)", styles['SubSection']))

    proj_data = [
        ["Comptes", "GPT-4o mini", "Claude Haiku", "GPT-4o", "Claude Sonnet"],
        ["10", "1.50 EUR", "12 EUR", "25 EUR", "36 EUR"],
        ["25", "3.75 EUR", "30 EUR", "63 EUR", "90 EUR"],
        ["50", "7.50 EUR", "60 EUR", "127 EUR", "180 EUR"],
        ["100", "15 EUR", "120 EUR", "253 EUR", "360 EUR"],
        ["250", "38 EUR", "300 EUR", "633 EUR", "900 EUR"],
        ["500", "75 EUR", "600 EUR", "1 265 EUR", "1 800 EUR"],
    ]
    story.append(make_table(
        proj_data[0], proj_data[1:],
        col_widths=[25*mm, 35*mm, 35*mm, 35*mm, 35*mm]
    ))

    story.append(Spacer(1, 5*mm))
    story.append(chart_scaling_projection())

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("Cout Annuel Projete (EUR)", styles['SubSection']))

    annual_data = [
        ["Comptes", "GPT-4o mini", "GPT-4o", "Claude Sonnet", "Strategie\nmixte*"],
        ["50", "90 EUR", "1 524 EUR", "2 160 EUR", "540 EUR"],
        ["100", "180 EUR", "3 036 EUR", "4 320 EUR", "1 080 EUR"],
        ["500", "900 EUR", "15 180 EUR", "21 600 EUR", "5 400 EUR"],
    ]
    story.append(make_table(
        annual_data[0], annual_data[1:],
        col_widths=[25*mm, 35*mm, 35*mm, 35*mm, 35*mm]
    ))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "<i>* Strategie mixte : GPT-4o mini pour Messaging/Sentiment (volume), "
        "Claude Sonnet pour Design/Pricing/Analytics (qualite)</i>",
        styles['SmallText']
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 8. STRATEGIE DE MONETISATION
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("8. Strategie de Monetisation", styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph("Integration du Cout IA dans les Abonnements", styles['SubSection']))
    story.append(Paragraph(
        "L'objectif est d'integrer le cout de l'IA de maniere transparente dans les plans "
        "d'abonnement, sans impact significatif sur la marge. Trois strategies sont possibles :",
        styles['BodyText']
    ))

    story.append(Paragraph("Strategie A : IA Incluse (Recommandee)", styles['SubSubSection']))
    story.append(Paragraph(
        "Le cout IA est absorbe dans le prix de l'abonnement. Avec GPT-4o mini comme modele "
        "par defaut, le cout est negligeable (< 0.20 EUR/compte). Cette approche maximise "
        "l'adoption et la valeur percue.",
        styles['BodyText']
    ))

    strat_a = [
        ["Plan", "Prix\nabonnement", "Proprietes", "Budget IA", "Cout IA\n(GPT-4o mini)", "Marge IA"],
        ["Starter", "29 EUR", "1-2", "200K tokens", "0.05 EUR", "99.8%"],
        ["Pro", "79 EUR", "3-5", "500K tokens", "0.15 EUR", "99.8%"],
        ["Business", "199 EUR", "10-20", "2M tokens", "0.60 EUR", "99.7%"],
        ["Enterprise", "499 EUR", "50+", "10M tokens", "3.00 EUR", "99.4%"],
    ]
    story.append(make_table(
        strat_a[0], strat_a[1:],
        col_widths=[25*mm, 25*mm, 22*mm, 25*mm, 30*mm, 25*mm],
        header_color=SUCCESS
    ))

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("Strategie B : IA Premium (Upsell)", styles['SubSubSection']))
    story.append(Paragraph(
        "L'IA basique (rule-based) est incluse, mais l'IA avancee (LLM) est un addon payant. "
        "Permet de segmenter les clients et de monetiser directement l'IA.",
        styles['BodyText']
    ))

    strat_b = [
        ["Addon", "Prix", "Inclus", "Modele"],
        ["IA Essentiel", "+9 EUR/mois", "Messaging + Sentiment (rule-based + IA)", "GPT-4o mini"],
        ["IA Pro", "+19 EUR/mois", "Toutes features IA, modele performant", "Claude Sonnet"],
        ["IA Enterprise", "+49 EUR/mois", "IA illimitee + modele premium + BYOK", "Claude Opus"],
    ]
    story.append(make_table(
        strat_b[0], strat_b[1:],
        col_widths=[30*mm, 28*mm, 70*mm, 32*mm],
        header_color=WARNING
    ))

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("Strategie C : BYOK Pur", styles['SubSubSection']))
    story.append(Paragraph(
        "Aucune cle plateforme, chaque client configure sa propre cle API. "
        "Cout pour Clenzy : <b>0 EUR</b>. Inconvenient : friction a l'onboarding, "
        "necessite que chaque client ait un compte provider.",
        styles['BodyText']
    ))

    story.append(Spacer(1, 5*mm))
    story.append(chart_monetization())

    story.append(Spacer(1, 4*mm))
    story.append(make_info_box(
        "<b>Recommandation :</b> La strategie A (IA incluse avec GPT-4o mini) est la plus "
        "competitive. Le cout IA represente <b>moins de 0.5%</b> du prix de l'abonnement. "
        "L'option BYOK reste disponible pour les clients souhaitant un modele premium "
        "(Claude Sonnet/Opus) aux frais du client.",
        SUCCESS
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 9. OPTIMISATIONS
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("9. Optimisations et Bonnes Pratiques", styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph("9.1 Prompt Caching", styles['SubSection']))
    story.append(Paragraph(
        "Les prompts systeme de Clenzy sont identiques pour tous les utilisateurs d'une "
        "feature. En activant le cache, les tokens du prompt systeme ne sont factures qu'a "
        "<b>10% du prix</b> apres le premier appel (fenetre de 5 minutes).",
        styles['BodyText']
    ))

    cache_data = [
        ["Feature", "Taille prompt systeme", "Economie avec cache", "Economie mensuelle"],
        ["DESIGN", "~540 tokens", "~486 tokens/appel", "~5%"],
        ["PRICING", "~200 tokens", "~180 tokens/appel", "~3%"],
        ["MESSAGING", "~330 tokens", "~297 tokens/appel", "~15-25%"],
        ["ANALYTICS", "~280 tokens", "~252 tokens/appel", "~10%"],
        ["SENTIMENT", "~220 tokens", "~198 tokens/appel", "~10-15%"],
    ]
    story.append(make_table(
        cache_data[0], cache_data[1:],
        col_widths=[30*mm, 38*mm, 40*mm, 40*mm]
    ))

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("9.2 Fallback Rule-Based", styles['SubSection']))
    story.append(Paragraph(
        "Deux features disposent d'un fallback rule-based qui ne consomme aucun token :<br/>"
        "&#8226; <b>Messaging</b> : detection d'intention par mots-cles (6 langues supportees)<br/>"
        "&#8226; <b>Sentiment</b> : scoring par dictionnaire de mots-cles positifs/negatifs<br/><br/>"
        "Le fallback peut etre utilise par defaut, avec l'IA activee uniquement pour les cas "
        "complexes ou lorsque le client souscrit a l'addon IA.",
        styles['BodyText']
    ))

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("9.3 Choix de Modele par Feature", styles['SubSection']))

    model_choice = [
        ["Feature", "Modele recommande", "Justification"],
        ["DESIGN", "Claude Sonnet", "Qualite CSS superieure, appels peu frequents"],
        ["PRICING", "GPT-4o", "Bon rapport qualite/prix pour du JSON structure"],
        ["MESSAGING", "GPT-4o mini", "Volume eleve, taches simples (intent + reponse)"],
        ["ANALYTICS", "Claude Sonnet", "Qualite des insights, appels rares"],
        ["SENTIMENT", "GPT-4o mini", "Volume eleve, classification simple"],
    ]
    story.append(make_table(
        model_choice[0], model_choice[1:],
        col_widths=[30*mm, 40*mm, 95*mm]
    ))

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("9.4 Autres Optimisations", styles['SubSection']))

    for opt in [
        "<b>Batch API</b> : Traitement par lot pour les analyses de sentiment (revues) et analytics. Reduction de 50%.",
        "<b>Truncation intelligente</b> : Le module Design tronque HTML et CSS a 50KB chacun pour eviter les prompts surdimensionnes.",
        "<b>Cache de design tokens</b> : Hash du contenu pour eviter de re-traiter un site deja analyse.",
        "<b>Max tokens output</b> : Limiter les reponses (ex: 5 tokens pour le test de cle, 4096 pour le CSS).",
        "<b>Monitoring budgetaire</b> : Alertes automatiques a 80% et 100% du budget mensuel.",
    ]:
        story.append(Paragraph(
            f"&#8226; {opt}",
            styles['BulletText']
        ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 10. RECOMMANDATIONS ET CONCLUSION
    # ═══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("10. Recommandations et Conclusion", styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph("Recommandations Cles", styles['SubSection']))

    reco_items = [
        ("<b>1. Adopter GPT-4o mini comme modele par defaut</b><br/>"
         "Avec un cout de 0.15 EUR/compte/mois, l'IA peut etre incluse dans tous les plans "
         "sans impact sur la marge. La qualite est suffisante pour 80% des usages."),
        ("<b>2. Garder BYOK pour le premium</b><br/>"
         "Les clients souhaitant Claude Sonnet ou Opus configurent leur propre cle. "
         "Cout pour Clenzy : 0 EUR. Valeur ajoutee pour le client : choix du modele."),
        ("<b>3. Redistribuer les budgets tokens</b><br/>"
         "Messaging a 200K, Design a 50K, Pricing a 30K, Analytics a 20K, Sentiment a 100K. "
         "Total : 400K (vs 500K actuel) mieux reparti."),
        ("<b>4. Activer le Prompt Caching</b><br/>"
         "Reduction de 15-25% sur le Messaging (gros volume). A implementer en priorite."),
        ("<b>5. Utiliser le fallback rule-based par defaut</b><br/>"
         "Pour Messaging et Sentiment, activer l'IA uniquement pour les plans payants "
         "ou sur opt-in du client."),
        ("<b>6. Implementer le routage par modele par feature</b><br/>"
         "Design/Analytics sur Claude Sonnet (qualite), Messaging/Sentiment sur GPT-4o mini "
         "(volume). Pricing sur GPT-4o (equilibre)."),
    ]
    for reco in reco_items:
        story.append(Paragraph(reco, styles['BodyText']))
        story.append(Spacer(1, 2*mm))

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("Synthese Financiere", styles['SubSection']))

    story.append(make_kpi_row([
        ("< 0.20 EUR", "Cout IA / compte\n(GPT-4o mini)", SUCCESS),
        ("< 0.5%", "Impact sur marge\nabonnement", CLENZY_ACCENT),
        ("99.4%+", "Marge preservee\ntous plans", SUCCESS),
    ]))

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("Conclusion", styles['SubSection']))
    story.append(Paragraph(
        "L'intelligence artificielle dans Clenzy represente un <b>avantage concurrentiel majeur</b> "
        "a un cout extremement faible. Avec le modele GPT-4o mini, le cout IA est "
        "<b>quasi negligeable</b> (moins de 0.20 EUR par compte par mois), permettant "
        "de l'inclure gratuitement dans tous les plans d'abonnement.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "Le modele hybride BYOK offre la flexibilite necessaire : les clients standards "
        "beneficient de l'IA incluse, tandis que les clients premium peuvent opter pour des "
        "modeles plus performants (Claude Sonnet/Opus) a leurs propres frais.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "L'IA n'est pas un centre de cout, c'est un <b>multiplicateur de valeur</b> qui "
        "justifie des prix d'abonnement plus eleves et reduit le churn en rendant "
        "la plateforme indispensable au quotidien des gestionnaires immobiliers.",
        styles['BodyText']
    ))

    story.append(Spacer(1, 10*mm))
    story.append(HRFlowable(width="60%", thickness=1, color=GRAY_300,
                            spaceBefore=0, spaceAfter=6))
    story.append(Paragraph(
        "<i>Document genere le 12 mars 2026 - SinaTech SARL<br/>"
        "Donnees basees sur les tarifs API en vigueur (OpenAI, Anthropic) "
        "et l'analyse du code source Clenzy v2.5</i>",
        ParagraphStyle('footer_note', parent=styles['SmallText'], alignment=TA_CENTER)
    ))

    # ═══════════════════════════════════════════════════════════════════════
    # BUILD
    # ═══════════════════════════════════════════════════════════════════════
    doc.build(
        story,
        onFirstPage=cover_page_bg,
        onLaterPages=regular_page
    )
    print(f"PDF genere : {OUTPUT_PATH}")


if __name__ == '__main__':
    build_pdf()
