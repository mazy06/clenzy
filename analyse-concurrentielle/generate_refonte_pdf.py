"""Genere le PDF 'Refonte Booking Engine - blueprint score 3 + avantage comparatif'.

Synthese presentable du plan de refonte (source : REFONTE-BOOKING-ENGINE.md). Tous les contenus
sont rediges ici (pas de parsing markdown), au format reportlab fond blanc (anti mode-sombre).

Regen : .venv/bin/python generate_refonte_pdf.py
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
ACCENT2 = colors.HexColor("#D4A574")
INK = colors.HexColor("#1F2A30")
MUTED = colors.HexColor("#5C6B73")
LIGHT = colors.HexColor("#EEF2F4")
LINE = colors.HexColor("#C9D4D9")
GREEN = colors.HexColor("#2C8059")
AMBER = colors.HexColor("#B07A1E")
RED = colors.HexColor("#B5524E")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=16,
                    textColor=PRIMARY, spaceBefore=4, spaceAfter=7, leading=19)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=12,
                    textColor=PRIMARY, spaceBefore=10, spaceAfter=4, leading=14)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="Helvetica-Bold", fontSize=10,
                    textColor=ACCENT, spaceBefore=7, spaceAfter=3, leading=12)
BODY = ParagraphStyle("BODY", parent=ss["Normal"], fontName="Helvetica", fontSize=9,
                      textColor=INK, leading=12.6, spaceAfter=4)
SMALL = ParagraphStyle("SMALL", parent=BODY, fontSize=7.6, textColor=MUTED, leading=9.6)
CELL = ParagraphStyle("CELL", parent=BODY, fontSize=7.7, leading=9.6, spaceAfter=0)
CELLB = ParagraphStyle("CELLB", parent=CELL, fontName="Helvetica-Bold")
CELLW = ParagraphStyle("CELLW", parent=CELLB, textColor=colors.white)
CELLC = ParagraphStyle("CELLC", parent=CELL, alignment=TA_CENTER)
CELLCB = ParagraphStyle("CELLCB", parent=CELLC, fontName="Helvetica-Bold")
TIT = ParagraphStyle("TIT", parent=BODY, fontName="Helvetica-Bold", fontSize=26,
                     textColor=PRIMARY, leading=30, alignment=TA_LEFT)
SUB = ParagraphStyle("SUB", parent=BODY, fontSize=12.5, textColor=MUTED, leading=16)

USABLE_W = A4[0] - 36 * mm


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, A4[1] - 6 * mm, A4[0], 6 * mm, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(18 * mm, 10 * mm, "Clenzy - Refonte Booking Engine . blueprint score 3 + avantage comparatif")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, "p. %d" % doc.page)
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
    canvas.restoreState()


def make_doc(path):
    doc = BaseDocTemplate(path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=16 * mm, bottomMargin=16 * mm, title="Refonte Booking Engine - blueprint")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=on_page)])
    return doc


def P(t, s=CELL):
    return Paragraph(t, s)


def bullet(t, s=BODY):
    return Paragraph("&bull;&nbsp; " + t, s)


def effort_cell(level):
    cmap = {"S": GREEN, "M": ACCENT, "L": AMBER, "XL": RED}
    c = cmap.get(level, MUTED)
    return Paragraph('<font color="#%s"><b>%s</b></font>' % (c.hexval()[2:], level), CELLC)


def mktable(rows, widths, header_bg=PRIMARY, accent_rows=None, accent_col=None):
    accent_rows = accent_rows or set()
    t = Table(rows, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3.4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.4),
    ]
    for r in accent_rows:
        style.append(("BACKGROUND", (0, r), (-1, r), colors.HexColor("#E4F0EC")))
    t.setStyle(TableStyle(style))
    return t


def hrow(cells):
    return [Paragraph(c, CELLW) for c in cells]


def build():
    S = []

    # ── Cover ──────────────────────────────────────────────────────────────
    S += [Spacer(1, 30 * mm)]
    S.append(Paragraph("Refonte du Booking Engine", TIT))
    S.append(Paragraph("Blueprint &mdash; viser le <b>score 3 sur tous les axes</b> + un avantage comparatif d&eacute;fendable", SUB))
    S += [Spacer(1, 8)]
    S.append(Paragraph("Domaine 2 (Booking engine &amp; site direct) : de <b>1,7</b> vers <b>~2,9/3</b> &mdash; en faire un domaine leader du panel.",
                       ParagraphStyle("lead", parent=BODY, fontSize=10.5, leading=15)))
    S += [Spacer(1, 14)]
    box = [[Paragraph("<b>Le verrou central</b>", CELLB)],
           [Paragraph("Le booking engine est aujourd'hui un <b>widget JS client-rendered</b> embarqu&eacute; sur le site de l'h&ocirc;te. "
                      "SEO, &laquo; site web inclus &raquo;, builder et blog sont <b>impossibles &agrave; mettre &agrave; 3 sans une plateforme "
                      "de sites h&eacute;berg&eacute;s rendus serveur (SSR)</b>. Cible : trifecta <b>site h&eacute;berg&eacute; SSR + widget "
                      "embarquable + SDK headless</b> (les deux derniers existent d&eacute;j&agrave;).", BODY)]]
    bt = Table(box, colWidths=[USABLE_W])
    bt.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), LIGHT), ("BOX", (0, 0), (-1, -1), 1.1, ACCENT),
                            ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    S.append(bt)
    S += [Spacer(1, 10)]
    S.append(Paragraph("Pr&eacute;par&eacute; le 2026-06-14 &mdash; source : reconnaissance code booking-engine (front SDK + backend) + analyse concurrentielle. "
                       "Document de r&eacute;f&eacute;rence : <b>REFONTE-BOOKING-ENGINE.md</b>.", SMALL))
    S.append(PageBreak())

    # ── A. Etat des lieux ──────────────────────────────────────────────────
    S.append(Paragraph("A. &Eacute;tat des lieux", H1))
    S.append(Paragraph("Architecture actuelle : widget JavaScript vanilla (Shadow DOM) embarqu&eacute; sur le site de l'h&ocirc;te, consommant "
                       "l'API publique Spring. SDK headless + preview React (PMS) en plus. <b>Aucun SSR, aucun site h&eacute;berg&eacute;, "
                       "aucun domaine custom, aucun mod&egrave;le Page/CMS/Blog</b> (greenfield).", BODY))
    S.append(Paragraph("Actifs r&eacute;utilisables (v&eacute;rifi&eacute;s)", H3))
    for t in ["<b>Multi-devise</b> : CurrencyConverterService (EUR/MAD/SAR, refresh quotidien) &mdash; existe, non c&acirc;bl&eacute; &agrave; l'affichage guest.",
              "<b>Socle IA</b> : AiProviderRouter + budget/gating + TranslationService + KbSearchService (RAG) + BYOK.",
              "<b>Caution</b> : SecurityDeposit (machine &agrave; &eacute;tats) &mdash; hold Stripe non c&acirc;bl&eacute;. <b>Vouchers</b> prod-ready. <b>Webhooks sortants</b> livr&eacute;s.",
              "<b>Manques nets</b> : Stripe Radar/3DS, capture de leads/abandoned-cart, campagnes Brevo, g&eacute;n&eacute;ration de contenu IA, mod&egrave;le site/page/blog."]:
        S.append(bullet(t))

    S.append(Paragraph("Scores Domaine 2 &mdash; point de d&eacute;part &amp; cible", H3))
    rows = [hrow(["Axe", "Auj.", "Cible", "Verrou principal"])]
    data = [
        ("Moteur public / paiement / promo / annulation / email / RTL / multi-langue", "3", "3", "Acquis (dont travail 2026-06-14)", True),
        ("Site web inclus (builder de pages)", "2", "3", "Plateforme de sites h&eacute;berg&eacute;s", False),
        ("Builder drag-and-drop sans code", "1", "3", "Composeur par blocs", False),
        ("Templates de site pr&ecirc;ts &agrave; l'emploi", "1", "3", "Catalogue + SSR", False),
        ("Panier multi-s&eacute;jours / multi-propri&eacute;t&eacute;s", "2", "3", "Productiser dans le widget public", False),
        ("Multi-devise", "2", "3", "C&acirc;bler CurrencyConverterService", False),
        ("SEO du site direct (meta / schema / sitemap)", "0", "3", "SSR (verrou n&deg;1)", False),
        ("Blog int&eacute;gr&eacute; / contenu marketing", "0", "3", "CMS + SSR", False),
        ("Protection anti-fraude / damage protection", "0", "3", "Radar/3DS + SecurityDeposit Stripe", False),
        ("Capture de leads / email marketing", "0", "3", "Lead model + abandoned-cart + Brevo", False),
        ("SDK / API booking engine", "2", "3", "Versioning + doc + portail dev", False),
        ("Outils IA (contenu / SEO / design)", "2", "3", "G&eacute;n&eacute;ration de contenu IA", False),
        ("Processeur de paiement propri&eacute;taire (gated)", "0", "hors scope", "Guesty/Hospitable only &mdash; non poursuivi", False),
    ]
    accent = set()
    for i, (axe, a, c, v, acq) in enumerate(data, start=1):
        rows.append([P(axe), P(a, CELLCB), P(c, CELLCB), P(v)])
        if acq:
            accent.add(i)
    S.append(mktable(rows, [USABLE_W * 0.46, USABLE_W * 0.08, USABLE_W * 0.12, USABLE_W * 0.34], accent_rows=accent))
    S.append(Paragraph("Lignes vertes = acquises. Si les 11 axes cibl&eacute;s passent &agrave; 3 &rarr; moyenne features ~<b>2,9/3</b> (domaine leader).", SMALL))
    S.append(PageBreak())

    # ── B. These avantage comparatif ───────────────────────────────────────
    S.append(Paragraph("B. Th&egrave;se d'avantage comparatif (gagner, pas juste la parit&eacute;)", H1))
    S.append(Paragraph("Les leaders du site direct (Lodgify, Guesty, Smily, Avantio) offrent un builder/SEO/blog corrects mais "
                       "<b>g&eacute;n&eacute;riques et mono-march&eacute; (EU/US, LTR)</b>. Trois diff&eacute;renciateurs que le panel n'a pas :", BODY))
    for n, t in [("1. Trifecta de distribution",
                  "site h&eacute;berg&eacute; SSR + widget embarquable + SDK headless/API &mdash; un m&ecirc;me moteur, trois modes. "
                  "Le widget et le headless existent <b>d&eacute;j&agrave;</b> ; il manque le site h&eacute;berg&eacute; SSR."),
                 ("2. Booking engine IA-natif multilingue + arabe-first / RTL",
                  "g&eacute;n&eacute;ration de contenu/SEO (titres, descriptions, blog, schema) en fr/en/<b>ar</b>, concierge IA RAG sur le site, "
                  "SEO multilingue hreflang. C'est l'angle <b>MENA (Maroc / Arabie Saoudite)</b> &mdash; march&eacute; o&ugrave; les builders "
                  "g&eacute;n&eacute;ralistes sont faibles (arabe, RTL, devises et paiements locaux PayTabs/CMI d&eacute;j&agrave; int&eacute;gr&eacute;s)."),
                 ("3. Conversion &amp; conformit&eacute; direct-first",
                  "moteur <b>Book Direct &amp; Save</b> (parit&eacute; tarifaire + rate membre + cr&eacute;dit wallet), upsells au checkout, "
                  "anti-fraude + caution int&eacute;gr&eacute;e, prix TTC par pays, r&eacute;cup&eacute;ration de panier. On vend un <b>canal direct "
                  "qui convertit et reste conforme</b>, pas un &laquo; site &raquo;.")]:
        S.append(Paragraph(n, H3))
        S.append(Paragraph(t, BODY))
    S.append(Paragraph("Positionnement : &laquo; <b>l'OS du canal direct pour conciergeries multi-pays</b> &raquo; &mdash; pas un clone de Webflow/Wix avec un calendrier.",
                       ParagraphStyle("pos", parent=BODY, fontName="Helvetica-Oblique", textColor=PRIMARY)))

    # ── C. Decision architecturale ─────────────────────────────────────────
    S.append(Paragraph("C. D&eacute;cision architecturale fondatrice &mdash; mod&egrave;le d'h&eacute;bergement", H1))
    S.append(Paragraph("Verrou n&deg;1 : sans rendu serveur, SEO / site inclus / builder / blog plafonnent &agrave; 2.", BODY))
    rows = [hrow(["Option", "Description", "Plafond", "Co&ucirc;t"])]
    rows.append([P("1. Embed-only (statu quo+)"), P("Garder le widget, exposer sitemap/JSON-LD que l'h&ocirc;te injecte sur SON site"),
                 P('<font color="#%s">~2</font>' % RED.hexval()[2:], CELLCB), P("S", CELLC)])
    rows.append([P("<b>2. Sites h&eacute;berg&eacute;s SSR</b>"), P("{slug}.clenzy.site + domaine custom (CNAME + TLS auto), <b>rendu serveur</b>"),
                 P('<font color="#%s">3</font>' % GREEN.hexval()[2:], CELLCB), P("XL", CELLC)])
    rows.append([P("<b>3. Hybride trifecta (recommand&eacute;)</b>"), P("Sites SSR + widget embarquable + SDK headless/API, moteur commun"),
                 P('<font color="#%s">3 +</font>' % GREEN.hexval()[2:], CELLCB), P("XL puis incr.", CELLC)])
    S.append(mktable(rows, [USABLE_W * 0.22, USABLE_W * 0.56, USABLE_W * 0.10, USABLE_W * 0.12], accent_rows={3}))
    S.append(Paragraph("<b>Recommandation : Option 3</b>, b&acirc;tie sur la fondation SSR. Techno : service <b>Next.js &laquo; Clenzy Sites &raquo;</b> "
                       "(ISR/SSG, hreflang, domaines custom, Core Web Vitals) consommant l'API Spring ; alternative l&eacute;g&egrave;re SSR Spring/Thymeleaf (MVP). "
                       "Domaines custom : CNAME + TLS auto (Caddy / cert-manager / Cloudflare for SaaS, &agrave; trancher).", BODY))
    S.append(PageBreak())

    # ── D. Refonte par axe ─────────────────────────────────────────────────
    S.append(Paragraph("D. Refonte par axe (cible 3 + ce qu'on construit)", H1))
    rows = [hrow(["Axe", "&Eacute;vol.", "Ce qu'on construit", "Eff."])]
    axes = [
        ("Site web inclus (builder)", "2&rarr;3", "Mod&egrave;les Site/SitePage rendus SSR ; multi-site par org ; preview live r&eacute;utilis&eacute;e", "L"),
        ("Builder sans code", "1&rarr;3", "Composeur <b>par blocs</b> (Hero, Search, Property grid, Gallery, Map, FAQ, Blog, CTA...) &mdash; pas freeform", "L"),
        ("Templates pr&ecirc;ts", "1&rarr;3", "Catalogue 10-15 th&egrave;mes complets par vertical, dont <b>RTL/arabe (riad, MENA)</b>", "M"),
        ("Panier multi-s&eacute;jours", "2&rarr;3", "Porter le panier (existe en preview) dans le widget public + SDK : 1 checkout, hold/annulation par item &mdash; <b>Trip builder</b>", "M"),
        ("Multi-devise", "2&rarr;3", "S&eacute;lecteur de devise &rarr; conversion via CurrencyConverterService + checkout devise choisie + prix TTC par pays", "S/M"),
        ("SEO du site direct", "0&rarr;3", "meta/OG + JSON-LD (Lodging/Offer/FAQ/Article/Rating) + sitemap + <b>hreflang fr/en/ar</b> + canonical + CWV", "M"),
        ("Blog int&eacute;gr&eacute;", "0&rarr;3", "BlogPost + page blog SSR + RSS + schema Article ; coupl&eacute; &agrave; l'IA contenu multilingue", "M"),
        ("Anti-fraude / damage", "0&rarr;3", "SecurityDeposit&rarr;Stripe (hold manuel hors-tx) + politique par bien / waiver ; Radar + 3DS + v&eacute;locit&eacute;", "M/L"),
        ("Capture leads / marketing", "0&rarr;3", "MarketingContact + consentement RGPD + abandoned-cart (s&eacute;quence email) + waitlist + segments", "L"),
        ("SDK / API", "2&rarr;3", "API v1 versionn&eacute;e + OpenAPI + portail dev (cl&eacute;s/scopes/sandbox) + webhooks (livr&eacute;s) = <b>trifecta</b>", "M"),
        ("Outils IA", "2&rarr;3", "Copywriting (biens/pages/blog/meta) fr/en/ar + SEO IA + g&eacute;n&eacute;ration de template + <b>concierge RAG</b> sur le site", "M/L"),
    ]
    for axe, ev, build_t, eff in axes:
        rows.append([P("<b>%s</b>" % axe), P(ev, CELLC), P(build_t), effort_cell(eff)])
    S.append(mktable(rows, [USABLE_W * 0.20, USABLE_W * 0.08, USABLE_W * 0.64, USABLE_W * 0.08]))
    S.append(Paragraph("Effort : <font color=\"#%s\"><b>S</b></font> jours . <font color=\"#%s\"><b>M</b></font> 1-2 sem . "
                       "<font color=\"#%s\"><b>L</b></font> 3-5 sem . <font color=\"#%s\"><b>XL</b></font> &gt;5 sem."
                       % (GREEN.hexval()[2:], ACCENT.hexval()[2:], AMBER.hexval()[2:], RED.hexval()[2:]), SMALL))
    S.append(PageBreak())

    # ── E. Nouvelles features ──────────────────────────────────────────────
    S.append(Paragraph("E. Nouvelles features propos&eacute;es (au-del&agrave; de la liste)", H1))
    feats = [
        ("Book Direct &amp; Save (strat&eacute;gique)", "badge parit&eacute; tarifaire, rate membre/direct, cr&eacute;dit wallet fid&eacute;lit&eacute;, comparateur OTA. La raison d'&ecirc;tre d'un canal direct."),
        ("Upsell / cross-sell au checkout", "early check-in, late checkout, m&eacute;nage mi-s&eacute;jour, transferts, exp&eacute;riences locales (service options &rarr; moteur d'upsell)."),
        ("Gift cards / vente de bons", "acheter du cr&eacute;dit/cadeau (r&eacute;utilise VoucherEngine) : cash + acquisition."),
        ("Comptes voyageur + wishlist + re-booking 1-clic", "r&eacute;tention et conversion r&eacute;p&eacute;t&eacute;e (realm guest Keycloak existe)."),
        ("Analytics conversion + A/B testing + pixels", "GA4 / Meta / GTM + tracking server-side ; vendre un canal qui convertit."),
        ("Paiements locaux MENA + Apple/Google Pay", "PayTabs/CMI d&eacute;j&agrave; int&eacute;gr&eacute;s + mada (KSA) : edge conversion Maroc/Arabie."),
        ("Centre de consentement / cookies / RGPD", "pr&eacute;requis l&eacute;gal des sites h&eacute;berg&eacute;s + marketing (banni&egrave;re, registre, DSAR)."),
        ("SEO hreflang arabe-first", "indexation arabe propre &mdash; quasi inexistante chez les g&eacute;n&eacute;ralistes EU/US."),
        ("Reviews / UGC + rich snippets", "preuve sociale + &eacute;toiles dans Google (AggregateRating) : CTR sup&eacute;rieur."),
        ("Instant-book vs request-to-book", "modes de r&eacute;servation param&eacute;trables par bien."),
        ("Performance Core Web Vitals + PWA", "facteur de ranking SEO + UX mobile MENA (&laquo; ajouter &agrave; l'&eacute;cran d'accueil &raquo;)."),
        ("Merchandising dynamique &eacute;thique", "urgence/scarcit&eacute; honn&ecirc;te, best-seller, recommandations IA de biens similaires."),
    ]
    rows = [hrow(["Feature", "Pourquoi"])]
    for name, why in feats:
        rows.append([P("<b>%s</b>" % name), P(why)])
    S.append(mktable(rows, [USABLE_W * 0.34, USABLE_W * 0.66]))
    S.append(PageBreak())

    # ── F+G. Architecture + Roadmap ────────────────────────────────────────
    S.append(Paragraph("F. Architecture cible (synth&egrave;se)", H1))
    arch = [
        "<b>Clenzy Sites (Next.js SSR/ISR &mdash; NOUVEAU)</b> : {slug}.clenzy.site / domaine custom &rarr; pages + blog + SEO (sitemap, JSON-LD, hreflang, CWV).",
        "<b>Widget embarquable</b> (existe) + <b>SDK headless</b> (existe) &mdash; m&ecirc;me API publique.",
        "<b>API publique versionn&eacute;e</b> /api/public/v1 (Spring).",
        "<b>Nouveaux mod&egrave;les</b> : Site, SitePage, BlogPost, SiteDomain, SiteTemplate, MarketingContact, AbandonedBooking, SeoRedirect.",
        "<b>R&eacute;utilis&eacute;s</b> : PublicBookingService, CurrencyConverterService, VoucherEngine, SecurityDeposit, AiProviderRouter, KbSearch, PriceSimulationService, WebhookController, EmailService.",
    ]
    for a in arch:
        S.append(bullet(a))
    S.append(Paragraph("R&egrave;gles d'ing&eacute;nierie (audits) : argent recalcul&eacute; serveur (#1) ; Stripe/PSP hors transaction + afterCommit + idempotency (#2) ; "
                       "ownership org apr&egrave;s findById (#3) ; controllers minces (#4) ; DTO records (#5) ; concurrence CAS (#8) ; timezone propri&eacute;t&eacute; (#9) ; "
                       "BigDecimal compareTo + RoundingMode (#10) ; SSRF guard + escapeHtml c&ocirc;t&eacute; SSR. Migrations Liquibase 0247+.", SMALL))

    S.append(Paragraph("G. Roadmap phas&eacute;e", H1))
    rows = [hrow(["Lot", "Contenu", "Axes", "Eff."])]
    roadmap = [
        ("0 &mdash; Quick wins (sans SSR)", "Multi-devise c&acirc;bl&eacute;e ; panier multi-s&eacute;jours widget ; API v1+OpenAPI+portail ; anti-fraude (SecurityDeposit&rarr;Stripe + Radar/3DS) ; lead capture + abandoned-cart ; IA copywriting", "5,4,10,8,9,11", "M-L"),
        ("1 &mdash; Fondation Sites SSR", "Service Next.js + Site/SitePage/SiteDomain + domaines custom + TLS + d&eacute;ploiement (clenzy-infra)", "pr&eacute;requis 1,2,3,6,7", "XL"),
        ("2 &mdash; Builder + Templates", "Composeur par blocs + catalogue templates + site inclus", "1,2,3", "L"),
        ("3 &mdash; SEO + Blog + IA contenu", "SEO complet + blog + g&eacute;n&eacute;ration IA multilingue + concierge RAG", "6,7,11", "M-L"),
        ("4 &mdash; Diff&eacute;renciation", "Book Direct &amp; Save, upsells, gift cards, comptes/wishlist, analytics/A-B, paiements locaux, RGPD, reviews", "features E", "L-XL"),
    ]
    for lot, contenu, axes_, eff in roadmap:
        rows.append([P("<b>%s</b>" % lot), P(contenu), P(axes_, CELLC), effort_cell(eff.split("-")[0] if "-" not in eff else "L")])
    S.append(mktable(rows, [USABLE_W * 0.20, USABLE_W * 0.56, USABLE_W * 0.16, USABLE_W * 0.08]))
    S.append(Paragraph("Le <b>Lot 0</b> monte d&eacute;j&agrave; <b>6 axes</b> sans d&eacute;pendre de l'infra SSR (ROI rapide). Le Lot 1 est le grand investissement infra qui d&eacute;bloque le reste.", BODY))

    S.append(Paragraph("H. D&eacute;cisions arr&ecirc;t&eacute;es (2026-06-14)", H3))
    for d in ["<b>D-1</b> Techno SSR : <b>Next.js &laquo; Clenzy Sites &raquo;</b> (SSR/ISR d&eacute;di&eacute;).",
              "<b>D-2</b> Domaines/TLS : <b>Cloudflare for SaaS</b> (z&eacute;ro ops, d&eacute;j&agrave; sur Cloudflare ; *.clenzy.site = wildcard). Repli : Caddy on-demand.",
              "<b>D-3</b> Builder : <b>composeur par blocs</b> (freeform diff&eacute;r&eacute;).",
              "<b>D-4</b> Email : <b>Brevo</b> derri&egrave;re une abstraction EmailCampaignProvider (campagnes natives plus tard).",
              "<b>D-5a</b> Anti-fraude : <b>Radar d&eacute;faut + 3DS</b> (r&egrave;gles custom diff&eacute;r&eacute;es).",
              "<b>D-5b</b> Damage : <b>les deux, phas&eacute;</b> &mdash; caution pr&eacute;-autoris&eacute;e d'abord, waiver ensuite (choix par bien).",
              "<b>D-6</b> Ordre : <b>Lot 0 (quick wins) d'abord</b>, fondation SSR (Lot 1) en parall&egrave;le."]:
        S.append(bullet(d, SMALL))

    return S


def main():
    doc = make_doc(os.path.join(PDF, "refonte-booking-engine.pdf"))
    doc.build(build())
    print("OK refonte -> %s" % os.path.join(PDF, "refonte-booking-engine.pdf"))


if __name__ == "__main__":
    main()
