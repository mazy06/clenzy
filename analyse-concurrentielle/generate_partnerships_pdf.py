#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genere le PDF 'Playbook Partenariats & Procedures' (services externes multi-pays Clenzy).

Destinataires : equipes integration internes + relation partenaires. Pour chaque service externe
(e-invoicing, paiement, declaration voyageurs, channel, RTL) : a faire, qui contacter, strategie
d'approche, cout estime (ordre de grandeur), procedure anticipee, delai, confiance, bloquant.

Source : analyse-concurrentielle/41-strategie-multipays.md + 42 + 20 + HORS-PERIMETRE.md.
Regen : .venv/bin/python generate_partnerships_pdf.py
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, PageBreak)

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
RED = colors.HexColor("#A23B2E")

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
CELL = ParagraphStyle("CELL", parent=BODY, fontSize=7.6, leading=9.4, spaceAfter=0)
CELLB = ParagraphStyle("CELLB", parent=CELL, fontName="Helvetica-Bold")
TIT = ParagraphStyle("TIT", parent=BODY, fontName="Helvetica-Bold", fontSize=25,
                     textColor=PRIMARY, leading=29, alignment=TA_LEFT)
SUB = ParagraphStyle("SUB", parent=BODY, fontSize=12, textColor=MUTED, leading=16)
LBL = ParagraphStyle("LBL", parent=CELL, fontName="Helvetica-Bold", fontSize=7.4, textColor=PRIMARY)

USABLE_W = A4[0] - 36 * mm

def on_page(canvas, doc):
    canvas.saveState()
    # Fond blanc explicite : sinon un lecteur PDF en mode sombre affiche le fond transparent
    # en noir (texte fonce invisible -> ecran noir).
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, A4[1] - 6 * mm, A4[0], 6 * mm, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(18 * mm, 10 * mm, "Clenzy - Playbook partenariats & procedures . multi-pays FR/MA/KSA")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, "p. %d" % doc.page)
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
    canvas.restoreState()

def make_doc(path):
    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=16 * mm, bottomMargin=16 * mm, title="Playbook partenariats Clenzy")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=on_page)])
    return doc

def conf_color(c):
    return {"Elevee": GREEN, "Moyenne": AMBER, "Faible": RED}.get(c, MUTED)

def bullet(txt, style=BODY):
    return Paragraph("- " + txt, style)

# ---- Donnees services (condensees depuis 41-strategie-multipays.md + playbook) ----
SERVICES = [
    {
        "n": 1, "service": "PDP Factur-X", "pays": "FR", "cat": "E-invoicing",
        "conf": "Elevee", "bloquant": "Non",
        "a_faire": "Embarquer le XML CII (deja genere par FacturXCiiBuilder) en PDF/A-3 (iText) + brancher un client PDP reel "
                   "(@Primary) a la place du transmetteur non configure + transmission afterCommit via EInvoicingService (HP-08). "
                   "Clenzy ne devient PAS PDP (agrement lourd) : on integre une PDP partenaire.",
        "contact": "Une PDP privee immatriculee DGFiP/AIFE (acteurs marche : EDICOM, Pennylane, Docaposte, Sage, Generix...). "
                   "Liste officielle a confirmer (impots.gouv/AIFE). Canal : portail developpeur de la PDP retenue.",
        "strategie": "Shortlister 2-3 PDP avec API REST + sandbox + tarif au volume ; signer un accord d'integration ; valider "
                     "la sortie Factur-X avec un validateur EN 16931 officiel avant go-live.",
        "cout": "Ordre de grandeur : setup faible-modere + abonnement + prix PAR FACTURE (centimes a dizaines de centimes). "
                "Sanction non-conformite : 50 EUR/facture, plafond 15 000 EUR/an (source 41 4.1).",
        "procedure": ["Shortlister 2-3 PDP immatriculees", "Signer l'accord + obtenir le sandbox",
                      "Generer Factur-X PDF/A-3 + valider EN 16931", "Tester emission/reception en sandbox",
                      "Brancher le client @Primary + cycle de vie", "Go-live : reception 09/2026, emission TPE/PME 09/2027"],
        "delai": "2-3 mois",
        "note_conf": "Calendrier 09/2026 (reception) / 09/2027 (emission) confirme. Reserve : perimetre PPF/PDP deja revise une fois.",
    },
    {
        "n": 2, "service": "DGI Simpl-TVA", "pays": "MA", "cat": "E-invoicing",
        "conf": "Moyenne", "bloquant": "Oui (partiel)",
        "a_faire": "Brancher le client Simpl-TVA reel (@Primary) a la place de DgiClearanceClient (-> PENDING) : auth + soumission "
                   "UBL 2.1 (deja mappe par MoroccoUblMapper) + attente clearance + persistance EInvoiceSubmission ; cabler la "
                   "chaine ICE (FiscalProfile.ice + TagResolverService par-org) + flux facture afterCommit (HP-16).",
        "contact": "Direction Generale des Impots (DGI) Maroc - portail Simpl-TVA (specs API en cours de publication). "
                   "Relais possible : integrateur certifie (EDICOM, OrchidaTax) le temps que l'API publique se stabilise.",
        "strategie": "Veille active sur la publication de l'API DGI (spec mouvante) ; demander le sandbox des disponibilite ; "
                     "integrateur certifie comme pont si l'acces direct est gated. Caler le dev sur la spec finale + seuils.",
        "cout": "Ordre de grandeur : portail DGI probablement sans frais d'acces ; via integrateur = setup + abonnement + "
                "par-facture (similaire PDP FR). A confirmer.",
        "procedure": ["Veille API Simpl-TVA + seuils DGI", "Enregistrement entreprise + ICE + acces sandbox",
                      "Serialiser l'Invoice en UBL 2.1 + mention ICE", "Tester la clearance en sandbox",
                      "Brancher client @Primary + archivage 10 ans", "Go-live aligne sur la vague de rollout DGI"],
        "delai": "2-4 mois apres publication de l'API",
        "note_conf": "Modele confirme (UBL 2.1, clearance, obligatoire 2026, TVA 20%, archivage 10 ans). API technique + seuils en cours de publication.",
    },
    {
        "n": 3, "service": "ZATCA Fatoora", "pays": "KSA", "cat": "E-invoicing",
        "conf": "Elevee", "bloquant": "Oui",
        "a_faire": "Completer le provider ZATCA (deja : UBL 2.1, QR TLV 1-5, chaine PIH/ICV atomique CLZ-P0-21). Reste (HP-10) : "
                   "onboarding CSID (CSR -> Compliance puis Production CSID), signature XAdES ECDSA, QR TLV 6-9, client API "
                   "clearance (B2B) + reporting (B2C <24h), certificats en KMS, branchement afterCommit.",
        "contact": "ZATCA (Zakat, Tax and Customs Authority) via le portail Fatoora (onboarding EGS/developpeur) + API CSID. "
                   "Doc de reference a suivre a la lettre : E-Invoicing Detailed Guideline v2.",
        "strategie": "POC en SANDBOX d'abord (derisquer avant engagement client KSA) : Compliance CSID -> tests de conformite -> "
                     "Production CSID. Suivre strictement les specs (UBL subset, profil XAdES, ordre TLV).",
        "cout": "Acces ZATCA/Fatoora GRATUIT (autorite fiscale, pas de frais d'API). Cout reel = effort d'ingenierie (XL : crypto "
                "XAdES, CSID, 2 regimes) + KMS/HSM pour les certificats (infra modere).",
        "procedure": ["Creer un EGS unit + generer la CSR", "Compliance CSID (sandbox) + secret",
                      "Batterie de tests de conformite (standard + simplified)", "Production CSID + certificats en KMS",
                      "UBL + PIH + signature XAdES + QR TLV 1-9", "B2B clearance (bloquant) + B2C reporting <24h (Outbox/DLT)"],
        "delai": "3-6 mois (sous-projet a part)",
        "note_conf": "Modele Phase 2 confirme (vagues 2026, CSID, PIH, QR TLV). Wave 23 = 750k SAR (31/03/2026), Wave 24 = 375k SAR (30/06/2026). Activation KSA interdite avant HP-10 complet.",
    },
    {
        "n": 4, "service": "Stripe - caution", "pays": "FR / Transverse", "cat": "Paiement",
        "conf": "Elevee", "bloquant": "Non",
        "a_faire": "Brancher le hold/capture/release reel sur la machine a etats SecurityDeposit deja livree (HP-19) : "
                   "pre-autorisation capture_method=manual, capture partielle, release - hors transaction + afterCommit + "
                   "idempotency via StripeGateway ; politique de caution par bien (montant depuis Property) ; expiration auto ~7j.",
        "contact": "Stripe (deja integre pour les paiements - compte existant). Dashboard + doc API PaymentIntents "
                   "(capture_method=manual). Support partenaire si besoin sur les limites de hold par marche.",
        "strategie": "Reutiliser le compte/cle Stripe + le StripeGateway (RequestOptions + idempotency, composant canonique). "
                     "Pas de nouveau partenariat : extension de l'integration en place. Tester en mode test avant prod.",
        "cout": "Tarif Stripe standard deja contractualise (~1,4%+0,25 EUR cartes EU). Une PRE-AUTORISATION non capturee n'engendre "
                "pas de frais de transaction (hold seulement). Pas de setup additionnel.",
        "procedure": ["PaymentIntent capture_method=manual a la reservation", "markHeld sur autorisation (afterCommit, idempotency)",
                      "Check-out : capture (totale/partielle) ou release", "Gerer l'expiration auto (~7j) : relance/re-hold",
                      "Persister via PaymentStatusTransitionService (CAS)"],
        "delai": "2-4 semaines (extension existante)",
        "note_conf": "Stripe deja integre ; SecurityDeposit + migration 0243 deja livres. Migration Airwallex prevue (fiche suivante) : le hold de caution passera alors par Airwallex. Limite Stripe : pas de payout Connect KSA.",
    },
    {
        "n": 5, "service": "Airwallex (remplacement de Stripe)", "pays": "Transverse", "cat": "Paiement",
        "conf": "Moyenne", "bloquant": "Non (onboarding KYB)",
        "a_faire": "Construire un AirwallexPaymentProvider (acquiring cartes + Payment Intents/Checkout) sur l'abstraction "
                   "PaymentProvider existante, en remplacement de Stripe ; rebrancher le hold de caution (capture manuelle) ; "
                   "idealement consolider FX + payouts proprietaires via Airwallex Payouts (remplacer Wise/GoCardless) ; migrer "
                   "webhooks + tokenisation.",
        "contact": "Airwallex - equipe Sales / Onboarding (airwallex.com) ; offre 'Airwallex for Platforms / Scale' pour "
                   "l'embarque marchand. Portail developpeur + API REST.",
        "strategie": "Compte + acces sandbox ; negocier la grille (tarif sur devis, surtout en platform/volume) ; valider la "
                     "couverture marches/devises (EUR + cartes internationales ; verifier l'acquiring local MA/KSA, sinon garder "
                     "CMI/Payzone/PayTabs en domestique) ; migrer en double-run avec Stripe avant bascule.",
        "cout": "Sur DEVIS (pas de grille flat publique comme Stripe). Ordre de grandeur : acquiring ~competitif vs Stripe "
                "(domestique ~1,x%, international plus eleve), marge FX faible (~0,5-1%), payouts a faible cout. Cout de "
                "migration = effort d'ingenierie (provider + payouts + webhooks). A confirmer par devis.",
        "procedure": ["Compte Airwallex + KYB + acces sandbox", "Negocier la grille (acquiring, FX, payouts) selon volume",
                      "Construire AirwallexPaymentProvider + payouts + webhooks (sandbox)",
                      "Double-run avec Stripe (reconciliation) sur un sous-ensemble", "Basculer le defaut + le hold de caution ; retirer Stripe",
                      "Verifier la couverture MA/KSA ; garder les gateways locales si besoin"],
        "delai": "2-4 mois (onboarding + dev provider + migration)",
        "note_conf": "Airwallex = plateforme paiements globale (acquiring + FX + payouts + cartes), peut consolider Stripe + "
                     "Wise/GoCardless. Pas encore dans le code (a construire). Tarif sur devis -> confiance moyenne ; verifier "
                     "l'acquiring domestique MENA.",
    },
    {
        "n": 6, "service": "CMI", "pays": "MA", "cat": "Paiement",
        "conf": "Moyenne", "bloquant": "Non (contrat marchand)",
        "a_faire": "Router via PaymentProviderRouter (MA + MAD) vers le CmiPaymentProvider existant (CmiRedirectController + "
                   "CmiHashService) ; securiser le flux retour/webhook (redirect + hash) ; toMinorUnits MAD (2 decimales).",
        "contact": "CMI (Centre Monetique Interbancaire) Maroc - service e-commerce/integration marchand, souvent via la BANQUE "
                   "marocaine de l'organisation. Obtention des credentials passerelle.",
        "strategie": "Souscrire un contrat marchand CMI (adosse a un compte bancaire marchand au Maroc) ; obtenir l'environnement "
                     "de test ; valider redirect + hash + webhook. Necessite une entite/compte local.",
        "cout": "Ordre de grandeur : frais d'acquisition par transaction (acquiring local) + eventuels frais installation/abonnement. "
                "A confirmer aupres de CMI / banque acquereur.",
        "procedure": ["Compte marchand MA + contrat e-commerce CMI", "Credentials + acces environnement de test",
                      "Valider hash (CmiHashService) + redirect + webhook", "Tests bout-en-bout (succes/echec/annulation)",
                      "Router via PaymentProviderRouter + prod"],
        "delai": "1-3 mois (ouverture contrat bancaire)",
        "note_conf": "Provider deja code (CmiPaymentProvider, CmiHashService). Modalites tarifaires d'acquiring local non sourcees.",
    },
    {
        "n": 6, "service": "Payzone", "pays": "MA", "cat": "Paiement",
        "conf": "Moyenne", "bloquant": "Non (contrat marchand)",
        "a_faire": "Router via PaymentProviderRouter (MA/MAD) vers le PayzonePaymentProvider existant ; valider flux + webhook ; "
                   "toMinorUnits MAD. Positionner en 2e provider MA (redondance / methodes locales complementaires de CMI).",
        "contact": "Payzone (Maroc) - equipe commerciale/integration marchand. Souscription marchand + portail/API Payzone.",
        "strategie": "Second provider MA (redondance CMI) ; souscrire un contrat marchand ; tester en sandbox ; activer selon "
                     "la couverture de methodes locales souhaitee.",
        "cout": "Ordre de grandeur : frais par transaction (acquiring local) + eventuel abonnement. A confirmer.",
        "procedure": ["Contrat marchand Payzone + credentials", "Acces sandbox/test",
                      "Valider PayzonePaymentProvider + webhook", "Tests bout-en-bout", "Router via PaymentProviderRouter + prod"],
        "delai": "1-3 mois (contrat marchand)",
        "note_conf": "Provider deja code. Modalites contractuelles non sourcees.",
    },
    {
        "n": 7, "service": "PayTabs (+ alternatives)", "pays": "KSA", "cat": "Paiement",
        "conf": "Elevee", "bloquant": "Non (KYB)",
        "a_faire": "Router via PaymentProviderRouter (KSA/SAR) vers le PayTabsPaymentProvider existant ; afficher mada dans le "
                   "tunnel ; toMinorUnits SAR ; valider le 3DS debit mada. Alternatives SAMA-licensed : HyperPay, Tap, Moyasar.",
        "contact": "PayTabs - onboarding marchand KSA (KYB/SAMA). Alternatives : HyperPay, Tap, Moyasar. Portail developpeur PayTabs.",
        "strategie": "Souscrire un compte marchand PayTabs KSA (KYB/SAMA) ; activer mada + Apple Pay + Visa/MC + STC Pay + BNPL "
                     "(Tabby/Tamara) selon besoin ; tester en sandbox. Garder HyperPay/Tap/Moyasar en alternatives.",
        "cout": "Ordre de grandeur : frais par transaction (acquiring KSA) + eventuel setup. A confirmer.",
        "procedure": ["Souscription marchand PayTabs KSA + KYB", "Acces sandbox + credentials",
                      "Valider PayTabsPaymentProvider + mada (BIN routing, 3DS) + webhook", "Tester mada / STC Pay / Apple Pay",
                      "Router via PaymentProviderRouter + prod"],
        "delai": "1-3 mois (onboarding + KYB)",
        "note_conf": "Providers SAMA-licensed + mada/STC Pay confirmes 2026 ; PayTabsPaymentProvider deja code. Entite locale possiblement requise.",
    },
    {
        "n": 8, "service": "mada (reseau debit KSA)", "pays": "KSA", "cat": "Paiement",
        "conf": "Elevee", "bloquant": "Non (via passerelle)",
        "a_faire": "Ne PAS integrer mada en direct : il est acquis via une passerelle SAMA-licensed (PayTabs/HyperPay/Tap/Moyasar). "
                   "Cote Clenzy : afficher mada dans le tunnel, gerer le BIN routing + 3DS debit, i18n des chaines paiement (AR).",
        "contact": "Pas de contact direct mada (schema interbancaire/SAMA) - l'acces passe par la passerelle (cf. PayTabs).",
        "strategie": "Activer mada VIA le contrat passerelle ; tester le routage BIN + acceptation debit ; verifier l'affichage "
                     "du logo/option mada (attente forte du marche KSA, >70% des acheteurs).",
        "cout": "Pas de cout direct mada cote marchand ; frais = ceux de la passerelle (taux mada domestique souvent < cartes "
                "internationales). A confirmer via la passerelle.",
        "procedure": ["Activer mada dans le contrat passerelle", "Configurer le BIN routing debit",
                      "Tester le flux 3DS debit en sandbox", "Afficher l'option mada dans le tunnel (+ i18n AR)",
                      "Suivre le taux d'acceptation en prod"],
        "delai": "Inclus dans l'onboarding passerelle",
        "note_conf": "mada confirme methode dominante KSA 2026 ; integration via passerelle SAMA-licensed.",
    },
    {
        "n": 9, "service": "DGSN / STDN", "pays": "MA", "cat": "Declaration voyageurs",
        "conf": "Moyenne", "bloquant": "Oui (gated)",
        "a_faire": "Implementer la soumission reelle des fiches voyageur sur le portail STDN (l'infra de connexion existe : "
                   "integration/compliance + ComplianceProviderType.POLICE_MA + stub) - NE PAS dupliquer (HP-17). Job @Scheduled "
                   "de tele-declaration quotidienne avant 8h heure marocaine (Africa/Casablanca, audit #9) + reconciliation.",
        "contact": "DGSN (Direction Generale de la Surete Nationale) Maroc - portail stdn.ma. Donnees transmises police + "
                   "Gendarmerie Royale. Acces hebergeur (demarche administrative, pas d'API self-service).",
        "strategie": "DERISQUER l'acces contractuel/administratif AVANT le dev (gated, pas de sandbox public). Obtenir le compte "
                     "hebergeur stdn.ma + modalites d'integration. Si pas d'API : mode declaratif assiste en attendant.",
        "cout": "Ordre de grandeur : portail reglementaire DGSN probablement sans frais d'acces. Cout = effort d'ingenierie (XL, "
                "dont obtention d'acces). A confirmer.",
        "procedure": ["Acces hebergeur au portail STDN (demarche DGSN)", "Clarifier le format du bulletin + modalite (API/portail)",
                      "Agregation des nuitees par propriete", "Declaration quotidienne avant 8h (Africa/Casablanca)",
                      "Soumission reelle + reconciliation + alerte admin sur echec"],
        "delai": "2-4 mois (dont obtention d'acces)",
        "note_conf": "Obligation confirmee (declaration quotidienne avant 8h, bulletin individuel, archivage 1 an). Modalites techniques d'acces : gated.",
    },
    {
        "n": 10, "service": "Absher / MOI / Shomoos", "pays": "KSA", "cat": "Declaration voyageurs",
        "conf": "Moyenne", "bloquant": "Oui (gated)",
        "a_faire": "Implementer la soumission reelle des declarations voyageur (infra existante : integration/compliance + "
                   "ComplianceProviderType.ABSHER_KSA + stub) - NE PAS dupliquer (HP-18). Transmission identite + piece + sejour "
                   "au check-in ; dates en Asia/Riyadh ; PII sensible -> chiffrement KMS + minimisation (PDPL).",
        "contact": "Ministry of Interior (MOI) KSA - ecosysteme Absher Business / Shomoos (systeme hotelier centralise) ; "
                   "Tawakkalna/Absher pour l'identite visiteur. Acces institutionnel MOI (gated).",
        "strategie": "Identifier le canal exact d'enregistrement meuble (Shomoos confirme ; role d'Absher a confirmer). Derisquer "
                     "l'acces contractuel MOI avant le dev (gated). Gerer la PII (chiffrement KMS, minimisation).",
        "cout": "Ordre de grandeur : systeme reglementaire MOI probablement sans frais d'acces. Cout = effort d'ingenierie (XL) + "
                "KMS pour la PII. A confirmer.",
        "procedure": ["Confirmer le canal d'enregistrement meuble (Shomoos vs Absher) aupres du MOI", "Acces institutionnel + specs",
                      "Modeliser les champs (identite, piece, sejour) + chiffrement PII", "Transmission au check-in (Asia/Riyadh)",
                      "Reconciliation + etat explicite + notif admin sur echec"],
        "delai": "3-6 mois (dont acces institutionnel)",
        "note_conf": "Shomoos confirme (centralise, integrations PMS existantes). Role exact Absher/Tawakkalna dans le flux meuble : a confirmer.",
    },
    {
        "n": 11, "service": "OTAs MENA (Gathern, Stay.sa, Mabeet)", "pays": "KSA", "cat": "Channel / OTA",
        "conf": "Moyenne", "bloquant": "Oui (gated)",
        "a_faire": "Les enums ChannelName existent mais AUCUN adapter (CLZ-P0-08). Depend du routage channel par bien+pays (HP-13 : "
                   "FR direct prioritaire, MENA Channex/CM, preseance anti double-push) + acces contractuel. Fallback : Rentals "
                   "United / Channex / iCal tant que les APIs directes sont gated.",
        "contact": "Equipes partenaires/API de Gathern (leader KSA), Stay.sa, Mabeet. Relais : Channex ou Rentals United "
                   "(agregateurs couvrant certaines OTAs MENA). Demande de partenariat connectivite directe.",
        "strategie": "Prioriser Gathern. Demarrer par le fallback iCal/Channex (time-to-market), puis negocier l'API two-way "
                     "directe (gated) en parallele. Ne developper l'adapter direct qu'APRES acces contractuel + sandbox (audit #14).",
        "cout": "Ordre de grandeur : OTAs = commission par reservation (~12-20% STR) prelevee sur le canal, pas un frais "
                "d'integration. Channex/Rentals United = abonnement + frais de connexion par OTA. A confirmer.",
        "procedure": ["Activer le fallback iCal/Channex pour Gathern", "Demander l'acces API partenaire (Gathern d'abord) + sandbox",
                      "Implementer le routage par bien+pays (HP-13) + preseance", "Developper l'adapter direct apres sandbox",
                      "Etendre pushRestrictions + reconciliation + watchdog"],
        "delai": "Fallback iCal/Channex 2-4 sem. ; adapter direct 2-4 mois apres acces",
        "note_conf": "Enums presents, aucun adapter ; APIs gated. Fallback Channex/RU credible mais soumis au plafond Channex (statut OTA premium inaccessible en revendeur).",
    },
    {
        "n": 12, "service": "Traduction & revue RTL arabe", "pays": "Transverse (MA + KSA)", "cat": "Traduction / RTL",
        "conf": "Moyenne", "bloquant": "Non",
        "a_faire": "Revue native des chaines arabes (ar.json web ~231KB ; booking-sdk/i18n.ts ; chaines paiement mada/STC Pay/CMI) "
                   "+ ar.json mobile (RN/Expo) ; QA RTL bout-en-bout (logical props, icones, planning Gantt, graphiques, PDF iText "
                   "reshaping, mobile I18nManager.forceRTL - HP-07) ; auditer les 6 formes plurielles arabes.",
        "contact": "Agence/freelance de traduction FR/EN -> AR specialisee localisation logicielle, locuteurs natifs maghrebins "
                   "(MA) ET du Golfe (KSA) - registres differents. Ideal : prestataire faisant aussi la QA RTL. A sourcer.",
        "strategie": "Contrat de localisation au mot + forfait QA RTL ; prestataire couvrant les deux registres (ou deux "
                     "relecteurs) ; coupler la livraison au lint CI de completude i18n (cle manquante = echec build, anti-derive).",
        "cout": "Ordre de grandeur : revue/traduction au mot (~0,08-0,15 EUR/mot AR pro) ; QA RTL en jours-homme. Police arabe "
                "(Tajawal / IBM Plex Sans Arabic) = self-host, libre/gratuite. A confirmer selon volume.",
        "procedure": ["Extraire le corpus AR (web, SDK, mobile) + glossaire metier", "Selectionner un prestataire natif MA + Golfe + QA RTL",
                      "Revue linguistique + 6 pluriels + chaines paiement manquantes", "QA RTL sur build reel (Gantt, icones, PDF, mobile)",
                      "Brancher le lint CI de completude i18n"],
        "delai": "3-6 semaines + maintenance continue",
        "note_conf": "Chantier identifie et cadre (HP-07). Pas de prestataire nomme (a sourcer) ; couts en ordre de grandeur.",
    },
]

SEQUENCE = [
    ("1", "Stripe - caution", "Transverse/FR", "Extension d'un partenariat existant, sans dependance externe. Quick win."),
    ("", "Airwallex (migration paiement)", "Transverse", "Remplacer Stripe : onboarding KYB + dev provider longs -> demarrer tot, double-run avant bascule."),
    ("2", "PDP Factur-X", "FR", "Echeance reception 09/2026 ; contractualiser une PDP maintenant (cycle de selection long)."),
    ("3", "Prestataire RTL arabe", "Transverse", "Prerequis bout-en-bout pour MA ET KSA ; pas de dependance gated. Lancer tot."),
    ("4", "CMI + Payzone", "MA", "Ouvrir les contrats marchands locaux (delai bancaire) en parallele du dev."),
    ("5", "DGI Simpl-TVA", "MA", "Veille + demande de sandbox au plus tot (spec mouvante, calendrier DGI)."),
    ("6", "DGSN / STDN", "MA", "Derisquer l'acces contractuel avant le dev (gated) - demarche administrative longue."),
    ("7", "PayTabs (+ mada)", "KSA", "Onboarding marchand KSA (KYB/SAMA) ; mada vient avec la passerelle."),
    ("8", "ZATCA Fatoora", "KSA", "POC sandbox d'abord (autorite, independant des partenaires) ; go-live apres HP-10."),
    ("9", "Absher / MOI / Shomoos", "KSA", "Acces institutionnel gated - lancer la demarche en amont (delai non maitrise)."),
    ("10", "OTAs MENA (Gathern...)", "KSA", "Fallback iCal/Channex pour le time-to-market ; API directe en parallele (gated)."),
]

RISKS = [
    "APIs gated / sans sandbox public : DGSN/STDN (MA), Absher/MOI/Shomoos (KSA), OTAs MENA - acces contractuel a derisquer AVANT dev (code speculatif interdit, audit #14).",
    "Spec mouvante DGI (MA) : modele confirme mais API technique + seuils non finalises -> risque de planning.",
    "Perimetre PPF/PDP mouvant (FR) : calendrier confirme mais perimetre deja revise une fois -> choisir une PDP partenaire.",
    "Controle des changes Maroc (Office des Changes) : flux sortants en devises restreints -> privilegier des payouts domestiques (MAD).",
    "Payouts KSA : Stripe Connect n'opere pas les payouts en KSA -> Wise (deja cable) ou partenaire local (SARIE).",
    "Residence des donnees / PII : RGPD (FR) / loi 09-08 (MA) / PDPL (KSA) -> hebergement par region + chiffrement KMS + minimisation, a instruire AVANT lancement.",
    "Conformite = bloquant : facture non cleared (ZATCA, DGI) = invalide -> etat de reconciliation explicite + notif admin, jamais un log avale (audit #7). Appels externes hors transaction + idempotency (audit #2).",
    "Crypto ZATCA (risque #1) : XAdES/CSID, chaine PIH/ICV atomique (verrou + contrainte unique, jamais check-then-act), clearance bloquante, certificats KMS jamais en BDD. Sous-projet a derisquer par POC.",
    "RTL arabe diffus : sx inline, planning Gantt, graphiques, PDF iText (reshaping), mobile I18nManager. Prerequis bout-en-bout MA + KSA.",
]

# ---- Catalogue complet des integrations applicatives (menu Integrations + backend) ----
# Etat code verifie : LIVE (live/complet) . PARTIEL . FLAG (desactive par flag) . STUB
# (test-connexion/TODO) . ENUM (enum nu sans adapter) . CATALOG (informatif, non integre) .
# SELF (self-hosted) . NOKEY (API publique sans cle). Chaque ligne : (service, etat, a_faire, contact, cout, bloq)
CATALOG = [
    ("Channels / OTA (les OTAs MENA Gathern/Stay.sa/Mabeet ont leur fiche dediee)", [
        ("Airbnb", "FLAG", "Creds OAuth partenaire (Host/co-host API) + activer airbnb.sync.enabled", "Airbnb API Partner program", "Commission canal", "Oui"),
        ("Booking.com (API)", "FLAG", "Contrat connectivite + creds -> activer booking.sync.enabled", "Booking.com Connectivity Partner", "Commission ~15%", "Oui"),
        ("Expedia / Hotels.com", "FLAG", "Creds EPC (api-key/secret) + activer flag", "Expedia Partner Central (EPC)", "Commission OTA", "Oui"),
        ("Agoda", "FLAG", "Cle YCS v3 + activer flag", "Agoda YCS / connectivity", "Commission OTA", "Oui"),
        ("Vrbo / HomeAway / Abritel", "FLAG", "Creds OAuth + activer flag", "Vrbo/Expedia connectivity", "Commission OTA", "Oui"),
        ("TripAdvisor", "STUB", "Construire le client (TODO -> List.of) + contrat", "TripAdvisor connectivity", "Commission/abo", "Oui"),
        ("Google Vacation Rentals", "STUB", "Construire le client (Travel Partner v3) + onboarding", "Google Travel Partner", "Modele pay-per-stay", "Oui"),
        ("Trip.com", "ENUM", "Construire l'adapter + contrat", "Trip.com connectivity", "Commission", "Oui"),
        ("HomeToGo", "ENUM", "Two-way API ou iCal ; pre-partenariat (HANDOFF_HOMETOGO)", "HomeToGo partner", "Commission/CPA", "Oui"),
        ("Almosafer / Tajawal / Wego", "CATALOG", "Evaluer API + contrat (OTAs MENA, coming-soon UI)", "OTAs MENA respectives", "Commission", "Oui"),
    ]),
    ("Channel managers (middleware OTA)", [
        ("Channex", "LIVE", "Deja integre (riche) ; gerer le mapping + cout par-bien (revendeur)", "Channex", "Abo + par-bien", "Non"),
        ("Rentals United", "CATALOG", "Brancher le client + contrat (fallback OTAs / MENA)", "Rentals United", "Abo + connexions", "Non"),
        ("Hostaway / SiteMinder (CM)", "CATALOG", "Faible priorite (Hostaway = concurrent) ; a evaluer", "resp. CM", "Abo", "Non"),
    ]),
    ("Paiement & Payout (hors CMI/Payzone/PayTabs/mada - voir fiches)", [
        ("Airwallex (remplacement Stripe)", "ABSENT", "Construire AirwallexPaymentProvider + payouts + FX (migration Stripe) ; tarif sur devis", "Airwallex (Sales / Platforms)", "Sur devis (FX ~0,5-1%)", "Non"),
        ("Stripe (Checkout/Connect)", "LIVE", "Live en prod ; a remplacer par Airwallex (voir fiche)", "Stripe", "~1,4-2,9% +0,25 EUR", "Non"),
        ("Stripe Connect (payout)", "LIVE", "Deja live (virements proprietaires)", "Stripe", "Frais Connect", "Non"),
        ("Wise (payout)", "LIVE", "Passer de sandbox a prod (token + profile-id)", "Wise Platform", "Frais virement", "Non"),
        ("GoCardless (Open Banking PIS)", "LIVE", "Creds prod (secret-id/key) + debtor account", "GoCardless Bank Account Data", "Par-transaction", "Non"),
        ("SEPA / Manuel (payout)", "LIVE", "Aucun (virement banque manuel, marque PROCESSING)", "Banque", "n/a", "Non"),
    ]),
    ("IoT / Capteurs / Serrures / Camera", [
        ("Minut (bruit)", "LIVE", "App developpeur Minut (client-id/secret OAuth)", "Minut developer portal", "Abo capteur", "Non"),
        ("Nuki (serrure)", "LIVE", "Token Web API Nuki (par-org)", "Nuki Web API", "Gratuit + materiel", "Non"),
        ("Netatmo (capteurs/camera)", "LIVE", "App Netatmo Connect (OAuth + scopes)", "Netatmo Connect", "Gratuit", "Non"),
        ("Tuya (serrures/cameras/capteurs)", "LIVE", "Projet Tuya IoT Cloud (access-id/secret)", "Tuya IoT Platform", "Abo cloud", "Non"),
        ("KeyNest (echange de cles)", "PARTIEL", "Valider endpoints/auth/rate-limit en sandbox (TODO KEYNEST-3..6)", "KeyNest API", "Par-echange", "Non"),
        ("go2rtc (passerelle camera)", "SELF", "Deja deploye (clenzy-infra) ; ports ICE firewall", "Self-hosted", "Infra", "Non"),
        ("Igloohome / TTLock / Ecobee / Resideo", "CATALOG", "Construire un SmartLockProvider/thermostat + API key/OAuth", "Portails dev respectifs", "Abo/materiel", "Non"),
    ]),
    ("Comptabilite", [
        ("Pennylane", "LIVE", "App partenaire Pennylane (sync reelle deja en place)", "Pennylane API partner", "Abo Pennylane", "Non"),
        ("QuickBooks", "PARTIEL", "Construire AccountingClient + sync (OAuth deja cable) ; app Intuit", "Intuit Developer", "Abo QBO", "Non"),
        ("Xero", "PARTIEL", "Idem (sync a construire) ; app Xero", "Xero Developer", "Abo Xero", "Non"),
        ("Sage", "PARTIEL", "Idem (sync a construire) ; app Sage", "Sage Developer", "Abo Sage", "Non"),
        ("Odoo", "STUB", "Construire le client (test-connexion seulement)", "Odoo", "Self/abo", "Non"),
    ]),
    ("Signature electronique", [
        ("Clenzy interne (SES PAdES)", "LIVE", "Aucun - provider actif par defaut (clenzy_custom)", "Interne", "Inclus", "Non"),
        ("Yousign (QTSP FR)", "LIVE*", "Cle API + contrat QTSP ; basculer le provider actif (code complet)", "Yousign", "Par-signature", "Non"),
        ("DocuSeal", "LIVE*", "Deployer l'instance + cle (code complet, instance absente)", "DocuSeal (self-host)", "Self/abo", "Non"),
        ("DocuSign", "STUB", "Implementer create/status/download (auth OAuth cablee seulement)", "DocuSign Developer", "Abo", "Non"),
        ("Universign / DocaPoste (QTSP FR)", "ENUM", "Construire le provider + contrat QTSP", "Universign / DocaPoste", "Par-signature", "Non"),
    ]),
    ("KYC / Verification d'identite", [
        ("Sumsub (leader MENA)", "STUB", "Construire le flux KYC + contrat (test-connexion seulement)", "Sumsub", "Par-verif (~1-3 USD)", "Non"),
        ("Veriff", "STUB", "Idem", "Veriff", "Par-verif", "Non"),
        ("Onfido", "STUB", "Idem", "Onfido", "Par-verif", "Non"),
    ]),
    ("Tarification / Revenue management", [
        ("PriceLabs", "STUB", "Construire la sync prix bidirectionnelle + partenariat", "PriceLabs", "Abo/bien", "Non"),
        ("Beyond", "STUB", "Idem", "Beyond", "Abo/bien", "Non"),
        ("Wheelhouse", "STUB", "Idem", "Wheelhouse", "Abo/bien", "Non"),
    ]),
    ("Conformite / declaration voyageurs (DGSN Maroc &amp; Absher KSA ont leur fiche dediee)", [
        ("Chekin (FR/ES/IT/PT)", "STUB", "Construire le flux declaration + contrat (test-connexion seulement)", "Chekin", "Par-logement/abo", "Non"),
    ]),
    ("Email / Messagerie", [
        ("Brevo (SMTP transactionnel)", "LIVE", "Compte Brevo + creds SMTP (clenzy.mail.*)", "Brevo", "Freemium + volume", "Non"),
        ("Brevo (API marketing)", "LIVE", "Cle API per-org (contacts/listes/webhook)", "Brevo", "Volume", "Non"),
        ("WhatsApp via Meta Cloud", "LIVE", "App Meta Business + Embedded Signup + templates valides", "Meta / WhatsApp Business", "Par-conversation", "Non*"),
        ("OpenWA (self-host WhatsApp)", "LIVE", "Instance self-host + cle API (provider alternatif)", "Self-host", "Self", "Non"),
        ("Postal", "ABSENT", "Implementer (cite stack primer.md, absent du backend) ou retirer", "Self-host", "Self", "Non"),
    ]),
    ("IA / LLM / Embeddings", [
        ("Anthropic (Claude)", "LIVE", "Cle API (+ BYOK per-org) - provider chat par defaut", "Anthropic", "Par-token", "Non"),
        ("OpenAI", "LIVE", "Cle API (via ChatLLMRouter)", "OpenAI", "Par-token", "Non"),
        ("Bedrock / OpenAI-compatible", "LIVE", "Cle (NVIDIA/Bedrock generique)", "Fournisseur OpenAI-compat", "Par-token", "Non"),
        ("Voyage AI (embeddings)", "LIVE", "Cle API (voyage-3-lite, defaut RAG)", "Voyage AI", "~0,02 USD/1M tok", "Non"),
        ("OpenAI embeddings", "LIVE", "Cle API (alternatif RAG)", "OpenAI", "Par-token", "Non"),
    ]),
    ("Activites & enrichissement", [
        ("Viator", "LIVE", "Cle partenaire (exp-api-key) - catalogue activites livret", "Viator Partner", "Commission affiliee", "Non"),
        ("GetYourGuide", "LIVE", "ID affilie (decorateur de lien)", "GetYourGuide Partner", "Commission", "Non"),
        ("Klook", "LIVE", "ID affilie (decorateur de lien)", "Klook Affiliate", "Commission", "Non"),
        ("Open-Meteo / Overpass / date.nager.at", "NOKEY", "Aucun - APIs publiques sans cle (meteo, POI, jours feries)", "-", "Gratuit", "Non"),
    ]),
]

# Catalogue prospectif (UI 'catalogue informatif' : tooltips + liens, non integres - a construire si poursuivis)
PROSPECTIVE = [
    ("Intelligence de marche", "AirDNA (donnees marche Airbnb/Vrbo)"),
    ("Fiscalite / taxe de sejour", "MyTSE (FR), Avalara MyLodgeTax (global)"),
    ("Assurance & screening", "Superhog, Safely, AXA Partners, Tawuniya (KSA)"),
    ("Menage & operations", "Turno, Properly, Breezeway"),
    ("Avis & reputation", "Revinate, TrustYou, HiJiffy"),
    ("Marketing & CRM", "Mailchimp, Klaviyo, Pipedrive"),
]

ETAT_STYLE = {
    "LIVE": (GREEN, colors.white), "LIVE*": (GREEN, colors.white), "PARTIEL": (ACCENT, colors.white),
    "FLAG": (AMBER, colors.white), "STUB": (PRIMARY2, colors.white), "ENUM": (MUTED, colors.white),
    "CATALOG": (LIGHT, INK), "SELF": (PRIMARY, colors.white), "NOKEY": (colors.HexColor("#7FB99E"), INK),
    "ABSENT": (RED, colors.white),
}

def catalog_table(rows):
    head = [Paragraph("<b>%s</b>" % h, ParagraphStyle("th", parent=CELLB, fontSize=6.8, textColor=colors.white,
            alignment=(TA_CENTER if h in ("Etat", "Bloq.") else TA_LEFT)))
            for h in ["Service", "Etat", "A faire pour integrer / activer", "Qui contacter", "Cout (ordre)", "Bloq."]]
    data = [head]
    style = [("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
             ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
             ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
             ("TOPPADDING", (0, 0), (-1, -1), 2.2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2)]
    for i, (svc, etat, af, contact, cout, bloq) in enumerate(rows, start=1):
        bg, fg = ETAT_STYLE.get(etat, (LIGHT, INK))
        data.append([
            Paragraph("<b>%s</b>" % svc, ParagraphStyle("s", parent=CELL, fontSize=6.8, leading=8.2)),
            Paragraph('<font color="%s"><b>%s</b></font>' % ("#" + fg.hexval()[2:], etat),
                      ParagraphStyle("e", parent=CELL, fontSize=6.2, alignment=TA_CENTER)),
            Paragraph(af, ParagraphStyle("af", parent=CELL, fontSize=6.6, leading=8)),
            Paragraph(contact, ParagraphStyle("c", parent=CELL, fontSize=6.6, leading=8)),
            Paragraph(cout, ParagraphStyle("co", parent=CELL, fontSize=6.6, leading=8)),
            Paragraph(bloq, ParagraphStyle("b", parent=CELL, fontSize=6.6, alignment=TA_CENTER,
                      textColor=(RED if bloq.startswith("Oui") else MUTED))),
        ])
        style.append(("BACKGROUND", (1, i), (1, i), bg))
        style.append(("BACKGROUND", (0, i), (0, i), LIGHT if i % 2 == 0 else colors.white))
        for col in (2, 3, 4, 5):
            style.append(("BACKGROUND", (col, i), (col, i), LIGHT if i % 2 == 0 else colors.white))
    t = Table(data, colWidths=[USABLE_W * x for x in (0.18, 0.085, 0.355, 0.20, 0.135, 0.045)], repeatRows=1)
    t.setStyle(TableStyle(style))
    return t

def service_block(s):
    cc = conf_color(s["conf"])
    bc = RED if s["bloquant"].lower().startswith("oui") else GREEN
    # En-tete : numero + nom + chips
    header = Table([[
        Paragraph("<b>%d</b>" % s["n"], ParagraphStyle("hn", parent=CELL, fontSize=14, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("<b>%s</b>" % s["service"], ParagraphStyle("hs", parent=CELL, fontSize=11, textColor=colors.white, leading=13)),
        Paragraph('<font color="white"><b>%s</b></font>' % s["pays"], ParagraphStyle("hp", parent=CELL, fontSize=7.4, alignment=TA_CENTER, textColor=colors.white)),
        Paragraph('<font color="white"><b>%s</b></font>' % s["cat"], ParagraphStyle("hc", parent=CELL, fontSize=7.4, alignment=TA_CENTER, textColor=colors.white)),
        Paragraph('<font color="white"><b>Conf. %s</b></font>' % s["conf"], ParagraphStyle("hcf", parent=CELL, fontSize=7, alignment=TA_CENTER, textColor=colors.white)),
        Paragraph('<font color="white"><b>Bloquant: %s</b></font>' % s["bloquant"], ParagraphStyle("hb", parent=CELL, fontSize=7, alignment=TA_CENTER, textColor=colors.white)),
    ]], colWidths=[10 * mm, USABLE_W * 0.40 - 10 * mm, USABLE_W * 0.13, USABLE_W * 0.17, USABLE_W * 0.14, USABLE_W * 0.16])
    header.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#27323A")),
                                ("BACKGROUND", (1, 0), (1, 0), PRIMARY),
                                ("BACKGROUND", (2, 0), (3, 0), PRIMARY2),
                                ("BACKGROUND", (4, 0), (4, 0), cc), ("BACKGROUND", (5, 0), (5, 0), bc),
                                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("GRID", (0, 0), (-1, -1), 0.5, colors.white),
                                ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                                ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5)]))
    proc = "".join("<br/>%d. %s" % (i + 1, p) for i, p in enumerate(s["procedure"]))
    rows = [
        ("A faire", s["a_faire"]),
        ("Qui contacter", s["contact"]),
        ("Strategie d'approche", s["strategie"]),
        ("Cout estime", s["cout"]),
        ("Procedure anticipee", proc.lstrip("<br/>")),
        ("Delai estime", s["delai"]),
        ("Note de confiance", s["note_conf"]),
    ]
    data = [[Paragraph(lbl, LBL), Paragraph(val, CELL)] for lbl, val in rows]
    t = Table(data, colWidths=[USABLE_W * 0.20, USABLE_W * 0.80])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                           ("BACKGROUND", (0, 0), (0, -1), LIGHT),
                           ("BACKGROUND", (1, 3), (1, 3), colors.HexColor("#FBF6EC")),  # cout
                           ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                           ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5)]))
    return [header, t, Spacer(1, 10)]

def sequence_table():
    head = [Paragraph("<b>%s</b>" % h, ParagraphStyle("th", parent=CELLB, fontSize=7.6, textColor=colors.white,
            alignment=(TA_CENTER if h in ("#", "Pays") else TA_LEFT))) for h in ["#", "Service", "Pays", "Pourquoi en premier"]]
    data = [head]
    style = [("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
             ("GRID", (0, 0), (-1, -1), 0.4, colors.white), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
             ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
             ("LEFTPADDING", (0, 0), (-1, -1), 5)]
    for idx, (_, svc, pays, why) in enumerate(SEQUENCE, start=1):
        data.append([Paragraph("<b>%s</b>" % idx, ParagraphStyle("n", parent=CELL, fontSize=8, alignment=TA_CENTER, textColor=ACCENT)),
                     Paragraph("<b>%s</b>" % svc, CELL),
                     Paragraph(pays, ParagraphStyle("p", parent=CELL, alignment=TA_CENTER, fontSize=7)),
                     Paragraph(why, CELL)])
    t = Table(data, colWidths=[USABLE_W * 0.06, USABLE_W * 0.26, USABLE_W * 0.13, USABLE_W * 0.55], repeatRows=1)
    t.setStyle(TableStyle(style))
    return t

def build():
    doc = make_doc(os.path.join(PDF, "playbook-partenariats.pdf"))
    S = [Spacer(1, 50), Paragraph("Playbook Partenariats", TIT), Paragraph("&amp; Procedures - services externes", TIT),
         Spacer(1, 12), Paragraph("Expansion multi-pays Clenzy . France + Maroc + Arabie Saoudite", SUB), Spacer(1, 26)]
    cover = Table([["Date", "14 juin 2026"],
                   ["Destinataires", "Equipes integration internes + relation partenaires"],
                   ["Objet", "Quoi faire . qui contacter . strategie d'approche . cout . procedure - par service externe"],
                   ["Services couverts", "13 fiches strategiques (multi-pays + migration paiement Airwallex) + catalogue complet (~55 integrations)"],
                   ["Source", "41-strategie-multipays.md . 42 . 20 . HORS-PERIMETRE.md + inventaire du code (menu Integrations + backend)"]],
                  colWidths=[USABLE_W * 0.24, USABLE_W * 0.76])
    cover.setStyle(TableStyle([("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                               ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY), ("TEXTCOLOR", (1, 0), (1, -1), INK),
                               ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                               ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    S += [cover, Spacer(1, 22),
          Paragraph('<font color="#5C6B73" size=8><i>Confidentiel - usage interne. Principes transverses : conformite = bloquant ; '
                    'appels externes hors transaction DB + idempotency ; serveur recalcule les montants ; secrets/certificats en KMS, '
                    'jamais en base. Les couts non sourcees sont des ORDRES DE GRANDEUR explicitement labellises ; les contacts/seuils '
                    'non confirmes sont marques "a confirmer".</i></font>', SMALL), PageBreak()]

    S.append(Paragraph("Comment lire ce document", H1))
    S.append(Paragraph("Chaque service externe dont depend l'expansion multi-pays fait l'objet d'une fiche standardisee : "
                       "<b>a faire</b> (le travail cote Clenzy), <b>qui contacter</b>, <b>strategie d'approche</b>, "
                       "<b>cout estime</b>, <b>procedure anticipee</b> (etapes onboarding -> go-live), <b>delai</b>, "
                       "<b>confiance</b> et caractere <b>bloquant</b> (API gated/contractuelle). L'ordre d'outreach recommande "
                       "est donne ci-dessous, puis les <b>13 fiches strategiques</b> (expansion multi-pays + migration Airwallex), "
                       "puis le <b>catalogue complet</b> des ~55 integrations de l'application, et enfin les risques transverses.", BODY))
    S.append(Paragraph("Regle d'or de l'outreach", H3))
    S.append(Paragraph("Tout ce qui est <b>gated ou a delai administratif non maitrise</b> (DGI, DGSN, onboarding ZATCA, "
                       "Absher/MOI, OTAs MENA, contrats marchands bancaires) doit etre <b>initie le plus tot possible</b>, "
                       "meme si le developpement correspondant est plus tardif dans les phases.", BODY))
    S.append(Paragraph("Sequencement recommande (FR -> MA -> KSA)", H2))
    S.append(sequence_table())
    S.append(PageBreak())

    S.append(Paragraph("Fiches par service externe", H1))
    S.append(Paragraph("13 services, groupes par categorie. Code couleur en-tete : confiance (vert/ambre/rouge) et bloquant "
                       "(vert = non, rouge = oui).", BODY))
    S.append(Spacer(1, 6))
    cur_cat = None
    for idx, s in enumerate(SERVICES, start=1):
        if s["cat"] != cur_cat:
            cur_cat = s["cat"]
            S.append(Paragraph(cur_cat, H2))
        for el in service_block({**s, "n": idx}):
            S.append(el)
    S.append(PageBreak())

    # ===== Catalogue complet des integrations applicatives =====
    S.append(Paragraph("Catalogue complet des integrations applicatives", H1))
    S.append(Paragraph("Au-dela des 13 fiches strategiques ci-dessus, l'application Clenzy expose ou cable "
                       "<b>~55 integrations</b> (menu Integrations + services backend). Ce catalogue les recense toutes, "
                       "par categorie, avec leur <b>etat reel dans le code</b> (verifie fichier:ligne) et ce qu'il reste a faire "
                       "pour les integrer/activer, qui contacter, le cout (ordre de grandeur) et le caractere bloquant.", BODY))
    S.append(Paragraph('<font size=7 color="#5C6B73">Etat code : '
                       '<font backColor="#2C8059" color="white"> LIVE </font> en prod . '
                       '<font backColor="#4A9B8E" color="white"> PARTIEL </font> partiel . '
                       '<font backColor="#B07A1E" color="white"> FLAG </font> code complet, desactive par flag (creds/contrat) . '
                       '<font backColor="#6B8A9A" color="white"> STUB </font> test-connexion/TODO . '
                       '<font backColor="#5C6B73" color="white"> ENUM </font> enum sans adapter . '
                       '<font backColor="#EEF2F4" color="#1F2A30"> CATALOG </font> informatif (non integre) . '
                       '<font backColor="#A23B2E" color="white"> ABSENT </font> a implementer. '
                       'LIVE* = code complet mais provider non actif par defaut.</font>', SMALL))
    for cat_title, rows in CATALOG:
        S += [Spacer(1, 7), Paragraph(cat_title, H3), catalog_table(rows)]
    S.append(Spacer(1, 10))
    S.append(Paragraph("Catalogue prospectif (UI informative : tooltips + liens, non integres)", H3))
    S.append(Paragraph("Services presents dans le catalogue de l'ecran Integrations a titre informatif - chacun necessiterait "
                       "une integration complete (API/REST) s'il etait poursuivi :", BODY))
    for dom, svcs in PROSPECTIVE:
        S.append(bullet("<b>%s</b> : %s" % (dom, svcs), CELL))
    S.append(PageBreak())

    S.append(Paragraph("Risques &amp; dependances transverses", H1))
    for r in RISKS:
        S.append(bullet(r, BODY))
    S.append(Spacer(1, 8))
    S.append(Paragraph("Reserves", H3))
    S.append(Paragraph("Les seuls chiffres reglementaires sourcees sont les sanctions FR (50 EUR/facture, plafond 15 000 EUR/an), "
                       "les seuils ZATCA (Wave 23 = 750k SAR, Wave 24 = 375k SAR) et les TVA (FR 20% . MA 20% . KSA 15%). Tous les "
                       "couts d'integration/transaction sont des ordres de grandeur. Les noms de PDP precis et le prestataire RTL "
                       "sont a sourcer/confirmer. Source : 41-strategie-multipays.md (sections 4 a 7, 11).", SMALL))
    doc.build(S)
    print("OK playbook ->", os.path.join(PDF, "playbook-partenariats.pdf"))

if __name__ == "__main__":
    build()
