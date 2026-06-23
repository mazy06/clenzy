# B11 — Booking Engine & Builder de site direct (benchmark)

> **Objectif** : situer la refonte **Baitly Studio / booking engine** (branche `booking-engine-wip`,
> moteur **GrapesJS** + import multi-standards) face au marché, pour figer la **direction du builder**
> (full freeform vs template-first bridé) avant l'intégration sur `main`.
> **Date** : 2026-06-20 · **Périmètre** : comment chaque concurrent permet à l'hôtelier / gestionnaire
> de **construire et personnaliser** son site + booking engine direct.

---

## 1. Suite produit — RoomRaccoon (concurrent de référence demandé)

All-in-one cloud, cible **hôtels indépendants 1–99 chambres**, forte base **Europe** (NL, DE, ZA).

| Module | Rôle | Inclus / Add-on |
|---|---|---|
| **PMS** | Calendrier drag-drop, check-in/out en ligne+tablette, profils invités, messagerie unifiée, housekeeping app, night audit auto, rapports RevPAR/ADR | Cœur |
| **Channel Manager** | Sync temps réel **100+ OTAs** (5 s), anti-surbooking, règles d'attribution | Cœur |
| **Booking Engine** | Réservation directe **sans commission**, prix/dispo PMS temps réel, parcours 5 étapes, Price Checker, codes promo, add-ons | Cœur |
| **RaccoonSite** (website builder) | Site hôtelier no-code (template + drag-drop léger) | **Add-on premium** |
| **RaccoonRev** | Revenue management ; **Plus = IA** (demande marché, tarifs concurrents, events, 365 j) | Add-on premium |
| **RaccoonUpsell** | Ventes additionnelles automatisées (petit-déj, late checkout, upgrades) | Add-on premium |
| **Payments** | Dépôts/pré-autos, PCI, terminal + lecteur carte, paiement par email | Inclus |
| **RaccoonID** | Scan d'identité, accès sans clé, check-in pré-arrivée | Add-on premium |

**Pricing** (room-dependent, ~mai 2026) : Entry **$300** / Starter **$383** / Premium **$562** /
Enterprise **$789** par mois. Essai gratuit. **300+ intégrations**.

---

## 2. Mécanisme du builder — comparatif (LE cœur de la décision)

| Acteur | Segment | Mécanisme du builder | Liberté exposée |
|---|---|---|---|
| **Mews** | Hôtel (moderne) | **Pas de builder** — booking engine **API / headless**, on amène son site (WordPress…) | Totale, mais tout à faire soi-même |
| **Asterio** (Septeo Hospitality) | Hôtel-resto-spa (FR/EU) | **Service géré** — site créé par leurs experts (pas de builder self-service, ni templates ni drag-drop côté client) ; booking engine « panier » multi-activités (chambres + resto + spa + bons cadeaux + packages) | **Déléguée** (agence : création + hébergement + SEO + maintenance) |
| **RoomRaccoon** (RaccoonSite) | Hôtel indé | Template + drag-drop léger ; **polices + 3 couleurs de marque** + contenu | **Faible** (bridé, simple) |
| **Guesty** | STR | Builder présent mais **peu personnalisable** ; supplément pour connecter un site existant | Faible |
| **Smoobu** | STR | Templates personnalisables, booking engine natif, **builder inclus gratuit** | Faible-moyen |
| **Cloudbeds** | Hôtel / hostel | Templates + booking engine ; **+ échappatoire HTML/CSS** sur le booking engine | Moyen-élevé |
| **Lodgify** ⭐ | STR (leader du site) | Template + **éditeur visuel complet** : typo, couleurs, marges, espacements, blocs réarrangeables, galeries | **Élevé** (dans le cadre des templates) |
| **Hostaway** (Booking Website Pro) | STR | Template + **drag-drop complet** + **IA** (génération copy/SEO) + marketing | **Élevé** + IA |
| **Clenzy — Baitly Studio (refonte GrapesJS)** | Conciergerie / STR | **GrapesJS** (éditeur visuel libre) + **import multi-standards** (Elementor/Divi/Beaver/Gutenberg/Webflow/WPBakery/HTML/Markdown) | **Maximale** (full freeform + import) |

> **Spectre** (du plus délégué au plus libre) : `Service géré / agence (Asterio)` · `Headless API (Mews)` →
> `Template bridé (RoomRaccoon, Guesty, Smoobu)` → `Template + éditeur visuel full (Lodgify, Hostaway, Cloudbeds)`
> → `Freeform + import externe (Clenzy/GrapesJS)`.

> **Note Asterio / Septeo Hospitality** : éditeur FR (ex-Sequoiasoft), PMS **multi-activités** (hôtel +
> restaurant + spa + boutique), web 100 % cloud, support FR 7j/7. **Deux choses à NE PAS confondre :**
> 1. **Le site web** = **service géré** (équipe d'experts qui crée, héberge, référence, maintient) —
>    « fait-pour-vous », pas de builder self-service.
> 2. **Le booking engine** = **widget embarquable** (« panier ») qu'on **pose sur un site EXISTANT** (quel
>    qu'en soit l'auteur), multi-activités (rooms + tables + spa + bons cadeaux). C'est ce widget qui
>    intéresse ici. **Stack = jQuery (legacy) — CONFIRMÉ** (retour first-hand : l'équipe Clenzy a travaillé sur
>    le booking engine Sequoiasoft/Asterio). Côté Clenzy l'équivalent = le **SDK `BaitlyWidget` + `sdk/core`**
>    (JS moderne, composable, **hydratation SSR** via `data-clenzy-widget`) → **avantage technique net** : perf,
>    SEO/SSR, composable dans le builder GrapesJS, face à un widget **jQuery legacy** côté Asterio.
>
> Septeo a aussi **Witbooking AI** (2ᵉ moteur de réservation, orienté IA) + **Ulyses Suite** (plateforme
> intégrée PMS + CRS + moteur) — à surveiller. Implication produit pour Clenzy : (a) en plus du builder
> self-serve, une option **« setup assisté / templates clé-en-main »** (créneau « fait-pour-vous » d'Asterio) ;
> (b) capitaliser sur un **widget moderne** vs les moteurs jQuery legacy du marché hôtelier FR.

---

## 3. Matrice de fonctionnalités — booking engine & site

Légende : ✅ natif · 🟡 partiel / limité · ⬜ absent · ❓ non confirmé

| Fonctionnalité | Mews | Asterio | RoomRaccoon | Guesty | Smoobu | Cloudbeds | Lodgify | Hostaway | **Clenzy (cible)** |
|---|---|---|---|---|---|---|---|---|---|
| Booking engine direct sans commission | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sync dispo/prix PMS temps réel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Website builder **self-service** | ⬜ | ⬜ (service géré) | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Éditeur visuel drag-drop | ⬜ | ⬜ | 🟡 | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| Perso layout/blocs/espacements | ⬜ | ⬜ (déléguée) | ⬜ | ⬜ | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| HTML/CSS libre | (site tiers) | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ✅ |
| **Import de templates externes** (Elementor/Divi/Webflow…) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ **(différenciateur)** |
| IA génération contenu/SEO | ⬜ | ❓ | 🟡 (RaccoonRev = pricing) | ⬜ | ⬜ | ❓ | ❓ | ✅ | 🟡 (assistant + AiDesignMatcher) |
| Multi-langue / multi-devise | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SEO / SSL / hébergement | (tiers) | ✅ (inclus service) | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ (SSR à finaliser) |
| Marketing (lead capture, pop-ups, email) | ⬜ | ❓ | 🟡 | ❓ | ❓ | ❓ | 🟡 | ✅ | 🟡 (Croissance : lead/relance/parrainage) |
| Multi-activités (resto/spa/bons cadeaux) | ⬜ | ✅ **(fort)** | ⬜ | ⬜ | ⬜ | 🟡 | ⬜ | ⬜ | ⬜ (hors périmètre STR) |

---

## 4. Pricing — repères (par mois, hors taxes, room/property-dependent)

| Acteur | Entrée | Haut de gamme | Builder de site |
|---|---|---|---|
| **Smoobu** | ~**€23,20** (1 logement, Pro prépayé) | — | Inclus gratuit (tous plans) |
| **Hostaway** | sur devis | sur devis | **Gratuit** pour clients (+ frais par résa directe) |
| **RoomRaccoon** | **$300** (Entry) | **$789** (Enterprise) | RaccoonSite = **add-on premium** |
| **Lodgify** | sur devis (par logement) | — | Cœur de l'offre |
| **Guesty / Cloudbeds / Mews** | sur devis | sur devis | Cloudbeds inclus ; Mews = pas de builder |

---

## 5. Enseignements

1. **Norme STR = template + éditeur visuel complet** (Lodgify, Hostaway) : on personnalise
   couleurs/typo/layout/blocs **mais dans des templates curatés**. Pas de HTML libre, **pas d'import externe**.
2. **Personne n'importe** Elementor/Divi/Webflow/HTML. Le plus ouvert = **Cloudbeds** (échappatoire HTML/CSS)
   et **Mews** (headless API). → **L'import multi-standards de Clenzy (GrapesJS) n'existe nulle part = différenciateur réel**,
   surtout pour **conciergeries / agences** qui reprennent des sites existants.
3. **L'IA est le nouveau front** : Hostaway génère le contenu/SEO du site ; RoomRaccoon pousse l'IA côté pricing.
   Clenzy a déjà l'**assistant** + `AiDesignMatcher` → carte à jouer (génération de site/template assistée).
4. **GrapesJS est le bon moteur** : seul à couvrir **les deux** — éditeur visuel template-first (façon Lodgify/Hostaway)
   **ET** mode libre + import. Il est **bridable** par défaut.
5. **Le marché hôtelier FR/EU (Asterio/Septeo) reste sur du « fait-pour-vous »** (site créé par une agence) +
   du **multi-activités** (resto/spa/bons cadeaux). → 2 pistes pour Clenzy : (a) une option **« setup assisté /
   templates clé-en-main »** à côté du self-serve, pour capter les non-bricoleurs ; (b) le **multi-activités**
   est hors périmètre STR aujourd'hui, mais c'est là qu'Asterio se différencie sur l'hôtellerie.

---

## 6. Recommandation pour Clenzy (direction du builder)

**Garder GrapesJS**, exposé en **2 niveaux** + IA :

| Niveau | Public | Contenu | Réf. marché |
|---|---|---|---|
| **Défaut « guidé »** | Hôtelier / host lambda | Templates curatés + perso couleurs/typo/blocs (éditeur bridé) | ≈ Lodgify / Hostaway (norme prouvée) |
| **Mode « avancé / import »** | Conciergerie / agence / power user | GrapesJS libre + **import Elementor/Divi/HTML** | **Différenciateur** (personne ne le fait) |
| **+ IA accélérateur** | Tous | Génération de template/contenu via l'assistant | ≈ Hostaway (IA copy/SEO) |

→ **On matche la norme** par défaut (simplicité, conversion), **on différencie** par l'import + l'IA.
Cela **valide la refonte GrapesJS** et son importeur multi-standards. **Décision** : conserver GrapesJS comme
moteur ; prévoir le **bridage par défaut** + le **mode import** comme différenciateur ; IA en phase ultérieure.

---

## 7. Sources

- HotelTechReport — RoomRaccoon : https://hoteltechreport.com/operations/hotel-management-software/roomraccoon-hms
- RoomRaccoon — RaccoonSite : https://roomraccoon.com/platform/raccoon-site/ · Blog builder : https://roomraccoon.com/blog/hotel-website-builder/ · Booking engine : https://roomraccoon.com/en/all-in-one/booking-engine
- RoomRaccoon pricing (SpotSaaS) : https://www.spotsaas.com/product/roomraccoon/pricing
- Lodgify — Website Builder : https://www.lodgify.com/vacation-rental-website-builder/ · Templates : https://www.lodgify.com/vacation-rental-website-templates/
- Hostaway — Direct Booking : https://www.hostaway.com/features/direct-booking/ · Booking Website Pro (upgrade) : https://www.thehostreport.com/news/hostaway-upgrades-its-direct-booking-website-builder
- Smoobu — Website Builder : https://www.smoobu.com/en/website-builder-vacation-rentals/ · Smoobu vs Guesty : https://www.smoobu.com/en/comparisons/smoobu-vs-guesty/
- Cloudbeds — Websites : https://www.cloudbeds.com/websites/ · HTML/CSS booking engine : https://myfrontdesk.cloudbeds.com/hc/en-us/articles/219144708
- Mews — best hotel website builders : https://www.mews.com/en/blog/best-hotel-website-builder
- Asterio (Septeo Hospitality) — HotelTechReport : https://hoteltechreport.com/operations/property-management-systems/asterio-septeo · Booking engine : https://www.asterio.com/en/features/booking-engine/ · Création de site (service) : https://www.asterio.com/fonctionnalites/creation-de-site-web/ · Septeo Ulyses Suite : https://www.septeo.com/fr/presse/septeo-hospitality-lance-ulyses-suite-un-nouveau-pms-un-crs-et-un-moteur-de-reservation-au-coeur-de-la-plus-grande-plateforme-logicielle-integree

> **Note méthodo** : données issues de pages éditeurs + sources tierces (HotelTechReport, comparateurs),
> juin 2026. Les pages roomraccoon.com renvoient 403 au fetch automatique (Cloudflare) → recoupées via
> recherche + sources indépendantes. À réévaluer périodiquement (offres mouvantes, IA en évolution rapide).
