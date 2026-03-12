#!/usr/bin/env python3
"""
Clenzy PMS - Documentation Complete
Generateur PDF professionnel multi-section
"""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from io import BytesIO
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable, KeepTogether
)

# ─── Colors ────────────────────────────────────────────────────────────────
PRIMARY = HexColor('#1A1A2E')
ACCENT = HexColor('#4F46E5')
ACCENT2 = HexColor('#7C3AED')
GREEN = HexColor('#059669')
ORANGE = HexColor('#D97706')
RED = HexColor('#DC2626')
BLUE = HexColor('#2563EB')
TEAL = HexColor('#0D9488')
GRAY100 = HexColor('#F3F4F6')
GRAY200 = HexColor('#E5E7EB')
GRAY300 = HexColor('#D1D5DB')
GRAY500 = HexColor('#6B7280')
GRAY600 = HexColor('#4B5563')
GRAY700 = HexColor('#374151')
GRAY800 = HexColor('#1F2937')
WHITE = white

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "Clenzy_PMS_Documentation.pdf")

styles = getSampleStyleSheet()
styles['BodyText'].fontSize = 10
styles['BodyText'].leading = 14.5
styles['BodyText'].textColor = GRAY700
styles['BodyText'].fontName = 'Helvetica'
styles['BodyText'].spaceAfter = 8
styles['BodyText'].alignment = TA_JUSTIFY

def add_style(name, **kwargs):
    if name not in styles.byName:
        styles.add(ParagraphStyle(name, **kwargs))

add_style('CoverTitle', parent=styles['Title'], fontSize=34, leading=40, textColor=WHITE,
          fontName='Helvetica-Bold', alignment=TA_LEFT, spaceAfter=6)
add_style('CoverSub', parent=styles['Normal'], fontSize=14, leading=18, textColor=HexColor('#C7D2FE'),
          fontName='Helvetica', alignment=TA_LEFT, spaceAfter=4)
add_style('CoverMeta', parent=styles['Normal'], fontSize=11, leading=14, textColor=HexColor('#94A3B8'),
          fontName='Helvetica', alignment=TA_LEFT)
add_style('S1', parent=styles['Heading1'], fontSize=22, leading=28, textColor=PRIMARY,
          fontName='Helvetica-Bold', spaceBefore=20, spaceAfter=10)
add_style('S2', parent=styles['Heading2'], fontSize=15, leading=20, textColor=ACCENT,
          fontName='Helvetica-Bold', spaceBefore=14, spaceAfter=8)
add_style('S3', parent=styles['Heading3'], fontSize=12, leading=16, textColor=GRAY700,
          fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=6)
add_style('Body', parent=styles['Normal'], fontSize=10, leading=14.5, textColor=GRAY700,
          fontName='Helvetica', spaceAfter=8, alignment=TA_JUSTIFY)
add_style('Bullet', parent=styles['Normal'], fontSize=10, leading=14, textColor=GRAY700,
          fontName='Helvetica', spaceAfter=3, leftIndent=16, bulletIndent=4)
add_style('Small', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=GRAY500,
          fontName='Helvetica', spaceAfter=4)
add_style('TH', parent=styles['Normal'], fontSize=9, leading=12, textColor=WHITE,
          fontName='Helvetica-Bold', alignment=TA_CENTER)
add_style('TC', parent=styles['Normal'], fontSize=9, leading=12, textColor=GRAY700,
          fontName='Helvetica', alignment=TA_CENTER)
add_style('TCL', parent=styles['Normal'], fontSize=9, leading=12, textColor=GRAY700,
          fontName='Helvetica', alignment=TA_LEFT)
add_style('TCB', parent=styles['Normal'], fontSize=9, leading=12, textColor=GRAY800,
          fontName='Helvetica-Bold', alignment=TA_CENTER)
add_style('KPI', parent=styles['Normal'], fontSize=24, leading=28, textColor=ACCENT,
          fontName='Helvetica-Bold', alignment=TA_CENTER)
add_style('KPILabel', parent=styles['Normal'], fontSize=9, leading=12, textColor=GRAY500,
          fontName='Helvetica', alignment=TA_CENTER)
add_style('Screenshot', parent=styles['Normal'], fontSize=9, leading=12, textColor=GRAY500,
          fontName='Helvetica-Oblique', alignment=TA_CENTER, spaceBefore=4, spaceAfter=4)

W = 170 * mm

def tbl(headers, rows, widths=None, hdr_color=ACCENT):
    h = [Paragraph(x, styles['TH']) for x in headers]
    data = [h] + [[Paragraph(str(c), styles['TC']) if not isinstance(c, Paragraph) else c for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), hdr_color),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('TOPPADDING', (0,0), (-1,0), 8),
        ('BOTTOMPADDING', (0,1), (-1,-1), 5),
        ('TOPPADDING', (0,1), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, GRAY200),
        ('LINEBELOW', (0,0), (-1,0), 1.5, hdr_color),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, GRAY100]),
    ]))
    return t

def info_box(text, color=BLUE):
    data = [[Paragraph(text, ParagraphStyle('ib', parent=styles['Body'], fontSize=9.5, leading=13))]]
    t = Table(data, colWidths=[W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), HexColor('#F0F4FF')),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LINEBEFORE', (0,0), (0,-1), 3, color),
    ]))
    return t

def screenshot_placeholder(desc):
    data = [[Paragraph(
        f"[SCREENSHOT PLACEHOLDER]<br/><i>{desc}</i>",
        styles['Screenshot']
    )]]
    t = Table(data, colWidths=[W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), GRAY100),
        ('BOX', (0,0), (-1,-1), 1, GRAY300),
        ('TOPPADDING', (0,0), (-1,-1), 16),
        ('BOTTOMPADDING', (0,0), (-1,-1), 16),
    ]))
    return t

def divider():
    return HRFlowable(width="100%", thickness=1, color=GRAY200, spaceBefore=4, spaceAfter=10)

def p(text): return Paragraph(text, styles['Body'])
def s1(text): return Paragraph(text, styles['S1'])
def s2(text): return Paragraph(text, styles['S2'])
def s3(text): return Paragraph(text, styles['S3'])
def bullet(text): return Paragraph(f"&#8226; {text}", styles['Bullet'])
def sp(h=4): return Spacer(1, h*mm)

# ─── Page drawing ──────────────────────────────────────────────────────────
def cover_bg(c, doc):
    w, h = A4
    c.setFillColor(PRIMARY)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(0, h - 8*mm, w, 8*mm, fill=1, stroke=0)
    c.setFillColor(HexColor('#2D2D4E'))
    c.rect(0, 0, w, 35*mm, fill=1, stroke=0)

def page_bg(c, doc):
    w, h = A4
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.5)
    c.line(20*mm, h-18*mm, w-20*mm, h-18*mm)
    c.setFont('Helvetica', 8)
    c.setFillColor(GRAY500)
    c.drawString(20*mm, h-16*mm, "Clenzy PMS - Documentation")
    c.drawRightString(w-20*mm, h-16*mm, "Confidentiel")
    c.drawString(20*mm, 12*mm, "SinaTech SARL - Mars 2026")
    c.drawRightString(w-20*mm, 12*mm, f"Page {doc.page}")
    c.setStrokeColor(GRAY200)
    c.setLineWidth(0.5)
    c.line(20*mm, 17*mm, w-20*mm, 17*mm)

# ─── Build ─────────────────────────────────────────────────────────────────
def build():
    doc = SimpleDocTemplate(OUTPUT_PATH, pagesize=A4,
        topMargin=25*mm, bottomMargin=22*mm, leftMargin=20*mm, rightMargin=20*mm,
        title="Clenzy PMS - Documentation Complete", author="SinaTech SARL")

    S = []  # story

    # ═══════════════════ COVER ═══════════════════
    S.append(sp(55))
    S.append(Paragraph("Documentation Complete", styles['CoverTitle']))
    S.append(Paragraph("Clenzy PMS", styles['CoverTitle']))
    S.append(sp(8))
    S.append(Paragraph("Property Management System", styles['CoverSub']))
    S.append(Paragraph("Plateforme SaaS de Gestion Locative Courte Duree", styles['CoverSub']))
    S.append(sp(25))
    S.append(Paragraph("Version 2.5 - Mars 2026", styles['CoverMeta']))
    S.append(Paragraph("SinaTech SARL - Document Confidentiel", styles['CoverMeta']))
    S.append(PageBreak())

    # ═══════════════════ TOC ═══════════════════
    S.append(s1("Sommaire"))
    S.append(divider())
    toc = [
        "1. Documentation Produit",
        "   1.1 Vue d'ensemble", "   1.2 Vision et objectifs", "   1.3 Modules fonctionnels",
        "   1.4 Architecture fonctionnelle", "   1.5 Glossaire PMS",
        "2. Documentation Business / Operations",
        "   2.1 Processus metier", "   2.2 Cycle de vie d'une reservation",
        "   2.3 Workflows cleaning & maintenance", "   2.4 Revenue management",
        "3. Documentation Technique",
        "   3.1 Architecture systeme", "   3.2 Modele de donnees",
        "   3.3 Documentation API", "   3.4 Securite",
        "4. Documentation Partenaire",
        "   4.1 Integrations OTA", "   4.2 IoT & Smart Devices",
        "   4.3 Webhooks", "   4.4 Booking Engine SDK",
        "5. Documentation Utilisateur",
        "   5.1 Guide de demarrage", "   5.2 Gestion des proprietes",
        "   5.3 Gestion des reservations", "   5.4 Communication guests",
        "6. Documentation Interne",
        "   6.1 Gestion des incidents", "   6.2 Monitoring",
        "7. Documentation IA",
        "   7.1 Vue d'ensemble IA", "   7.2 Architecture IA",
        "   7.3 Tarification et budget", "   7.4 Modules IA detailles",
    ]
    for item in toc:
        bold = not item.startswith("   ")
        sz = 11 if bold else 10
        S.append(Paragraph(
            f"<b>{item.strip()}</b>" if bold else f"&nbsp;&nbsp;&nbsp;{item.strip()}",
            ParagraphStyle('toc', parent=styles['Body'], fontSize=sz, leading=18, spaceAfter=1)
        ))
    S.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 1. PRODUCT DOCUMENTATION
    # ═══════════════════════════════════════════════════════════════════════
    S.append(s1("1. Documentation Produit"))
    S.append(divider())

    # 1.1
    S.append(s2("1.1 Vue d'ensemble de Clenzy"))
    S.append(p(
        "<b>Clenzy</b> est une plateforme SaaS de gestion locative (Property Management System) "
        "concue pour les proprietaires, gestionnaires et conciergeries de location courte et moyenne duree. "
        "La plateforme centralise l'ensemble des operations : gestion des biens, reservations, tarification, "
        "communication guests, interventions, comptabilite, et integrations avec les grandes plateformes OTA."
    ))

    # KPIs
    kpi_data = [
        [Paragraph("181", styles['KPI']), Paragraph("102", styles['KPI']),
         Paragraph("18", styles['KPI']), Paragraph("3", styles['KPI'])],
        [Paragraph("Entites metier", styles['KPILabel']), Paragraph("Points d'API", styles['KPILabel']),
         Paragraph("Integrations", styles['KPILabel']), Paragraph("Langues", styles['KPILabel'])],
    ]
    kt = Table(kpi_data, colWidths=[W/4]*4)
    kt.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'), ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('BOX', (0,0), (0,-1), 0.5, GRAY200), ('BOX', (1,0), (1,-1), 0.5, GRAY200),
        ('BOX', (2,0), (2,-1), 0.5, GRAY200), ('BOX', (3,0), (3,-1), 0.5, GRAY200),
        ('TOPPADDING', (0,0), (-1,-1), 8), ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    S.append(kt)
    S.append(sp(4))
    S.append(screenshot_placeholder("Dashboard principal Clenzy avec KPIs, reservations recentes et calendrier"))

    # 1.2
    S.append(s2("1.2 Vision et Objectifs"))
    S.append(p("<b>Vision :</b> Devenir la plateforme de reference pour la gestion locative en Europe et au Maghreb, "
               "en offrant une solution tout-en-un, multilingue, avec une intelligence artificielle integree."))
    for obj in [
        "<b>Centralisation</b> : Un seul outil pour gerer biens, reservations, finances et equipes",
        "<b>Multi-canal</b> : Synchronisation temps reel avec Airbnb, Booking, Expedia et 15+ plateformes",
        "<b>Automatisation</b> : Workflows intelligents pour messagerie, tarification et interventions",
        "<b>IA embarquee</b> : 5 modules IA pour design, pricing, messaging, analytics et sentiment",
        "<b>Conformite</b> : RGPD, fiscalite multi-pays, facturation conforme",
        "<b>Multilingue</b> : Francais, Anglais, Arabe (LTR/RTL)",
    ]:
        S.append(bullet(obj))

    # 1.3
    S.append(s2("1.3 Modules Fonctionnels"))
    modules = [
        ["Module", "Description", "Entites cles"],
        ["Proprietes", "Gestion du parc immobilier, photos, equipements, statuts", "Property, CalendarDay, Portfolio"],
        ["Reservations", "Cycle complet de reservation, check-in/out numerique", "Reservation, Guest, OnlineCheckIn"],
        ["Calendrier", "Disponibilites, synchronisation iCal, blocage de dates", "CalendarDay, ICalFeed, BookingRestriction"],
        ["Tarification", "Plans tarifaires, yield management, prix dynamiques", "RatePlan, RateOverride, YieldRule"],
        ["Communication", "Messagerie multi-canal (WhatsApp, Email, SMS, In-App)", "Conversation, MessageTemplate, AutomationRule"],
        ["Interventions", "Menage, maintenance, reparations, planning equipes", "Intervention, ServiceRequest, Team"],
        ["Finances", "Facturation, paiements, comptabilite, portefeuille", "Invoice, PaymentTransaction, LedgerEntry"],
        ["Guests", "Profils, avis, check-in en ligne, guide d'accueil", "Guest, GuestReview, WelcomeGuide"],
        ["IoT", "Serrures connectees, detection de bruit, codes d'acces", "SmartLockDevice, NoiseAlert, KeyExchangeCode"],
        ["Documents", "Modeles, generation PDF, conformite reglementaire", "DocumentTemplate, DocumentGeneration"],
        ["IA", "Design, pricing, messaging, analytics, sentiment", "AiTokenUsage, OrgAiApiKey"],
        ["Organisation", "Multi-tenant, roles, permissions, invitations", "Organization, Role, Permission"],
    ]
    S.append(tbl(modules[0], modules[1:], widths=[28*mm, 82*mm, 60*mm]))

    S.append(PageBreak())

    # 1.4
    S.append(s2("1.4 Architecture Fonctionnelle"))
    S.append(p(
        "Clenzy suit une architecture en couches avec une separation claire entre le frontend React/TypeScript "
        "et le backend Spring Boot/Java 21. La couche de donnees utilise PostgreSQL avec multi-tenancy "
        "par filtre Hibernate sur <b>organization_id</b>."
    ))

    arch = [
        ["Couche", "Technologie", "Responsabilite"],
        ["Frontend", "React 18 + TypeScript + MUI v5", "Interface utilisateur, 40 modules fonctionnels"],
        ["API Gateway", "Spring Security + JWT", "Authentification, autorisation, rate limiting"],
        ["Business Logic", "Spring Boot 3.2 + Java 21", "134 services metier, validation, orchestration"],
        ["Data Access", "JPA/Hibernate + Liquibase", "181 entites, migrations, multi-tenancy"],
        ["Database", "PostgreSQL + Redis", "Persistance, cache, sessions distribuees"],
        ["Integrations", "RestClient + Resilience4j", "18 partenaires externes, circuit breakers"],
        ["Auth", "Keycloak (OAuth2/OIDC)", "SSO, gestion des identites, federation"],
        ["IA", "OpenAI + Anthropic APIs", "5 modules IA, BYOK, budget tokens"],
    ]
    S.append(tbl(arch[0], arch[1:], widths=[30*mm, 60*mm, 80*mm]))

    S.append(sp(4))
    S.append(screenshot_placeholder("Schema d'architecture Clenzy : frontend, backend, base de donnees, integrations"))

    # 1.5 GLOSSARY
    S.append(s2("1.5 Glossaire PMS"))
    glossary = [
        ["Terme", "Definition"],
        ["PMS", "Property Management System - Systeme de gestion des biens immobiliers"],
        ["OTA", "Online Travel Agency - Plateforme de reservation en ligne (Airbnb, Booking.com)"],
        ["ADR", "Average Daily Rate - Tarif journalier moyen"],
        ["RevPAR", "Revenue Per Available Room - Revenu par chambre disponible"],
        ["BYOK", "Bring Your Own Key - Le client utilise sa propre cle API"],
        ["iCal", "Format standard de calendrier pour synchroniser les disponibilites"],
        ["Channel Manager", "Outil de synchronisation multi-canal des disponibilites et tarifs"],
        ["Yield Management", "Gestion dynamique des rendements/tarifs selon la demande"],
        ["Check-in numerique", "Processus d'enregistrement des guests via formulaire en ligne"],
        ["Conciergerie", "Societe de gestion locative assurant l'exploitation au quotidien"],
        ["Guest", "Voyageur/client qui reserve un hebergement"],
        ["Intervention", "Tache de menage, maintenance ou reparation planifiee"],
        ["Multi-tenancy", "Architecture permettant a plusieurs organisations de partager la plateforme"],
        ["Webhook", "Notification HTTP envoyee en temps reel lors d'un evenement"],
        ["LOS Discount", "Reduction basee sur la duree du sejour (Length of Stay)"],
    ]
    S.append(tbl(glossary[0], glossary[1:], widths=[35*mm, 135*mm]))

    S.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 2. BUSINESS / OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    S.append(s1("2. Documentation Business / Operations"))
    S.append(divider())

    # 2.1
    S.append(s2("2.1 Processus Metier Principaux"))
    S.append(p("Clenzy couvre l'ensemble du cycle de vie de la gestion locative, "
               "de l'onboarding du bien jusqu'au reporting financier."))

    processes = [
        ["Processus", "Acteurs", "Frequence", "Automatisable"],
        ["Onboarding propriete", "Proprietaire, Manager", "Ponctuel", "Partiellement"],
        ["Publication multi-canal", "Manager", "Ponctuel", "Oui (sync iCal)"],
        ["Traitement reservation", "Systeme, Manager", "Quotidien", "Oui (webhooks)"],
        ["Communication guest", "Manager, IA", "Quotidien", "Oui (automation)"],
        ["Check-in / Check-out", "Guest, Manager", "Par sejour", "Oui (check-in en ligne)"],
        ["Planning interventions", "Manager, Equipes", "Quotidien", "Oui (trigger auto)"],
        ["Tarification dynamique", "Manager, IA", "Hebdomadaire", "Oui (yield rules)"],
        ["Facturation & paiements", "Systeme, Manager", "Par reservation", "Oui (auto-invoice)"],
        ["Reporting & KPIs", "Proprietaire, Manager", "Mensuel", "Oui (dashboards)"],
    ]
    S.append(tbl(processes[0], processes[1:], widths=[38*mm, 36*mm, 30*mm, 30*mm]))

    # 2.2
    S.append(sp(4))
    S.append(s2("2.2 Cycle de Vie d'une Reservation"))
    S.append(p("Une reservation passe par plusieurs etats, de la creation jusqu'a la completion :"))

    lifecycle = [
        ["Etape", "Statut", "Actions", "Notifications"],
        ["1. Creation", "PENDING", "Reception via OTA, iCal ou booking engine", "Email + push au manager"],
        ["2. Confirmation", "CONFIRMED", "Validation, envoi instructions check-in", "Email au guest + SMS"],
        ["3. Paiement", "CONFIRMED", "Lien de paiement Stripe, suivi", "Rappel si impaye"],
        ["4. Pre-arrival", "CONFIRMED", "Check-in en ligne, guide d'accueil", "J-3, J-1 rappels auto"],
        ["5. Sejour", "CONFIRMED", "Communication guest, interventions", "Alertes bruit, demandes"],
        ["6. Check-out", "COMPLETED", "Etat des lieux, facturation finale", "Email recapitulatif"],
        ["7. Post-sejour", "COMPLETED", "Demande d'avis, analyse sentiment", "Email J+1 apres depart"],
        ["Alt. Annulation", "CANCELLED", "Politique d'annulation, remboursement", "Notification annulation"],
    ]
    S.append(tbl(lifecycle[0], lifecycle[1:], widths=[28*mm, 26*mm, 58*mm, 42*mm]))
    S.append(sp(3))
    S.append(screenshot_placeholder("Interface de detail d'une reservation avec timeline des statuts"))

    # 2.3
    S.append(s2("2.3 Workflows Cleaning & Maintenance"))
    S.append(p("Les interventions sont declenchees automatiquement ou manuellement :"))
    for item in [
        "<b>Menage automatique</b> : Declenche a chaque check-out, assigne a l'equipe de menage de la propriete",
        "<b>Maintenance planifiee</b> : Recurrence configurable (hebdo, mensuel). Exemples : verification chaudiere, jardin",
        "<b>Reparation urgente</b> : Creee via demande de service (guest ou equipe), priorite URGENT",
        "<b>Inspection</b> : Post-checkout ou periodique, avec photos obligatoires",
    ]:
        S.append(bullet(item))
    S.append(sp(2))

    int_table = [
        ["Type", "Declencheur", "Priorite", "Assignation", "Suivi"],
        ["CLEANING", "Check-out auto", "MEDIUM", "Equipe menage", "Photos avant/apres"],
        ["REPAIR", "Demande service", "HIGH/URGENT", "Technicien", "Devis + validation"],
        ["MAINTENANCE", "Planification", "LOW/MEDIUM", "Technicien", "Checklist"],
        ["INSPECTION", "Periodique", "MEDIUM", "Superviseur", "Rapport + photos"],
    ]
    S.append(tbl(int_table[0], int_table[1:], widths=[28*mm, 30*mm, 26*mm, 30*mm, 36*mm]))
    S.append(screenshot_placeholder("Planning des interventions avec vue calendrier et statuts"))

    # 2.4
    S.append(s2("2.4 Revenue Management"))
    S.append(p("Clenzy integre un moteur de tarification avance avec resolution multi-regles :"))
    S.append(p("<b>Ordre de priorite des prix :</b><br/>"
               "1. Rate Override (prix manuel) > 2. Promotion > 3. Saisonnier > 4. Last Minute > 5. Base"))
    pricing_concepts = [
        ["Concept", "Description", "Exemple"],
        ["Rate Plan", "Plan tarifaire avec type et periode", "Saison haute juillet : +30%"],
        ["Rate Override", "Prix fixe pour une date specifique", "Reveillon 31/12 : 250 EUR"],
        ["Channel Modifier", "Ajustement par canal de distribution", "Airbnb : +15% (couvre commission)"],
        ["LOS Discount", "Reduction pour sejours longs", "7+ nuits : -10%"],
        ["Occupancy Pricing", "Prix selon taux de remplissage", "Occupancy > 80% : +20%"],
        ["Yield Rule", "Regle automatique de yield", "Si dispo > 5j dans 7j : -15%"],
        ["Booking Restriction", "Contraintes de reservation", "Min 3 nuits en haute saison"],
        ["PriceLabs", "Integration pricing externe (IA)", "Sync automatique quotidien"],
    ]
    S.append(tbl(pricing_concepts[0], pricing_concepts[1:], widths=[35*mm, 75*mm, 55*mm]))

    S.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 3. TECHNICAL DOCUMENTATION
    # ═══════════════════════════════════════════════════════════════════════
    S.append(s1("3. Documentation Technique"))
    S.append(divider())

    # 3.1
    S.append(s2("3.1 Architecture Systeme"))
    S.append(p("Clenzy est deploye sur une infrastructure Docker avec les composants suivants :"))

    infra = [
        ["Service", "Technologie", "Port", "Role"],
        ["clenzy-backend", "Spring Boot 3.2 / Java 21", "8080", "API REST, logique metier"],
        ["clenzy-frontend", "React 18 / Vite / Nginx", "3000", "Interface utilisateur SPA"],
        ["clenzy-keycloak", "Keycloak 23+", "8080", "OAuth2/OIDC, gestion identites"],
        ["postgres", "PostgreSQL 16", "5432", "Base de donnees principale"],
        ["clenzy-redis", "Redis 7", "6379", "Cache, sessions, distributed locks"],
        ["gotenberg", "Gotenberg", "3000", "Conversion PDF (LibreOffice)"],
        ["nginx", "Nginx", "443/80", "Reverse proxy, SSL termination"],
    ]
    S.append(tbl(infra[0], infra[1:], widths=[32*mm, 45*mm, 18*mm, 60*mm]))
    S.append(sp(3))
    S.append(screenshot_placeholder("Diagramme d'architecture infrastructure (Docker Compose)"))

    S.append(s3("Patterns Architecturaux"))
    for pat in [
        "<b>Multi-Tenancy</b> : Filtre Hibernate sur organization_id, isolation complete des donnees",
        "<b>Transactional Outbox</b> : Publication fiable d'evenements via table outbox + relay",
        "<b>Circuit Breaker</b> : Resilience4j sur toutes les APIs externes (18 circuit breakers configures)",
        "<b>CQRS leger</b> : Separation lecture/ecriture pour les dashboards et rapports",
        "<b>Event-Driven Automation</b> : Moteur Trigger > Condition > Action pour l'automatisation",
        "<b>Virtual Threads</b> : Java 21 Project Loom pour la concurrence massive",
    ]:
        S.append(bullet(pat))

    # 3.2
    S.append(s2("3.2 Modele de Donnees"))
    S.append(p("Le modele de donnees comprend <b>181 entites JPA</b> organisees en domaines :"))

    domains = [
        ["Domaine", "Entites principales", "Nb entites"],
        ["Core", "Property, Reservation, Guest, Organization, User", "~25"],
        ["Pricing", "RatePlan, RateOverride, YieldRule, OccupancyPricing", "~15"],
        ["Finance", "Invoice, PaymentTransaction, LedgerEntry, Wallet", "~20"],
        ["Communication", "Conversation, MessageTemplate, AutomationRule", "~12"],
        ["Interventions", "Intervention, ServiceRequest, Team, TeamMember", "~10"],
        ["Documents", "DocumentTemplate, DocumentGeneration, GdprConsent", "~10"],
        ["IoT", "SmartLockDevice, NoiseAlert, KeyExchangeCode", "~8"],
        ["Channel", "ICalFeed, ChannelFee, ChannelContentMapping", "~12"],
        ["Audit", "AuditLog, SecurityAuditLog", "~5"],
        ["AI", "AiTokenUsage, AiTokenBudget, OrgAiApiKey", "~5"],
        ["Autres", "Notification, Subscription, Marketplace, etc.", "~59"],
    ]
    S.append(tbl(domains[0], domains[1:], widths=[30*mm, 95*mm, 22*mm]))

    S.append(sp(3))
    S.append(s3("Statuts et Enums Principaux"))
    enums = [
        ["Enum", "Valeurs"],
        ["ReservationStatus", "PENDING, CONFIRMED, CANCELLED, COMPLETED"],
        ["PropertyStatus", "ACTIVE, INACTIVE, UNDER_MAINTENANCE, ARCHIVED"],
        ["InterventionType", "CLEANING, REPAIR, MAINTENANCE, INSPECTION"],
        ["Priority", "LOW, MEDIUM, HIGH, URGENT"],
        ["InvoiceStatus", "DRAFT, ISSUED, PAID, OVERDUE, CANCELLED"],
        ["PaymentStatus", "PENDING, COMPLETED, FAILED, REFUNDED"],
        ["UserRole", "SUPER_ADMIN, HOST, TECHNICIAN, HOUSEKEEPER, SUPERVISOR"],
        ["OrgMemberRole", "OWNER, MANAGER, STAFF, VIEWER"],
        ["Channel", "WHATSAPP, EMAIL, SMS, IN_APP"],
        ["FiscalRegime", "MICROENTREPRENEUR, AUTO_ENTREPRENEUR, EI, SARL, EIRL"],
    ]
    S.append(tbl(enums[0], enums[1:], widths=[38*mm, 130*mm]))

    S.append(PageBreak())

    # 3.3
    S.append(s2("3.3 Documentation API"))
    S.append(p("L'API REST de Clenzy expose <b>300+ endpoints</b> organises par domaine. "
               "Documentation interactive disponible via Swagger UI a <b>/swagger-ui.html</b>."))

    api_groups = [
        ["Groupe", "Base URL", "Endpoints", "Auth"],
        ["Properties", "/api/properties", "CRUD, channels, assignation", "JWT"],
        ["Reservations", "/api/reservations", "CRUD, paiement, check-in", "JWT"],
        ["Calendar", "/api/calendar", "Disponibilites, blocage, pricing", "JWT"],
        ["Guests", "/api/guests", "Profils, communication, check-in", "JWT"],
        ["Interventions", "/api/interventions", "CRUD, assignation, completion", "JWT"],
        ["Invoices", "/api/invoices", "Generation, PDF, envoi email", "JWT"],
        ["Payments", "/api/payments", "Stripe, liens, remboursements", "JWT"],
        ["Conversations", "/api/conversations", "Threads, messages, statuts", "JWT"],
        ["Teams", "/api/teams", "Equipes, membres, assignation", "JWT"],
        ["AI", "/api/ai/*", "Pricing, messaging, analytics", "JWT"],
        ["Webhooks", "/api/webhooks/*", "Airbnb, Booking, Stripe, ...", "HMAC/Token"],
        ["Public", "/api/public/*", "Check-in, guide, key-exchange", "Token/None"],
    ]
    S.append(tbl(api_groups[0], api_groups[1:], widths=[28*mm, 35*mm, 58*mm, 22*mm]))
    S.append(sp(3))
    S.append(screenshot_placeholder("Interface Swagger UI montrant les groupes d'endpoints"))

    # 3.4
    S.append(s2("3.4 Securite"))
    S.append(p("La securite de Clenzy repose sur plusieurs couches :"))

    security = [
        ["Couche", "Mecanisme", "Detail"],
        ["Authentification", "Keycloak OAuth2/OIDC", "JWT tokens, refresh, federation"],
        ["Autorisation", "@PreAuthorize + ownership", "RBAC par methode + validation proprietaire"],
        ["Chiffrement", "AES-256 sur PII", "Email, nom, telephone chiffres en base"],
        ["API Keys", "Jasypt encryption", "Cles API partenaires chiffrees"],
        ["Anti-brute-force", "LoginProtectionService", "Verrouillage apres tentatives echouees"],
        ["CAPTCHA", "reCAPTCHA v3", "Protection formulaires publics"],
        ["RGPD", "GdprService", "Export, suppression, consentement versionne"],
        ["Audit", "SecurityAuditLog", "Login, permissions, acces non autorises"],
        ["Circuit Breaker", "Resilience4j", "Protection contre cascading failures"],
    ]
    S.append(tbl(security[0], security[1:], widths=[30*mm, 42*mm, 90*mm]))

    S.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 4. PARTNER DOCUMENTATION
    # ═══════════════════════════════════════════════════════════════════════
    S.append(s1("4. Documentation Partenaire"))
    S.append(divider())

    S.append(s2("4.1 Integrations OTA"))
    S.append(p("Clenzy se connecte a <b>8 plateformes OTA</b> pour la distribution des annonces "
               "et la synchronisation des reservations :"))

    ota = [
        ["Plateforme", "Type Integration", "Fonctionnalites", "Sync"],
        ["Airbnb", "API OAuth2 + Webhooks", "Listings, reservations, messages, reviews", "Temps reel"],
        ["Booking.com", "Webhooks + iCal", "Reservations, disponibilites, tarifs", "Temps reel"],
        ["Expedia", "Webhooks", "Reservations, disponibilites", "Temps reel"],
        ["HomeAway/VRBO", "Webhooks + iCal", "Listings, reservations", "Temps reel"],
        ["Agoda", "Webhooks", "Reservations", "Temps reel"],
        ["Tripadvisor", "Webhooks", "Reviews, listings", "Periodique"],
        ["Hotels.com", "Webhooks", "Reservations", "Temps reel"],
        ["iCal generique", "Import/Export iCal", "Calendrier, disponibilites", "15 min"],
    ]
    S.append(tbl(ota[0], ota[1:], widths=[28*mm, 35*mm, 70*mm, 25*mm]))

    S.append(sp(3))
    S.append(info_box(
        "<b>Principe de synchronisation :</b> Les reservations entrantes sont traitees via webhooks "
        "(temps reel) ou import iCal (polling toutes les 15 min). Les modifications de disponibilite "
        "et de tarifs sont poussees vers les canaux via le <b>RateDistributionService</b>. "
        "Un circuit breaker Resilience4j protege chaque canal contre les pannes."
    ))

    # 4.2
    S.append(s2("4.2 IoT & Smart Devices"))
    iot = [
        ["Partenaire", "Type", "Fonctionnalites"],
        ["Nuki", "Serrure connectee", "Verrouillage/deverrouillage, codes temporaires, historique d'acces"],
        ["Minut", "Capteur bruit", "Detection de bruit, alertes temps reel, heures calmes configurables"],
        ["Tuya", "Smart Home", "Controle d'appareils generiques (lumieres, thermostat, etc.)"],
        ["KeyNest", "Echange de cles", "Points de depot physiques, codes d'acces, suivi des remises"],
    ]
    S.append(tbl(iot[0], iot[1:], widths=[28*mm, 35*mm, 105*mm]))

    # 4.3
    S.append(s2("4.3 Evenements Webhook"))
    S.append(p("Clenzy supporte les webhooks entrants et sortants :"))
    webhooks = [
        ["Evenement", "Direction", "Payload", "Utilisation"],
        ["reservation.created", "Entrant", "JSON Reservation", "Nouvelle reservation OTA"],
        ["reservation.cancelled", "Entrant", "JSON Reservation", "Annulation depuis OTA"],
        ["payment.completed", "Entrant", "Stripe Event", "Paiement confirme"],
        ["noise.alert", "Entrant", "Minut Event", "Alerte bruit detectee"],
        ["lock.accessed", "Entrant", "Nuki Event", "Acces serrure connectee"],
        ["review.posted", "Entrant", "JSON Review", "Nouvel avis guest"],
        ["booking.confirmed", "Sortant", "JSON Booking", "Vers partenaires externes"],
        ["automation.triggered", "Interne", "JSON Action", "Declenchement automatisation"],
    ]
    S.append(tbl(webhooks[0], webhooks[1:], widths=[35*mm, 22*mm, 30*mm, 68*mm]))

    # 4.4
    S.append(s2("4.4 Booking Engine SDK"))
    S.append(p(
        "Le <b>Clenzy Booking SDK</b> est un widget de reservation embarquable sur le site web du client. "
        "Il est distribue sous forme de package npm (React/TypeScript) et communique directement avec l'API Clenzy."
    ))
    for feat in [
        "<b>Integration</b> : Iframe ou composant React direct",
        "<b>Personnalisation</b> : CSS genere par IA a partir du site web du client",
        "<b>Multi-langue</b> : Support FR, EN, AR avec detection automatique",
        "<b>Paiement</b> : Integration Stripe Elements pour le paiement direct",
        "<b>Responsive</b> : Adapte mobile, tablette et desktop",
    ]:
        S.append(bullet(feat))
    S.append(screenshot_placeholder("Widget Booking Engine integre sur un site web client"))

    S.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 5. CLIENT / USER DOCUMENTATION
    # ═══════════════════════════════════════════════════════════════════════
    S.append(s1("5. Documentation Utilisateur"))
    S.append(divider())

    # 5.1
    S.append(s2("5.1 Guide de Demarrage Rapide"))
    S.append(p("Ce guide vous accompagne dans vos premiers pas sur Clenzy."))

    S.append(s3("Etape 1 : Creer votre compte"))
    S.append(p("Rendez-vous sur <b>app.clenzy.com</b> et creez votre compte. "
               "Vous recevrez un email de confirmation. Choisissez votre type d'organisation :"))
    for t in [
        "<b>Individuel</b> : Proprietaire gerant 1-3 biens",
        "<b>Professionnel</b> : Conciergerie ou agence gerant 3-50 biens",
        "<b>Franchise</b> : Reseau de conciergeries avec gestion centralisee",
    ]:
        S.append(bullet(t))
    S.append(screenshot_placeholder("Page d'inscription avec choix du type d'organisation"))

    S.append(s3("Etape 2 : Ajouter votre premiere propriete"))
    S.append(p("Depuis le menu <b>Proprietes > Ajouter</b>, renseignez les informations de votre bien : "
               "adresse, type, nombre de chambres, capacite, prix de base, photos."))
    S.append(screenshot_placeholder("Formulaire de creation de propriete"))

    S.append(s3("Etape 3 : Connecter vos canaux"))
    S.append(p("Allez dans <b>Canaux</b> pour connecter vos comptes Airbnb, Booking.com, etc. "
               "Les reservations seront synchronisees automatiquement."))
    S.append(screenshot_placeholder("Page de configuration des canaux OTA"))

    S.append(s3("Etape 4 : Configurer votre equipe"))
    S.append(p("Si vous travaillez en equipe, invitez vos collaborateurs via <b>Equipes > Inviter</b>. "
               "Assignez des roles : Manager, Menage, Technicien, Superviseur."))

    # 5.2
    S.append(sp(4))
    S.append(s2("5.2 Gestion des Proprietes"))
    S.append(p("Chaque propriete dans Clenzy possede un profil complet :"))
    for feat in [
        "<b>Informations generales</b> : Adresse, type, capacite, superficie, equipements",
        "<b>Photos</b> : Galerie multi-photos avec ordre personnalisable",
        "<b>Tarification</b> : Prix de base, plans saisonniers, promotions",
        "<b>Calendrier</b> : Vue mensuelle des disponibilites, blocage de dates",
        "<b>Check-in instructions</b> : Horaires, adresse de remise des cles, guide d'accueil",
        "<b>Equipes</b> : Assignation des equipes de menage et maintenance",
        "<b>Canaux</b> : Connexion aux OTAs, contenu specifique par canal",
        "<b>Documents</b> : Bail, conditions generales, reglement interieur",
    ]:
        S.append(bullet(feat))
    S.append(screenshot_placeholder("Page de detail d'une propriete avec onglets"))

    # 5.3
    S.append(s2("5.3 Gestion des Reservations"))
    S.append(p("Le module reservations centralise toutes les reservations de toutes les sources :"))
    S.append(screenshot_placeholder("Liste des reservations avec filtres (statut, propriete, dates, source)"))

    for feat in [
        "<b>Vue liste</b> : Filtres par statut, propriete, dates, source (Airbnb, Booking, direct)",
        "<b>Detail reservation</b> : Informations guest, dates, montants, historique de communication",
        "<b>Actions rapides</b> : Confirmer, annuler, envoyer lien de paiement, generer facture",
        "<b>Check-in en ligne</b> : Formulaire pre-arrivee envoye automatiquement au guest",
        "<b>Timeline</b> : Historique complet de la reservation (creation, paiement, check-in, etc.)",
    ]:
        S.append(bullet(feat))

    # 5.4
    S.append(s2("5.4 Communication Guests"))
    S.append(p("La messagerie multi-canal permet de communiquer avec les guests via :"))
    channels_comm = [
        ["Canal", "Configuration", "Automatisation"],
        ["WhatsApp", "Integration Twilio / WhatsApp Business", "Messages pre/post-sejour automatiques"],
        ["Email", "SMTP configurable par organisation", "Templates personnalisables, variables dynamiques"],
        ["SMS", "Integration Twilio", "Rappels check-in, alertes urgentes"],
        ["In-App", "Messagerie interne Clenzy", "Notifications push mobile"],
    ]
    S.append(tbl(channels_comm[0], channels_comm[1:], widths=[25*mm, 65*mm, 68*mm]))
    S.append(sp(2))
    S.append(info_box(
        "<b>Automatisation :</b> Configurez des regles dans <b>Automatisation > Regles</b> pour envoyer "
        "automatiquement des messages a chaque etape du sejour : confirmation, pre-arrivee (J-3), "
        "check-in (J-1), bienvenue (J), check-out (J-fin), post-sejour (J+1)."
    ))
    S.append(screenshot_placeholder("Interface de messagerie multi-canal avec conversation ouverte"))

    S.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 6. INTERNAL OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════
    S.append(s1("6. Documentation Interne"))
    S.append(divider())

    # 6.1
    S.append(s2("6.1 Gestion des Incidents"))
    S.append(p("Procedure de gestion des incidents techniques et operationnels :"))

    incidents = [
        ["Severite", "Temps de reponse", "Exemples", "Escalade"],
        ["P1 - Critique", "< 15 min", "Plateforme down, perte de donnees", "CTO + equipe on-call"],
        ["P2 - Majeur", "< 1 heure", "Sync OTA cassee, paiements bloques", "Lead dev + support"],
        ["P3 - Mineur", "< 4 heures", "Bug UI, lenteur, erreur ponctuelle", "Equipe dev"],
        ["P4 - Cosmique", "< 24 heures", "Typo, amelioration mineure", "Backlog sprint"],
    ]
    S.append(tbl(incidents[0], incidents[1:], widths=[28*mm, 30*mm, 55*mm, 40*mm]))

    S.append(s3("Procedure de reponse"))
    for step in [
        "<b>1. Detection</b> : Alertes Prometheus/Grafana, signalements utilisateurs, monitoring circuit breakers",
        "<b>2. Triage</b> : Classification de severite, identification du domaine impacte",
        "<b>3. Investigation</b> : Analyse logs structures, traces distribuees, audit security logs",
        "<b>4. Resolution</b> : Hotfix, rollback, ou workaround selon la severite",
        "<b>5. Post-mortem</b> : Analyse racine, mesures preventives, mise a jour documentation",
    ]:
        S.append(bullet(step))

    # 6.2
    S.append(s2("6.2 Monitoring & Observabilite"))
    monitoring = [
        ["Composant", "Outil", "Metriques cles"],
        ["Backend", "Prometheus + Actuator", "Request latency, error rate, JVM heap, DB pool"],
        ["Frontend", "Sentry (errors)", "JS errors, API failures, render performance"],
        ["Database", "pg_stat_statements", "Query time, connections, locks, replication lag"],
        ["Redis", "Redis INFO", "Memory usage, hit rate, connections"],
        ["Integrations", "Resilience4j events", "Circuit state, failure rate, call duration"],
        ["Health", "/health endpoint", "Readiness, liveness (Kubernetes)"],
        ["AI", "AiTokenUsage table", "Tokens consumed, budget remaining, cost per feature"],
    ]
    S.append(tbl(monitoring[0], monitoring[1:], widths=[28*mm, 40*mm, 95*mm]))
    S.append(sp(3))
    S.append(screenshot_placeholder("Dashboard Grafana avec metriques Clenzy"))

    S.append(s3("Alertes Configurees"))
    for alert in [
        "<b>CPU > 80%</b> pendant 5 min : Notification Slack + email",
        "<b>Error rate > 5%</b> : Alerte P2 automatique",
        "<b>Circuit breaker OPEN</b> : Notification immediate (integration externe defaillante)",
        "<b>DB connections > 90%</b> : Alerte critique (pool HikariCP sature)",
        "<b>AI budget > 80%</b> : Notification au client (budget tokens bientot epuise)",
    ]:
        S.append(bullet(alert))

    S.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════
    # 7. AI DOCUMENTATION
    # ═══════════════════════════════════════════════════════════════════════
    S.append(s1("7. Documentation IA / Features Avancees"))
    S.append(divider())

    # 7.1
    S.append(s2("7.1 Vue d'Ensemble IA"))
    S.append(p(
        "Clenzy integre <b>5 modules d'intelligence artificielle</b> qui assistent les utilisateurs "
        "dans leurs operations quotidiennes. L'IA est alimentee par les APIs OpenAI (GPT-4o) et "
        "Anthropic (Claude Sonnet) via un modele hybride BYOK."
    ))

    ai_overview = [
        ["Module", "Fonction", "Provider", "Menu"],
        ["DESIGN", "Extraction design tokens + generation CSS booking engine", "GPT-4o + Claude", "Booking Engine"],
        ["PRICING", "Recommandations de prix dynamiques par propriete", "Claude Sonnet", "Prix Dynamiques"],
        ["MESSAGING", "Detection d'intention + suggestion de reponses", "Claude Sonnet", "Contact"],
        ["ANALYTICS", "Insights IA sur les performances (occupation, revenus)", "Claude Sonnet", "Dashboard"],
        ["SENTIMENT", "Analyse de sentiment des avis avec themes et actions", "Claude Sonnet", "Avis"],
    ]
    S.append(tbl(ai_overview[0], ai_overview[1:], widths=[25*mm, 68*mm, 30*mm, 30*mm]))

    # 7.2
    S.append(s2("7.2 Architecture IA"))
    S.append(p("L'architecture IA repose sur le pattern <b>BYOK (Bring Your Own Key)</b> :"))
    for item in [
        "<b>AiKeyResolver</b> : Resout la cle API (cle org BYOK > cle plateforme > erreur)",
        "<b>AiTokenBudgetService</b> : Controle les budgets mensuels par feature et par org",
        "<b>AiTokenUsage</b> : Tracking granulaire (provider, model, prompt/completion tokens)",
        "<b>Circuit Breakers</b> : 5 circuit breakers dedies (ai-design, ai-pricing, ai-messaging, etc.)",
        "<b>AiAnonymizationService</b> : Suppression des PII avant envoi aux APIs IA",
    ]:
        S.append(bullet(item))

    ai_arch = [
        ["Composant", "Classe", "Role"],
        ["Key Resolver", "AiKeyResolver", "Resolution cle API : BYOK > plateforme > erreur"],
        ["OpenAI Client", "OpenAiProvider", "RestClient vers api.openai.com/v1"],
        ["Anthropic Client", "AnthropicProvider", "RestClient vers api.anthropic.com/v1"],
        ["Budget Manager", "AiTokenBudgetService", "Verification et decompte du budget tokens"],
        ["Usage Tracker", "AiTokenUsage (entity)", "Log chaque appel (tokens, cout, feature)"],
        ["Key Manager", "OrgAiApiKeyService", "CRUD + test + validation des cles BYOK"],
        ["Error Classifier", "classifyProviderError()", "Messages d'erreur clairs (solde, cle, quota)"],
    ]
    S.append(tbl(ai_arch[0], ai_arch[1:], widths=[30*mm, 45*mm, 90*mm]))

    # 7.3
    S.append(s2("7.3 Tarification et Budget"))
    S.append(p("Chaque appel IA consomme des tokens factures par le provider. "
               "Le budget par defaut est de <b>100 000 tokens/mois par feature</b> (500K total)."))

    tarif = [
        ["Modele", "Provider", "Input ($/MTok)", "Output ($/MTok)", "Cout 500K tokens"],
        ["GPT-4o mini", "OpenAI", "$0.15", "$0.60", "~0.15 EUR"],
        ["Claude Haiku 4.5", "Anthropic", "$1.00", "$5.00", "~1.20 EUR"],
        ["GPT-4o", "OpenAI", "$2.50", "$10.00", "~2.53 EUR"],
        ["Claude Sonnet 4.5", "Anthropic", "$3.00", "$15.00", "~3.60 EUR"],
        ["Claude Opus 4.6", "Anthropic", "$5.00", "$25.00", "~9.20 EUR"],
    ]
    S.append(tbl(tarif[0], tarif[1:], widths=[32*mm, 25*mm, 28*mm, 28*mm, 30*mm]))

    S.append(sp(3))
    S.append(info_box(
        "<b>Modele BYOK :</b> Les clients peuvent configurer leur propre cle API dans "
        "<b>Parametres > IA</b> pour utiliser le modele de leur choix et etre factures "
        "directement par le provider. Cout pour Clenzy : 0 EUR.<br/><br/>"
        "<b>Conseil :</b> GPT-4o mini est recommande comme modele par defaut (0.15 EUR/compte/mois). "
        "Claude Sonnet est ideal pour les features premium (design, analytics)."
    , GREEN))

    # 7.4
    S.append(s2("7.4 Modules IA Detailles"))

    S.append(s3("DESIGN - Generation CSS Booking Engine"))
    S.append(p(
        "Pipeline en 2 etapes : (1) GPT-4o extrait les design tokens (couleurs, fonts, spacing) "
        "depuis le site web du client, (2) Claude genere le CSS personnalise du widget de reservation."
    ))
    design_det = [
        ["Etape", "Tokens/appel", "Declencheur", "Cache"],
        ["Extraction tokens", "4 300 - 21 300", "Upload URL site web", "Oui (hash contenu)"],
        ["Generation CSS", "2 750 - 4 650", "Validation des tokens", "Non (unique)"],
    ]
    S.append(tbl(design_det[0], design_det[1:], widths=[35*mm, 35*mm, 50*mm, 35*mm]))

    S.append(s3("PRICING - Prix Dynamiques"))
    S.append(p(
        "Analyse l'historique de reservations, le taux d'occupation et la saisonnalite pour "
        "generer des recommandations de prix jour par jour sur la periode demandee.<br/>"
        "<b>Tokens/appel :</b> 3 800 - 5 700 | <b>Frequence :</b> 2-5 fois/mois/propriete"
    ))

    S.append(s3("MESSAGING - Intent Detection & Reponses"))
    S.append(p(
        "Le plus gros consommateur (60% des tokens). Analyse chaque message guest entrant : "
        "(1) detection d'intention (reservation, reclamation, info, urgence), "
        "(2) generation d'une suggestion de reponse.<br/>"
        "<b>Tokens/message :</b> 1 080 - 2 130 | <b>Frequence :</b> 20-50 messages/mois/propriete<br/>"
        "<b>Fallback :</b> Detection d'intention rule-based disponible (0 token)"
    ))

    S.append(s3("ANALYTICS - Insights IA"))
    S.append(p(
        "Genere des insights a partir des KPIs (occupation, ADR, RevPAR, sources) "
        "avec recommandations actionnables.<br/>"
        "<b>Tokens/appel :</b> 1 500 - 2 600 | <b>Frequence :</b> 1-2 fois/mois"
    ))

    S.append(s3("SENTIMENT - Analyse des Avis"))
    S.append(p(
        "Analyse le texte des avis clients avec : score de sentiment, themes identifies, "
        "recommandations d'action, suggestion de reponse.<br/>"
        "<b>Tokens/appel :</b> 920 - 1 920 | <b>Frequence :</b> 5-15 avis/mois<br/>"
        "<b>Fallback :</b> Analyse rule-based par mots-cles (6 langues, 0 token)"
    ))

    S.append(sp(3))
    S.append(screenshot_placeholder("Page Parametres > IA avec cards OpenAI et Claude brandees"))

    # ═══════════════════════════════════════════════════════════════════════
    # ANNEXES
    # ═══════════════════════════════════════════════════════════════════════
    S.append(PageBreak())
    S.append(s1("Annexes"))
    S.append(divider())

    S.append(s2("A. Liste Complete des Integrations"))
    integrations = [
        ["Partenaire", "Type", "Statut", "Protocole"],
        ["Airbnb", "OTA", "Production", "OAuth2 + REST + Webhooks"],
        ["Booking.com", "OTA", "Production", "Webhooks + iCal"],
        ["Expedia", "OTA", "Production", "Webhooks"],
        ["HomeAway/VRBO", "OTA", "Production", "Webhooks + iCal"],
        ["Agoda", "OTA", "Production", "Webhooks"],
        ["Tripadvisor", "OTA", "Production", "Webhooks"],
        ["Hotels.com", "OTA", "Production", "Webhooks"],
        ["Stripe", "Paiement", "Production", "REST + Webhooks"],
        ["Twilio", "Communication", "Production", "REST + Webhooks"],
        ["HubSpot", "CRM", "Production", "REST + Webhooks"],
        ["PennyLane", "Comptabilite", "Production", "REST + Webhooks"],
        ["PriceLabs", "Pricing", "Production", "REST API"],
        ["Nuki", "Smart Lock", "Production", "REST API"],
        ["Minut", "IoT / Bruit", "Production", "REST + Webhooks"],
        ["Tuya", "Smart Home", "Production", "REST API"],
        ["KeyNest", "Cles physiques", "Production", "REST + Webhooks"],
        ["Zapier", "Automation", "Production", "Webhooks"],
    ]
    S.append(tbl(integrations[0], integrations[1:], widths=[30*mm, 25*mm, 25*mm, 58*mm]))

    S.append(sp(5))
    S.append(s2("B. Profils Utilisateurs et Permissions"))
    roles = [
        ["Role", "Scope", "Acces", "Cas d'usage"],
        ["SUPER_ADMIN", "Plateforme", "Total", "Administration systeme"],
        ["OWNER", "Organisation", "Complet (son org)", "Proprietaire du compte"],
        ["MANAGER", "Organisation", "Gestion operationnelle", "Responsable conciergerie"],
        ["STAFF", "Organisation", "Lecture + actions limitees", "Collaborateur operationnel"],
        ["VIEWER", "Organisation", "Lecture seule", "Investisseur, consultant"],
        ["HOST", "Proprietes", "Gestion de ses biens", "Proprietaire individuel"],
        ["HOUSEKEEPER", "Equipe", "Interventions menage", "Agent de menage"],
        ["TECHNICIAN", "Equipe", "Interventions maintenance", "Technicien de maintenance"],
        ["SUPERVISOR", "Equipe", "Supervision equipes", "Chef d'equipe terrain"],
    ]
    S.append(tbl(roles[0], roles[1:], widths=[30*mm, 25*mm, 40*mm, 55*mm]))

    S.append(sp(5))
    S.append(s2("C. Environments et Deploiement"))
    envs = [
        ["Environnement", "URL", "Usage", "Base de donnees"],
        ["Development", "localhost:3000 / :8080", "Developpement local", "PostgreSQL local"],
        ["CI/CD", "GitHub Actions", "Tests automatises", "H2 in-memory"],
        ["Staging", "staging.clenzy.com", "Validation pre-prod", "PostgreSQL staging"],
        ["Production", "app.clenzy.com", "Production live", "PostgreSQL managed"],
    ]
    S.append(tbl(envs[0], envs[1:], widths=[30*mm, 40*mm, 40*mm, 42*mm]))

    # ═══════════════════════════════════════════════════════════════════════
    # FOOTER
    # ═══════════════════════════════════════════════════════════════════════
    S.append(sp(10))
    S.append(HRFlowable(width="60%", thickness=1, color=GRAY300, spaceBefore=0, spaceAfter=6))
    S.append(Paragraph(
        "<i>Document genere le 12 mars 2026 - SinaTech SARL<br/>"
        "Clenzy PMS v2.5 - Tous droits reserves<br/>"
        "Ce document est confidentiel et destine exclusivement aux equipes internes et partenaires autorises.</i>",
        ParagraphStyle('fn', parent=styles['Small'], alignment=TA_CENTER)
    ))

    # BUILD
    doc.build(S, onFirstPage=cover_bg, onLaterPages=page_bg)
    print(f"PDF genere : {OUTPUT_PATH}")

if __name__ == '__main__':
    build()
