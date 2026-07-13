# Refonte générale du Booking Engine — Blueprint « score 3 sur tous les axes + avantage comparatif »

> Document de cadrage produit + technique. Objectif : faire passer le **Domaine 2 (Booking engine & site direct)** de 1,7 à ~2,9 (domaine LEADER du panel), pas seulement la parité.
> Préparé le 2026-06-14. Source d'état des lieux : reconnaissance code `client/src/modules/booking-engine/` + `booking-sdk/` + backend `com.clenzy.booking`.
> Convention : ne rien noter « 3 » sans livraison réelle + testée. Les axes gated (partenariats/externe) sont signalés.

---

## A. État des lieux (factuel)

**Architecture actuelle** : le booking engine est un **widget JavaScript vanilla** (`BaitlyWidget`, isolation Shadow DOM) que l'hôte **embarque sur son propre site**. Il consomme l'API publique `/api/public/booking/{slug}/**` (Spring). Il existe aussi un **SDK headless** (`booking-sdk/`, classe `ClenzyBooking`) et une **preview React** côté PMS (admin).

- **Aucun rendu serveur (SSR).** Aucun site hébergé par Baitly, aucun sous-domaine, aucun domaine custom.
- **Aucun modèle de site / page / CMS / blog** (greenfield total côté données).
- **Personnalisation** = design tokens (21 props) + 6 presets de thème + CSS/JS custom + extraction IA de tokens depuis une URL (`AiDesignService`). **Pas de page builder.**
- **Panier multi-séjours** = uniquement dans la preview PMS (React). **Le widget public ne fait pas de multi-séjour.**
- **i18n fr/en/ar + RTL** = fait. **Multi-devise** = formatage `Intl` à la devise de config, **pas de conversion vers la devise choisie par le voyageur**.
- **IA** = extraction de design tokens uniquement (pas de génération de contenu/copy).

**Actifs backend réutilisables (inventaire vérifié)** :

| Brique | Statut | Réutilisable pour |
|---|---|---|
| `CurrencyConverterService` + `ExchangeRateProviderService` (EUR base, MAD/SAR, refresh quotidien open.er-api.com) | ✅ prod | **Multi-devise** (affichage + checkout) |
| `AiProviderRouter` (`AiRequest.of/json`), `ChatLLMRouter`, `AiTokenBudgetService` (gating+budget), BYOK | ✅ prod | **Outils IA** (contenu/SEO/design/concierge) |
| `TranslationService` (DeepL/Google + cache Redis) | ✅ prod | SEO multilingue, contenu multilingue |
| `KbSearchService` (RAG pgvector) | ✅ prod | **IA concierge** sur le site |
| `SecurityDeposit` + `SecurityDepositService` (machine à états PENDING/HELD/RELEASED/CAPTURED) | ⚠️ hold Stripe **non câblé** (HP-19) | **Anti-fraude / damage protection** |
| `StripeGateway` + `PaymentProviderRegistry` (Stripe, PayTabs, CMI, Payzone) | ✅ prod | Paiement multi-pays, **moyens locaux MENA** |
| Stripe Radar / 3DS / risk scoring | ❌ absent | **Anti-fraude** (à construire) |
| `VoucherEngine` + `PublicVoucherController` | ✅ prod | Promo, **gift cards** |
| `EmailService` + composers + `EmailWrapperService` (List-Unsubscribe) | ✅ prod | Email marketing transac |
| Campagnes Brevo / lead capture / abandoned-cart | ❌ absent (Brevo webhook-only ; `WaitlistSignup`+`MarketingIntegration` minimaux) | **Capture de leads / email marketing** |
| Webhooks sortants (`WebhookController`, file+retry+HMAC) | ✅ prod (livré 2026-06-14) | **SDK / API** (intégrations) |
| `PriceSimulationService` (TVA + taxe séjour par pays) | ✅ prod | Affichage prix TTC par pays |

**Scores Domaine 2 — point de départ** (après le travail du 2026-06-14) :

| Axe | Aujourd'hui | Cible | Verrou |
|---|---|---|---|
| Moteur de réservation public | 3 | 3 | — (acquis) |
| Paiement direct intégré (Stripe) | 3 | 3 | — (acquis) |
| Codes promo / vouchers | 3 | 3 | — (acquis) |
| Politiques d'annulation, email confirmation, RTL, multi-langue | 3 | 3 | — (acquis 2026-06-14) |
| **Site web inclus (builder de pages)** | 2 | 3 | Plateforme de sites hébergés |
| **Builder drag-and-drop sans code** | 1 | 3 | Composeur par blocs |
| **Templates de site prêts à l'emploi** | 1 | 3 | Catalogue + SSR |
| **Panier multi-séjours / multi-propriétés** | 2 | 3 | Productiser dans le widget public |
| **Multi-devise** | 2 | 3 | Câbler `CurrencyConverterService` |
| **SEO du site direct (meta/schema/sitemap)** | 0 | 3 | **SSR (verrou n°1)** |
| **Blog intégré / contenu marketing** | 0 | 3 | CMS + SSR |
| **Protection anti-fraude / damage protection** | 0 | 3 | Radar/3DS + SecurityDeposit Stripe |
| **Capture de leads / email marketing** | 0 | 3 | Lead model + abandoned-cart + Brevo |
| **SDK / API booking engine** | 2 | 3 | Versioning + doc + portail dev |
| **Outils IA (contenu/SEO/design)** | 2 | 3 | Génération de contenu IA |
| Processeur de paiement propriétaire | 0 | *hors scope* | Gated (Guesty/Hospitable only) — non poursuivi |

> Si les 11 axes ciblés passent à 3, la moyenne features Domaine 2 atteint **~2,9/3** → Booking devient un **domaine leader** du panel (devant Lodgify/Guesty sur l'ensemble site+IA+conformité).

---

## B. Thèse d'avantage comparatif (pourquoi on GAGNE, pas juste la parité)

Les leaders du « site direct » (Lodgify, Guesty, Smily, Avantio) offrent un **website builder + SEO + blog** corrects mais **génériques et mono-marché (EU/US, LTR)**. L'avantage défendable de Baitly se construit sur **3 différenciateurs que le panel n'a pas** :

1. **Trifecta de distribution** : *hosted SSR site* + *widget embarquable* + *SDK headless/API* — un même moteur, trois modes. Aucun concurrent ne propose les trois proprement. Le widget et le headless existent **déjà** ; il manque le site hébergé SSR.
2. **Booking engine IA-natif multilingue + RTL + arabe-first** : génération de contenu/SEO (titres, descriptions, blog, schema) en fr/en/**ar**, concierge IA RAG sur le site, SEO multilingue `hreflang`. C'est l'angle **MENA (Maroc/Arabie Saoudite)** de la stratégie multi-pays — un marché où les builders généralistes sont faibles (arabe, RTL, devises locales, moyens de paiement locaux PayTabs/CMI déjà intégrés).
3. **Conversion & conformité « direct-first »** : moteur *Book Direct & Save* (parité tarifaire + rate membre + crédit wallet), upsells au checkout, anti-fraude + caution intégrée, prix TTC par pays (TVA + taxe de séjour), récupération de panier abandonné. On ne vend pas un « site », on vend un **canal direct qui convertit et reste conforme**.

> Positionnement : **« l'OS du canal direct pour conciergeries multi-pays »** — pas un clone de Webflow/Wix avec un calendrier.

---

## C. DÉCISION ARCHITECTURALE FONDATRICE — modèle d'hébergement

C'est le **verrou n°1** : sans rendu serveur, SEO / site inclus / builder / blog plafonnent à 2. Trois options :

| Option | Description | Plafond SEO/Site | Coût |
|---|---|---|---|
| **1. Embed-only (statu quo+)** | Garder le widget, exposer `sitemap.xml`/JSON-LD que l'hôte injecte sur SON site | ❌ ~2 (SEO du site de l'hôte, pas de Baitly) | S |
| **2. Sites hébergés SSR** | Chaque org a un site `{slug}.clenzy.site` + domaine custom (`reservation.monhotel.com` via CNAME + TLS auto), **rendu serveur** | ✅ 3 | **XL (infra)** |
| **3. Hybride trifecta** *(recommandé)* | Sites hébergés SSR **+** widget embarquable **+** SDK headless/API. Le moteur de données est commun | ✅ 3 + différenciation | XL puis incrémental |

**Recommandation : Option 3, bâtie sur la fondation SSR de l'Option 2.**

**Choix techno SSR** : service dédié **Next.js « Baitly Sites »** consommant l'API Spring (ISR/SSG pour la perf + Core Web Vitals, `hreflang`, domaines custom, edge cache). Alternative plus légère : SSR Spring + Thymeleaf (moins d'infra, DX/SEO plus faible) — acceptable en MVP mais l'angle « avantage comparatif » justifie Next.js.
- **Domaines custom** : CNAME `*.clenzy.site` + émission TLS automatique (Caddy on-demand TLS, ou cert-manager/ACME, ou couche managée type Cloudflare for SaaS). À trancher (infra clenzy-infra).
- **À trancher D-1** (section H) : Next.js dédié vs Thymeleaf ; provider TLS domaines custom.

> Tout le reste (builder, templates, blog, SEO) **dépend** de cette fondation. Elle constitue le **Lot 1**.

---

## D. Refonte par axe (cible 3 + ce qu'on construit + avantage)

Notation effort : **S** (jours) / **M** (1-2 sem) / **L** (3-5 sem) / **XL** (>5 sem). « réutilise » = brique existante.

### D.1 — Site web inclus (builder de pages) · 2→3 · **L** (dépend Lot 1)
- **Construire** : modèle `Site` (org, slug, customDomain, locales, theme, statut publié/brouillon, SEO defaults) + `SitePage` (path, type [home / property-list / property-detail / blog / custom], `blocks` JSON, meta SEO) rendus par le service SSR.
- **Avantage** : multi-site par org (une conciergerie gère N marques), multilingue par page, preview live (la preview React existe déjà → réutilisée).

### D.2 — Builder drag-and-drop sans code · 1→3 · **L**
- **Construire** : **composeur par blocs** (pas freeform-canvas) — bibliothèque de blocs (Hero, Search, Property Grid, Property Detail, Gallery, Map, Testimonials/Reviews, FAQ, Blog teaser, CTA, Rich text, Newsletter). Réorganisation + édition de contenu + theming via tokens. C'est ce que font réellement Lodgify/Guesty (sections, pas Webflow). Persisté en `blocks` JSON par page.
- **Honnêteté** : le vrai drag-drop freeform = phase ultérieure / build-vs-buy. Le composeur par blocs **atteint 3** (parité builder concurrents) à coût raisonnable.
- **Réutilise** : `DesignTokenEditor`, presets, `PreviewInspector`.

### D.3 — Templates de site prêts à l'emploi · 1→3 · **M**
- **Construire** : catalogue `SiteTemplate` (10-15 thèmes complets = pages + blocs + tokens préremplis, par vertical : appart urbain, villa, chalet, riad/MENA, B&B…). Application en 1 clic → site éditable.
- **Avantage** : templates **RTL/arabe natifs** (riad, MENA) que le panel n'a pas. **Réutilise** les 6 presets de tokens existants comme base.

### D.4 — Panier multi-séjours / multi-propriétés · 2→3 · **M**
- **Construire** : porter le panier multi-séjours (qui existe en preview PMS) dans le **widget public + SDK** : recherche multi-dates/multi-biens → 1 panier → **1 checkout Stripe** (déjà agrégé côté preview). Gérer dispo/hold par item (réutiliser le hold calendrier 30 min existant), remboursement/annulation par item.
- **Avantage** : « **Trip builder** » — itinéraires multi-propriétés (rare dans le panel : tous à 0-1 sauf Baitly à 2). Productisé = vrai différenciateur.

### D.5 — Multi-devise · 2→3 · **S/M** (réutilise tout)
- **Construire** : sélecteur de devise (front) → backend convertit les prix via `CurrencyConverterService` (date de séjour) dans les réponses `PublicBookingService` + checkout dans la devise choisie (Stripe multi-devise ; gérer settlement). Court-circuit même-devise.
- **Avantage** : EUR/MAD/SAR **déjà** alimentés (refresh quotidien) → MENA-ready immédiat. Afficher prix **TTC par pays** (réutiliser `PriceSimulationService` : TVA + taxe séjour).

### D.6 — SEO du site direct (meta / schema / sitemap) · 0→3 · **M** (dépend Lot 1)
- **Construire** (sur SSR) : `<title>`/meta/OpenGraph/Twitter par page rendus serveur ; **JSON-LD** `LodgingBusiness` + `Product`/`Offer` (prix, dispo) + `BreadcrumbList` + `FAQPage` + `Article` (blog) + `AggregateRating` (reviews) ; `/sitemap.xml` (multi-langue) + `/robots.txt` ; **`hreflang`** fr/en/ar ; canonical ; redirections 301 (`SeoRedirect`). Core Web Vitals (ISR/edge).
- **Avantage** : **SEO arabe + hreflang multi-pays** — angle quasi inexistant chez les généralistes EU/US. Rich snippets (prix, étoiles, FAQ) = CTR supérieur.

### D.7 — Blog intégré / contenu marketing · 0→3 · **M** (dépend Lot 1)
- **Construire** : `BlogPost` (site, slug, locale, titre, corps rich/MDX, excerpt, cover, tags, SEO, publishedAt) + page blog SSR + flux RSS + sitemap blog + schema `Article`. Édité via le composeur par blocs.
- **Avantage** : couplé à l'**IA de contenu** (D.11) → génération d'articles SEO multilingues en 1 clic (« 10 choses à faire à Marrakech » en fr/en/ar). C'est le combo blog+IA+SEO multilingue que personne n'a.

### D.8 — Protection anti-fraude / damage protection · 0→3 · **M/L**
- **Construire** :
  - **Damage protection** : câbler `SecurityDeposit` à Stripe (HP-19) — pré-autorisation `capture_method=manual` (hors transaction + `afterCommit` + idempotency via `StripeGateway`), release/capture pilotés. Politique de caution **par bien** (montant depuis `Property`). Alternative non-bloquante : **damage waiver** (frais assurance non remboursable) au choix de l'hôte.
  - **Anti-fraude** : Stripe **Radar** (règles + score), **3DS/SCA** sur checkout, vélocité/abus (réutiliser `TrustedClientIpResolver` + rate limits Redis existants), blocklist email/carte.
- **Avantage** : combiné au paiement MENA (PayTabs/CMI) = anti-fraude **multi-PSP**, rare. Caution intégrée = différenciateur (panel : 0-3 épars).

### D.9 — Capture de leads / email marketing · 0→3 · **L**
- **Construire** :
  - `MarketingContact` / `LeadCapture` (email, source, locale, **consentement RGPD**, double opt-in) + endpoints (newsletter, « prévenez-moi si dispo » → réutilise `WaitlistSignup`, exit-intent).
  - **Récupération de panier abandonné** : `AbandonedBooking` (snapshot panier) + séquence email programmée (réutilise `EmailService`/`EmailWrapperService` List-Unsubscribe, ou campagnes Brevo en étendant `MarketingIntegration` aujourd'hui webhook-only).
  - Segments + séquences (onboarding, nurture, win-back).
- **Avantage** : récupération panier + waitlist + nurture **multilingue** ; conforme RGPD (centre de consentement, voir E.7).

### D.10 — SDK / API booking engine · 2→3 · **M** (briques en place)
- **Construire** : **API publique versionnée** (`/api/public/v1/**`) + **doc OpenAPI** générée + **portail développeur** (les clés API existent : gestion clés/scopes/sandbox) + **webhooks sortants** (✅ livrés : `WebhookController`) + SDK headless (✅ existe) + widget embarquable (✅ existe). Rate limits + idempotency documentés.
- **Avantage** : **trifecta documentée** (hosted + embed + headless) avec webhooks signés HMAC — le panel offre rarement les trois. Le webhook system livré 2026-06-14 est l'actif clé ici.

### D.11 — Outils IA (contenu / SEO / design) · 2→3 · **M/L** (réutilise `AiProviderRouter`)
- **Construire** (sur le socle IA existant, gating + budget via `AiTokenBudgetService`, BYOK) :
  - **Copywriting** : descriptions de biens, copy de pages, **articles de blog**, titres/meta SEO — multilingue fr/en/**ar** via `TranslationService`.
  - **SEO IA** : suggestions mots-clés, génération meta + JSON-LD, alt-text images, maillage interne.
  - **Design IA** : étendre `AiDesignService` (extraction tokens) → **génération de template** (« décris ta marque → site généré »).
  - **Concierge IA sur le site** : chatbot RAG (`KbSearchService` + assistant) répondant aux questions voyageurs et **nudgeant la réservation**.
- **Avantage** : booking engine **IA-natif de bout en bout** (contenu→SEO→design→concierge), multilingue. Différenciateur central de la thèse B.

---

## E. Nouvelles features proposées (au-delà de la liste)

> Curated — les plus fortes pour la conversion / la différenciation / la cohérence multi-pays.

1. **Moteur « Book Direct & Save »** *(stratégique)* : badge parité tarifaire (« moins cher qu'Airbnb »), **rate membre/direct**, **crédit wallet** fidélité, comparateur de prix OTA. C'est *la raison d'être* d'un canal direct — aucun builder du panel ne l'outille vraiment. Réutilise `VoucherEngine` + wallet existant.
2. **Upsell / cross-sell au checkout** : early check-in, late checkout, ménage mi-séjour, transferts, **expériences locales**. Les `service options` existent → productiser en moteur d'upsell (revenu net). 
3. **Gift cards / vente de bons** : acheter du crédit/cadeau (réutilise `VoucherEngine`). Nouvelle source de cash + acquisition.
4. **Comptes voyageur + wishlist + cartes enregistrées + re-booking 1-clic** : rétention et conversion répétée (realm guest Keycloak existe déjà).
5. **Analytics de conversion + A/B testing du funnel + pixels** (GA4 / Meta Pixel / GTM + tracking server-side conforme). Indispensable pour vendre un « canal qui convertit ».
6. **Moyens de paiement locaux + Apple/Google Pay** : PayTabs/CMI déjà intégrés (MENA) → wallets + mada (KSA) + cartes locales = **edge conversion Maroc/Arabie**.
7. **Centre de consentement / cookies / RGPD** : prérequis légal des sites hébergés + marketing (bannière, registre de consentement, DSAR). Couplé à la conformité multi-pays déjà entamée.
8. **SEO multilingue `hreflang` + arabe-first** : déjà cité en D.6 mais c'est *en soi* une feature vendable (peu de concurrents indexent proprement l'arabe).
9. **Reviews / UGC + rich snippets `AggregateRating`** : preuve sociale sur le site + étoiles dans Google (CTR).
10. **Instant-book vs request-to-book** : modes de réservation paramétrables par bien (les OTA premium le font).
11. **Performance / Core Web Vitals + PWA** (« ajouter à l'écran d'accueil ») : facteur de ranking SEO + UX mobile MENA.
12. **Merchandising dynamique éthique** : urgence/scarcité honnête (« 2 dates restantes »), best-seller, recommandations IA de biens similaires.

---

## F. Architecture cible (synthèse technique)

```
                    ┌─────────────────────────────────────────────┐
                    │  Baitly Sites (Next.js SSR/ISR) — NOUVEAU    │
   {slug}.clenzy.site / domaine custom  ──►  pages + blog + SEO    │
                    │  (sitemap, JSON-LD, hreflang, CWV, edge)     │
                    └───────────────┬─────────────────────────────┘
   Widget embarquable (existe) ─────┤  même API publique
   SDK headless (existe) ───────────┤
                                    ▼
            API publique versionnée /api/public/v1 (Spring)
   ┌──────────────────────────────────────────────────────────────┐
   │ Nouveaux modèles : Site, SitePage, BlogPost, SiteDomain,       │
   │   SiteTemplate, MarketingContact, AbandonedBooking, SeoRedirect│
   │ Réutilisés : PublicBookingService, CurrencyConverterService,   │
   │   VoucherEngine, SecurityDeposit, AiProviderRouter, KbSearch,  │
   │   PriceSimulationService, WebhookController, EmailService       │
   └──────────────────────────────────────────────────────────────┘
```

**Règles d'ingénierie (rappel audits)** : argent recalculé serveur (#1) ; appels Stripe/PSP **hors transaction** + `afterCommit` + idempotency (#2) ; ownership org après `findById` (#3) ; controllers minces sans repo (#4) ; DTO records, pas d'entités exposées (#5) ; pas de `catch(Exception)` avaleur (#7) ; concurrence CAS/contrainte unique (#8) ; dates en timezone propriété (#9) ; `BigDecimal compareTo` + `RoundingMode` (#10). SEO/SSR : SSRF guard sur fetch externes (`ICalUrlValidator`), échappement HTML (`StringUtils.escapeHtml`).

**Migrations Liquibase** : nouveaux changesets `0247+` (sites, pages, blog, domains, templates, leads, abandoned-cart). Aucun toucher au schéma existant.

---

## G. Roadmap phasée (lots livrables, validation entre chaque)

| Lot | Contenu | Axes débloqués | Effort | Dépend |
|---|---|---|---|---|
| **0 — Quick wins (in-repo, sans SSR)** | Multi-devise câblée (D.5) ; panier multi-séjours dans le widget (D.4) ; API v1 + OpenAPI + portail (D.10) ; SecurityDeposit→Stripe + Radar/3DS (D.8) ; lead capture + abandoned-cart (D.9, sans site) ; IA copywriting descriptions/biens (D.11 partiel) | 5, 4, 10, 8, 9 partiel, 11 partiel | M–L | — |
| **1 — Fondation Sites hébergés SSR** | Service Next.js « Baitly Sites » + modèles `Site`/`SitePage`/`SiteDomain` + domaines custom + TLS + déploiement (clenzy-infra) | prérequis 1,2,3,6,7 | **XL** | Décisions D-1/D-2 |
| **2 — Builder + Templates** | Composeur par blocs (D.2) + catalogue templates (D.3) + site inclus (D.1) | 1, 2, 3 | L | Lot 1 |
| **3 — SEO + Blog + IA contenu** | SEO complet (D.6) + blog (D.7) + génération IA contenu/SEO multilingue + concierge RAG (D.11) | 6, 7, 11 | M–L | Lot 1 |
| **4 — Différenciation conversion** | Book Direct & Save, upsells, gift cards, comptes/wishlist, analytics/A-B, paiements locaux, consentement RGPD, reviews/snippets (E.1-12) | features E | L–XL | Lots 0-3 |

> Le **Lot 0** monte déjà **6 axes** (5,4,10,8,9,11-partiel) **sans dépendre de l'infra SSR** → ROI rapide. Le Lot 1 est le grand investissement infra qui débloque le reste.

---

## H. Décisions arrêtées (2026-06-14)

- **D-1. Techno SSR** : ✅ **Next.js « Baitly Sites »** (SSR/ISR dédié, consommant l'API Spring) — meilleur SEO/CWV/hreflang/domaines custom.
- **D-2. Domaines custom + TLS** : ✅ **Cloudflare for SaaS** — Baitly est déjà sur Cloudflare, infra docker-compose (pas K8s) ; zéro ops TLS, émission instantanée, CDN/DDoS inclus. Sous-domaines `*.clenzy.site` = cert wildcard. *Repli si coût/hostname problématique : Caddy on-demand TLS.*
- **D-3. Builder** : ✅ **composeur par blocs** (bibliothèque de blocs réorganisables) — atteint 3, parité builders concurrents. Vrai drag-drop freeform = différé (build-vs-buy).
- **D-4. Email marketing** : ✅ **Brevo maintenant**, derrière une abstraction **`EmailCampaignProvider`** (mêmes patterns que le multi-provider IA/paiement) pour basculer en **campagnes natives** plus tard sans réécrire.
- **D-5a. Anti-fraude** : ✅ **Stripe Radar (règles par défaut) + 3DS/SCA** au lancement (gratuit, conforme). Règles custom (Radar for Teams) = différé, ajouté si les données de fraude le justifient.
- **D-5b. Damage protection** : ✅ **les deux, phasé** — **caution pré-autorisée** d'abord (modèle `SecurityDeposit` existe → câblage Stripe manual-capture), **damage waiver** ensuite (longs séjours / MENA). L'hôte choisit par bien.
- **D-6. Ordre d'exécution** : ✅ **Lot 0 (quick wins) d'abord**, fondation SSR (Lot 1) **en parallèle** dès que l'infra Cloudflare/Next.js est prête. Plusieurs items du Lot 0 (IA copywriting, lead capture, API) sont des prérequis du site SSR → pas de travail perdu.

### Différés explicites (issus des décisions)
- Radar for Teams (règles anti-fraude custom) — après données de fraude.
- Damage waiver (police sous-jacente / pool) — après la caution pré-autorisée.
- Campagnes email natives — après Brevo, via l'abstraction `EmailCampaignProvider`.
- Vrai builder freeform (Webflow-class) — après le composeur par blocs.

---

## I. Hors scope / gated (transparence)

- **Processeur de paiement propriétaire** (built-in, à la Guesty/Hospitable) : licence/PSP propriétaire, **non poursuivi** (reste à 0, hors différenciation prioritaire).
- Vrai builder freeform (Webflow-class) : différé (D-3).
- Domaines custom à grande échelle, CDN/edge, déploiement Next.js : **dépend de clenzy-infra** (Lot 1).
