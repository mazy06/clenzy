#!/usr/bin/env python3
"""Generate Twilio Setup Guide PDF for Clenzy PMS."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib import colors
import os

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "Guide_Configuration_Twilio_Clenzy.pdf")

PRIMARY = HexColor("#6B8A9A")
PRIMARY_DARK = HexColor("#4A6B7A")
ACCENT = HexColor("#4A9B8E")
BG_LIGHT = HexColor("#F5F8FA")
BG_STEP = HexColor("#EBF2F5")
TEXT_PRIMARY = HexColor("#2C3E50")
TEXT_SECONDARY = HexColor("#5A6C7D")
ORANGE_WARN = HexColor("#E67E22")
RED_ALERT = HexColor("#E74C3C")
GREEN_OK = HexColor("#27AE60")

def get_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        'DocTitle', parent=styles['Title'],
        fontSize=22, textColor=PRIMARY_DARK, spaceAfter=6,
        fontName='Helvetica-Bold', alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'DocSubtitle', parent=styles['Normal'],
        fontSize=11, textColor=TEXT_SECONDARY, spaceAfter=16,
        fontName='Helvetica', alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'SectionTitle', parent=styles['Heading1'],
        fontSize=16, textColor=PRIMARY_DARK, spaceBefore=20, spaceAfter=8,
        fontName='Helvetica-Bold', borderPadding=(0, 0, 4, 0),
    ))
    styles.add(ParagraphStyle(
        'StepTitle', parent=styles['Heading2'],
        fontSize=13, textColor=PRIMARY, spaceBefore=14, spaceAfter=6,
        fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'Body', parent=styles['Normal'],
        fontSize=10, textColor=TEXT_PRIMARY, spaceAfter=6,
        fontName='Helvetica', leading=14,
    ))
    styles.add(ParagraphStyle(
        'BodyBold', parent=styles['Normal'],
        fontSize=10, textColor=TEXT_PRIMARY, spaceAfter=6,
        fontName='Helvetica-Bold', leading=14,
    ))
    styles.add(ParagraphStyle(
        'BulletItem', parent=styles['Normal'],
        fontSize=10, textColor=TEXT_PRIMARY, spaceAfter=3,
        fontName='Helvetica', leading=14, leftIndent=16, bulletIndent=6,
    ))
    styles.add(ParagraphStyle(
        'Warning', parent=styles['Normal'],
        fontSize=10, textColor=ORANGE_WARN, spaceAfter=8, spaceBefore=4,
        fontName='Helvetica-Bold', leading=14,
        leftIndent=8, borderPadding=(4, 4, 4, 4),
    ))
    styles.add(ParagraphStyle(
        'CodeBlock', parent=styles['Normal'],
        fontSize=9, textColor=HexColor("#1A1A2E"), spaceAfter=8,
        fontName='Courier', leading=13, leftIndent=12,
        backColor=BG_LIGHT, borderPadding=(6, 6, 6, 6),
    ))
    styles.add(ParagraphStyle(
        'Footer', parent=styles['Normal'],
        fontSize=8, textColor=TEXT_SECONDARY,
        fontName='Helvetica', alignment=TA_CENTER
    ))
    return styles


def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )
    styles = get_styles()
    story = []

    # ── Title ──
    story.append(Paragraph("Guide de Configuration Twilio", styles['DocTitle']))
    story.append(Paragraph("Clenzy PMS - Envoi de SMS et WhatsApp aux guests", styles['DocSubtitle']))
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY, spaceAfter=12))

    # ── Meta info ──
    meta_data = [
        ["Destinataire", "Responsable administratif / operations"],
        ["Temps estime", "30 min de configuration + 24-48h de validation reglementaire"],
        ["Date", "13 mars 2026"],
    ]
    meta_table = Table(meta_data, colWidths=[4*cm, 12*cm])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), PRIMARY),
        ('TEXTCOLOR', (1, 0), (1, -1), TEXT_PRIMARY),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # ── Prerequis ──
    story.append(Paragraph("Prerequis", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=BG_STEP, spaceAfter=8))
    prereqs = [
        "Un compte Twilio actif (https://console.twilio.com)",
        "Un Kbis ou extrait d'immatriculation de la societe (PDF, moins de 3 mois)",
        "L'adresse officielle du siege social de la societe",
        "Une carte bancaire pour l'achat de numeros (~1-2 EUR/mois par numero)",
    ]
    for p in prereqs:
        story.append(Paragraph(f"&bull;  {p}", styles['BulletItem']))
    story.append(Spacer(1, 8))

    # ── Etat actuel ──
    story.append(Paragraph("Etat actuel de la configuration", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=BG_STEP, spaceAfter=8))

    status_data = [
        ["Variable", "Valeur", "Statut"],
        ["TWILIO_ACCOUNT_SID", "ACc3ca...e41d", "OK"],
        ["TWILIO_AUTH_TOKEN", "fcb76c...a78b", "OK"],
        ["TWILIO_MESSAGING_SERVICE_SID", "---", "A configurer (Etape 2)"],
        ["TWILIO_WHATSAPP_FROM", "---", "Optionnel (Etape 4)"],
        ["TWILIO_VERIFY_SID", "---", "Optionnel (Etape 5)"],
    ]
    status_table = Table(status_data, colWidths=[6*cm, 4.5*cm, 5.5*cm])
    status_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 1), (0, -1), 'Courier'),
        ('FONTNAME', (1, 1), (1, -1), 'Courier'),
        ('FONTNAME', (2, 1), (2, -1), 'Helvetica'),
        ('TEXTCOLOR', (2, 1), (2, 2), GREEN_OK),
        ('TEXTCOLOR', (2, 3), (2, 3), RED_ALERT),
        ('TEXTCOLOR', (2, 4), (2, 5), TEXT_SECONDARY),
        ('BACKGROUND', (0, 1), (-1, -1), BG_LIGHT),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#D5DEE5")),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(status_table)
    story.append(Spacer(1, 12))

    # ══════════════════════════════════════════════════════════════════
    # ETAPE 1
    # ══════════════════════════════════════════════════════════════════
    story.append(Paragraph("Etape 1 - Creer un Regulatory Bundle", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=BG_STEP, spaceAfter=8))
    story.append(Paragraph(
        "Les numeros francais (+33) necessitent une validation reglementaire ARCEP. "
        "Cette etape est <b>obligatoire</b> avant de pouvoir acheter un numero francais.",
        styles['Body']
    ))

    story.append(Paragraph("Marche a suivre :", styles['BodyBold']))
    steps_1 = [
        "Aller sur <b>Twilio Console</b> &rarr; <b>Phone Numbers</b> &rarr; <b>Regulatory Compliance</b> &rarr; <b>Bundles</b>",
        "URL directe : https://console.twilio.com/us1/develop/phone-numbers/regulatory-compliance/bundles",
        'Cliquer <b>"Create a Bundle"</b>',
        "Selectionner : <b>Country</b> = France, <b>Number Type</b> = National, <b>Business Type</b> = Business",
        "Remplir les informations de l'entreprise :",
    ]
    for i, s in enumerate(steps_1):
        story.append(Paragraph(f"{i+1}.  {s}", styles['BulletItem']))

    sub_fields = [
        "<b>Business Name</b> : nom legal de la societe",
        "<b>Business Registration Number</b> : numero SIREN ou SIRET",
        "<b>Address</b> : adresse complete du siege social",
    ]
    for f in sub_fields:
        story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;&bull;  {f}", styles['BulletItem']))

    story.append(Paragraph(
        '6.  <b>Uploader le document</b> : Type = "Business Registration Document", '
        'Fichier = <b>Kbis de moins de 3 mois</b> (PDF)',
        styles['BulletItem']
    ))
    story.append(Paragraph("7.  Soumettre le bundle", styles['BulletItem']))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "DELAI : La validation prend generalement 24 a 48 heures. "
        "Vous recevrez un email de Twilio quand le bundle est approuve. "
        "Ne passez a l'etape 2 qu'apres approbation.",
        styles['Warning']
    ))

    # ══════════════════════════════════════════════════════════════════
    # ETAPE 2
    # ══════════════════════════════════════════════════════════════════
    story.append(Paragraph("Etape 2 - Acheter un numero et creer le Messaging Service", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=BG_STEP, spaceAfter=8))

    story.append(Paragraph("2.1 - Acheter un numero francais", styles['StepTitle']))
    steps_2a = [
        "Aller sur <b>Phone Numbers</b> &rarr; <b>Manage</b> &rarr; <b>Buy a Number</b>",
        "URL directe : https://console.twilio.com/us1/develop/phone-numbers/manage/search",
        "Rechercher : <b>Country</b> = France (+33), <b>Capabilities</b> = cocher <b>SMS</b>",
        "Choisir un numero et cliquer <b>\"Buy\"</b>",
        "<b>Assigner le Regulatory Bundle</b> cree a l'etape 1 (dropdown \"Assign approved Bundle\")",
        "Confirmer l'achat (~1.15 EUR/mois)",
    ]
    for i, s in enumerate(steps_2a):
        story.append(Paragraph(f"{i+1}.  {s}", styles['BulletItem']))
    story.append(Paragraph(
        "Notez ce numero de telephone, il sera associe au Messaging Service.",
        styles['Warning']
    ))

    story.append(Paragraph("2.2 - Creer le Messaging Service", styles['StepTitle']))
    steps_2b = [
        'Aller sur <b>Messaging</b> &rarr; <b>Services</b> (https://console.twilio.com/us1/develop/sms/services)',
        'Cliquer <b>"Create Messaging Service"</b>',
        '<b>Step 1</b> : Friendly Name = <b>"Clenzy PMS"</b>, Use case = "Notify my users" &rarr; Create',
        '<b>Step 2 - Add Senders</b> : cliquer "Add Senders" &rarr; Type = Phone Number &rarr; selectionner le numero achete &rarr; confirmer',
        '<b>Step 3 - Set up integration</b> : laisser les options par defaut &rarr; continuer',
        '<b>Step 4 - Add compliance info</b> : remplir les informations &rarr; "Complete Messaging Service Setup"',
    ]
    for i, s in enumerate(steps_2b):
        story.append(Paragraph(f"{i+1}.  {s}", styles['BulletItem']))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Recuperer le Messaging Service SID :", styles['BodyBold']))
    story.append(Paragraph(
        "Retourner sur <b>Messaging</b> &rarr; <b>Services</b> &rarr; <b>Clenzy PMS</b>. "
        "Le <b>Messaging Service SID</b> est affiche en haut de la page (commence par <b>MG...</b>).",
        styles['Body']
    ))
    story.append(Paragraph("TWILIO_MESSAGING_SERVICE_SID = MG...............................", styles['CodeBlock']))

    # ══════════════════════════════════════════════════════════════════
    # ETAPE 3
    # ══════════════════════════════════════════════════════════════════
    story.append(Paragraph("Etape 3 - Configurer les webhooks", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=BG_STEP, spaceAfter=8))
    story.append(Paragraph(
        "Cette etape sera realisee par l'equipe technique (developpeur). "
        "Rien a faire de votre cote.",
        styles['Body']
    ))
    story.append(Paragraph("URLs de webhook a configurer dans le Messaging Service :", styles['BodyBold']))
    webhook_data = [
        ["Webhook", "URL"],
        ["Status Callback", "https://app.clenzy.fr/api/webhooks/twilio/status"],
        ["Inbound Message", "https://app.clenzy.fr/api/webhooks/twilio/inbound"],
    ]
    wh_table = Table(webhook_data, colWidths=[5*cm, 11*cm])
    wh_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Courier'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 1), (-1, -1), BG_LIGHT),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#D5DEE5")),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(wh_table)
    story.append(Spacer(1, 8))

    # ══════════════════════════════════════════════════════════════════
    # ETAPE 4
    # ══════════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Paragraph("Etape 4 - WhatsApp Business (optionnel)", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=BG_STEP, spaceAfter=8))
    story.append(Paragraph(
        "Pour envoyer des messages WhatsApp aux guests. Deux modes disponibles :",
        styles['Body']
    ))

    story.append(Paragraph("4.1 - Mode Sandbox (test immediat)", styles['StepTitle']))
    story.append(Paragraph(
        'Aller sur <b>Messaging</b> &rarr; <b>Try it out</b> &rarr; <b>Send a WhatsApp message</b>. '
        'Suivre les instructions pour connecter votre telephone au sandbox. '
        'Le numero sandbox est temporaire et uniquement pour les tests.',
        styles['Body']
    ))
    story.append(Paragraph("Valeur de test : TWILIO_WHATSAPP_FROM = whatsapp:+14155238886", styles['CodeBlock']))

    story.append(Paragraph("4.2 - Mode Production (numero WhatsApp dedie)", styles['StepTitle']))
    steps_4 = [
        'Aller sur <b>Messaging</b> &rarr; <b>Senders</b> &rarr; <b>WhatsApp senders</b>',
        'Cliquer <b>"Add new sender"</b>',
        "Vous devrez avoir un compte <b>Meta Business Manager</b> verifie",
        "Associer un numero de telephone a <b>WhatsApp Business API</b>",
        "Faire approuver des <b>message templates</b> par Meta (necessaire pour les messages proactifs)",
        "Une fois configure, noter le numero WhatsApp",
    ]
    for i, s in enumerate(steps_4):
        story.append(Paragraph(f"{i+1}.  {s}", styles['BulletItem']))
    story.append(Paragraph("TWILIO_WHATSAPP_FROM = whatsapp:+33XXXXXXXXX", styles['CodeBlock']))
    story.append(Paragraph(
        "DELAI : La verification Meta Business peut prendre plusieurs jours a semaines. "
        "Le mode Sandbox permet de tester en attendant.",
        styles['Warning']
    ))

    # ══════════════════════════════════════════════════════════════════
    # ETAPE 5
    # ══════════════════════════════════════════════════════════════════
    story.append(Paragraph("Etape 5 - Verify Service / OTP (optionnel)", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=BG_STEP, spaceAfter=8))
    story.append(Paragraph(
        "Pour la verification OTP (code par SMS) des guests.",
        styles['Body']
    ))
    steps_5 = [
        'Aller sur <b>Verify</b> &rarr; <b>Services</b> (https://console.twilio.com/us1/develop/verify/services)',
        'Cliquer <b>"Create new"</b>',
        'Friendly Name = <b>"Clenzy Verification"</b>, Verification Channels = cocher <b>SMS</b>',
        'Cliquer <b>"Create"</b>',
        "Le <b>Verify Service SID</b> est affiche (commence par <b>VA...</b>)",
    ]
    for i, s in enumerate(steps_5):
        story.append(Paragraph(f"{i+1}.  {s}", styles['BulletItem']))
    story.append(Paragraph("TWILIO_VERIFY_SID = VA...............................", styles['CodeBlock']))

    # ══════════════════════════════════════════════════════════════════
    # RESUME
    # ══════════════════════════════════════════════════════════════════
    story.append(Paragraph("Resume - Valeurs a transmettre au developpeur", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=BG_STEP, spaceAfter=8))
    story.append(Paragraph(
        "Une fois toutes les etapes completees, transmettre ces valeurs <b>de maniere securisee</b> "
        "(pas par email en clair - utiliser un gestionnaire de mots de passe partage ou un canal chiffre) :",
        styles['Body']
    ))

    summary_data = [
        ["Variable", "Format attendu", "Source"],
        ["TWILIO_ACCOUNT_SID", "AC...", "Deja configure"],
        ["TWILIO_AUTH_TOKEN", "(secret)", "Deja configure"],
        ["TWILIO_MESSAGING_SERVICE_SID", "MG...", "Etape 2"],
        ["TWILIO_WHATSAPP_FROM", "whatsapp:+33...", "Etape 4 (optionnel)"],
        ["TWILIO_VERIFY_SID", "VA...", "Etape 5 (optionnel)"],
    ]
    sum_table = Table(summary_data, colWidths=[6*cm, 4.5*cm, 5.5*cm])
    sum_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 1), (0, -1), 'Courier'),
        ('FONTNAME', (1, 1), (1, -1), 'Courier'),
        ('BACKGROUND', (0, 1), (-1, 1), HexColor("#E8F5E9")),
        ('BACKGROUND', (0, 2), (-1, 2), HexColor("#E8F5E9")),
        ('BACKGROUND', (0, 3), (-1, 3), HexColor("#FFF3E0")),
        ('BACKGROUND', (0, 4), (-1, 4), BG_LIGHT),
        ('BACKGROUND', (0, 5), (-1, 5), BG_LIGHT),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#D5DEE5")),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(sum_table)
    story.append(Spacer(1, 12))

    # ══════════════════════════════════════════════════════════════════
    # COUTS
    # ══════════════════════════════════════════════════════════════════
    story.append(Paragraph("Couts estimes", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=BG_STEP, spaceAfter=8))

    cost_data = [
        ["Element", "Cout estime"],
        ["Numero francais (+33)", "~1.15 EUR/mois"],
        ["SMS sortant (France)", "~0.07 EUR/SMS"],
        ["SMS sortant (Maroc)", "~0.05 EUR/SMS"],
        ["SMS sortant (Arabie Saoudite)", "~0.04 EUR/SMS"],
        ["WhatsApp (initie par l'entreprise)", "~0.05-0.08 EUR/msg"],
        ["WhatsApp (initie par le guest)", "~0.02 EUR/msg"],
        ["Verify OTP", "~0.05 EUR/verification"],
    ]
    cost_table = Table(cost_data, colWidths=[10*cm, 6*cm])
    cost_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 1), (-1, -1), BG_LIGHT),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#D5DEE5")),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(cost_table)
    story.append(Paragraph(
        "Les prix sont indicatifs. Consultez https://www.twilio.com/pricing pour les tarifs a jour.",
        styles['Body']
    ))

    # ══════════════════════════════════════════════════════════════════
    # CHECKLIST
    # ══════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 12))
    story.append(Paragraph("Checklist de progression", styles['SectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=BG_STEP, spaceAfter=8))

    checklist = [
        "Etape 1 : Regulatory Bundle cree et approuve",
        "Etape 2.1 : Numero francais (+33) achete",
        "Etape 2.2 : Messaging Service cree - SID MG... transmis au dev",
        "Etape 3 : Webhooks configures (par le dev)",
        "Etape 4 : WhatsApp configure (optionnel) - numero transmis au dev",
        "Etape 5 : Verify Service cree (optionnel) - SID VA... transmis au dev",
        "Variables deployees en production (par le dev)",
        "Test d'envoi SMS valide",
    ]
    for item in checklist:
        story.append(Paragraph(f"&#9744;  {item}", styles['BulletItem']))

    # ── Footer ──
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#D5DEE5"), spaceAfter=8))
    story.append(Paragraph("Document cree le 13/03/2026 - Clenzy PMS v1.0 - Confidentiel", styles['Footer']))

    doc.build(story)
    print(f"PDF genere : {OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
