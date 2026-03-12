#!/usr/bin/env python3
"""
Clenzy PMS - Generateur de Documentation Multi-PDF
Genere 7 documents PDF separes par audience.

Usage : python3 generate_all_docs.py
"""

import os
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)

# ─── Colors ────────────────────────────────────────────────────────────────
PRIMARY     = HexColor('#1A1A2E')
ACCENT      = HexColor('#4F46E5')
ACCENT2     = HexColor('#7C3AED')
GREEN       = HexColor('#059669')
ORANGE      = HexColor('#D97706')
RED         = HexColor('#DC2626')
BLUE        = HexColor('#2563EB')
TEAL        = HexColor('#0D9488')
GRAY100     = HexColor('#F3F4F6')
GRAY200     = HexColor('#E5E7EB')
GRAY300     = HexColor('#D1D5DB')
GRAY500     = HexColor('#6B7280')
GRAY600     = HexColor('#4B5563')
GRAY700     = HexColor('#374151')
GRAY800     = HexColor('#1F2937')
WHITE       = white

OUTPUT_DIR  = os.path.dirname(os.path.abspath(__file__))
W = 170 * mm

# ─── Styles ────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()
styles['BodyText'].fontSize = 10
styles['BodyText'].leading = 14.5
styles['BodyText'].textColor = GRAY700
styles['BodyText'].fontName = 'Helvetica'
styles['BodyText'].spaceAfter = 8
styles['BodyText'].alignment = TA_JUSTIFY

def _add(name, **kw):
    if name not in styles.byName:
        styles.add(ParagraphStyle(name, **kw))

_add('CoverTitle', parent=styles['Title'], fontSize=34, leading=40, textColor=WHITE,
     fontName='Helvetica-Bold', alignment=TA_LEFT, spaceAfter=6)
_add('CoverSub', parent=styles['Normal'], fontSize=14, leading=18, textColor=HexColor('#C7D2FE'),
     fontName='Helvetica', alignment=TA_LEFT, spaceAfter=4)
_add('CoverMeta', parent=styles['Normal'], fontSize=11, leading=14, textColor=HexColor('#94A3B8'),
     fontName='Helvetica', alignment=TA_LEFT)
_add('S1', parent=styles['Heading1'], fontSize=22, leading=28, textColor=PRIMARY,
     fontName='Helvetica-Bold', spaceBefore=20, spaceAfter=10)
_add('S2', parent=styles['Heading2'], fontSize=15, leading=20, textColor=ACCENT,
     fontName='Helvetica-Bold', spaceBefore=14, spaceAfter=8)
_add('S3', parent=styles['Heading3'], fontSize=12, leading=16, textColor=GRAY700,
     fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=6)
_add('Body', parent=styles['Normal'], fontSize=10, leading=14.5, textColor=GRAY700,
     fontName='Helvetica', spaceAfter=8, alignment=TA_JUSTIFY)
_add('Bullet', parent=styles['Normal'], fontSize=10, leading=14, textColor=GRAY700,
     fontName='Helvetica', spaceAfter=3, leftIndent=16, bulletIndent=4)
_add('Small', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=GRAY500,
     fontName='Helvetica', spaceAfter=4)
_add('TH', parent=styles['Normal'], fontSize=9, leading=12, textColor=WHITE,
     fontName='Helvetica-Bold', alignment=TA_CENTER)
_add('TC', parent=styles['Normal'], fontSize=9, leading=12, textColor=GRAY700,
     fontName='Helvetica', alignment=TA_CENTER)
_add('TCL', parent=styles['Normal'], fontSize=9, leading=12, textColor=GRAY700,
     fontName='Helvetica', alignment=TA_LEFT)
_add('TCB', parent=styles['Normal'], fontSize=9, leading=12, textColor=GRAY800,
     fontName='Helvetica-Bold', alignment=TA_CENTER)
_add('KPI', parent=styles['Normal'], fontSize=24, leading=28, textColor=ACCENT,
     fontName='Helvetica-Bold', alignment=TA_CENTER)
_add('KPILabel', parent=styles['Normal'], fontSize=9, leading=12, textColor=GRAY500,
     fontName='Helvetica', alignment=TA_CENTER)
_add('Screenshot', parent=styles['Normal'], fontSize=9, leading=12, textColor=GRAY500,
     fontName='Helvetica-Oblique', alignment=TA_CENTER, spaceBefore=4, spaceAfter=4)

# ─── Helpers ───────────────────────────────────────────────────────────────
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
    data = [[Paragraph(f"[SCREENSHOT PLACEHOLDER]<br/><i>{desc}</i>", styles['Screenshot'])]]
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

def p(text):    return Paragraph(text, styles['Body'])
def s1(text):   return Paragraph(text, styles['S1'])
def s2(text):   return Paragraph(text, styles['S2'])
def s3(text):   return Paragraph(text, styles['S3'])
def bullet(t):  return Paragraph(f"&#8226; {t}", styles['Bullet'])
def sp(h=4):    return Spacer(1, h*mm)

# ─── Page backgrounds ─────────────────────────────────────────────────────
def _make_cover_bg(accent_color):
    def cover_bg(c, doc):
        w, h = A4
        c.setFillColor(PRIMARY)
        c.rect(0, 0, w, h, fill=1, stroke=0)
        c.setFillColor(accent_color)
        c.rect(0, h - 8*mm, w, 8*mm, fill=1, stroke=0)
        c.setFillColor(HexColor('#2D2D4E'))
        c.rect(0, 0, w, 35*mm, fill=1, stroke=0)
    return cover_bg

def _make_page_bg(header_label):
    def page_bg(c, doc):
        w, h = A4
        c.setStrokeColor(ACCENT)
        c.setLineWidth(1.5)
        c.line(20*mm, h-18*mm, w-20*mm, h-18*mm)
        c.setFont('Helvetica', 8)
        c.setFillColor(GRAY500)
        c.drawString(20*mm, h-16*mm, f"Clenzy PMS - {header_label}")
        c.drawRightString(w-20*mm, h-16*mm, "Confidentiel")
        c.drawString(20*mm, 12*mm, "SinaTech SARL - Mars 2026")
        c.drawRightString(w-20*mm, 12*mm, f"Page {doc.page}")
        c.setStrokeColor(GRAY200)
        c.setLineWidth(0.5)
        c.line(20*mm, 17*mm, w-20*mm, 17*mm)
    return page_bg

def _cover(S, title, subtitle, audience_label, accent_color):
    S.append(sp(55))
    S.append(Paragraph(title, styles['CoverTitle']))
    S.append(Paragraph("Clenzy PMS", styles['CoverTitle']))
    S.append(sp(8))
    S.append(Paragraph(subtitle, styles['CoverSub']))
    S.append(Paragraph(f"Audience : {audience_label}", styles['CoverSub']))
    S.append(sp(25))
    S.append(Paragraph("Version 2.5 - Mars 2026", styles['CoverMeta']))
    S.append(Paragraph("SinaTech SARL - Document Confidentiel", styles['CoverMeta']))
    S.append(PageBreak())

def _toc(S, items):
    S.append(s1("Sommaire"))
    S.append(divider())
    for item in items:
        bold = not item.startswith("   ")
        sz = 11 if bold else 10
        S.append(Paragraph(
            f"<b>{item.strip()}</b>" if bold else f"&nbsp;&nbsp;&nbsp;{item.strip()}",
            ParagraphStyle('toc_', parent=styles['Body'], fontSize=sz, leading=18, spaceAfter=1)
        ))
    S.append(PageBreak())

def _footer(S):
    S.append(sp(10))
    S.append(HRFlowable(width="60%", thickness=1, color=GRAY300, spaceBefore=0, spaceAfter=6))
    S.append(Paragraph(
        "<i>Document genere le 12 mars 2026 - SinaTech SARL<br/>"
        "Clenzy PMS v2.5 - Tous droits reserves<br/>"
        "Ce document est confidentiel et destine exclusivement aux equipes internes et partenaires autorises.</i>",
        ParagraphStyle('fn', parent=styles['Small'], alignment=TA_CENTER)
    ))

def _build(filename, title, S, header_label, accent_color=ACCENT):
    path = os.path.join(OUTPUT_DIR, filename)
    doc = SimpleDocTemplate(path, pagesize=A4,
        topMargin=25*mm, bottomMargin=22*mm, leftMargin=20*mm, rightMargin=20*mm,
        title=f"Clenzy PMS - {title}", author="SinaTech SARL")
    doc.build(S, onFirstPage=_make_cover_bg(accent_color), onLaterPages=_make_page_bg(header_label))
    print(f"  -> {path}")

# ═══════════════════════════════════════════════════════════════════════════
# 1. DOCUMENTATION PRODUIT
# ═══════════════════════════════════════════════════════════════════════════
def build_produit():
    S = []
    _cover(S, "Documentation Produit", "Vue d'ensemble, modules fonctionnels et vision", "Product Owner / Decideur", ACCENT)
    _toc(S, [
        "1. Vue d'ensemble de Clenzy",
        "2. Vision et Objectifs",
        "3. Modules Fonctionnels",
        "   3.1 Proprietes", "   3.2 Reservations", "   3.3 Calendrier",
        "   3.4 Tarification", "   3.5 Communication", "   3.6 Interventions",
        "   3.7 Finances", "   3.8 Guests", "   3.9 IoT",
        "   3.10 Documents", "   3.11 IA", "   3.12 Organisation",
        "4. Architecture Fonctionnelle",
        "5. Glossaire PMS",
        "6. Roadmap Produit",
    ])

    # 1
    S.append(s1("1. Vue d'ensemble de Clenzy"))
    S.append(divider())
    S.append(p(
        "<b>Clenzy</b> est une plateforme SaaS de gestion locative (Property Management System) "
        "concue pour les proprietaires, gestionnaires et conciergeries de location courte et moyenne duree. "
        "La plateforme centralise l'ensemble des operations : gestion des biens, reservations, tarification, "
        "communication guests, interventions, comptabilite, et integrations avec les grandes plateformes OTA."
    ))
    S.append(p(
        "Clenzy se differencie par son approche <b>tout-en-un</b> : un seul outil remplace la combinaison "
        "de 5-8 logiciels habituellement necessaires (PMS + channel manager + CRM + facturation + messaging + IoT). "
        "L'intelligence artificielle embarquee assiste les utilisateurs dans la tarification, la communication "
        "et l'analyse de performance."
    ))

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

    # 2
    S.append(s1("2. Vision et Objectifs"))
    S.append(divider())
    S.append(p("<b>Vision :</b> Devenir la plateforme de reference pour la gestion locative en Europe et au Maghreb, "
               "en offrant une solution tout-en-un, multilingue, avec une intelligence artificielle integree."))
    S.append(sp(2))
    S.append(s2("Objectifs Strategiques"))
    for obj in [
        "<b>Centralisation</b> : Un seul outil pour gerer biens, reservations, finances et equipes",
        "<b>Multi-canal</b> : Synchronisation temps reel avec Airbnb, Booking, Expedia et 15+ plateformes",
        "<b>Automatisation</b> : Workflows intelligents pour messagerie, tarification et interventions",
        "<b>IA embarquee</b> : 5 modules IA pour design, pricing, messaging, analytics et sentiment",
        "<b>Conformite</b> : RGPD, fiscalite multi-pays, facturation conforme",
        "<b>Multilingue</b> : Francais, Anglais, Arabe (LTR/RTL)",
    ]:
        S.append(bullet(obj))
    S.append(sp(2))

    S.append(s2("Proposition de Valeur"))
    S.append(p("Clenzy repond aux besoins de trois segments :"))
    segments = [
        ["Segment", "Taille du parc", "Besoins principaux", "Valeur Clenzy"],
        ["Proprietaire individuel", "1-3 biens", "Simplicite, calendrier, messaging", "Gratuit ou Starter (29 EUR/mois)"],
        ["Conciergerie / Agence", "3-50 biens", "Multi-canal, equipes, tarification", "Pro (79 EUR/mois) - IA incluse"],
        ["Grand gestionnaire", "50-500+ biens", "Performance, API, integrations, IA avancee", "Business (sur devis) - BYOK"],
    ]
    S.append(tbl(segments[0], segments[1:], widths=[35*mm, 25*mm, 50*mm, 55*mm]))

    S.append(PageBreak())

    # 3
    S.append(s1("3. Modules Fonctionnels"))
    S.append(divider())
    S.append(p("Clenzy est compose de <b>12 modules fonctionnels</b> couvrant l'integralite de la gestion locative :"))

    modules_overview = [
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
    S.append(tbl(modules_overview[0], modules_overview[1:], widths=[28*mm, 82*mm, 60*mm]))
    S.append(sp(4))

    # 3.1 Proprietes
    S.append(s2("3.1 Module Proprietes"))
    S.append(p("Le module Proprietes est le coeur de Clenzy. Chaque bien immobilier est modelise avec :"))
    for f in [
        "<b>Informations generales</b> : Nom, adresse, type (appartement, maison, villa, chambre), capacite, superficie",
        "<b>Equipements</b> : Liste configurable (WiFi, parking, piscine, climatisation, etc.)",
        "<b>Photos</b> : Galerie multi-photos avec ordre drag-and-drop, redimensionnement automatique",
        "<b>Statuts</b> : ACTIVE, INACTIVE, UNDER_MAINTENANCE, ARCHIVED",
        "<b>Assignation</b> : Rattachement a un portefeuille, une equipe, un proprietaire",
        "<b>Contenu canal</b> : Description personnalisee par OTA (Airbnb, Booking, etc.)",
    ]:
        S.append(bullet(f))
    S.append(screenshot_placeholder("Page de detail d'une propriete avec onglets et photos"))

    # 3.2 Reservations
    S.append(s2("3.2 Module Reservations"))
    S.append(p("Centralise toutes les reservations, quelle que soit la source :"))
    resa_sources = [
        ["Source", "Integration", "Sync", "Particularites"],
        ["Airbnb", "API OAuth2 + Webhooks", "Temps reel", "Messages, reviews, IDs guests"],
        ["Booking.com", "Webhooks + iCal", "Temps reel", "Commission variable"],
        ["Booking Engine", "API directe", "Instantane", "0% commission"],
        ["Manuel", "Saisie dans Clenzy", "N/A", "Reservations telephoniques/email"],
        ["iCal Import", "URLs iCal externes", "15 min", "Plateformes non integrees"],
    ]
    S.append(tbl(resa_sources[0], resa_sources[1:], widths=[30*mm, 38*mm, 25*mm, 58*mm]))

    # 3.3 - 3.12 summaries
    for mod_name, mod_desc in [
        ("3.3 Module Calendrier", "Gestion des disponibilites avec vue mensuelle multi-proprietes, synchronisation iCal bidirectionnelle, blocage de dates et restrictions de reservation (duree minimum, gaps, etc.)"),
        ("3.4 Module Tarification", "Moteur de pricing avance : plans tarifaires saisonniers, rate overrides, reductions LOS, pricing par occupation, yield rules automatiques, integration PriceLabs"),
        ("3.5 Module Communication", "Messagerie unifiee multi-canal : WhatsApp (via Twilio), Email (SMTP), SMS, In-App. Templates dynamiques avec variables, automation rules pour messages pre/post-sejour"),
        ("3.6 Module Interventions", "Planning des menages, maintenances et reparations. Assignation automatique aux equipes, checklists, photos avant/apres, suivi en temps reel"),
        ("3.7 Module Finances", "Facturation automatique, suivi des paiements (Stripe), comptabilite par propriete, rapprochement bancaire, integration PennyLane, gestion des commissions OTA"),
        ("3.8 Module Guests", "CRM guest complet : profils, historique de sejours, preferences, documents d'identite, check-in en ligne, guide d'accueil digital, integration HubSpot"),
        ("3.9 Module IoT", "Integration serrures connectees (Nuki), capteurs de bruit (Minut), smart home (Tuya), echange de cles (KeyNest). Codes d'acces temporaires generes automatiquement"),
        ("3.10 Module Documents", "Generation de documents PDF (contrats, factures, etats des lieux) via templates personnalisables et moteur Gotenberg. Conformite RGPD"),
        ("3.11 Module IA", "5 sous-modules : Design (CSS booking engine), Pricing (prix dynamiques), Messaging (detection d'intention), Analytics (insights), Sentiment (analyse d'avis)"),
        ("3.12 Module Organisation", "Multi-tenancy, gestion des roles (OWNER, MANAGER, STAFF, VIEWER), invitations par email, permissions granulaires, branding personnalise"),
    ]:
        S.append(s2(mod_name))
        S.append(p(mod_desc))

    S.append(PageBreak())

    # 4
    S.append(s1("4. Architecture Fonctionnelle"))
    S.append(divider())
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

    # 5
    S.append(s1("5. Glossaire PMS"))
    S.append(divider())
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
        ["SaaS", "Software as a Service - Logiciel heberge et facture en abonnement"],
        ["Circuit Breaker", "Pattern de resilience qui protege contre les pannes en cascade"],
        ["Rate Plan", "Plan tarifaire avec type de prix et periode d'application"],
    ]
    S.append(tbl(glossary[0], glossary[1:], widths=[35*mm, 135*mm]))

    # 6
    S.append(PageBreak())
    S.append(s1("6. Roadmap Produit"))
    S.append(divider())
    roadmap = [
        ["Phase", "Periode", "Contenu", "Statut"],
        ["Phase 1 : Core PMS", "2024 Q3-Q4", "Proprietes, reservations, calendrier, tarification", "Termine"],
        ["Phase 2 : IA + Comm", "2025 Q1-Q2", "5 modules IA, messaging multi-canal, automation", "Termine"],
        ["Phase 2.5 : BYOK", "2025 Q3", "Cles API par org, budget tokens, guidance UX", "Termine"],
        ["Phase 3 : Mobile", "2025 Q4", "Application mobile React Native (iOS + Android)", "Planifie"],
        ["Phase 4 : Marketplace", "2026 Q1", "Place de marche de services (menage, conciergerie)", "Planifie"],
        ["Phase 5 : Revenue+", "2026 Q2", "Revenue management avance, benchmarking marche", "Concept"],
    ]
    S.append(tbl(roadmap[0], roadmap[1:], widths=[30*mm, 25*mm, 70*mm, 25*mm]))

    _footer(S)
    _build("Clenzy_Documentation_Produit.pdf", "Documentation Produit", S, "Documentation Produit")


# ═══════════════════════════════════════════════════════════════════════════
# 2. DOCUMENTATION BUSINESS / OPERATIONS
# ═══════════════════════════════════════════════════════════════════════════
def build_business():
    S = []
    _cover(S, "Documentation Business", "Processus metier, workflows et gestion operationnelle", "Operations / Management", TEAL)
    _toc(S, [
        "1. Processus Metier Principaux",
        "2. Cycle de Vie d'une Reservation",
        "3. Workflows Cleaning & Maintenance",
        "   3.1 Types d'interventions", "   3.2 Declencheurs automatiques",
        "   3.3 Suivi et reporting",
        "4. Revenue Management",
        "   4.1 Ordre de priorite des prix", "   4.2 Concepts tarifaires",
        "   4.3 Strategies recommandees",
        "5. Gestion des Equipes",
        "6. Reporting Operationnel",
        "7. Conformite et Reglementation",
    ])

    # 1
    S.append(s1("1. Processus Metier Principaux"))
    S.append(divider())
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
    S.append(sp(3))
    S.append(info_box(
        "<b>Automatisation :</b> 70% des processus quotidiens peuvent etre automatises via "
        "les regles d'automatisation Clenzy (Trigger > Condition > Action). L'objectif est de "
        "reduire la charge operationnelle de 60% pour une conciergerie gerant 20+ biens."
    , TEAL))

    # 2
    S.append(s1("2. Cycle de Vie d'une Reservation"))
    S.append(divider())
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

    S.append(s2("Politiques d'Annulation"))
    S.append(p("Clenzy supporte plusieurs politiques d'annulation configurables par propriete :"))
    cancel = [
        ["Politique", "Remboursement", "Delai", "Cas d'usage"],
        ["Flexible", "100%", "J-1 avant arrivee", "Petits biens, basse saison"],
        ["Moderee", "100% si J-5, 50% si J-1", "J-5 / J-1", "Standard conciergerie"],
        ["Stricte", "50% si J-14, 0% apres", "J-14", "Haute saison, villas premium"],
        ["Non remboursable", "0%", "Immediate", "Offres promotionnelles"],
    ]
    S.append(tbl(cancel[0], cancel[1:], widths=[32*mm, 30*mm, 30*mm, 60*mm]))

    S.append(PageBreak())

    # 3
    S.append(s1("3. Workflows Cleaning & Maintenance"))
    S.append(divider())

    S.append(s2("3.1 Types d'Interventions"))
    int_table = [
        ["Type", "Declencheur", "Priorite", "Assignation", "Suivi"],
        ["CLEANING", "Check-out auto", "MEDIUM", "Equipe menage", "Photos avant/apres"],
        ["REPAIR", "Demande service", "HIGH/URGENT", "Technicien", "Devis + validation"],
        ["MAINTENANCE", "Planification", "LOW/MEDIUM", "Technicien", "Checklist"],
        ["INSPECTION", "Periodique", "MEDIUM", "Superviseur", "Rapport + photos"],
    ]
    S.append(tbl(int_table[0], int_table[1:], widths=[28*mm, 30*mm, 26*mm, 30*mm, 36*mm]))

    S.append(s2("3.2 Declencheurs Automatiques"))
    for item in [
        "<b>Menage automatique</b> : Declenche a chaque check-out, assigne a l'equipe de menage de la propriete",
        "<b>Maintenance planifiee</b> : Recurrence configurable (hebdo, mensuel). Exemples : verification chaudiere, jardin",
        "<b>Reparation urgente</b> : Creee via demande de service (guest ou equipe), priorite URGENT",
        "<b>Inspection</b> : Post-checkout ou periodique, avec photos obligatoires",
    ]:
        S.append(bullet(item))

    S.append(s2("3.3 Suivi et Reporting"))
    S.append(p("Chaque intervention est tracee avec : date de creation, assignation, debut, completion, "
               "duree, photos, commentaires, cout. Les KPIs d'intervention sont visibles sur le dashboard."))
    S.append(screenshot_placeholder("Planning des interventions avec vue calendrier et statuts"))

    # 4
    S.append(s1("4. Revenue Management"))
    S.append(divider())
    S.append(p("Clenzy integre un moteur de tarification avance avec resolution multi-regles :"))

    S.append(s2("4.1 Ordre de Priorite des Prix"))
    S.append(p("<b>Ordre de resolution :</b><br/>"
               "1. Rate Override (prix manuel) &gt; 2. Promotion &gt; 3. Saisonnier &gt; 4. Last Minute &gt; 5. Base"))

    S.append(s2("4.2 Concepts Tarifaires"))
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

    S.append(s2("4.3 Strategies Recommandees"))
    for s in [
        "<b>Basse saison</b> : Prix de base -20%, LOS discount 7 nuits -15%, last minute J-3 -10%",
        "<b>Moyenne saison</b> : Prix de base standard, LOS discount 7 nuits -10%",
        "<b>Haute saison</b> : Prix de base +30-50%, min 3 nuits, pas de LOS discount",
        "<b>Evenements speciaux</b> : Rate override fixe, min 5 nuits, non annulable",
    ]:
        S.append(bullet(s))

    S.append(PageBreak())

    # 5
    S.append(s1("5. Gestion des Equipes"))
    S.append(divider())
    S.append(p("Clenzy permet de gerer des equipes multi-competences :"))
    teams = [
        ["Role equipe", "Responsabilites", "Permissions", "Exemple"],
        ["HOUSEKEEPER", "Menage, linge, accueil", "Voir interventions assignees", "Agent de menage"],
        ["TECHNICIAN", "Reparation, maintenance", "Voir interventions + demandes", "Plombier, electricien"],
        ["SUPERVISOR", "Supervision terrain", "Gerer equipe + interventions", "Chef d'equipe"],
        ["MANAGER", "Gestion complete", "Tout sauf parametres org", "Responsable exploitation"],
    ]
    S.append(tbl(teams[0], teams[1:], widths=[30*mm, 40*mm, 40*mm, 40*mm]))

    # 6
    S.append(s1("6. Reporting Operationnel"))
    S.append(divider())
    S.append(p("Clenzy genere des rapports operationnels automatiques :"))
    reports = [
        ["Rapport", "Frequence", "Contenu", "Destinataires"],
        ["Dashboard KPIs", "Temps reel", "Occupation, ADR, RevPAR, revenus", "Manager, Proprietaire"],
        ["Rapport mensuel", "Mensuel", "Synthese financiere par propriete", "Proprietaire"],
        ["Activite equipes", "Hebdomadaire", "Interventions realisees, duree, qualite", "Superviseur"],
        ["Analyse IA", "Sur demande", "Insights pricing, messaging, sentiment", "Manager"],
    ]
    S.append(tbl(reports[0], reports[1:], widths=[30*mm, 25*mm, 60*mm, 35*mm]))

    # 7
    S.append(s1("7. Conformite et Reglementation"))
    S.append(divider())
    for item in [
        "<b>RGPD</b> : Droit d'acces, rectification, effacement, portabilite. GdprService dedie",
        "<b>Fiscalite</b> : 5 regimes fiscaux supportes (micro-entrepreneur, auto, EI, SARL, EIRL)",
        "<b>Facturation</b> : Conforme aux obligations legales (TVA, numerotation sequentielle)",
        "<b>Documents</b> : Archivage 10 ans, signature electronique preparee",
        "<b>Hebergement</b> : Fiche de police, taxe de sejour, declaration en mairie",
    ]:
        S.append(bullet(item))

    _footer(S)
    _build("Clenzy_Documentation_Business.pdf", "Documentation Business", S, "Documentation Business", TEAL)


# ═══════════════════════════════════════════════════════════════════════════
# 3. DOCUMENTATION TECHNIQUE
# ═══════════════════════════════════════════════════════════════════════════
def build_technique():
    S = []
    _cover(S, "Documentation Technique", "Architecture, data model, API et securite", "Developpeurs / DevOps", BLUE)
    _toc(S, [
        "1. Architecture Systeme",
        "   1.1 Infrastructure Docker", "   1.2 Patterns architecturaux",
        "2. Modele de Donnees",
        "   2.1 Domaines et entites", "   2.2 Statuts et enums",
        "3. Documentation API",
        "   3.1 Groupes d'endpoints", "   3.2 Authentification",
        "   3.3 Pagination et filtrage",
        "4. Securite",
        "   4.1 Couches de securite", "   4.2 Chiffrement des donnees",
        "5. Stack Technique Detaillee",
        "6. Performance et Scalabilite",
        "7. CI/CD et Deploiement",
    ])

    # 1
    S.append(s1("1. Architecture Systeme"))
    S.append(divider())

    S.append(s2("1.1 Infrastructure Docker"))
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

    S.append(s2("1.2 Patterns Architecturaux"))
    for pat in [
        "<b>Multi-Tenancy</b> : Filtre Hibernate sur organization_id, isolation complete des donnees",
        "<b>Transactional Outbox</b> : Publication fiable d'evenements via table outbox + relay",
        "<b>Circuit Breaker</b> : Resilience4j sur toutes les APIs externes (18 circuit breakers configures)",
        "<b>CQRS leger</b> : Separation lecture/ecriture pour les dashboards et rapports",
        "<b>Event-Driven Automation</b> : Moteur Trigger > Condition > Action pour l'automatisation",
        "<b>Virtual Threads</b> : Java 21 Project Loom pour la concurrence massive",
        "<b>RestClient</b> : Nouveau RestClient Spring 6.1 (remplace WebClient pour appels synchrones)",
        "<b>Structured Concurrency</b> : Virtual threads pour parallelisme sans blocking",
    ]:
        S.append(bullet(pat))

    S.append(PageBreak())

    # 2
    S.append(s1("2. Modele de Donnees"))
    S.append(divider())
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

    S.append(s2("2.2 Statuts et Enums Principaux"))
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

    S.append(s2("Conventions JPA"))
    for c in [
        "<b>Nommage tables</b> : snake_case (ex: smart_lock_device)",
        "<b>Cle primaire</b> : @GeneratedValue(strategy = IDENTITY), type Long",
        "<b>Audit</b> : @CreatedDate / @LastModifiedDate via Spring Data",
        "<b>Soft delete</b> : Pas de soft delete global, archivage par statut",
        "<b>Relations</b> : FetchType.LAZY par defaut, @BatchSize(size=20) sur les collections",
        "<b>Validation</b> : @NotNull, @Size, @Email, @Pattern en JPA + validation Spring",
    ]:
        S.append(bullet(c))

    S.append(PageBreak())

    # 3
    S.append(s1("3. Documentation API"))
    S.append(divider())

    S.append(s2("3.1 Groupes d'Endpoints"))
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
        ["AI Keys", "/api/ai/keys/*", "BYOK key management", "JWT"],
        ["Webhooks", "/api/webhooks/*", "Airbnb, Booking, Stripe, ...", "HMAC/Token"],
        ["Public", "/api/public/*", "Check-in, guide, key-exchange", "Token/None"],
    ]
    S.append(tbl(api_groups[0], api_groups[1:], widths=[28*mm, 35*mm, 58*mm, 22*mm]))
    S.append(sp(3))
    S.append(screenshot_placeholder("Interface Swagger UI montrant les groupes d'endpoints"))

    S.append(s2("3.2 Authentification"))
    S.append(p("Toutes les APIs protegees utilisent des tokens JWT emis par Keycloak. "
               "Le backend valide le token via la configuration <b>spring.security.oauth2.resourceserver</b>."))
    S.append(info_box(
        "<b>Format du header :</b> <tt>Authorization: Bearer &lt;jwt-token&gt;</tt><br/>"
        "<b>Duree de vie :</b> Access token 5 min, Refresh token 30 min<br/>"
        "<b>Claims custom :</b> org_id, roles[], permissions[]"
    , BLUE))

    S.append(s2("3.3 Pagination et Filtrage"))
    S.append(p("Les endpoints de liste supportent la pagination Spring Data :"))
    for param in [
        "<b>page</b> : Numero de page (defaut 0)",
        "<b>size</b> : Taille de page (defaut 20, max 100)",
        "<b>sort</b> : Champ et direction (ex: sort=createdAt,desc)",
        "<b>Filtres</b> : Parametres specifiques par ressource (status, propertyId, dateRange, etc.)",
    ]:
        S.append(bullet(param))

    S.append(PageBreak())

    # 4
    S.append(s1("4. Securite"))
    S.append(divider())

    S.append(s2("4.1 Couches de Securite"))
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

    S.append(s2("4.2 Chiffrement des Donnees"))
    S.append(p("Deux niveaux de chiffrement sont utilises :"))
    for item in [
        "<b>PII (donnees personnelles)</b> : AES-256 via EncryptedFieldConverter, reversible pour affichage",
        "<b>Cles API</b> : Jasypt PBE encryption avec master key en variable d'environnement",
        "<b>Mots de passe</b> : Bcrypt via Keycloak (jamais stockes dans Clenzy)",
        "<b>Tokens</b> : JWT signe RSA-256 par Keycloak",
    ]:
        S.append(bullet(item))

    # 5
    S.append(s1("5. Stack Technique Detaillee"))
    S.append(divider())
    stack = [
        ["Composant", "Version", "Usage"],
        ["Java", "21 (LTS)", "Language backend, virtual threads"],
        ["Spring Boot", "3.2.x", "Framework applicatif"],
        ["Spring Security", "6.2.x", "OAuth2 Resource Server"],
        ["Hibernate", "6.4.x", "ORM, multi-tenancy filter"],
        ["Liquibase", "4.25.x", "Migrations DB"],
        ["Resilience4j", "2.2.x", "Circuit breakers, rate limiters"],
        ["PostgreSQL", "16", "Base de donnees relationnelle"],
        ["Redis", "7.x", "Cache, sessions, locks"],
        ["Keycloak", "23+", "IAM, SSO, OIDC"],
        ["React", "18.x", "Framework frontend"],
        ["TypeScript", "5.x", "Typage statique frontend"],
        ["MUI (Material-UI)", "5.x", "Composants UI"],
        ["Vite", "5.x", "Build tool frontend"],
        ["React Query", "5.x", "Gestion d'etat serveur"],
        ["React Hook Form", "7.x", "Gestion de formulaires"],
        ["i18next", "23.x", "Internationalisation (FR/EN/AR)"],
    ]
    S.append(tbl(stack[0], stack[1:], widths=[38*mm, 22*mm, 100*mm]))

    # 6
    S.append(PageBreak())
    S.append(s1("6. Performance et Scalabilite"))
    S.append(divider())
    perf = [
        ["Aspect", "Objectif", "Mecanisme"],
        ["Latence API", "< 200ms (p95)", "HikariCP pool, indices SQL, cache Redis"],
        ["Throughput", "1000 req/s", "Virtual threads, connection pooling"],
        ["Base de donnees", "50M lignes", "Partitionnement par date, vacuum, indices"],
        ["Cache", "Hit rate > 85%", "Redis TTL, cache aside pattern"],
        ["Concurrence", "500 users simultanes", "Virtual threads, event-driven"],
        ["Disponibilite", "99.9% SLA", "Circuit breakers, health checks, replicas"],
    ]
    S.append(tbl(perf[0], perf[1:], widths=[32*mm, 30*mm, 95*mm]))

    # 7
    S.append(s1("7. CI/CD et Deploiement"))
    S.append(divider())
    envs = [
        ["Environnement", "URL", "Usage", "Base de donnees"],
        ["Development", "localhost:3000 / :8080", "Developpement local", "PostgreSQL local"],
        ["CI/CD", "GitHub Actions", "Tests automatises", "H2 in-memory"],
        ["Staging", "staging.clenzy.com", "Validation pre-prod", "PostgreSQL staging"],
        ["Production", "app.clenzy.com", "Production live", "PostgreSQL managed"],
    ]
    S.append(tbl(envs[0], envs[1:], widths=[30*mm, 40*mm, 40*mm, 42*mm]))
    S.append(sp(3))
    S.append(p("Pipeline CI/CD : push > lint + compile > tests unitaires > build Docker > deploy staging > smoke tests > deploy prod"))

    _footer(S)
    _build("Clenzy_Documentation_Technique.pdf", "Documentation Technique", S, "Documentation Technique", BLUE)


# ═══════════════════════════════════════════════════════════════════════════
# 4. DOCUMENTATION PARTENAIRE
# ═══════════════════════════════════════════════════════════════════════════
def build_partenaire():
    S = []
    _cover(S, "Documentation Partenaire", "Integrations OTA, IoT, webhooks et SDK", "Partenaires / Integrateurs", ACCENT2)
    _toc(S, [
        "1. Integrations OTA",
        "   1.1 Plateformes connectees", "   1.2 Principe de synchronisation",
        "   1.3 Configuration par canal",
        "2. IoT & Smart Devices",
        "   2.1 Serrures connectees (Nuki)", "   2.2 Detection de bruit (Minut)",
        "   2.3 Smart Home (Tuya)", "   2.4 Echange de cles (KeyNest)",
        "3. Integrations Metier",
        "   3.1 Paiement (Stripe)", "   3.2 CRM (HubSpot)",
        "   3.3 Comptabilite (PennyLane)", "   3.4 Pricing (PriceLabs)",
        "4. Webhooks",
        "5. Booking Engine SDK",
        "6. API Partenaire",
    ])

    # 1
    S.append(s1("1. Integrations OTA"))
    S.append(divider())

    S.append(s2("1.1 Plateformes Connectees"))
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

    S.append(s2("1.2 Principe de Synchronisation"))
    S.append(info_box(
        "<b>Principe de synchronisation :</b> Les reservations entrantes sont traitees via webhooks "
        "(temps reel) ou import iCal (polling toutes les 15 min). Les modifications de disponibilite "
        "et de tarifs sont poussees vers les canaux via le <b>RateDistributionService</b>. "
        "Un circuit breaker Resilience4j protege chaque canal contre les pannes."
    , ACCENT2))

    S.append(s2("1.3 Configuration par Canal"))
    S.append(p("Chaque canal peut etre configure par propriete :"))
    for item in [
        "<b>Commission</b> : Pourcentage de commission OTA (Airbnb ~15%, Booking ~15-20%)",
        "<b>Channel Modifier</b> : Ajustement de prix pour couvrir la commission (+15% sur Airbnb)",
        "<b>Contenu specifique</b> : Description, titre, amenities adaptes par canal",
        "<b>Synchronisation</b> : Activation/desactivation par canal, intervalle iCal",
        "<b>Mapping</b> : Correspondance des types de chambre et equipements vers le format du canal",
    ]:
        S.append(bullet(item))

    S.append(PageBreak())

    # 2
    S.append(s1("2. IoT & Smart Devices"))
    S.append(divider())

    S.append(s2("2.1 Serrures Connectees (Nuki)"))
    S.append(p("Integration avec les serrures Nuki pour la gestion d'acces sans cle :"))
    for f in [
        "<b>Association</b> : Lier une serrure Nuki a une propriete Clenzy",
        "<b>Codes temporaires</b> : Generation automatique de codes pour chaque reservation",
        "<b>Verrouillage/Deverrouillage</b> : Controle a distance depuis l'interface",
        "<b>Historique</b> : Log complet des acces (qui, quand, mode)",
        "<b>Notifications</b> : Alerte en temps reel si la porte reste ouverte",
    ]:
        S.append(bullet(f))

    S.append(s2("2.2 Detection de Bruit (Minut)"))
    S.append(p("Surveillance du niveau sonore en temps reel :"))
    for f in [
        "<b>Seuils configurables</b> : Niveaux de decibels par tranche horaire",
        "<b>Heures calmes</b> : Definition des plages horaires sensibles (22h-8h)",
        "<b>Alertes progressives</b> : 1ere alerte guest, 2eme alerte manager, 3eme escalade",
        "<b>Historique</b> : Graphiques de niveaux sonores par jour/semaine",
    ]:
        S.append(bullet(f))

    S.append(s2("2.3 Smart Home (Tuya)"))
    S.append(p("Controle d'appareils domestiques intelligents via l'API Tuya :"))
    for f in ["Lumieres", "Thermostat", "Climatisation", "Stores automatiques"]:
        S.append(bullet(f))

    S.append(s2("2.4 Echange de Cles (KeyNest)"))
    S.append(p("Points de depot de cles physiques avec suivi :"))
    for f in [
        "<b>Points de depot</b> : Localisation du commerce KeyNest le plus proche",
        "<b>Codes d'acces</b> : Code unique pour chaque reservation",
        "<b>Tracking</b> : Confirmation de depot et recuperation en temps reel",
    ]:
        S.append(bullet(f))

    S.append(PageBreak())

    # 3
    S.append(s1("3. Integrations Metier"))
    S.append(divider())

    for title_, desc_, feats in [
        ("3.1 Paiement (Stripe)", "Integration Stripe pour le traitement des paiements :", [
            "<b>Checkout</b> : Liens de paiement generes automatiquement",
            "<b>Payment Intents</b> : Gestion avancee du flux de paiement",
            "<b>Remboursements</b> : Remboursement total ou partiel depuis Clenzy",
            "<b>Webhooks</b> : Notification en temps reel (paiement reussi, echoue, rembourse)",
            "<b>Comptes connectes</b> : Stripe Connect pour les marketplaces",
        ]),
        ("3.2 CRM (HubSpot)", "Synchronisation des contacts et activites :", [
            "<b>Contacts</b> : Sync bidirectionnelle guests/contacts HubSpot",
            "<b>Deals</b> : Reservation = deal dans le pipeline HubSpot",
            "<b>Timeline</b> : Activites de sejour visibles dans le CRM",
        ]),
        ("3.3 Comptabilite (PennyLane)", "Export comptable automatise :", [
            "<b>Factures</b> : Push automatique des factures vers PennyLane",
            "<b>Ecritures</b> : Correspondance plan comptable configurable",
            "<b>Rapprochement</b> : Synchronisation des paiements",
        ]),
        ("3.4 Pricing (PriceLabs)", "Intelligence tarifaire externe :", [
            "<b>Sync quotidien</b> : Import des prix recommandes PriceLabs",
            "<b>Override</b> : Les prix manuels Clenzy ont toujours priorite",
            "<b>Marche</b> : Donnees de benchmarking du marche local",
        ]),
    ]:
        S.append(s2(title_))
        S.append(p(desc_))
        for f in feats:
            S.append(bullet(f))

    S.append(PageBreak())

    # 4
    S.append(s1("4. Webhooks"))
    S.append(divider())
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

    S.append(s2("Securisation des Webhooks"))
    for item in [
        "<b>Signature HMAC</b> : Chaque webhook est signe avec un secret partage",
        "<b>Replay protection</b> : Verification du timestamp (fenetre de 5 min)",
        "<b>Idempotence</b> : Deduplication basee sur l'ID de l'evenement",
        "<b>Retry</b> : 3 tentatives avec backoff exponentiel",
    ]:
        S.append(bullet(item))

    # 5
    S.append(s1("5. Booking Engine SDK"))
    S.append(divider())
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
        "<b>Calendrier</b> : Affichage des disponibilites en temps reel",
        "<b>Pricing dynamique</b> : Prix affiches selon les regles tarifaires actives",
    ]:
        S.append(bullet(feat))
    S.append(screenshot_placeholder("Widget Booking Engine integre sur un site web client"))

    # 6
    S.append(s1("6. API Partenaire"))
    S.append(divider())
    S.append(p("Les partenaires technologiques peuvent integrer Clenzy via l'API REST :"))
    S.append(info_box(
        "<b>Documentation interactive :</b> Swagger UI disponible a <b>/swagger-ui.html</b><br/>"
        "<b>Format :</b> JSON, pagination Spring Data, filtres par query params<br/>"
        "<b>Auth :</b> OAuth2 Bearer token via Keycloak<br/>"
        "<b>Rate limiting :</b> 1000 req/min par token"
    , ACCENT2))

    _footer(S)
    _build("Clenzy_Documentation_Partenaire.pdf", "Documentation Partenaire", S, "Documentation Partenaire", ACCENT2)


# ═══════════════════════════════════════════════════════════════════════════
# 5. DOCUMENTATION UTILISATEUR
# ═══════════════════════════════════════════════════════════════════════════
def build_utilisateur():
    S = []
    _cover(S, "Guide Utilisateur", "Prise en main, fonctionnalites et bonnes pratiques", "Proprietaires / Managers / Equipes", GREEN)
    _toc(S, [
        "1. Guide de Demarrage Rapide",
        "   1.1 Creer votre compte", "   1.2 Ajouter votre premiere propriete",
        "   1.3 Connecter vos canaux", "   1.4 Configurer votre equipe",
        "2. Gestion des Proprietes",
        "3. Gestion des Reservations",
        "4. Communication Guests",
        "   4.1 Messagerie multi-canal", "   4.2 Automatisation",
        "5. Calendrier et Disponibilites",
        "6. Tarification",
        "7. Interventions",
        "8. Finances et Facturation",
        "9. Intelligence Artificielle",
        "10. FAQ et Bonnes Pratiques",
    ])

    # 1
    S.append(s1("1. Guide de Demarrage Rapide"))
    S.append(divider())

    S.append(s2("1.1 Creer Votre Compte"))
    S.append(p("Rendez-vous sur <b>app.clenzy.com</b> et creez votre compte. "
               "Vous recevrez un email de confirmation."))
    S.append(p("Choisissez votre type d'organisation :"))
    for t in [
        "<b>Individuel</b> : Proprietaire gerant 1-3 biens",
        "<b>Professionnel</b> : Conciergerie ou agence gerant 3-50 biens",
        "<b>Franchise</b> : Reseau de conciergeries avec gestion centralisee",
    ]:
        S.append(bullet(t))
    S.append(screenshot_placeholder("Page d'inscription avec choix du type d'organisation"))

    S.append(s2("1.2 Ajouter Votre Premiere Propriete"))
    S.append(p("Depuis le menu <b>Proprietes > Ajouter</b>, renseignez :"))
    for f in [
        "Nom et adresse du bien", "Type (appartement, maison, villa, chambre, studio)",
        "Nombre de chambres, capacite maximale", "Prix de base par nuit",
        "Photos (minimum 5 recommandees)", "Description (generee par IA si souhaitee)",
    ]:
        S.append(bullet(f))
    S.append(screenshot_placeholder("Formulaire de creation de propriete"))

    S.append(s2("1.3 Connecter Vos Canaux"))
    S.append(p("Allez dans <b>Canaux</b> pour connecter vos comptes Airbnb, Booking.com, etc. "
               "Les reservations seront synchronisees automatiquement."))
    S.append(p("Pour chaque canal, vous pouvez configurer :"))
    for f in [
        "Taux de commission (pour ajuster les prix automatiquement)",
        "Contenu specifique (description, titre adaptes au canal)",
        "Synchronisation iCal (URL d'import et d'export)",
    ]:
        S.append(bullet(f))
    S.append(screenshot_placeholder("Page de configuration des canaux OTA"))

    S.append(s2("1.4 Configurer Votre Equipe"))
    S.append(p("Si vous travaillez en equipe, invitez vos collaborateurs via <b>Equipes > Inviter</b>. "
               "Assignez des roles :"))
    roles_user = [
        ["Role", "Permissions", "Ideal pour"],
        ["Manager", "Gestion complete des proprietes et reservations", "Responsable de conciergerie"],
        ["Staff", "Voir et agir sur les taches assignees", "Collaborateur polyvalent"],
        ["Viewer", "Lecture seule, rapports", "Investisseur, consultant"],
        ["Housekeeper", "Interventions de menage uniquement", "Agent de menage"],
        ["Technician", "Interventions de maintenance", "Technicien"],
    ]
    S.append(tbl(roles_user[0], roles_user[1:], widths=[28*mm, 65*mm, 58*mm]))

    S.append(PageBreak())

    # 2
    S.append(s1("2. Gestion des Proprietes"))
    S.append(divider())
    S.append(p("Chaque propriete dans Clenzy possede un profil complet :"))
    for feat in [
        "<b>Informations generales</b> : Adresse, type, capacite, superficie, equipements",
        "<b>Photos</b> : Galerie multi-photos avec ordre personnalisable (drag-and-drop)",
        "<b>Tarification</b> : Prix de base, plans saisonniers, promotions",
        "<b>Calendrier</b> : Vue mensuelle des disponibilites, blocage de dates",
        "<b>Check-in instructions</b> : Horaires, adresse de remise des cles, guide d'accueil",
        "<b>Equipes</b> : Assignation des equipes de menage et maintenance",
        "<b>Canaux</b> : Connexion aux OTAs, contenu specifique par canal",
        "<b>Documents</b> : Bail, conditions generales, reglement interieur",
    ]:
        S.append(bullet(feat))
    S.append(screenshot_placeholder("Page de detail d'une propriete avec onglets"))

    # 3
    S.append(s1("3. Gestion des Reservations"))
    S.append(divider())
    S.append(p("Le module reservations centralise toutes les reservations :"))
    for feat in [
        "<b>Vue liste</b> : Filtres par statut, propriete, dates, source (Airbnb, Booking, direct)",
        "<b>Detail reservation</b> : Informations guest, dates, montants, historique",
        "<b>Actions rapides</b> : Confirmer, annuler, envoyer lien de paiement, generer facture",
        "<b>Check-in en ligne</b> : Formulaire pre-arrivee envoye automatiquement au guest",
        "<b>Timeline</b> : Historique complet (creation, paiement, check-in, etc.)",
    ]:
        S.append(bullet(feat))
    S.append(screenshot_placeholder("Liste des reservations avec filtres"))

    # 4
    S.append(PageBreak())
    S.append(s1("4. Communication Guests"))
    S.append(divider())

    S.append(s2("4.1 Messagerie Multi-Canal"))
    channels_comm = [
        ["Canal", "Configuration", "Automatisation"],
        ["WhatsApp", "Integration Twilio / WhatsApp Business", "Messages pre/post-sejour automatiques"],
        ["Email", "SMTP configurable par organisation", "Templates personnalisables, variables dynamiques"],
        ["SMS", "Integration Twilio", "Rappels check-in, alertes urgentes"],
        ["In-App", "Messagerie interne Clenzy", "Notifications push mobile"],
    ]
    S.append(tbl(channels_comm[0], channels_comm[1:], widths=[25*mm, 65*mm, 68*mm]))

    S.append(s2("4.2 Automatisation"))
    S.append(p("Configurez des regles dans <b>Automatisation > Regles</b> :"))
    auto_rules = [
        ["Declencheur", "Timing", "Action", "Exemple"],
        ["Reservation confirmee", "Immediate", "Email de bienvenue", "Merci pour votre reservation !"],
        ["Pre-arrivee", "J-3", "Instructions check-in", "Code d'acces, parking, WiFi"],
        ["Jour d'arrivee", "14h", "Message de bienvenue", "Bienvenue dans votre logement !"],
        ["Jour de depart", "10h", "Rappel check-out", "N'oubliez pas les cles"],
        ["Post-sejour", "J+1", "Demande d'avis", "Comment s'est passe votre sejour ?"],
    ]
    S.append(tbl(auto_rules[0], auto_rules[1:], widths=[32*mm, 18*mm, 38*mm, 60*mm]))
    S.append(screenshot_placeholder("Interface de messagerie multi-canal avec conversation ouverte"))

    # 5-8
    S.append(PageBreak())
    S.append(s1("5. Calendrier et Disponibilites"))
    S.append(divider())
    S.append(p("Le calendrier affiche les disponibilites de toutes vos proprietes :"))
    for f in [
        "<b>Vue mensuelle</b> : Toutes les proprietes sur un seul ecran",
        "<b>Blocage de dates</b> : Bloquer manuellement des dates (usage personnel, travaux)",
        "<b>Sync iCal</b> : Import/export automatique avec les OTAs non integrees",
        "<b>Restrictions</b> : Duree minimum, gaps entre reservations, jours d'arrivee/depart",
    ]:
        S.append(bullet(f))
    S.append(screenshot_placeholder("Vue calendrier multi-proprietes"))

    S.append(s1("6. Tarification"))
    S.append(divider())
    S.append(p("Gerez vos prix depuis <b>Tarification</b> :"))
    for f in [
        "<b>Prix de base</b> : Tarif standard par nuit pour chaque propriete",
        "<b>Plans saisonniers</b> : Haute/basse saison avec pourcentage d'ajustement",
        "<b>Promotions</b> : Reductions temporaires (ex: -20% en janvier)",
        "<b>Tarifs par canal</b> : Ajustement automatique pour couvrir les commissions OTA",
        "<b>Prix dynamiques (IA)</b> : Recommandations basees sur l'occupation et la demande",
    ]:
        S.append(bullet(f))

    S.append(s1("7. Interventions"))
    S.append(divider())
    S.append(p("Planifiez et suivez les interventions de menage et maintenance :"))
    for f in [
        "<b>Menage automatique</b> : Cree automatiquement a chaque check-out",
        "<b>Maintenance planifiee</b> : Recurrence configurable",
        "<b>Reparation urgente</b> : Creee via demande de service du guest",
        "<b>Photos avant/apres</b> : Documentation visuelle obligatoire",
        "<b>Suivi en temps reel</b> : Statut mis a jour par l'equipe terrain",
    ]:
        S.append(bullet(f))

    S.append(s1("8. Finances et Facturation"))
    S.append(divider())
    for f in [
        "<b>Facturation automatique</b> : Facture generee a chaque reservation confirmee",
        "<b>Paiement en ligne</b> : Lien Stripe envoye au guest par email/SMS",
        "<b>Suivi des paiements</b> : Dashboard avec statuts (en attente, paye, echoue)",
        "<b>Commissions OTA</b> : Calcul automatique et deduction",
        "<b>Export comptable</b> : Integration PennyLane ou export CSV",
    ]:
        S.append(bullet(f))

    # 9
    S.append(PageBreak())
    S.append(s1("9. Intelligence Artificielle"))
    S.append(divider())
    S.append(p("Clenzy integre 5 modules IA accessibles depuis differents menus :"))
    ai_user = [
        ["Module", "Ou le trouver", "Ce qu'il fait"],
        ["Design IA", "Booking Engine > Design", "Genere le CSS de votre widget de reservation a partir de votre site"],
        ["Prix IA", "Prix Dynamiques", "Recommande des prix optimaux jour par jour"],
        ["Messaging IA", "Contact > Conversations", "Detecte l'intention du message et suggere une reponse"],
        ["Analytics IA", "Dashboard > Insights", "Analyse vos KPIs et propose des actions"],
        ["Sentiment IA", "Avis", "Analyse les avis guests et identifie les themes"],
    ]
    S.append(tbl(ai_user[0], ai_user[1:], widths=[28*mm, 42*mm, 90*mm]))
    S.append(sp(3))
    S.append(info_box(
        "<b>Cle API personnelle :</b> Vous pouvez connecter votre propre compte OpenAI ou Claude "
        "dans <b>Parametres > IA</b> pour un usage illimite. Sans cle personnelle, un budget "
        "de 500 000 tokens/mois est inclus dans votre abonnement."
    , GREEN))

    # 10
    S.append(s1("10. FAQ et Bonnes Pratiques"))
    S.append(divider())
    for q, a in [
        ("Comment synchroniser Airbnb ?", "Canaux > Airbnb > Connecter. Autorisez l'acces OAuth2 et les reservations seront synchronisees automatiquement."),
        ("Comment generer une facture ?", "Reservations > Detail > Actions > Generer facture. La facture PDF est envoyee par email au guest."),
        ("Comment configurer les messages automatiques ?", "Automatisation > Regles > Nouvelle regle. Choisissez le declencheur, le timing et le template."),
        ("Comment ajouter un membre a l'equipe ?", "Equipes > Inviter. Entrez l'email et le role souhaite. L'invite recevra un lien de creation de compte."),
        ("L'IA est-elle obligatoire ?", "Non. Tous les modules IA sont optionnels. Les fonctionnalites de base fonctionnent sans IA."),
    ]:
        S.append(s3(q))
        S.append(p(a))

    _footer(S)
    _build("Clenzy_Guide_Utilisateur.pdf", "Guide Utilisateur", S, "Guide Utilisateur", GREEN)


# ═══════════════════════════════════════════════════════════════════════════
# 6. DOCUMENTATION INTERNE
# ═══════════════════════════════════════════════════════════════════════════
def build_interne():
    S = []
    _cover(S, "Documentation Interne", "Operations, monitoring et gestion des incidents", "Equipe Technique / DevOps", ORANGE)
    _toc(S, [
        "1. Gestion des Incidents",
        "   1.1 Niveaux de severite", "   1.2 Procedure de reponse",
        "   1.3 Post-mortem",
        "2. Monitoring & Observabilite",
        "   2.1 Metriques par composant", "   2.2 Alertes configurees",
        "   2.3 Dashboards",
        "3. Runbooks Operationnels",
        "   3.1 Deploiement", "   3.2 Rollback",
        "   3.3 Gestion des certificats", "   3.4 Backup et restore",
        "4. Securite Operationnelle",
        "5. On-Call et Astreinte",
        "6. Checklist de Maintenance",
    ])

    # 1
    S.append(s1("1. Gestion des Incidents"))
    S.append(divider())

    S.append(s2("1.1 Niveaux de Severite"))
    incidents = [
        ["Severite", "Temps de reponse", "Exemples", "Escalade"],
        ["P1 - Critique", "< 15 min", "Plateforme down, perte de donnees, fuite securite", "CTO + equipe on-call"],
        ["P2 - Majeur", "< 1 heure", "Sync OTA cassee, paiements bloques, auth down", "Lead dev + support"],
        ["P3 - Mineur", "< 4 heures", "Bug UI, lenteur, erreur ponctuelle", "Equipe dev"],
        ["P4 - Cosmetique", "< 24 heures", "Typo, amelioration mineure, suggestion UX", "Backlog sprint"],
    ]
    S.append(tbl(incidents[0], incidents[1:], widths=[28*mm, 30*mm, 55*mm, 40*mm]))

    S.append(s2("1.2 Procedure de Reponse"))
    for step in [
        "<b>1. Detection</b> : Alertes Prometheus/Grafana, signalements utilisateurs, monitoring circuit breakers",
        "<b>2. Triage</b> : Classification de severite, identification du domaine impacte",
        "<b>3. Communication</b> : Notification Slack #incidents, status page si P1/P2",
        "<b>4. Investigation</b> : Analyse logs structures, traces distribuees, audit security logs",
        "<b>5. Resolution</b> : Hotfix, rollback, ou workaround selon la severite",
        "<b>6. Verification</b> : Tests smoke post-fix, monitoring renforce 24h",
        "<b>7. Post-mortem</b> : Analyse racine, mesures preventives, mise a jour documentation",
    ]:
        S.append(bullet(step))

    S.append(s2("1.3 Post-Mortem"))
    S.append(p("Chaque incident P1/P2 fait l'objet d'un post-mortem dans les 48h :"))
    for item in [
        "Timeline complete de l'incident",
        "Cause racine identifiee (5 Whys)",
        "Impact mesure (nombre d'utilisateurs, duree, donnees)",
        "Actions correctives (avec owner et deadline)",
        "Mesures preventives pour eviter la recurrence",
    ]:
        S.append(bullet(item))

    S.append(PageBreak())

    # 2
    S.append(s1("2. Monitoring & Observabilite"))
    S.append(divider())

    S.append(s2("2.1 Metriques par Composant"))
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
    S.append(screenshot_placeholder("Dashboard Grafana avec metriques Clenzy"))

    S.append(s2("2.2 Alertes Configurees"))
    alerts = [
        ["Alerte", "Seuil", "Action", "Severite"],
        ["CPU > 80%", "5 min continu", "Notification Slack + email", "P2"],
        ["Error rate > 5%", "3 min continu", "Alerte P2 automatique", "P2"],
        ["Circuit breaker OPEN", "Immediate", "Notification (integration defaillante)", "P2"],
        ["DB connections > 90%", "Immediate", "Alerte critique (HikariCP sature)", "P1"],
        ["AI budget > 80%", "Par org", "Notification au client", "P4"],
        ["Disk > 85%", "Immediate", "Notification + cleanup auto", "P2"],
        ["Memory > 90%", "5 min continu", "Alerte critique, GC analysis", "P1"],
        ["API latency > 2s", "10 min continu", "Investigation performance", "P3"],
    ]
    S.append(tbl(alerts[0], alerts[1:], widths=[32*mm, 25*mm, 55*mm, 18*mm]))

    S.append(s2("2.3 Dashboards"))
    S.append(p("Dashboards Grafana disponibles :"))
    for d in [
        "<b>Overview</b> : Vue d'ensemble sante systeme",
        "<b>API Performance</b> : Latence par endpoint, error rates",
        "<b>Database</b> : Requetes lentes, connexions, locks",
        "<b>Integrations</b> : Etat des circuit breakers, taux d'echec",
        "<b>Business</b> : Reservations/jour, revenus, satisfaction",
        "<b>AI</b> : Consommation tokens, couts, budget restant",
    ]:
        S.append(bullet(d))

    S.append(PageBreak())

    # 3
    S.append(s1("3. Runbooks Operationnels"))
    S.append(divider())

    S.append(s2("3.1 Deploiement"))
    S.append(p("Procedure de deploiement standard :"))
    for step in [
        "1. Merger la PR dans main (apres review + CI vert)",
        "2. GitHub Actions declenche le build Docker automatique",
        "3. Images poussees vers le registry (tagged avec le SHA)",
        "4. Deploiement staging automatique (webhook)",
        "5. Tests smoke staging (5 min)",
        "6. Deploiement production (approbation manuelle)",
        "7. Monitoring renforce pendant 30 min post-deploy",
    ]:
        S.append(bullet(step))

    S.append(s2("3.2 Rollback"))
    S.append(p("En cas de probleme post-deploiement :"))
    for step in [
        "1. Identifier la version precedente (tag Docker)",
        "2. Deployer l'image precedente",
        "3. Verifier les migrations DB (Liquibase est forward-only, preparer un script de rollback si necessaire)",
        "4. Notifier l'equipe via Slack #deployments",
    ]:
        S.append(bullet(step))

    S.append(s2("3.3 Gestion des Certificats"))
    S.append(p("Les certificats SSL sont geres via Let's Encrypt + certbot auto-renewal."))

    S.append(s2("3.4 Backup et Restore"))
    for item in [
        "<b>PostgreSQL</b> : Backup quotidien pg_dump, retention 30 jours",
        "<b>Redis</b> : RDB snapshot toutes les 6h, AOF en temps reel",
        "<b>Fichiers</b> : Photos et documents sur S3 avec versioning",
        "<b>Test de restore</b> : Test mensuel de restauration sur environnement staging",
    ]:
        S.append(bullet(item))

    # 4
    S.append(s1("4. Securite Operationnelle"))
    S.append(divider())
    for item in [
        "<b>Acces infrastructure</b> : SSH via bastion host, cles RSA, 2FA obligatoire",
        "<b>Secrets</b> : Variables d'environnement, jamais dans le code source",
        "<b>Rotation des cles</b> : Trimestrielle pour les API keys, semestrielle pour les certificats",
        "<b>Audit trail</b> : SecurityAuditLog pour tous les acces sensibles",
        "<b>Scan vulnerabilites</b> : Dependabot + OWASP ZAP hebdomadaire",
    ]:
        S.append(bullet(item))

    # 5
    S.append(s1("5. On-Call et Astreinte"))
    S.append(divider())
    oncall = [
        ["Horaire", "Couverture", "Responsable", "Compensation"],
        ["Lun-Ven 9h-18h", "Heures ouvrables", "Equipe dev complete", "Standard"],
        ["Lun-Ven 18h-22h", "Soir", "Dev on-call (rotation)", "+25%"],
        ["Samedi / Dimanche", "Weekend", "Dev on-call (rotation)", "+50%"],
        ["Nuit (22h-9h)", "Nuit", "Alertes P1 uniquement", "+75%"],
    ]
    S.append(tbl(oncall[0], oncall[1:], widths=[30*mm, 30*mm, 38*mm, 28*mm]))

    # 6
    S.append(s1("6. Checklist de Maintenance"))
    S.append(divider())
    S.append(s2("Quotidien"))
    for item in ["Verifier dashboard Grafana overview", "Verifier les alertes non acquittees",
                 "Verifier l'etat des circuit breakers"]:
        S.append(bullet(item))
    S.append(s2("Hebdomadaire"))
    for item in ["Analyser les requetes SQL lentes (pg_stat_statements)", "Verifier l'espace disque",
                 "Revoir les logs d'erreur applicatifs", "Verifier les mises a jour de securite"]:
        S.append(bullet(item))
    S.append(s2("Mensuel"))
    for item in ["Tester la restauration de backup", "Verifier les certificats SSL",
                 "Analyser les couts cloud", "Revoir les permissions et acces"]:
        S.append(bullet(item))

    _footer(S)
    _build("Clenzy_Documentation_Interne.pdf", "Documentation Interne", S, "Documentation Interne", ORANGE)


# ═══════════════════════════════════════════════════════════════════════════
# 7. DOCUMENTATION IA
# ═══════════════════════════════════════════════════════════════════════════
def build_ia():
    S = []
    _cover(S, "Documentation IA", "Architecture, modules, tarification et configuration", "Technique / Product / Decideurs", RED)
    _toc(S, [
        "1. Vue d'Ensemble IA",
        "2. Architecture IA",
        "   2.1 Composants", "   2.2 BYOK (Bring Your Own Key)",
        "   2.3 Circuit Breakers IA",
        "3. Tarification et Budget",
        "   3.1 Cout par modele", "   3.2 Budget par organisation",
        "   3.3 Projections financieres",
        "4. Module DESIGN - Generation CSS",
        "5. Module PRICING - Prix Dynamiques",
        "6. Module MESSAGING - Detection d'Intention",
        "7. Module ANALYTICS - Insights IA",
        "8. Module SENTIMENT - Analyse d'Avis",
        "9. Configuration et Administration",
        "10. Optimisation et Recommandations",
    ])

    # 1
    S.append(s1("1. Vue d'Ensemble IA"))
    S.append(divider())
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

    S.append(sp(3))
    S.append(info_box(
        "<b>Principe de base :</b> L'IA est un assistant, pas un remplacement. Chaque suggestion "
        "est presentee a l'utilisateur qui decide de l'appliquer ou non. Aucune action n'est executee "
        "automatiquement par l'IA."
    , RED))

    # 2
    S.append(s1("2. Architecture IA"))
    S.append(divider())

    S.append(s2("2.1 Composants"))
    ai_arch = [
        ["Composant", "Classe", "Role"],
        ["Key Resolver", "AiKeyResolver", "Resolution cle API : BYOK > plateforme > erreur"],
        ["OpenAI Client", "OpenAiProvider", "RestClient vers api.openai.com/v1"],
        ["Anthropic Client", "AnthropicProvider", "RestClient vers api.anthropic.com/v1"],
        ["Budget Manager", "AiTokenBudgetService", "Verification et decompte du budget tokens"],
        ["Usage Tracker", "AiTokenUsage (entity)", "Log chaque appel (tokens, cout, feature)"],
        ["Key Manager", "OrgAiApiKeyService", "CRUD + test + validation des cles BYOK"],
        ["Error Classifier", "classifyProviderError()", "Messages d'erreur clairs (solde, cle, quota)"],
        ["Anonymizer", "AiAnonymizationService", "Suppression des PII avant envoi aux APIs IA"],
    ]
    S.append(tbl(ai_arch[0], ai_arch[1:], widths=[30*mm, 45*mm, 90*mm]))

    S.append(s2("2.2 BYOK (Bring Your Own Key)"))
    S.append(p("Le modele BYOK permet a chaque organisation de configurer ses propres cles API :"))
    for item in [
        "<b>Cle plateforme (par defaut)</b> : Cle partagee par tous les tenants, budget de tokens controle",
        "<b>Cle organisation (BYOK)</b> : L'org utilise sa propre cle API, facturee directement par le provider",
        "<b>Resolution</b> : AiKeyResolver cherche d'abord la cle BYOK, puis fallback sur la cle plateforme",
        "<b>Budget</b> : Avec une cle BYOK, le budget de tokens n'est PAS enforced (mais toujours tracked)",
        "<b>Securite</b> : Cles chiffrees en base (Jasypt AES-256), jamais retournees en clair au frontend",
    ]:
        S.append(bullet(item))

    S.append(s2("2.3 Circuit Breakers IA"))
    S.append(p("Chaque module IA dispose de son propre circuit breaker Resilience4j :"))
    cb = [
        ["Circuit Breaker", "Failure Rate", "Wait Duration", "Sliding Window"],
        ["ai-design", "50%", "30s", "10 calls"],
        ["ai-pricing", "50%", "30s", "10 calls"],
        ["ai-messaging", "50%", "30s", "10 calls"],
        ["ai-analytics", "50%", "30s", "10 calls"],
        ["ai-sentiment", "50%", "30s", "10 calls"],
    ]
    S.append(tbl(cb[0], cb[1:], widths=[32*mm, 28*mm, 28*mm, 28*mm]))

    S.append(PageBreak())

    # 3
    S.append(s1("3. Tarification et Budget"))
    S.append(divider())

    S.append(s2("3.1 Cout par Modele"))
    tarif = [
        ["Modele", "Provider", "Input ($/MTok)", "Output ($/MTok)", "Cout 500K tokens"],
        ["GPT-4o mini", "OpenAI", "$0.15", "$0.60", "~0.15 EUR"],
        ["Claude Haiku 4.5", "Anthropic", "$1.00", "$5.00", "~1.20 EUR"],
        ["GPT-4o", "OpenAI", "$2.50", "$10.00", "~2.53 EUR"],
        ["Claude Sonnet 4.5", "Anthropic", "$3.00", "$15.00", "~3.60 EUR"],
        ["Claude Opus 4.6", "Anthropic", "$5.00", "$25.00", "~9.20 EUR"],
    ]
    S.append(tbl(tarif[0], tarif[1:], widths=[32*mm, 25*mm, 28*mm, 28*mm, 30*mm]))

    S.append(s2("3.2 Budget par Organisation"))
    S.append(p("Budget par defaut : <b>100 000 tokens/mois par feature</b> (500K total)."))
    budget = [
        ["Feature", "Budget Tokens", "Cout Claude Sonnet", "Cout GPT-4o mini"],
        ["DESIGN", "100 000", "~0.72 EUR", "~0.03 EUR"],
        ["PRICING", "100 000", "~0.72 EUR", "~0.03 EUR"],
        ["MESSAGING", "100 000", "~0.72 EUR", "~0.03 EUR"],
        ["ANALYTICS", "100 000", "~0.72 EUR", "~0.03 EUR"],
        ["SENTIMENT", "100 000", "~0.72 EUR", "~0.03 EUR"],
        ["TOTAL", "500 000", "~3.60 EUR", "~0.15 EUR"],
    ]
    S.append(tbl(budget[0], budget[1:], widths=[30*mm, 30*mm, 35*mm, 35*mm]))

    S.append(s2("3.3 Projections Financieres"))
    projections = [
        ["Nb comptes", "GPT-4o mini / mois", "Claude Sonnet / mois", "BYOK / mois"],
        ["10", "1.50 EUR", "36 EUR", "0 EUR"],
        ["50", "7.50 EUR", "180 EUR", "0 EUR"],
        ["100", "15 EUR", "360 EUR", "0 EUR"],
        ["500", "75 EUR", "1 800 EUR", "0 EUR"],
    ]
    S.append(tbl(projections[0], projections[1:], widths=[28*mm, 38*mm, 38*mm, 38*mm]))
    S.append(sp(3))
    S.append(info_box(
        "<b>Recommandation :</b> Utiliser <b>GPT-4o mini</b> comme modele par defaut pour la cle plateforme "
        "(0.15 EUR/compte/mois). Les clients premium utilisent BYOK avec Claude Sonnet, "
        "factures directement par Anthropic. Cout pour Clenzy : 0 EUR."
    , GREEN))

    S.append(PageBreak())

    # 4
    S.append(s1("4. Module DESIGN - Generation CSS"))
    S.append(divider())
    S.append(p(
        "Pipeline en 2 etapes : (1) GPT-4o extrait les design tokens (couleurs, fonts, spacing) "
        "depuis le site web du client, (2) Claude genere le CSS personnalise du widget de reservation."
    ))
    S.append(s2("Flux Detaille"))
    design_flow = [
        ["Etape", "Action", "Input", "Output", "Tokens"],
        ["1. Extraction", "Scrape + analyse du site web", "URL du site", "Design tokens JSON", "4 300 - 21 300"],
        ["2. Validation", "L'utilisateur revise les tokens", "Design tokens", "Tokens valides", "0 (UI)"],
        ["3. Generation", "Claude genere le CSS", "Tokens valides", "CSS complet", "2 750 - 4 650"],
        ["4. Preview", "Apercu du widget", "CSS genere", "Widget rendu", "0 (UI)"],
    ]
    S.append(tbl(design_flow[0], design_flow[1:], widths=[20*mm, 40*mm, 30*mm, 30*mm, 30*mm]))
    S.append(sp(2))
    S.append(p("<b>Cache :</b> L'extraction de tokens est cachee par hash du contenu. Si le site n'a pas change, "
               "les tokens precedents sont reutilises (0 token)."))

    # 5
    S.append(s1("5. Module PRICING - Prix Dynamiques"))
    S.append(divider())
    S.append(p(
        "Analyse l'historique de reservations, le taux d'occupation et la saisonnalite pour "
        "generer des recommandations de prix jour par jour."
    ))
    S.append(s2("Donnees d'Entree"))
    for item in [
        "Historique des reservations (90 derniers jours)",
        "Taux d'occupation actuel et previsionnel",
        "Tarifs actuels (base, saisonnier, overrides)",
        "Evenements locaux et jours feries",
        "Performances des proprietes similaires",
    ]:
        S.append(bullet(item))
    S.append(s2("Sortie"))
    S.append(p("Pour chaque jour de la periode demandee :"))
    for item in [
        "<b>Prix recommande</b> : Montant en devise locale",
        "<b>Justification</b> : Raison de la recommandation",
        "<b>Confiance</b> : Score de confiance (HIGH, MEDIUM, LOW)",
        "<b>Comparaison</b> : Ecart avec le prix actuel",
    ]:
        S.append(bullet(item))
    S.append(p("<b>Tokens/appel :</b> 3 800 - 5 700 | <b>Frequence :</b> 2-5 fois/mois/propriete"))

    # 6
    S.append(PageBreak())
    S.append(s1("6. Module MESSAGING - Detection d'Intention"))
    S.append(divider())
    S.append(p(
        "Le plus gros consommateur de tokens (60% du budget). Analyse chaque message guest entrant."
    ))
    S.append(s2("Pipeline de Traitement"))
    msg_flow = [
        ["Etape", "Action", "Detail"],
        ["1. Reception", "Message recu via WhatsApp/Email/SMS/In-App", "Webhook ou polling"],
        ["2. Anonymisation", "Suppression PII (noms, telephones, emails)", "AiAnonymizationService"],
        ["3. Detection intention", "Claude analyse le contenu", "BOOKING, COMPLAINT, INFO, URGENT, OTHER"],
        ["4. Suggestion reponse", "Claude genere une reponse adaptee", "Contexte de la reservation"],
        ["5. Presentation", "Le manager revise et valide/modifie", "UI avec bouton Envoyer"],
    ]
    S.append(tbl(msg_flow[0], msg_flow[1:], widths=[30*mm, 55*mm, 70*mm]))
    S.append(sp(2))
    S.append(p("<b>Tokens/message :</b> 1 080 - 2 130 | <b>Frequence :</b> 20-50 messages/mois/propriete"))
    S.append(p("<b>Fallback :</b> Detection d'intention rule-based disponible (0 token). "
               "Mots-cles en 6 langues pour les cas simples."))

    # 7
    S.append(s1("7. Module ANALYTICS - Insights IA"))
    S.append(divider())
    S.append(p(
        "Genere des insights a partir des KPIs de l'organisation :"
    ))
    for item in [
        "<b>Taux d'occupation</b> : Tendance, comparaison mensuelle, saisonnalite",
        "<b>ADR</b> : Evolution du tarif journalier moyen",
        "<b>RevPAR</b> : Revenue per available room, benchmark",
        "<b>Sources</b> : Repartition des revenus par canal (Airbnb, Booking, direct)",
        "<b>Recommandations</b> : Actions concretes pour optimiser les performances",
    ]:
        S.append(bullet(item))
    S.append(p("<b>Tokens/appel :</b> 1 500 - 2 600 | <b>Frequence :</b> 1-2 fois/mois"))

    # 8
    S.append(s1("8. Module SENTIMENT - Analyse d'Avis"))
    S.append(divider())
    S.append(p("Analyse les avis clients avec plusieurs dimensions :"))
    sentiment = [
        ["Dimension", "Description", "Exemple"],
        ["Score global", "Positif / Neutre / Negatif (0-100)", "Score: 85 (Positif)"],
        ["Themes", "Sujets identifies dans l'avis", "Proprete, Localisation, Accueil"],
        ["Points forts", "Aspects positifs mentionnes", "Excellent accueil, bien equipe"],
        ["Points faibles", "Aspects negatifs mentionnes", "Bruit la nuit, parking difficile"],
        ["Actions", "Recommandations pour ameliorer", "Installer double vitrage"],
        ["Reponse suggeree", "Proposition de reponse au guest", "Merci pour votre retour..."],
    ]
    S.append(tbl(sentiment[0], sentiment[1:], widths=[30*mm, 55*mm, 70*mm]))
    S.append(sp(2))
    S.append(p("<b>Tokens/appel :</b> 920 - 1 920 | <b>Frequence :</b> 5-15 avis/mois"))
    S.append(p("<b>Fallback :</b> Analyse rule-based par mots-cles (6 langues, 0 token)"))

    S.append(PageBreak())

    # 9
    S.append(s1("9. Configuration et Administration"))
    S.append(divider())
    S.append(p("La configuration IA est accessible dans <b>Parametres > IA</b> :"))
    S.append(screenshot_placeholder("Page Parametres > IA avec cards OpenAI et Claude brandees"))
    S.append(sp(2))
    S.append(s2("Configuration BYOK"))
    for item in [
        "<b>Ajouter une cle</b> : Entrer la cle API, tester la connexion, sauvegarder",
        "<b>Modele personnalise</b> : Choisir un modele different (ex: gpt-4o-mini, claude-3-haiku)",
        "<b>Tester la connexion</b> : Verification que la cle est valide (meme si le solde est faible)",
        "<b>Supprimer la cle</b> : Retour automatique a la cle plateforme",
    ]:
        S.append(bullet(item))

    S.append(s2("Gestion des Erreurs"))
    S.append(p("Le systeme classifie les erreurs API pour des messages utilisateur clairs :"))
    errors = [
        ["Erreur", "Cause", "Message utilisateur", "Cle sauvable ?"],
        ["401 Unauthorized", "Cle invalide", "Cle invalide. Verifiez la cle.", "Non"],
        ["400 Credit balance", "Solde insuffisant", "Solde insuffisant. Ajoutez des credits.", "Oui"],
        ["429 Rate limit", "Quota depasse", "Limite de requetes. Reessayez.", "Oui"],
        ["529 Overloaded", "Serveur surcharge", "Provider temporairement indisponible.", "Oui"],
    ]
    S.append(tbl(errors[0], errors[1:], widths=[30*mm, 25*mm, 60*mm, 25*mm]))

    # 10
    S.append(s1("10. Optimisation et Recommandations"))
    S.append(divider())
    S.append(s2("Reduire les Couts"))
    for item in [
        "<b>Modele par defaut : GPT-4o mini</b> (0.15 EUR/compte/mois au lieu de 3.60 EUR avec Claude)",
        "<b>Messaging rule-based</b> : Utiliser la detection par mots-cles pour les intentions simples",
        "<b>Cache design tokens</b> : Evite les extractions repetitives",
        "<b>Budget par feature</b> : Ajuster les quotas selon l'usage reel",
        "<b>BYOK pour les gros comptes</b> : Cout 0 EUR pour Clenzy, le client paie directement",
    ]:
        S.append(bullet(item))
    S.append(s2("Augmenter la Qualite"))
    for item in [
        "<b>Prompts optimises</b> : Chaque service utilise des system prompts affines avec contexte metier",
        "<b>Anonymisation</b> : Suppression automatique des PII avant chaque appel",
        "<b>Temperature basse</b> : temperature=0.3 pour des reponses coherentes et factuelles",
        "<b>MaxTokens controle</b> : Limiter les tokens de sortie par feature pour eviter les depassements",
        "<b>Monitoring</b> : Suivi granulaire par feature, provider, modele dans AiTokenUsage",
    ]:
        S.append(bullet(item))

    _footer(S)
    _build("Clenzy_Documentation_IA.pdf", "Documentation IA", S, "Documentation IA", RED)


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    print("=" * 60)
    print("Clenzy PMS - Generation de 7 documents PDF")
    print("=" * 60)

    builders = [
        ("1/7 Documentation Produit", build_produit),
        ("2/7 Documentation Business", build_business),
        ("3/7 Documentation Technique", build_technique),
        ("4/7 Documentation Partenaire", build_partenaire),
        ("5/7 Guide Utilisateur", build_utilisateur),
        ("6/7 Documentation Interne", build_interne),
        ("7/7 Documentation IA", build_ia),
    ]

    for label, builder in builders:
        print(f"\n{label}...")
        builder()

    print("\n" + "=" * 60)
    print("7 documents PDF generes avec succes !")
    print("=" * 60)
