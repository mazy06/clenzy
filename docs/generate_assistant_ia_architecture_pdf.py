#!/usr/bin/env python3
"""
Clenzy — Assistant IA : Architecture & Documentation Technique
Generateur PDF professionnel avec schémas, graphiques et tableaux.

Génère docs/Clenzy_Assistant_IA_Architecture.pdf à partir de la doc
markdown ASSISTANT_IA_ARCHITECTURE.md, enrichie de :
- Cover page brandée
- Schémas SVG (architecture composants, flow end-to-end, modèle données)
- Graphiques matplotlib (coûts LLM, latence p99, répartition tools)
- Tableaux stylés (tools inventory, providers, schedulers)
- Palette Clenzy : #6B8A9A (primary), #A6C0CE (light), #5A7684 (dark),
  #4A9B8E (success), #D4A574 (warning), #C97A7A (danger)
"""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle
from matplotlib.lines import Line2D
import matplotlib.patches as mpatches
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black, Color
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, KeepTogether, HRFlowable, ListFlowable, ListItem,
)
from reportlab.platypus.tableofcontents import TableOfContents

# ============================================================================
# PALETTE CLENZY (alignée avec primer.md)
# ============================================================================
CLENZY_PRIMARY     = HexColor('#6B8A9A')   # bleu-gris
CLENZY_DARK        = HexColor('#5A7684')   # bleu-gris foncé
CLENZY_LIGHT       = HexColor('#A6C0CE')   # bleu-gris clair
CLENZY_BG          = HexColor('#F4F7F9')   # fond doux
CLENZY_ACCENT_TEAL = HexColor('#4A9B8E')   # success/positif
CLENZY_ACCENT_GOLD = HexColor('#D4A574')   # warning/highlight
CLENZY_ACCENT_RED  = HexColor('#C97A7A')   # danger/négatif
CLENZY_ACCENT_BLUE = HexColor('#7BA3C2')   # info
GRAY_100 = HexColor('#F3F4F6')
GRAY_200 = HexColor('#E5E7EB')
GRAY_300 = HexColor('#D1D5DB')
GRAY_500 = HexColor('#6B7280')
GRAY_600 = HexColor('#4B5563')
GRAY_700 = HexColor('#374151')
GRAY_800 = HexColor('#1F2937')
GRAY_900 = HexColor('#111827')
WHITE = white
BLACK = black

# Matplotlib palette synchronisée
MPL_PRIMARY = '#6B8A9A'
MPL_DARK = '#5A7684'
MPL_LIGHT = '#A6C0CE'
MPL_TEAL = '#4A9B8E'
MPL_GOLD = '#D4A574'
MPL_RED = '#C97A7A'
MPL_BLUE = '#7BA3C2'

# Matplotlib gray palette (hex strings, not HexColor objects)
MPL_GRAY_300 = '#D1D5DB'
MPL_GRAY_500 = '#6B7280'
MPL_GRAY_700 = '#374151'
MPL_GRAY_800 = '#1F2937'

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "Clenzy_Assistant_IA_Architecture.pdf")

# ============================================================================
# STYLES
# ============================================================================
styles = getSampleStyleSheet()

styles.add(ParagraphStyle('CoverTitle', parent=styles['Title'],
    fontSize=36, leading=42, textColor=WHITE, alignment=TA_LEFT,
    fontName='Helvetica-Bold', spaceAfter=12))
styles.add(ParagraphStyle('CoverSubtitle', parent=styles['Normal'],
    fontSize=16, leading=20, textColor=CLENZY_LIGHT, alignment=TA_LEFT,
    fontName='Helvetica', spaceAfter=6))
styles.add(ParagraphStyle('CoverMeta', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=HexColor('#CBD8E0'), alignment=TA_LEFT,
    fontName='Helvetica'))
styles.add(ParagraphStyle('TocEntry', parent=styles['Normal'],
    fontSize=11, leading=18, textColor=GRAY_700, fontName='Helvetica',
    leftIndent=8))
styles.add(ParagraphStyle('TocEntryBold', parent=styles['Normal'],
    fontSize=12, leading=20, textColor=CLENZY_DARK, fontName='Helvetica-Bold'))

styles.add(ParagraphStyle('SectionTitle', parent=styles['Heading1'],
    fontSize=22, leading=28, textColor=CLENZY_DARK,
    fontName='Helvetica-Bold', spaceBefore=24, spaceAfter=14,
    borderPadding=(0, 0, 6, 0)))
styles.add(ParagraphStyle('SubSection', parent=styles['Heading2'],
    fontSize=15, leading=20, textColor=CLENZY_PRIMARY,
    fontName='Helvetica-Bold', spaceBefore=18, spaceAfter=10))
styles.add(ParagraphStyle('SubSubSection', parent=styles['Heading3'],
    fontSize=12, leading=15, textColor=GRAY_700,
    fontName='Helvetica-Bold', spaceBefore=12, spaceAfter=6))

styles['BodyText'].fontSize = 10
styles['BodyText'].leading = 14.5
styles['BodyText'].textColor = GRAY_700
styles['BodyText'].fontName = 'Helvetica'
styles['BodyText'].spaceAfter = 8
styles['BodyText'].alignment = TA_JUSTIFY

styles.add(ParagraphStyle('BodyBold', parent=styles['Normal'],
    fontSize=10, leading=14.5, textColor=GRAY_800,
    fontName='Helvetica-Bold', spaceAfter=6))
styles.add(ParagraphStyle('SmallText', parent=styles['Normal'],
    fontSize=8.5, leading=11, textColor=GRAY_500,
    fontName='Helvetica', spaceAfter=4))
styles.add(ParagraphStyle('BulletItem', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=GRAY_700,
    fontName='Helvetica', spaceAfter=4, leftIndent=18,
    bulletIndent=6))
styles.add(ParagraphStyle('Caption', parent=styles['Normal'],
    fontSize=8.5, leading=10, textColor=GRAY_500,
    fontName='Helvetica-Oblique', alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle('CodeBlock', parent=styles['Normal'],
    fontSize=8.5, leading=11, textColor=GRAY_800, fontName='Courier',
    backColor=GRAY_100, borderPadding=8, leftIndent=4, rightIndent=4,
    spaceAfter=8))

styles.add(ParagraphStyle('TableHeader', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=WHITE,
    fontName='Helvetica-Bold', alignment=TA_LEFT))
styles.add(ParagraphStyle('TableCell', parent=styles['Normal'],
    fontSize=8.5, leading=11, textColor=GRAY_700,
    fontName='Helvetica', alignment=TA_LEFT))
styles.add(ParagraphStyle('TableCellBold', parent=styles['Normal'],
    fontSize=8.5, leading=11, textColor=CLENZY_DARK,
    fontName='Helvetica-Bold', alignment=TA_LEFT))
styles.add(ParagraphStyle('TableCellCenter', parent=styles['Normal'],
    fontSize=8.5, leading=11, textColor=GRAY_700,
    fontName='Helvetica', alignment=TA_CENTER))

styles.add(ParagraphStyle('KpiValue', parent=styles['Normal'],
    fontSize=24, leading=28, textColor=CLENZY_DARK,
    fontName='Helvetica-Bold', alignment=TA_CENTER))
styles.add(ParagraphStyle('KpiLabel', parent=styles['Normal'],
    fontSize=8.5, leading=11, textColor=GRAY_500,
    fontName='Helvetica', alignment=TA_CENTER))

styles.add(ParagraphStyle('Footer', parent=styles['Normal'],
    fontSize=8, leading=10, textColor=GRAY_500,
    fontName='Helvetica', alignment=TA_CENTER))

# ============================================================================
# HELPERS
# ============================================================================

def make_table(headers, rows, col_widths=None, header_color=None,
               row_bg_alt=GRAY_100, body_align='LEFT'):
    """Tableau stylé Clenzy."""
    if header_color is None:
        header_color = CLENZY_PRIMARY
    h_paragraphs = [Paragraph(h, styles['TableHeader']) for h in headers]
    cell_style = styles['TableCell'] if body_align == 'LEFT' else styles['TableCellCenter']
    body_rows = []
    for row in rows:
        body_rows.append([Paragraph(str(c), cell_style) for c in row])
    data = [h_paragraphs] + body_rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), header_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('ALIGN', (0, 0), (-1, -1), body_align),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY_300),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, row_bg_alt]),
    ])
    t.setStyle(style)
    return t


def make_info_box(text, color=None, icon='ℹ'):
    """Encart d'information coloré."""
    if color is None:
        color = CLENZY_ACCENT_BLUE
    light_bg = Color(color.red, color.green, color.blue, alpha=0.08)
    p = Paragraph(f'<b><font color="{color.hexval()}">{icon}</font></b>&nbsp;&nbsp;{text}',
                  ParagraphStyle('infobox', parent=styles['Normal'],
                                  fontSize=9.5, leading=13, textColor=GRAY_700,
                                  fontName='Helvetica', leftIndent=10, rightIndent=10,
                                  spaceAfter=4))
    t = Table([[p]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), light_bg),
        ('LINEBEFORE', (0, 0), (0, -1), 3, color),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
    ]))
    return t


def make_kpi_row(kpis, total_width=170*mm):
    """Rangée de tuiles KPI."""
    n = len(kpis)
    col_w = total_width / n
    cells = []
    for kpi in kpis:
        val = Paragraph(kpi['value'], styles['KpiValue'])
        lbl = Paragraph(kpi['label'], styles['KpiLabel'])
        inner = Table([[val], [lbl]], colWidths=[col_w - 6*mm])
        inner.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ]))
        cells.append(inner)
    row = Table([cells], colWidths=[col_w] * n)
    row.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CLENZY_BG),
        ('BOX', (0, 0), (-1, -1), 1, CLENZY_LIGHT),
        ('LINEBEFORE', (1, 0), (-1, -1), 0.5, GRAY_200),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return row


def section_divider():
    return HRFlowable(width="100%", thickness=2, color=CLENZY_LIGHT,
                       spaceBefore=8, spaceAfter=16)


def chart_to_image(fig, width=170*mm, height=80*mm):
    """Convertit une figure matplotlib en Image ReportLab."""
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=200, bbox_inches='tight',
                 facecolor='white', edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    return Image(buf, width=width, height=height)


# ============================================================================
# SCHEMAS (matplotlib)
# ============================================================================

def diagram_architecture_globale():
    """Diagramme de composants : Frontend → Backend → External."""
    fig, ax = plt.subplots(figsize=(11, 7))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 9)
    ax.axis('off')

    # Frontend block
    fe = FancyBboxPatch((0.5, 6.5), 11, 2, boxstyle="round,pad=0.05",
                          facecolor='#E8F0F4', edgecolor=MPL_PRIMARY, linewidth=1.8)
    ax.add_patch(fe)
    ax.text(6, 8.2, 'FRONTEND (React + TypeScript + MUI)',
            ha='center', fontsize=10, fontweight='bold', color=MPL_DARK)

    # Frontend sub-components
    for i, (label, x) in enumerate([
        ('AssistantPage\n(chat UI)', 2),
        ('ChatInput +\nMessageList', 6),
        ('ToolResultWidget\n(11 widgets)', 10)
    ]):
        sub = FancyBboxPatch((x - 1.4, 6.8), 2.8, 1, boxstyle="round,pad=0.03",
                               facecolor='white', edgecolor=MPL_LIGHT)
        ax.add_patch(sub)
        ax.text(x, 7.3, label, ha='center', va='center', fontsize=8,
                color=MPL_DARK)
    ax.text(6, 6.6, '← useAgent hook (SSE consumer) →',
            ha='center', fontsize=7.5, style='italic', color=MPL_PRIMARY)

    # Arrow
    ax.annotate('', xy=(6, 6.3), xytext=(6, 5.7),
                arrowprops=dict(arrowstyle='->', color=MPL_DARK, lw=2))
    ax.text(6.2, 6, 'POST SSE\nstream', fontsize=7.5, color=MPL_DARK)

    # Backend block
    be = FancyBboxPatch((0.5, 1.8), 11, 3.8, boxstyle="round,pad=0.05",
                          facecolor='#F4F7F9', edgecolor=MPL_PRIMARY, linewidth=1.8)
    ax.add_patch(be)
    ax.text(6, 5.4, 'BACKEND (Spring Boot 3.2 + Java 21)',
            ha='center', fontsize=10, fontweight='bold', color=MPL_DARK)

    # Controller
    ctrl = FancyBboxPatch((4.5, 4.3), 3, 0.7, boxstyle="round,pad=0.03",
                            facecolor=MPL_LIGHT, edgecolor=MPL_PRIMARY)
    ax.add_patch(ctrl)
    ax.text(6, 4.65, 'AssistantController', ha='center', va='center',
            fontsize=8, fontweight='bold', color=MPL_DARK)

    # AgentOrchestrator (central)
    orc = FancyBboxPatch((3.5, 2.8), 5, 1.2, boxstyle="round,pad=0.05",
                          facecolor=MPL_PRIMARY, edgecolor=MPL_DARK, linewidth=1.5)
    ax.add_patch(orc)
    ax.text(6, 3.65, 'AgentOrchestrator', ha='center', va='center',
            fontsize=10, fontweight='bold', color='white')
    ax.text(6, 3.2, '(boucle tool-calling max 5 itér.)', ha='center',
            va='center', fontsize=7, color='white', style='italic')

    # Subcomponents below
    for i, (label, x, color) in enumerate([
        ('Anthropic\nChatProvider', 1.8, MPL_TEAL),
        ('ToolRegistry\n27 tools', 4.8, MPL_GOLD),
        ('KbSearch\n(RAG)', 7.5, MPL_BLUE),
        ('Memory\nService', 10.2, MPL_RED),
    ]):
        sub = FancyBboxPatch((x - 1.1, 2), 2.2, 0.7, boxstyle="round,pad=0.03",
                               facecolor='white', edgecolor=color, linewidth=1.5)
        ax.add_patch(sub)
        ax.text(x, 2.35, label, ha='center', va='center', fontsize=7.5,
                color=color, fontweight='bold')

    # Arrow controller → orchestrator
    ax.annotate('', xy=(6, 4.0), xytext=(6, 4.2),
                arrowprops=dict(arrowstyle='->', color=MPL_DARK, lw=1.2))

    # External services
    for i, (label, x, color) in enumerate([
        ('Postgres\n+pgvector', 2, MPL_PRIMARY),
        ('Redis\n(cache)', 6, MPL_GOLD),
        ('Anthropic\nVoyage APIs', 10, MPL_TEAL)
    ]):
        sub = FancyBboxPatch((x - 1.2, 0.3), 2.4, 1, boxstyle="round,pad=0.04",
                               facecolor='white', edgecolor=color, linewidth=1.5)
        ax.add_patch(sub)
        ax.text(x, 0.8, label, ha='center', va='center', fontsize=8,
                color=color, fontweight='bold')

    return fig


def diagram_flow_end_to_end():
    """Flow vertical numéroté d'un message utilisateur."""
    fig, ax = plt.subplots(figsize=(10, 9))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 11)
    ax.axis('off')

    steps = [
        ('User tape un message', '#F4F7F9', MPL_DARK),
        ('Frontend POST /api/assistant/chat\n(SSE stream ouvert)', '#E8F0F4', MPL_PRIMARY),
        ('AssistantController construit AgentContext\n(orgId, keycloakId, language)', '#E8F0F4', MPL_PRIMARY),
        ('Thread pool SSE exécute orchestrator.handleMessage()\n(non-blocking)', '#FFF4E5', MPL_GOLD),
        ('AgentOrchestrator :\n• Crée/résout conversation\n• Persiste user message\n• Build system prompt (memory + RAG)', '#E8F4F0', MPL_TEAL),
        ('runToolLoop (max 5 itérations) :\n• Stream Anthropic SSE\n• Parse text + tool_calls\n• Si write tool → confirmation', '#E8F4F0', MPL_TEAL),
        ('Persistance messages (DB)\n+ émission events SSE temps réel', '#FFF4E5', MPL_GOLD),
        ('Frontend rend texte + widgets\n(KpiSummary, DataTable, Charts…)', '#E8F0F4', MPL_PRIMARY),
    ]

    y_start = 10
    y_step = 1.2
    for i, (text, bg, color) in enumerate(steps):
        y = y_start - i * y_step
        # Number circle
        circle = mpatches.Circle((1, y), 0.4, facecolor=color, edgecolor='white', linewidth=2)
        ax.add_patch(circle)
        ax.text(1, y, str(i + 1), ha='center', va='center', fontsize=11,
                fontweight='bold', color='white')
        # Box
        box = FancyBboxPatch((2, y - 0.4), 7.5, 0.8, boxstyle="round,pad=0.05",
                              facecolor=bg, edgecolor=color, linewidth=1.2)
        ax.add_patch(box)
        ax.text(2.3, y, text, ha='left', va='center', fontsize=8.5,
                color=MPL_GRAY_700)
        # Arrow
        if i < len(steps) - 1:
            ax.annotate('', xy=(1, y - 0.7), xytext=(1, y - 0.45),
                        arrowprops=dict(arrowstyle='->', color=MPL_GRAY_500, lw=1.2))

    return fig


def diagram_rag_flow():
    """Flow RAG : Markdown → Chunks → Embeddings → Search → Inject."""
    fig, ax = plt.subplots(figsize=(11, 5))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 5)
    ax.axis('off')

    # Top row : Ingestion
    ax.text(6, 4.6, 'INGESTION (one-shot per doc)', ha='center', fontsize=10,
            fontweight='bold', color=MPL_DARK)

    boxes_top = [
        ('Doc Markdown\n.md', 1, MPL_GOLD),
        ('Split par H2\n+ chunks ~500 tokens', 3.5, MPL_GOLD),
        ('Embed batch\nVoyage/OpenAI', 6.5, MPL_GOLD),
        ('Persist KbChunk\n+ vector(1024d)', 9.5, MPL_GOLD),
    ]
    for label, x, color in boxes_top:
        box = FancyBboxPatch((x - 1.1, 3.4), 2.2, 0.8, boxstyle="round,pad=0.05",
                              facecolor='#FFF4E5', edgecolor=color, linewidth=1.5)
        ax.add_patch(box)
        ax.text(x, 3.8, label, ha='center', va='center', fontsize=8, color=MPL_GRAY_700)
    # Arrows top
    for x in [2.4, 4.9, 7.9]:
        ax.annotate('', xy=(x + 0.7, 3.8), xytext=(x, 3.8),
                    arrowprops=dict(arrowstyle='->', color=MPL_GRAY_500, lw=1.2))

    # Separator
    ax.axhline(y=2.7, xmin=0.05, xmax=0.95, color=MPL_GRAY_300, linewidth=0.5, linestyle='--')

    # Bottom row : Query
    ax.text(6, 2.4, 'QUERY (à chaque message utilisateur)', ha='center', fontsize=10,
            fontweight='bold', color=MPL_DARK)

    boxes_bot = [
        ('User message', 0.8, MPL_TEAL),
        ('Embed query', 3, MPL_TEAL),
        ('pgvector\ncosine search\n(over-fetch ×4)', 5.5, MPL_TEAL),
        ('Rerank\nVoyage rerank-2', 8, MPL_TEAL),
        ('Top-K chunks\nrelevance ≥ 0.70', 10.7, MPL_PRIMARY),
    ]
    for label, x, color in boxes_bot:
        bg_color = '#E8F4F0' if color == MPL_TEAL else '#E8F0F4'
        box = FancyBboxPatch((x - 1, 1.2), 2, 0.9, boxstyle="round,pad=0.05",
                              facecolor=bg_color, edgecolor=color, linewidth=1.5)
        ax.add_patch(box)
        ax.text(x, 1.65, label, ha='center', va='center', fontsize=7.5, color=MPL_GRAY_700)
    for x in [1.85, 4, 6.55, 9.05]:
        ax.annotate('', xy=(x + 0.6, 1.65), xytext=(x, 1.65),
                    arrowprops=dict(arrowstyle='->', color=MPL_GRAY_500, lw=1.2))

    # Final injection
    inj = FancyBboxPatch((4, 0.05), 4, 0.7, boxstyle="round,pad=0.05",
                          facecolor=MPL_PRIMARY, edgecolor=MPL_DARK, linewidth=1.5)
    ax.add_patch(inj)
    ax.text(6, 0.4, 'Auto-inject dans system prompt LLM\n→ anti-hallucination + citations', ha='center',
            va='center', fontsize=8, color='white', fontweight='bold')
    ax.annotate('', xy=(6, 0.8), xytext=(10.7, 1.15),
                arrowprops=dict(arrowstyle='->', color=MPL_DARK, lw=1.5,
                                connectionstyle="arc3,rad=-0.2"))

    return fig


def chart_tools_distribution():
    """Pie chart : répartition des 27 tools par catégorie."""
    fig, ax = plt.subplots(figsize=(7, 5))
    sizes = [14, 7, 2, 2, 2]
    labels = ['Read tools (14)', 'Write tools (7)', 'Simulation (2)',
              'Workflow (2)', 'Memory + Nav (2)']
    colors = [MPL_PRIMARY, MPL_RED, MPL_TEAL, MPL_GOLD, MPL_BLUE]
    wedges, texts, autotexts = ax.pie(sizes, labels=labels, colors=colors,
                                       autopct='%1.0f%%', startangle=90,
                                       wedgeprops=dict(edgecolor='white', linewidth=2),
                                       textprops=dict(fontsize=9, color=MPL_GRAY_700))
    for at in autotexts:
        at.set_color('white')
        at.set_fontweight('bold')
        at.set_fontsize(10)
    ax.set_title('Répartition des 27 tools de l\'Assistant IA',
                  fontsize=11, fontweight='bold', color=MPL_DARK, pad=18)
    return fig


def chart_costs_llm():
    """Bar chart : coûts LLM mensuels par usage type (estimation 1000 users)."""
    fig, ax = plt.subplots(figsize=(8, 4.5))
    categories = ['Chat\nSonnet 4', 'Briefings\nHaiku 4.5', 'Embeddings\nVoyage', 'Rerank\nVoyage', 'Vision\nclaims']
    costs = [180, 30, 0.50, 3.0, 24]
    colors = [MPL_PRIMARY, MPL_TEAL, MPL_GOLD, MPL_BLUE, MPL_RED]
    bars = ax.bar(categories, costs, color=colors, edgecolor='white', linewidth=2)
    for bar, cost in zip(bars, costs):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2, height + 4,
                f'${cost:.2f}' if cost < 1 else f'${cost:.0f}',
                ha='center', fontsize=9, fontweight='bold', color=MPL_GRAY_700)
    ax.set_ylabel('Coût mensuel estimé ($)', fontsize=10, color=MPL_GRAY_700)
    ax.set_title('Estimation coûts LLM mensuels (1000 utilisateurs actifs)',
                  fontsize=11, fontweight='bold', color=MPL_DARK, pad=12)
    ax.set_ylim(0, 220)
    ax.grid(axis='y', linestyle='--', alpha=0.4)
    ax.set_axisbelow(True)
    for spine in ['top', 'right']:
        ax.spines[spine].set_visible(False)
    ax.tick_params(axis='x', labelsize=8.5, colors=MPL_GRAY_700)
    ax.tick_params(axis='y', labelsize=8.5, colors=MPL_GRAY_700)
    return fig


def chart_latency_p99():
    """Bar chart : latence p99 par scénario."""
    fig, ax = plt.subplots(figsize=(8, 4))
    scenarios = ['First token\n(streaming)', 'Réponse texte\npure', 'Avec 1 tool\nread', 'Avec 2 tools\n+ confirmation']
    latencies = [0.5, 2.0, 4.5, 6.5]
    colors = [MPL_TEAL, MPL_PRIMARY, MPL_GOLD, MPL_RED]
    bars = ax.barh(scenarios, latencies, color=colors, edgecolor='white', linewidth=2)
    for bar, lat in zip(bars, latencies):
        width = bar.get_width()
        ax.text(width + 0.15, bar.get_y() + bar.get_height() / 2,
                f'{lat:.1f}s', va='center', fontsize=9, fontweight='bold',
                color=MPL_GRAY_700)
    ax.set_xlabel('Latence p99 (secondes)', fontsize=10, color=MPL_GRAY_700)
    ax.set_title('Latence p99 par scénario d\'usage',
                  fontsize=11, fontweight='bold', color=MPL_DARK, pad=12)
    ax.set_xlim(0, 8)
    ax.grid(axis='x', linestyle='--', alpha=0.4)
    ax.set_axisbelow(True)
    for spine in ['top', 'right']:
        ax.spines[spine].set_visible(False)
    ax.tick_params(axis='x', labelsize=8.5, colors=MPL_GRAY_700)
    ax.tick_params(axis='y', labelsize=8.5, colors=MPL_GRAY_700)
    return fig


def diagram_memory_scopes():
    """Schéma 4 scopes mémoire."""
    fig, ax = plt.subplots(figsize=(10, 4.5))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 5)
    ax.axis('off')

    ax.text(6, 4.5, 'Memory long-terme : 4 scopes avec sélection par embedding',
            ha='center', fontsize=11, fontweight='bold', color=MPL_DARK)

    scopes = [
        ('PREFERENCE', '"Langue: français"\n"Couleur: bleu"', MPL_PRIMARY, 1.5),
        ('FACT', '"App Bastille: 2 chambres"\n"Client allergique fumeurs"', MPL_TEAL, 4.4),
        ('GOAL', '"Atteindre 80% occ\nen juillet"', MPL_GOLD, 7.3),
        ('PROJECT', '"Refonte calendrier Q3\nen cours"', MPL_RED, 10.2),
    ]

    for label, example, color, x in scopes:
        # Header
        hdr = FancyBboxPatch((x - 1.3, 2.8), 2.6, 0.6, boxstyle="round,pad=0.04",
                              facecolor=color, edgecolor='white', linewidth=2)
        ax.add_patch(hdr)
        ax.text(x, 3.1, label, ha='center', va='center', fontsize=9.5,
                fontweight='bold', color='white')
        # Example
        ex = FancyBboxPatch((x - 1.3, 1.2), 2.6, 1.4, boxstyle="round,pad=0.04",
                             facecolor='white', edgecolor=color, linewidth=1.5)
        ax.add_patch(ex)
        ax.text(x, 1.9, example, ha='center', va='center', fontsize=7.5,
                color=MPL_GRAY_700, style='italic')

    # Bottom annotation
    ax.text(6, 0.5, 'Cleanup automatique : last_accessed_at > 6 mois → DELETE',
            ha='center', fontsize=9, style='italic', color=MPL_GRAY_500)

    return fig


def diagram_briefing_flow():
    """Flow horizontal des briefings : scheduler → compose → dispatch."""
    fig, ax = plt.subplots(figsize=(11, 4.5))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 5)
    ax.axis('off')

    ax.text(6, 4.7, 'Briefings proactifs : flow scheduler → composition → dispatch 3 canaux',
            ha='center', fontsize=10, fontweight='bold', color=MPL_DARK)

    # Step 1 : Scheduler
    s1 = FancyBboxPatch((0.3, 2.5), 2.4, 1.5, boxstyle="round,pad=0.05",
                          facecolor=MPL_PRIMARY, edgecolor='white', linewidth=2)
    ax.add_patch(s1)
    ax.text(1.5, 3.6, 'Scheduler horaire', ha='center', va='center', fontsize=9,
            fontweight='bold', color='white')
    ax.text(1.5, 3.1, 'cron("0 0 * * * *")\nMatching heure locale\npar timezone', ha='center', va='center',
            fontsize=7, color='white', style='italic')

    # Arrow
    ax.annotate('', xy=(3.5, 3.25), xytext=(2.8, 3.25),
                arrowprops=dict(arrowstyle='->', color=MPL_GRAY_500, lw=1.5))

    # Step 2 : Composer
    s2 = FancyBboxPatch((3.5, 2.5), 2.6, 1.5, boxstyle="round,pad=0.05",
                          facecolor=MPL_TEAL, edgecolor='white', linewidth=2)
    ax.add_patch(s2)
    ax.text(4.8, 3.6, 'BriefingComposer', ha='center', va='center', fontsize=9,
            fontweight='bold', color='white')
    ax.text(4.8, 3.1, 'LLM Haiku 4.5\nRead-only tools\nAnti-hallucination', ha='center', va='center',
            fontsize=7, color='white', style='italic')

    # Arrow
    ax.annotate('', xy=(7, 3.25), xytext=(6.2, 3.25),
                arrowprops=dict(arrowstyle='->', color=MPL_GRAY_500, lw=1.5))

    # Step 3 : Dispatcher
    s3 = FancyBboxPatch((7, 2.5), 2.4, 1.5, boxstyle="round,pad=0.05",
                          facecolor=MPL_GOLD, edgecolor='white', linewidth=2)
    ax.add_patch(s3)
    ax.text(8.2, 3.6, 'BriefingDelivery', ha='center', va='center', fontsize=9,
            fontweight='bold', color='white')
    ax.text(8.2, 3.1, 'Dispatch parallèle\nisolation par canal', ha='center', va='center',
            fontsize=7, color='white', style='italic')

    # 3 canaux on the right
    for i, (label, color, y) in enumerate([
        ('In-App\nNotification', MPL_BLUE, 3.7),
        ('Email\n(Brevo HTML)', MPL_PRIMARY, 2.6),
        ('WhatsApp\n(Twilio template)', MPL_TEAL, 1.5),
    ]):
        box = FancyBboxPatch((10, y - 0.4), 1.8, 0.8, boxstyle="round,pad=0.04",
                              facecolor='white', edgecolor=color, linewidth=1.5)
        ax.add_patch(box)
        ax.text(10.9, y, label, ha='center', va='center', fontsize=7.5,
                color=color, fontweight='bold')
        ax.annotate('', xy=(10, y), xytext=(9.4, 3.25),
                    arrowprops=dict(arrowstyle='->', color=MPL_GRAY_500, lw=1,
                                    connectionstyle=f"arc3,rad={(i-1)*0.2}"))

    # Retry scheduler annotation
    ax.text(6, 0.5, 'BriefingRetryScheduler horaire (CAS atomique) — retry des FAILED jusqu\'à 24h',
            ha='center', fontsize=8.5, style='italic', color=MPL_GRAY_500)

    return fig


# ============================================================================
# PAGE TEMPLATE (header + footer)
# ============================================================================

def add_page_decorations(canvas, doc):
    canvas.saveState()
    # Footer
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(GRAY_500)
    canvas.drawString(20*mm, 12*mm,
                       'Clenzy — Assistant IA — Architecture & Documentation Technique')
    canvas.drawRightString(A4[0] - 20*mm, 12*mm, f'Page {doc.page}')
    # Footer line
    canvas.setStrokeColor(CLENZY_LIGHT)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, 16*mm, A4[0] - 20*mm, 16*mm)
    canvas.restoreState()


def first_page(canvas, doc):
    canvas.saveState()
    # Full bleed background gradient (simulated by 2 rectangles)
    canvas.setFillColor(CLENZY_DARK)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)

    # Subtle pattern (geometric dots)
    canvas.setFillColor(HexColor('#7BA3C2'))
    for x in range(0, int(A4[0]) + 1, 30):
        for y in range(0, int(A4[1]) + 1, 30):
            canvas.circle(x, y, 0.5, fill=1, stroke=0)

    # Title block
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 14)
    canvas.drawString(25*mm, A4[1] - 35*mm, 'CLENZY')
    canvas.setFont('Helvetica', 11)
    canvas.setFillColor(CLENZY_LIGHT)
    canvas.drawString(25*mm, A4[1] - 42*mm, 'Property Management System')

    # Big title
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 38)
    canvas.drawString(25*mm, A4[1] - 110*mm, 'Assistant IA')
    canvas.setFont('Helvetica-Bold', 38)
    canvas.drawString(25*mm, A4[1] - 125*mm, 'Architecture')

    canvas.setFont('Helvetica', 16)
    canvas.setFillColor(CLENZY_LIGHT)
    canvas.drawString(25*mm, A4[1] - 142*mm, '& Documentation Technique')

    # Accent line
    canvas.setStrokeColor(CLENZY_ACCENT_GOLD)
    canvas.setLineWidth(3)
    canvas.line(25*mm, A4[1] - 150*mm, 70*mm, A4[1] - 150*mm)

    # Subtitle
    canvas.setFont('Helvetica', 11)
    canvas.setFillColor(HexColor('#CBD8E0'))
    canvas.drawString(25*mm, A4[1] - 165*mm,
                       'Core agent · 27 tools · KB RAG pgvector · Memory · Briefings · Vision · Workflows')

    # Bottom block
    canvas.setStrokeColor(HexColor('#7BA3C2'))
    canvas.setLineWidth(0.5)
    canvas.line(25*mm, 50*mm, A4[0] - 25*mm, 50*mm)

    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(CLENZY_LIGHT)
    canvas.drawString(25*mm, 42*mm, 'Date :')
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(WHITE)
    canvas.drawString(40*mm, 42*mm, '27 mai 2026')

    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(CLENZY_LIGHT)
    canvas.drawString(25*mm, 36*mm, 'Version :')
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(WHITE)
    canvas.drawString(40*mm, 36*mm, '1.0')

    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(CLENZY_LIGHT)
    canvas.drawString(25*mm, 30*mm, 'Cible :')
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(WHITE)
    canvas.drawString(40*mm, 30*mm, 'Équipe technique Clenzy')

    canvas.restoreState()


# ============================================================================
# CONTENT BUILDER
# ============================================================================

def build_story():
    story = []

    # ━━━━━ COVER ━━━━━
    story.append(PageBreak())  # cover handled by first_page template

    # ━━━━━ TABLE DES MATIÈRES ━━━━━
    story.append(Paragraph('Table des matières', styles['SectionTitle']))
    story.append(section_divider())

    toc_entries = [
        ('1. Vue d\'ensemble', '4'),
        ('2. Architecture globale', '5'),
        ('3. Modèle de données', '7'),
        ('4. Core Agent : Orchestrator + LLM Provider', '9'),
        ('5. Tool framework', '11'),
        ('6. Inventaire des 27 tools', '12'),
        ('7. Knowledge Base RAG (pgvector)', '14'),
        ('8. Memory long-terme', '16'),
        ('9. Simulations pricing & calendrier', '17'),
        ('10. Workflows procéduraux', '18'),
        ('11. Briefings proactifs', '19'),
        ('12. Vision (images)', '21'),
        ('13. Frontend chat', '22'),
        ('14. Sécurité & multi-tenant', '23'),
        ('15. Configuration & déploiement', '24'),
        ('16. Limites connues & TODOs', '25'),
    ]
    toc_data = [[Paragraph(title, styles['TocEntryBold' if '.' not in title.split()[0][1:] else 'TocEntry']),
                  Paragraph(page, styles['TocEntry'])] for title, page in toc_entries]
    t = Table(toc_data, colWidths=[150*mm, 15*mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, GRAY_200),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(PageBreak())

    # ━━━━━ 1. VUE D'ENSEMBLE ━━━━━
    story.append(Paragraph('1. Vue d\'ensemble', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph(
        'L\'<b>Assistant IA Clenzy</b> est un agent conversationnel multimodal intégré au PMS '
        '(Property Management System), conçu pour automatiser les tâches répétitives, fournir '
        'des analyses métier en temps réel et exécuter des actions concrètes via le langage naturel.',
        styles['BodyText']))

    story.append(Paragraph('Capacités métier', styles['SubSection']))
    capabilities = [
        ('Comprendre', 'Questions métier en FR/EN/AR sur propriétés, réservations, finances, opérationnel'),
        ('Exécuter', 'Actions concrètes : créer intervention, assigner technicien, bloquer calendrier'),
        ('Simuler', 'Scénarios « what-if » (changement de prix, blocage calendrier) avec modèle économique'),
        ('Mémoriser', 'Préférences et faits long-terme (4 scopes : preference, fact, goal, project)'),
        ('Citer', 'Documentation Clenzy via RAG pgvector — anti-hallucination strict'),
        ('Orchestrer', 'Workflows multi-étapes guidés (onboarding, clôture, préparation saison)'),
        ('Envoyer', 'Briefings proactifs daily/weekly via 3 canaux (in-app, email, WhatsApp)'),
        ('Analyser', 'Images (factures, dégradations, plans) via Claude Vision'),
        ('Suggérer', 'Navigation contextuelle vers les bonnes pages du PMS'),
    ]
    for verb, desc in capabilities:
        story.append(Paragraph(f'• <b><font color="{CLENZY_PRIMARY.hexval()}">{verb}</font></b> — {desc}',
                                styles['BulletItem']))
    story.append(Spacer(1, 12))

    # KPIs
    story.append(Paragraph('Chiffres clés', styles['SubSection']))
    story.append(make_kpi_row([
        {'value': '27', 'label': 'Tools (agents)'},
        {'value': '8', 'label': 'Migrations DB'},
        {'value': '65', 'label': 'Fichiers Java'},
        {'value': '~46 KB', 'label': 'Orchestrator'},
    ]))
    story.append(Spacer(1, 16))

    # Stack technique
    story.append(Paragraph('Stack technique', styles['SubSection']))
    stack_rows = [
        ['LLM', 'Anthropic Claude Sonnet 4 (vision, agent) + Haiku 4.5 (briefings)'],
        ['Embeddings', 'Voyage AI voyage-3-lite (1024d) ou OpenAI text-embedding-3-small'],
        ['Re-ranking', 'Voyage rerank-2 (cross-encoder) ou NoOp (fallback)'],
        ['Vector store', 'PostgreSQL 16 + pgvector (vector(1024), ivfflat cosine)'],
        ['Streaming', 'Server-Sent Events (pool dédié 10-100 threads)'],
        ['Persistance', 'JPA/Hibernate + Liquibase (migrations 0143-0150)'],
        ['Cache', 'Redis (météo 3h, holidays, RAG hot queries)'],
        ['Schedulers', 'Spring @Scheduled (6 schedulers : briefing, retry, memory, vision…)'],
        ['Frontend', 'React 18 + TypeScript + MUI + EventSource SSE consumer'],
        ['Storage images', 'S3 ou BYTEA (PhotoStorageService selon profile)'],
    ]
    story.append(make_table(['Couche', 'Technologie'], stack_rows,
                            col_widths=[35*mm, 135*mm]))
    story.append(Spacer(1, 12))

    story.append(make_info_box(
        'L\'assistant est <b>fail-soft systématique</b> : si le RAG est down, les briefings échouent, ou '
        'la clé API manque, l\'utilisateur reçoit toujours une réponse intelligible avec dégradation '
        'gracieuse — jamais un écran blanc ou une exception non gérée.',
        color=CLENZY_ACCENT_TEAL, icon='✓'))

    story.append(PageBreak())

    # ━━━━━ 2. ARCHITECTURE GLOBALE ━━━━━
    story.append(Paragraph('2. Architecture globale', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph(
        'L\'architecture suit un pattern <b>3-tier</b> : un frontend React qui consomme un flux SSE, un '
        'backend Spring Boot orchestré par <b>AgentOrchestrator</b> (cœur du système), et des services '
        'externes (Anthropic, Voyage, OpenMeteo, PostgreSQL pgvector, Redis).',
        styles['BodyText']))

    story.append(Paragraph('Diagramme de composants', styles['SubSection']))
    story.append(chart_to_image(diagram_architecture_globale(), width=170*mm, height=115*mm))
    story.append(Paragraph('Figure 1 : Vue d\'ensemble des composants frontend + backend + services externes',
                            styles['Caption']))
    story.append(Spacer(1, 8))

    story.append(Paragraph('Flow end-to-end d\'un message', styles['SubSection']))
    story.append(chart_to_image(diagram_flow_end_to_end(), width=160*mm, height=145*mm))
    story.append(Paragraph('Figure 2 : Séquence complète de bout en bout (Frontend → Backend → LLM → Tools → Réponse)',
                            styles['Caption']))

    story.append(PageBreak())

    # ━━━━━ 3. MODÈLE DE DONNÉES ━━━━━
    story.append(Paragraph('3. Modèle de données', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph(
        '12 tables principales structurent la persistance de l\'assistant. Toutes (sauf les tables admin '
        'cross-tenant) déclarent un <b>filtre Hibernate <code>organizationFilter</code></b> activé '
        'automatiquement par le TenantFilter de la Spring Security chain. <b>Aucune fuite cross-tenant '
        'n\'est possible</b> via les repositories standards.',
        styles['BodyText']))

    db_rows = [
        ['assistant_conversation', 'id, organization_id, keycloak_id, title, model, archived_at',
         'PK + (keycloak_id, created_at desc)'],
        ['assistant_message', 'id, conversation_id, role, content, tool_calls JSONB, attachments JSONB, tokens',
         'FK + (conversation_id, created_at asc)'],
        ['assistant_memory', 'id, keycloak_id, memory_key, memory_value, scope, embedding vector(1024)',
         'UNIQUE (kc_id, key) + ivfflat cosine'],
        ['assistant_briefing_pref', 'keycloak_id, frequency, time_local, timezone, channels JSONB',
         'UNIQUE (keycloak_id)'],
        ['assistant_briefing_log', 'keycloak_id, briefing_date, status, conversation_id, channels',
         'UNIQUE (kc_id, date) → idempotence'],
        ['assistant_workflow_run', 'keycloak_id, workflow_id, current_step_idx, collected_data JSONB, version',
         'Optimistic locking @Version'],
        ['kb_document', 'organization_id (nullable=global), title, source_path, content_hash',
         'UNIQUE (source_path, org_id)'],
        ['kb_chunk', 'document_id, chunk_index, content, embedding vector(1024)',
         'ivfflat cosine, FK doc_id'],
        ['org_ai_api_key', 'organization_id, provider, api_key (AES-256), model_override',
         'UNIQUE (org_id, provider)'],
        ['org_whatsapp_template', 'organization_id, template_key, body, variables JSONB',
         'UNIQUE (org_id, key)'],
        ['org_vision_alert', 'organization_id (UNIQUE), monthly_token_threshold, last_alerted_at',
         'Opt-in alerts par org'],
        ['property_elasticity_estimate', 'property_id, elasticity, sample_size, computed_at',
         'Cache empirique recalculé'],
    ]
    story.append(make_table(['Table', 'Colonnes clés', 'Index/Contraintes'],
                            db_rows, col_widths=[48*mm, 80*mm, 42*mm]))

    story.append(Spacer(1, 16))
    story.append(Paragraph('Migrations Liquibase', styles['SubSection']))
    mig_rows = [
        ['0143', 'CREATE EXTENSION vector (pgvector)'],
        ['0144', 'tables kb_document + kb_chunk'],
        ['0145', 'colonne embedding vector(1024) sur assistant_memory'],
        ['0146', 'colonnes last_accessed_at + expires_at sur assistant_memory'],
        ['0147', 'tables property_pricing_config + property_elasticity_estimate'],
        ['0148', 'table org_whatsapp_template'],
        ['0149', 'table org_vision_alert'],
        ['0150', 'colonne version (optimistic locking) sur assistant_workflow_run'],
    ]
    story.append(make_table(['ID', 'Description'], mig_rows,
                            col_widths=[20*mm, 150*mm]))

    story.append(Spacer(1, 12))
    story.append(make_info_box(
        '<b>Point de vigilance :</b> les <i>native queries</i> bypassent le filtre Hibernate. '
        'Toute query native sur une table tenant-scoped <b>DOIT</b> inclure manuellement '
        '<code>WHERE organization_id = :orgId</code> en paramètre. Vérifié pour '
        '<code>AssistantMemoryRepository.searchByCosineSimilarity()</code> suite à un audit critique.',
        color=CLENZY_ACCENT_RED, icon='⚠'))

    story.append(PageBreak())

    # ━━━━━ 4. CORE AGENT ━━━━━
    story.append(Paragraph('4. Core Agent : Orchestrator + LLM Provider', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph('AgentOrchestrator (cœur du système)', styles['SubSection']))
    story.append(Paragraph(
        'Fichier : <code>server/src/main/java/com/clenzy/service/agent/AgentOrchestrator.java</code> (~46 KB)',
        styles['BodyText']))

    story.append(Paragraph('Constantes clés :', styles['BodyBold']))
    const_rows = [
        ['MAX_TOOL_ITERATIONS = 5', 'Safety net contre boucles infinies LLM ↔ tools'],
        ['MAX_TOKENS_PER_TURN = 4096', 'Limite réponse LLM par tour'],
        ['DEFAULT_TEMPERATURE = 0.3', 'Mode déterministe (moins de créativité)'],
        ['MAX_MEMORY_ENTRIES = 30', 'Memory entries injectées dans system prompt'],
        ['RAG_TOP_K = 4', 'Chunks KB auto-injectés à chaque message'],
        ['RAG_RELEVANCE_MIN = 0.70', 'Seuil minimum cosine similarity pour injection'],
    ]
    story.append(make_table(['Constante', 'Rôle'], const_rows,
                            col_widths=[55*mm, 115*mm]))

    story.append(Spacer(1, 12))
    story.append(Paragraph('Boucle interne runToolLoop()', styles['SubSubSection']))
    story.append(Paragraph('''<font color="#374151"><font face="Courier" size="8.5">
for iter in 0..MAX_TOOL_ITERATIONS:<br/>
&nbsp;&nbsp;outcome = streamOneTurn(request, conversation, apiKey, consumer)<br/>
&nbsp;&nbsp;if outcome.isError(): emit error → return<br/>
&nbsp;&nbsp;persist(assistantMessage(text + tool_calls + tokens))<br/>
&nbsp;&nbsp;if outcome.toolCalls.isEmpty():<br/>
&nbsp;&nbsp;&nbsp;&nbsp;emit done → return<br/>
&nbsp;&nbsp;if anyToolRequiresConfirmation(outcome.toolCalls):<br/>
&nbsp;&nbsp;&nbsp;&nbsp;pendingToolStore.add(toolCallId, futureHistory)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;emit tool_confirmation_request → PAUSE<br/>
&nbsp;&nbsp;for toolCall in outcome.toolCalls:<br/>
&nbsp;&nbsp;&nbsp;&nbsp;handler = registry.find(toolCall.name())<br/>
&nbsp;&nbsp;&nbsp;&nbsp;result = handler.execute(toolCall.args(), context)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;persist(toolMessage(toolCallId, result))<br/>
&nbsp;&nbsp;&nbsp;&nbsp;request.appendMessage(toolMessage)<br/>
</font></font>''', styles['CodeBlock']))

    story.append(Paragraph('AnthropicChatProvider (LLM driver)', styles['SubSection']))
    story.append(Paragraph(
        'Wrapper SSE pour l\'API Anthropic Messages, avec parsing en temps réel des events stream '
        '(<code>message_start</code>, <code>content_block_delta</code>, <code>tool_use</code>…). '
        'Supporte le BYOK (clé API par organisation, encryptée AES-256 dans <code>org_ai_api_key</code>) '
        'avec fallback sur la clé plateforme <code>ANTHROPIC_API_KEY</code>.',
        styles['BodyText']))

    sse_rows = [
        ['message_start', 'capture usage.input_tokens initial'],
        ['content_block_start (text)', 'initialise accumulateur texte'],
        ['content_block_start (tool_use)', 'initialise accumulateur args tool'],
        ['content_block_delta (text_delta)', 'accumule + émet ChatEvent.TextDelta'],
        ['content_block_delta (input_json_delta)', 'accumule args tool (string concat)'],
        ['content_block_stop', 'flush du tool_use → ChatEvent.ToolCallRequest'],
        ['message_delta', 'capture stop_reason final + output_tokens'],
        ['message_stop', 'émet ChatEvent.Done (text, tokens, model, finishReason)'],
    ]
    story.append(make_table(['Event Anthropic SSE', 'Action interne'], sse_rows,
                            col_widths=[70*mm, 100*mm]))

    story.append(PageBreak())

    # ━━━━━ 5. TOOL FRAMEWORK ━━━━━
    story.append(Paragraph('5. Tool framework', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph(
        'Chaque tool implémente l\'interface <code>ToolHandler</code> et est <b>auto-découvert par Spring</b> '
        'à l\'init via le <code>ToolRegistry</code>. <b>Règle d\'or</b> : un tool ne touche JAMAIS la base de '
        'données directement — il délègue à un Service Spring existant qui porte les filtres tenant, '
        'l\'autorisation et la logique métier.',
        styles['BodyText']))

    story.append(Paragraph('Interface ToolHandler', styles['SubSection']))
    story.append(Paragraph('''<font face="Courier" size="9">
public interface ToolHandler {<br/>
&nbsp;&nbsp;String name();                          // ex: "list_reservations"<br/>
&nbsp;&nbsp;ToolDescriptor descriptor();            // JSON schema + requiresConfirmation<br/>
&nbsp;&nbsp;ToolResult execute(JsonNode args, AgentContext context);<br/>
}
</font>''', styles['CodeBlock']))

    story.append(Paragraph('ToolResult (record)', styles['SubSection']))
    story.append(Paragraph(
        '<code>ToolResult.success(jsonContent, displayHint)</code> ou <code>ToolResult.error(msg)</code>. '
        'Le <code>displayHint</code> route le rendu côté frontend vers le widget approprié.',
        styles['BodyText']))

    hint_rows = [
        ['summary', 'KpiSummaryWidget (tuiles KPI horizontales)'],
        ['list / table', 'DataTableWidget (table paginée)'],
        ['chart-bar', 'BarChartWidget (Recharts vertical)'],
        ['chart-line', 'LineChartWidget (évolution temporelle)'],
        ['chart-pie', 'PieChartWidget (répartition)'],
        ['insights', 'InsightsWidget (anomalies + recommendations)'],
        ['navigation', 'NavigationCardWidget (bouton cliquable vers route)'],
        ['portfolio', 'PortfolioOverviewWidget (KPIs cross-property)'],
        ['weather', 'WeatherWidget (forecast 7j)'],
        ['events', 'EventsWidget (jours fériés + festivals)'],
        ['simulation', 'SimulationWidget (baseline vs scenario)'],
        ['workflow', 'WorkflowWidget (étape multi-step)'],
        ['knowledge', 'KnowledgeWidget (snippets RAG avec citations)'],
    ]
    story.append(make_table(['displayHint', 'Widget React rendu'], hint_rows,
                            col_widths=[40*mm, 130*mm]))

    story.append(PageBreak())

    # ━━━━━ 6. INVENTAIRE 27 TOOLS ━━━━━
    story.append(Paragraph('6. Inventaire des 27 tools', styles['SectionTitle']))
    story.append(section_divider())

    story.append(chart_to_image(chart_tools_distribution(), width=120*mm, height=85*mm))
    story.append(Paragraph('Figure 3 : Répartition des 27 tools par catégorie',
                            styles['Caption']))

    story.append(Paragraph('6.1 Read tools (14 — sans confirmation)', styles['SubSection']))
    read_rows = [
        ['list_properties', 'city?, status?, type?, limit≤50', 'Liste propriétés'],
        ['list_reservations', 'propertyId?, status?, dateRange?, limit', 'Réservations paginées'],
        ['list_cleaning_tasks', 'propertyId?, status?, from?, limit', 'Tâches ménage'],
        ['get_dashboard_summary', '—', 'KPIs portfolio'],
        ['get_financial_summary', 'propertyId?, months', 'Revenue/expense/profit bar chart'],
        ['get_properties_performance', 'limit, metric (revenue/ratings)', 'Top N (bar chart)'],
        ['get_business_insights', 'propertyId', 'Anomalies + recommandations'],
        ['get_reservation_trend', 'propertyId, months', 'Line chart évolution'],
        ['get_occupancy_forecast', 'propertyId, days≤90', '% occupation prévisionnel'],
        ['get_interventions_by_status', 'propertyId?, daysBack', 'Pie chart statuts'],
        ['get_weather_forecast', 'city OR propertyId, days≤7', 'Météo (cache Redis 3h)'],
        ['get_local_events', 'city, from, to', 'Jours fériés + festivals + sport'],
        ['analyze_portfolio', 'daysBack', 'KPIs cross-property + patterns'],
        ['search_knowledge_base', 'query, topK≤10', 'Top K chunks doc Clenzy'],
    ]
    story.append(make_table(['Tool', 'Inputs', 'Cas d\'usage'],
                            read_rows, col_widths=[55*mm, 60*mm, 55*mm]))

    story.append(Spacer(1, 12))
    story.append(Paragraph('6.2 Write tools (7 — avec confirmation utilisateur)', styles['SubSection']))
    write_rows = [
        ['create_intervention', 'propertyId, title, type, scheduledDate', 'INSERT + notif staff'],
        ['assign_intervention', 'interventionId, assignedToUserId', 'UPDATE + notif assignee'],
        ['cancel_reservation', 'reservationId, cancellationReason', 'Soft-delete + refund Stripe'],
        ['update_property_status', 'propertyId, newStatus', 'Toggle online/offline OTA'],
        ['send_guest_message', 'reservationId, templateId, variables', 'Envoi SMS/Email/WhatsApp'],
        ['block_calendar_day', 'propertyId, from, to', 'INSERT BLOCKED + sync OTA'],
        ['forget_fact', 'key', 'DELETE memory (irréversible)'],
    ]
    story.append(make_table(['Tool', 'Inputs requis', 'Side-effect'],
                            write_rows, col_widths=[55*mm, 65*mm, 50*mm],
                            header_color=CLENZY_ACCENT_RED))

    story.append(make_info_box(
        'Tous les <b>write tools</b> ont <code>requiresConfirmation=true</code>. Le LLM propose '
        'l\'action, l\'orchestrateur <b>pause le flux SSE</b>, le frontend affiche un dialog avec les '
        'arguments lisibles, et l\'utilisateur confirme/refuse explicitement via '
        '<code>POST /api/assistant/tool-confirm</code>.',
        color=CLENZY_ACCENT_GOLD, icon='⚡'))

    story.append(Spacer(1, 12))
    story.append(Paragraph('6.3 Simulation tools (2 — sans confirmation, read-only)', styles['SubSection']))
    sim_rows = [
        ['simulate_pricing_change',
         'propertyId, pctChange ∈ [-50, +50], from?, to?',
         'baseline vs scenario + recommendation textuelle'],
        ['simulate_calendar_block',
         'propertyId, from, to',
         'revenue perdu + occupation break-even'],
    ]
    story.append(make_table(['Tool', 'Inputs', 'Output'],
                            sim_rows, col_widths=[55*mm, 55*mm, 60*mm],
                            header_color=CLENZY_ACCENT_TEAL))

    story.append(Spacer(1, 12))
    story.append(Paragraph('6.4 Workflow + Memory + Navigation (4)', styles['SubSection']))
    misc_rows = [
        ['start_workflow', 'Initie procédure guidée (onboard_property, end_of_month_closing…)'],
        ['advance_workflow', 'Avance d\'une étape après input user'],
        ['remember_fact', 'Upsert memory (key, value, scope) + embedding'],
        ['suggest_navigation', 'Bouton cliquable vers /route dans le chat'],
    ]
    story.append(make_table(['Tool', 'Rôle'], misc_rows,
                            col_widths=[50*mm, 120*mm], header_color=CLENZY_ACCENT_BLUE))

    story.append(PageBreak())

    # ━━━━━ 7. RAG ━━━━━
    story.append(Paragraph('7. Knowledge Base RAG (pgvector)', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph(
        'Le <b>RAG (Retrieval-Augmented Generation)</b> permet à l\'assistant de citer la documentation '
        'Clenzy avec un anti-hallucination strict. Les LLM ont une date de cutoff et ne connaissent pas '
        'la doc projet — le RAG comble cette lacune en injectant les passages pertinents directement '
        'dans le system prompt.',
        styles['BodyText']))

    story.append(chart_to_image(diagram_rag_flow(), width=170*mm, height=85*mm))
    story.append(Paragraph('Figure 4 : Flow RAG complet — ingestion + query + auto-injection',
                            styles['Caption']))

    story.append(Paragraph('Providers swappables', styles['SubSection']))
    prov_rows = [
        ['Embeddings — Voyage', 'voyage-3-lite', '1024', '128 / batch', '~$0.02/1M tokens'],
        ['Embeddings — OpenAI', 'text-embedding-3-small', '1024 (param)', '2048 / batch', '~$0.02/1M tokens'],
        ['Re-rank — Voyage', 'rerank-2 (cross-encoder)', 'N/A', '—', '~$0.05/1k pairs'],
        ['Re-rank — NoOp', 'identity (fallback)', 'N/A', '—', '$0'],
    ]
    story.append(make_table(['Provider', 'Modèle', 'Dim', 'Batch', 'Coût'],
                            prov_rows, col_widths=[42*mm, 50*mm, 18*mm, 25*mm, 35*mm]))

    story.append(Spacer(1, 12))
    story.append(Paragraph('Auto-injection vs Tool explicit', styles['SubSection']))
    inj_rows = [
        ['Auto-injection', 'À chaque message user', 'Invisible — chunks dans system prompt', 'Transparent'],
        ['Tool search_knowledge_base', 'LLM décide quand', 'Visible — résultat tool structuré', 'LLM contrôle topK'],
    ]
    story.append(make_table(['Mode', 'Quand', 'Visibilité au LLM', 'Avantage'],
                            inj_rows, col_widths=[55*mm, 35*mm, 50*mm, 30*mm]))

    story.append(Spacer(1, 12))
    story.append(make_info_box(
        '<b>Anti-hallucination :</b> le system prompt contient l\'instruction explicite '
        '"Cite tes sources via <code>[titre](path)</code> si tu utilises ces snippets — '
        'n\'invente jamais une procédure non documentée". Combiné au modèle Haiku 4.5 strict '
        'pour les briefings, cela réduit drastiquement les hallucinations.',
        color=CLENZY_ACCENT_TEAL, icon='✓'))

    story.append(PageBreak())

    # ━━━━━ 8. MEMORY ━━━━━
    story.append(Paragraph('8. Memory long-terme', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph(
        'L\'assistant retient durablement les préférences et faits importants de l\'utilisateur, classés '
        'en <b>4 scopes</b>, sélectionnés par <b>pertinence sémantique</b> (embedding cosine similarity) '
        'à chaque message.',
        styles['BodyText']))

    story.append(chart_to_image(diagram_memory_scopes(), width=170*mm, height=80*mm))
    story.append(Paragraph('Figure 5 : 4 scopes de memory avec exemples concrets',
                            styles['Caption']))

    story.append(Paragraph('Cascade de sélection', styles['SubSection']))
    story.append(Paragraph(
        '<b>1.</b> Si <code>EmbeddingService</code> disponible et message user non-blank → embed query '
        '→ query native pgvector cosine sur les memories de l\'user → top 30 triées par similarité.<br/><br/>'
        '<b>2.</b> Sinon (provider down ou message vide) → fallback <code>listForUser</code> triées par '
        '<code>last_accessed_at desc</code>.<br/><br/>'
        '<b>Effet de bord :</b> <code>last_accessed_at</code> est bumped en batch sur les memories '
        'retournées → purge naturelle des memories mortes (non lues depuis 6 mois → DELETE).',
        styles['BodyText']))

    story.append(Paragraph('Cleanup automatique (lundi 3h UTC)', styles['SubSection']))
    story.append(Paragraph('''<font face="Courier" size="9">
DELETE FROM assistant_memory<br/>
WHERE last_accessed_at &lt; NOW() - INTERVAL '6 months'<br/>
&nbsp;&nbsp;OR (expires_at IS NOT NULL AND expires_at &lt; NOW());
</font>''', styles['CodeBlock']))

    story.append(PageBreak())

    # ━━━━━ 9. SIMULATIONS ━━━━━
    story.append(Paragraph('9. Simulations pricing & calendrier', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph('SimulatePricingChangeTool', styles['SubSection']))
    story.append(Paragraph(
        '<b>Question type :</b> "Que se passe-t-il si je baisse le prix de 10% en juillet ?"',
        styles['BodyBold']))
    story.append(Paragraph('Algorithme :', styles['BodyText']))
    story.append(Paragraph('''<font face="Courier" size="9">
ADR_baseline       = revenue / nuits_occupées<br/>
ADR_scenario       = ADR_baseline × (1 + pctChange)<br/>
Occupancy_baseline = nuits_occupées / jours_période<br/>
Occupancy_scenario = Occupancy_baseline × (1 - elasticity × pctChange)<br/>
Revenue_baseline   = ADR_baseline × Occupancy_baseline × jours<br/>
Revenue_scenario   = ADR_scenario × Occupancy_scenario × jours<br/>
Δ Revenue          = Revenue_scenario - Revenue_baseline<br/>
Recommendation     = "✓ Hausse recommandée" si Δ > 0 sinon "⚠ Baisse réduit le revenu"
</font>''', styles['CodeBlock']))

    story.append(Paragraph('EmpiricalElasticityEstimator', styles['SubSection']))
    story.append(Paragraph(
        'Calcule <b>empiriquement</b> l\'élasticité prix-demande d\'une propriété sur les 12 derniers '
        'mois en analysant les paires (mois T, mois T+1) avec |ΔADR%| ≥ 2%. Au moins 3 paires '
        'significatives requises, élasticité bornée dans [0.1, 1.5]. Fallback : 0.5 (valeur industrie '
        'moyenne).',
        styles['BodyText']))

    story.append(Paragraph('Optimisations performance', styles['SubSubSection']))
    story.append(Paragraph(
        '• <b>Bucketing O(N×M)</b> par YearMonth plutôt que jour-par-jour → 100× plus rapide sur historiques chargés<br/>'
        '• <b>Guards anti-div/0</b> : <code>if (prevAdr ≤ 0) continue;</code>, <code>if (deltaAdr == 0) continue;</code><br/>'
        '• <b>Cache</b> dans <code>property_elasticity_estimate</code>, recalcul scheduler weekly (> 30j obsolescence)',
        styles['BodyText']))

    story.append(PageBreak())

    # ━━━━━ 10. WORKFLOWS ━━━━━
    story.append(Paragraph('10. Workflows procéduraux', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph(
        'Les <b>workflows</b> sont des procédures multi-étapes guidées (ex: onboarding propriété, '
        'clôture de mois, préparation haute saison). Ils sont définis en YAML déclaratif et orchestrés '
        'par <code>WorkflowEngine</code> avec <b>optimistic locking</b> (@Version) pour la concurrence HA.',
        styles['BodyText']))

    story.append(Paragraph('Définition YAML (exemple onboard_property)', styles['SubSection']))
    story.append(Paragraph('''<font face="Courier" size="8.5">
id: onboard_property<br/>
name: "Onboarding nouvelle propriété"<br/>
steps:<br/>
&nbsp;&nbsp;- id: type_property<br/>
&nbsp;&nbsp;&nbsp;&nbsp;prompts:<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;fr: "Quel type de bien ?"<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;en: "What type of property?"<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ar: "ما نوع العقار؟"<br/>
&nbsp;&nbsp;&nbsp;&nbsp;expects_data:<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;type: string<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;enum: [APARTMENT, HOUSE, STUDIO]<br/>
&nbsp;&nbsp;- id: confirm<br/>
&nbsp;&nbsp;&nbsp;&nbsp;prompts: { fr: "Confirmer la création de {{summary}} ?" }<br/>
&nbsp;&nbsp;&nbsp;&nbsp;action: create_property
</font>''', styles['CodeBlock']))

    story.append(Paragraph('WorkflowEngine (sans état)', styles['SubSection']))
    wf_rows = [
        ['collectData(run, def, response)', 'Valide la réponse contre JSON schema, merge dans collected_data'],
        ['advanceStep(run, def)', 'Incrémente current_step_idx ou marque COMPLETED'],
        ['renderPrompt(step, run, language)', 'Interpole {{summary}}, {{collectedData.x}} dans la traduction'],
        ['executeStepAction(step, run, language)', 'Retourne suggestion structurée pour le LLM (tool + args)'],
    ]
    story.append(make_table(['Méthode', 'Rôle'], wf_rows,
                            col_widths=[60*mm, 110*mm]))

    story.append(Spacer(1, 12))
    story.append(make_info_box(
        '<b>Optimistic locking</b> : si deux requêtes tentent d\'avancer le même run simultanément '
        '(user ouvre 2 onglets), seule l\'une réussit. L\'autre reçoit <code>OptimisticLockException</code> '
        '→ l\'agent peut re-prompter "réessayez". Évite les corruptions d\'état.',
        color=CLENZY_ACCENT_BLUE, icon='⚙'))

    story.append(PageBreak())

    # ━━━━━ 11. BRIEFINGS ━━━━━
    story.append(Paragraph('11. Briefings proactifs', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph(
        'Recevoir chaque matin un <b>résumé personnalisé</b> des KPIs et alertes du portfolio, sans '
        'avoir à ouvrir le PMS. 3 canaux configurables par l\'utilisateur : in-app, email HTML, '
        'WhatsApp (via Twilio template).',
        styles['BodyText']))

    story.append(chart_to_image(diagram_briefing_flow(), width=170*mm, height=80*mm))
    story.append(Paragraph('Figure 6 : Flow briefings — scheduler → composer (Haiku 4.5) → dispatch parallèle',
                            styles['Caption']))

    story.append(Paragraph('Configuration utilisateur (Settings > IA > Briefings)', styles['SubSection']))
    cfg_rows = [
        ['Activé', 'on / off'],
        ['Fréquence', 'DAILY_MORNING / WEEKLY_SUNDAY / ONLY_ALERTS'],
        ['Heure locale', 'HH:mm (ex: 08:00)'],
        ['Timezone', 'Europe/Paris (auto-détecté depuis JWT)'],
        ['Canaux', 'multi-select [in_app, email, whatsapp]'],
    ]
    story.append(make_table(['Champ', 'Options'], cfg_rows,
                            col_widths=[40*mm, 130*mm]))

    story.append(Spacer(1, 12))
    story.append(Paragraph('Retry CAS atomique (BriefingRetryScheduler)', styles['SubSection']))
    story.append(Paragraph(
        'Le retry scheduler horaire utilise un <b>Compare-And-Swap atomique</b> sur le status du log : '
        '<code>tryAcquireRetry(log_id, current=FAILED → new=RETRYING)</code>. Cela évite le double-retry si '
        'deux instances scheduler tournent en HA simultanément. Si l\'acquisition échoue, l\'instance '
        'skip ce log (une autre s\'en occupe).',
        styles['BodyText']))

    story.append(PageBreak())

    # ━━━━━ 12. VISION ━━━━━
    story.append(Paragraph('12. Vision (images)', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph('Cas d\'usage métier', styles['SubSection']))
    story.append(Paragraph(
        '• Upload photo de <b>dégradation</b> dans un logement → l\'assistant crée automatiquement une intervention maintenance avec description<br/>'
        '• Upload <b>facture fournisseur</b> → extraction des montants, fournisseur, date<br/>'
        '• Upload <b>plan d\'aménagement</b> → suggestions de mobilier',
        styles['BodyText']))

    story.append(Paragraph('Limites Anthropic', styles['SubSection']))
    lim_rows = [
        ['Taille max', '5 MB par image'],
        ['Formats acceptés', 'image/jpeg, image/png, image/gif, image/webp'],
        ['Modèle requis', 'Claude 3.5 Sonnet+ (défaut claude-sonnet-4-20250514 ✓)'],
        ['Limite UX', '3 images max par message (frontend ChatInput.tsx)'],
        ['Encoding', 'Base64 in-document (pas d\'URLs)'],
    ]
    story.append(make_table(['Critère', 'Valeur'], lim_rows,
                            col_widths=[40*mm, 130*mm]))

    story.append(Spacer(1, 12))
    story.append(Paragraph('Tracking & alertes', styles['SubSection']))
    story.append(Paragraph(
        '<code>VisionTokenUsageService</code> agrège les <code>prompt_tokens</code> des messages avec '
        '<code>attachments IS NOT NULL</code> sur 30 jours glissants par organisation. '
        '<code>VisionUsageAlertScheduler</code> compare l\'usage vs le seuil configuré dans '
        '<code>org_vision_alert.monthly_token_threshold</code> et notifie l\'admin org en cas de '
        'dépassement (avec cool-down via <code>last_alerted_at</code> pour éviter le spam).',
        styles['BodyText']))

    story.append(make_info_box(
        '<b>Sécurité ownership :</b> <code>GET /api/assistant/attachments/{storageKey}</code> valide '
        'via query native que le storageKey appartient bien à une conversation de l\'utilisateur '
        'courant. <b>404 silencieux</b> si mismatch (évite l\'énumération de storage keys).',
        color=CLENZY_ACCENT_RED, icon='🔒'))

    story.append(PageBreak())

    # ━━━━━ 13. FRONTEND CHAT ━━━━━
    story.append(Paragraph('13. Frontend chat', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph('Arborescence', styles['SubSection']))
    story.append(Paragraph('''<font face="Courier" size="8.5">
client/src/modules/assistant/<br/>
├── AssistantPage.tsx          (page racine, layout 3 zones)<br/>
├── components/<br/>
│&nbsp;&nbsp;&nbsp;├── MessageList.tsx        (virtualized scroll)<br/>
│&nbsp;&nbsp;&nbsp;├── MessageBubble.tsx      (user droite / assistant gauche)<br/>
│&nbsp;&nbsp;&nbsp;├── ChatInput.tsx          (textarea + voice + upload)<br/>
│&nbsp;&nbsp;&nbsp;├── ToolCallCard.tsx<br/>
│&nbsp;&nbsp;&nbsp;├── ToolConfirmationDialog.tsx<br/>
│&nbsp;&nbsp;&nbsp;└── ConversationListSidebar.tsx<br/>
└── widgets/<br/>
&nbsp;&nbsp;&nbsp;&nbsp;├── ToolResultWidget.tsx (routeur par displayHint)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;└── 13 widgets spécialisés (KpiSummary, DataTable, Charts…)
</font>''', styles['CodeBlock']))

    story.append(Paragraph('Voice input (Web Speech API)', styles['SubSection']))
    voice_rows = [
        ['API native', 'SpeechRecognition (Chrome/Edge/Safari)'],
        ['Mapping langue', 'fr-FR, en-US, ar-MA (depuis i18n context)'],
        ['continuous', 'false (1 utterance par activation)'],
        ['interimResults', 'true (feedback temps réel)'],
        ['Comportement', 'Append au texte existant (pas d\'overwrite)'],
        ['Animation', 'Pulse mic CSS keyframes pendant écoute'],
        ['Errors gérées', 'not-allowed, audio-capture, network, no-speech'],
    ]
    story.append(make_table(['Aspect', 'Valeur'], voice_rows,
                            col_widths=[45*mm, 125*mm]))

    story.append(PageBreak())

    # ━━━━━ 14. SECURITE ━━━━━
    story.append(Paragraph('14. Sécurité & multi-tenant', styles['SectionTitle']))
    story.append(section_divider())

    sec_rows = [
        ['Authentification', 'Keycloak JWT (cookie HttpOnly clenzy_auth)'],
        ['Autorisation controller', '@PreAuthorize("isAuthenticated()") sur AssistantController'],
        ['Autorisation tools', 'Délégation aux Services Spring (checks rôles + ownership)'],
        ['Multi-tenant', 'TenantFilter → TenantContext (ThreadLocal) → Hibernate organizationFilter'],
        ['Confirmation write tools', 'requiresConfirmation=true → POST /tool-confirm explicite'],
        ['Audit', 'AuditLogService trace toutes les actions write tools'],
        ['API keys', 'Plateforme : env var. BYOK : AES-256 in org_ai_api_key. Jamais loggées en clair.'],
        ['Vision attachments', 'Native query ownership check (404 si mismatch, anti-énumération)'],
    ]
    story.append(make_table(['Couche', 'Mécanisme'], sec_rows,
                            col_widths=[50*mm, 120*mm]))

    story.append(Spacer(1, 12))
    story.append(make_info_box(
        '<b>Cloisonnement strict :</b> aucune fuite cross-organisation possible via les repositories '
        'JPA standards (filtre Hibernate automatique). Les <i>native queries</i> sont auditées '
        'manuellement pour inclure <code>WHERE organization_id = :orgId</code> explicite.',
        color=CLENZY_ACCENT_TEAL, icon='🛡'))

    story.append(PageBreak())

    # ━━━━━ 15. CONFIGURATION ━━━━━
    story.append(Paragraph('15. Configuration & déploiement', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph('Variables d\'environnement (plateforme)', styles['SubSection']))
    story.append(Paragraph('''<font face="Courier" size="8.5">
# LLM<br/>
ANTHROPIC_API_KEY=sk-ant-...                     # fallback BYOK<br/><br/>
# Embeddings<br/>
clenzy.ai.embeddings.provider=voyage             # ou openai<br/>
clenzy.ai.embeddings.voyage.api-key=pa-...<br/>
clenzy.ai.embeddings.relevance-threshold=0.70<br/><br/>
# Re-ranking<br/>
clenzy.ai.rerank.enabled=true<br/>
clenzy.ai.rerank.provider=voyage                 # ou noop<br/><br/>
# Memory<br/>
clenzy.assistant.memory.relevance-enabled=true<br/>
clenzy.assistant.memory.cleanup-enabled=true<br/><br/>
# Briefings<br/>
clenzy.assistant.briefing.retry-enabled=true<br/>
clenzy.assistant.briefing.model=claude-haiku-4-5<br/><br/>
# Vision<br/>
clenzy.assistant.vision.enabled=true
</font>''', styles['CodeBlock']))

    story.append(Paragraph('Schedulers actifs (6)', styles['SubSection']))
    sched_rows = [
        ['BriefingScheduler', '0 0 * * * * (horaire)', 'Émet briefings selon prefs user'],
        ['BriefingRetryScheduler', '0 30 * * * * (horaire+30)', 'Retry des briefings FAILED (CAS atomique)'],
        ['AssistantMemoryCleanupScheduler', '0 0 3 * * 1 (lundi 3h UTC)', 'Purge memories stales > 6 mois'],
        ['VisionUsageAlertScheduler', '0 0 9 * * 1 (lundi 9h)', 'Alerte si org dépasse son quota vision'],
        ['ElasticityRecomputeScheduler', '0 0 4 * * 0 (dim 4h)', 'Recalcule élasticité empirique > 30j'],
        ['KbIndexTuningScheduler', '0 0 2 1 * * (1er du mois)', 'Recalcule ivfflat lists selon volume'],
    ]
    story.append(make_table(['Scheduler', 'Cron', 'Rôle'], sched_rows,
                            col_widths=[55*mm, 45*mm, 70*mm]))

    story.append(Spacer(1, 12))
    story.append(make_info_box(
        '<b>Docker pgvector requis :</b> l\'image PostgreSQL doit être <code>pgvector/pgvector:pg15</code> '
        '(pas <code>postgres:15</code> standard) — sinon la migration 0143 (CREATE EXTENSION vector) '
        'échoue au boot. Voir <code>clenzy-infra/docker-compose.dev.yml</code>.',
        color=CLENZY_ACCENT_GOLD, icon='⚙'))

    story.append(PageBreak())

    # ━━━━━ 16. LIMITES & ROADMAP ━━━━━
    story.append(Paragraph('16. Limites connues & TODOs', styles['SectionTitle']))
    story.append(section_divider())

    story.append(Paragraph('Implémenté mais perfectible', styles['SubSection']))
    limits = [
        ('Token budget non-enforcé',
         'AiProperties.TokenBudget.enforced=true configurable mais pas de logique de blocage dans AgentOrchestrator (passive monitoring uniquement).'),
        ('PendingToolStore in-memory',
         'Les tools en attente de confirmation expirent à la fin de la session (pas de persistance BDD). Si user ferme l\'onglet, le tool est perdu.'),
        ('Élasticité sans saisonnalité',
         'Moyenne arithmétique des paires (T, T+1), peut être biaisée par un mois exceptionnel. À terme : régression linéaire multi-variée.'),
        ('Pas de retry exponentiel Anthropic',
         'Erreur réseau → propagée au frontend qui peut re-envoyer. Le SDK HTTP a un retry basique mais non configuré.'),
        ('Workflows non hot-reloadables',
         'Les définitions YAML sont chargées au boot via @PostConstruct. Modification nécessite restart.'),
    ]
    for title, desc in limits:
        story.append(Paragraph(f'• <b>{title}</b><br/>&nbsp;&nbsp;&nbsp;<i>{desc}</i>',
                                styles['BulletItem']))

    story.append(Spacer(1, 12))
    story.append(Paragraph('Roadmap potentielle', styles['SubSection']))
    roadmap = [
        'Streaming voice output (TTS Eleven Labs pour réponses parlées, mobile-first)',
        'Multi-tour confirmation ("tu confirmes ces 5 interventions ?" en batch)',
        'Memory hiérarchique (org-shared memory en plus de user-scoped)',
        'Tool sandboxing (rate limit par user, max writes/jour)',
        'A/B testing prompts (framework pour comparer 2 system prompts en prod)',
        'Fine-tuning du re-ranker sur les data Clenzy (cross-encoder spécifique)',
    ]
    for item in roadmap:
        story.append(Paragraph(f'• {item}', styles['BulletItem']))

    story.append(Spacer(1, 16))
    story.append(Paragraph('Coûts opérationnels (estimation 1000 utilisateurs actifs)', styles['SubSection']))
    story.append(chart_to_image(chart_costs_llm(), width=160*mm, height=85*mm))
    story.append(Paragraph('Figure 7 : Estimation des coûts LLM mensuels par usage type',
                            styles['Caption']))

    story.append(Spacer(1, 8))
    story.append(chart_to_image(chart_latency_p99(), width=160*mm, height=70*mm))
    story.append(Paragraph('Figure 8 : Latence p99 par scénario d\'usage',
                            styles['Caption']))

    story.append(Spacer(1, 16))
    story.append(make_info_box(
        '<b>Quota Anthropic :</b> tier 4 par défaut (4000 RPM, 400k TPM). Suffisant pour ~100 users '
        'actifs simultanés. Au-delà : passer en tier 5 ou implémenter du queueing.',
        color=CLENZY_ACCENT_BLUE, icon='ℹ'))

    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=1, color=CLENZY_LIGHT))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        '<b>Fin du document</b> — pour questions ou évolutions, contacter l\'équipe Clenzy.',
        styles['Footer']))

    return story


# ============================================================================
# MAIN
# ============================================================================

def main():
    print(f"Generating PDF: {OUTPUT_PATH}")

    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        topMargin=25*mm,
        bottomMargin=22*mm,
        leftMargin=20*mm,
        rightMargin=20*mm,
        title="Clenzy — Assistant IA — Architecture",
        author="Équipe Clenzy",
        subject="Documentation technique Assistant IA",
        keywords="Clenzy, IA, Assistant, PMS, Architecture",
    )

    # Build content
    story = build_story()

    # Generate (first_page for cover, add_page_decorations for rest)
    doc.build(story, onFirstPage=first_page, onLaterPages=add_page_decorations)

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"✓ PDF generated: {OUTPUT_PATH} ({size_kb:.1f} KB)")


if __name__ == '__main__':
    main()
