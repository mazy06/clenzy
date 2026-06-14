# Benchmark B2 — Moteur de réservation & site direct (D2) + Calendrier & multi-logements / multi-tenant (D3)

> Lot B2 de la campagne d'analyse concurrentielle Clenzy.
> Cible : conciergeries / gestionnaires professionnels (B2B2C) + propriétaires multi-biens, ancrage France.
> Grille 0–3 : 0 Absent · 1 Basique · 2 Standard · 3 Avancé.
> Date : 2026-06-13. Recherche web : 2025-2026.

---

## 1. Périmètre & méthode

Ce rapport couvre **deux domaines** du cadrage :

- **Domaine 2 — Moteur de réservation & site direct** (pondération 6 %) : booking engine / widget embarquable, site web inclus (templates / builder), paiement direct, panier multi-séjours, SEO, politiques d'annulation, multi-langue / RTL.
- **Domaine 3 — Calendrier & multi-logements / multi-tenant** (pondération 8 %) : vue multi-propriété, multi-comptes / multi-établissements, drag & drop, gestion de portefeuille, robustesse anti-overbooking, multi-tenant / agency mode.

**Méthode.** Colonne Clenzy justifiée par l'inventaire code (vérité terrain — voir `inventaire/02-*.md` et `inventaire/03-*.md`). Colonnes concurrents : recherche web 2025-2026 datée, niveau de confiance (`Confirmé` / `Probable` / `À vérifier`), « non documenté » quand introuvable. Reformulation systématique (pas de copie de source). Panel : Hostaway, Guesty, Smoobu, Lodgify, Hospitable, Avantio, Smily (BookingSync).

**Lecture des scores.** Le score moyen par acteur (1 décimale) est la **moyenne arithmétique des fonctionnalités** de chaque sous-matrice (CSV `data/02-*.csv` et `data/03-*.csv`). Pour Clenzy, ces moyennes fines (D2 = 1,4 ; D3 = 2,6) intègrent des sous-fonctionnalités granulaires marketing/SEO où Clenzy est à 0. Le **score synthétique du cadrage** (D2 = 2, D3 = 3) reflète une lecture pondérée sur les fonctionnalités cœur (booking engine, paiement, calendrier, multi-tenant), où Clenzy est au niveau avancé. **Les deux lectures sont conservées en transparence** ; l'écart D2 traduit précisément le gap « site direct / acquisition » identifié ci-dessous.

---

## 2. Inventaire interne (résumé)

### Domaine 2 — Booking & site direct
- **`PublicBookingService`** (1242 l. + 1574 l. de tests) : booking engine public par organisation (slug + API key). **Implémenté.**
- **Paiement Stripe Checkout** direct (session + webhook signé, circuit breaker). **Implémenté.**
- **`VoucherEngine`** : codes promo scopés (ALL / BOOKING_ENGINE / DIRECT_LINK / WHATSAPP / EMAIL), min/max stay, limites d'usage (`BookingVoucher`, `VoucherPropertyScope`, `VoucherUsage`). **Implémenté — riche.**
- **Auth guest** Keycloak realm `clenzy-guests`. **Implémenté.**
- **Multi-devise** EUR/MAD/SAR/USD/GBP. **Implémenté.**
- **Panier multi-séjours** : `BookingCartPage.tsx`. **Implémenté (partiel).**
- **Éditeur de design** : design tokens + CSS/JS + assistant IA (`DesignTokenEditor`, `BookingEngineCssEditor`, `AiDesignMatcher`) — **pas un builder de pages drag-and-drop**.
- **SDK JS headless** (`booking-sdk/`) : events, **pas d'i18n embarqué, pas de RTL**.
- **Manques** : builder de site (templates / pages), **SEO / blog absents**, email de confirmation booking direct non prouvé, RTL absent.
- **Score interne : 2 / 3** (cadrage §7).

### Domaine 3 — Calendrier & multi-tenant
- **`CalendarEngine`** : verrou `pg_advisory_xact_lock(property_id)` + write-ahead log `calendar_commands` + outbox → Kafka (`calendar.updates`). Anti-overbooking de **niveau transactionnel**, couvert par `CalendarEngineConcurrencyTest`. **Implémenté — différenciant.**
- **`CalendarDay`** : statut AVAILABLE/BOOKED/BLOCKED/MAINTENANCE, prix, min/max stay, changeover. **Implémenté.**
- **Planning UI** : 19 fichiers `modules/planning/`, drag & drop (`PlanningBar`, `PlanningBarGhost`), quick-create (61 KB), blocage de périodes, filtres, pagination, popovers. **Implémenté.**
- **Multi-tenant** : `@Filter organizationFilter` Hibernate + `TenantFilter` post-JWT *fail-closed* (403 si org non résolue) + cross-org pour SUPER_ADMIN/SUPER_MANAGER. **Implémenté — strict.**
- **Portefeuille** : `modules/portfolios/` + détecteurs de patterns IA (`service/agent/portfolio/`).
- **Partitionnement** : `CalendarPartitionManager` (scalabilité).
- **Score interne : 3 / 3** (cadrage §7).

---

## 3. Matrice de comparaison

### 3.1 Sous-matrice — Domaine 2 (Booking & site direct)

| Fonctionnalité | Clenzy | Hostaway | Guesty | Smoobu | Lodgify | Hospitable | Avantio | Smily | Confiance |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Moteur de réservation / widget embarquable | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | Confirmé |
| Site web inclus (builder / templates) | 2 | 3 | 3 | 2 | 3 | 2 | 3 | 3 | Confirmé |
| Builder drag-and-drop sans code | 1 | 3 | 3 | 2 | 3 | 2 | 2 | 2 | Probable |
| Templates de site prêts à l'emploi | 1 | 3 | 3 | 2 | 3 | 2 | 2 | 3 | Confirmé |
| Paiement direct intégré (Stripe / processeur) | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | Confirmé |
| Processeur de paiement propriétaire (built-in) | 0 | 0 | 3 | 0 | 0 | 3 | 0 | 0 | Confirmé |
| Codes promo / vouchers (scope + limites) | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | Confirmé |
| Panier multi-séjours / multi-propriétés | 2 | 1 | 1 | 0 | 1 | 0 | 1 | 1 | À vérifier |
| Multi-devise | 2 | 3 | 3 | 2 | 3 | 2 | 3 | 3 | Confirmé |
| Multi-langue interface booking | 2 | 3 | 3 | 2 | 3 | 2 | 3 | 3 | Probable |
| RTL / arabe (booking direct) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | À vérifier |
| SEO du site direct (meta / schema / sitemap) | 0 | 2 | 3 | 2 | 3 | 2 | 3 | 3 | Confirmé |
| Blog intégré / contenu marketing | 0 | 2 | 1 | 1 | 2 | 1 | 2 | 2 | Probable |
| Politiques d'annulation paramétrables | 2 | 3 | 3 | 2 | 3 | 3 | 3 | 2 | Probable |
| Email de confirmation de réservation | 1 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | Probable |
| Protection anti-fraude / damage protection | 0 | 2 | 3 | 0 | 1 | 3 | 1 | 1 | Probable |
| Capture de leads / email marketing | 0 | 3 | 2 | 1 | 2 | 2 | 2 | 2 | Probable |
| SDK / API booking pour intégration custom | 2 | 2 | 3 | 1 | 2 | 1 | 2 | 2 | Probable |
| Outils IA (contenu / SEO / design) | 2 | 3 | 2 | 0 | 1 | 1 | 1 | 2 | Probable |
| **Moyenne (1 déc.)** | **1,4** | **2,3** | **2,5** | **1,4** | **2,2** | **1,9** | **2,1** | **2,1** | |

> Score synthétique cadrage Clenzy D2 = **2** (lecture pondérée sur le cœur booking/paiement/vouchers ; voir §1).

### 3.2 Sous-matrice — Domaine 3 (Calendrier & multi-tenant)

| Fonctionnalité | Clenzy | Hostaway | Guesty | Smoobu | Lodgify | Hospitable | Avantio | Smily | Confiance |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Vue multi-calendrier / multi-propriété unifiée | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | Confirmé |
| Drag-and-drop des réservations | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | Confirmé |
| Édition groupée (rates / min-stay / blocages) | 2 | 3 | 3 | 2 | 2 | 2 | 2 | 3 | Confirmé |
| Filtres / pagination de la vue planning | 3 | 3 | 3 | 2 | 2 | 2 | 3 | 3 | Probable |
| Blocage de périodes (maintenance / ménage) | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | Confirmé |
| Statuts visuels (ménage / sources / couleurs) | 2 | 3 | 3 | 2 | 2 | 3 | 2 | 2 | Probable |
| Robustesse anti-overbooking (transactionnel) | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | Probable |
| Synchronisation temps réel inter-canaux | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | Confirmé |
| Multi-tenant / isolation par organisation | 3 | 2 | 3 | 1 | 1 | 1 | 3 | 3 | Probable |
| Mode agence / multi-comptes / sous-comptes | 3 | 2 | 3 | 1 | 1 | 1 | 3 | 3 | Probable |
| Gestion de portefeuille (groupes de biens) | 2 | 3 | 3 | 2 | 2 | 2 | 3 | 3 | Confirmé |
| Multi-unités (sous-unités d'une propriété) | 2 | 3 | 3 | 2 | 2 | 2 | 3 | 2 | Confirmé |
| Portail propriétaire avec accès calendrier | 2 | 3 | 3 | 1 | 2 | 1 | 3 | 3 | Confirmé |
| Vue calendrier mobile multi-unités | 2 | 3 | 2 | 3 | 2 | 3 | 2 | 2 | Probable |
| Gestion fuseau horaire par propriété | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | Probable |
| Échelle (centaines à milliers de lots) | 3 | 3 | 3 | 2 | 2 | 2 | 3 | 3 | Probable |
| **Moyenne (1 déc.)** | **2,6** | **2,8** | **2,8** | **2,1** | **2,1** | **2,2** | **2,6** | **2,7** | |

> Score synthétique cadrage Clenzy D3 = **3** (lecture pondérée sur anti-overbooking + drag&drop + multi-tenant ; voir §1).

---

## 4. Gaps · Avantages · Parité

### Domaine 2 — Booking & site direct

**Top 3 gaps (Clenzy en retard) :**
1. **Pas de website builder de pages / templates.** Hostaway (Booking Website Pro, drag-and-drop + IA), Guesty (Guesty Websites Basic/Advanced), Lodgify (20+ templates, leader site direct) et Smily (sites multilingues SEO) offrent un builder de pages complet. Clenzy a un éditeur de **design tokens + CSS/JS**, pas un builder de pages no-code → barrière à l'autonomie de l'hôte.
2. **SEO / blog absents.** Lodgify, Guesty et Avantio embarquent meta-tags, schema markup, sitemap, blog et même optimisation « AI search ». Clenzy n'a aucun module SEO → le site direct ne capte pas de trafic organique, ce qui contredit l'objectif « réduire la dépendance OTA ».
3. **Acquisition / conversion faible** : pas de capture de leads ni d'email marketing intégré (Hostaway, Lodgify), email de confirmation booking direct non prouvé dans le code, pas de protection anti-fraude / damage protection (Guesty, Hospitable Direct Premium jusqu'à 5 M$ de couverture).

**Top 3 avantages (Clenzy en tête) :**
1. **Moteur de vouchers / codes promo le plus riche** : scopes multi-canaux (BOOKING_ENGINE / DIRECT_LINK / WHATSAPP / EMAIL), min/max stay, limites d'usage — granularité supérieure aux promo codes simples des concurrents.
2. **Panier multi-séjours** (`BookingCartPage`) : permet de réserver plusieurs séjours en un parcours — fonctionnalité **non documentée** chez les 7 concurrents (panier mono-séjour partout).
3. **Assistant IA de design** (`AiDesignMatcher` + design tokens) : approche IA-native du theming, là où les concurrents proposent des templates figés.

**Parité :** moteur de réservation public, paiement Stripe direct, multi-devise, auth guest — tous au standard du marché.

### Domaine 3 — Calendrier & multi-tenant

**Top 3 avantages (Clenzy en tête ou au plus haut niveau) :**
1. **Robustesse anti-overbooking transactionnelle** : verrou advisory PostgreSQL par propriété + write-ahead log + outbox → Kafka, testé en concurrence. Les concurrents s'appuient sur la sync de calendrier (prévention au niveau channel) ; Clenzy verrouille au niveau base de données → garantie plus forte contre la course critique.
2. **Multi-tenant natif fail-closed** : `@Filter` Hibernate + `TenantFilter` post-JWT qui refuse (403) si l'org n'est pas résolue. Conçu agency/B2B2C dès l'architecture, au niveau de Guesty / Avantio / Smily et au-dessus des outils orientés hôte (Smoobu, Lodgify, Hospitable mono-compte).
3. **Gestion du fuseau horaire par propriété** (règle interne dates) — souvent traitée au niveau système/JVM ailleurs ; Clenzy l'ancre à la propriété, ce qui élimine les décalages d'un jour à l'origine d'overbookings.

**Top 3 gaps (Clenzy en léger retard) :**
1. **Édition groupée (bulk edit)** des rates / min-stay / blocages depuis le calendrier : Hostaway, Guesty et Smily proposent du bulk-edit multi-listings ; Clenzy est plus orienté action unitaire (quick-create / block period).
2. **Gestion de portefeuille / groupes de biens** : Guesty (sub-units, groupes), Avantio et Hostaway (multi-units expand/collapse) offrent des regroupements visuels riches ; Clenzy a `portfolios/` mais plus orienté détection de patterns IA que regroupement opérationnel.
3. **Portail propriétaire avec calendrier** : Guesty/Avantio/Smily ont des Owners Portals matures (vue calendrier, stats, réservations pour le compte). Clenzy a un `owner-portal/` (cadrage) mais sa profondeur côté calendrier est à confirmer.

**Parité :** vue multi-propriété unifiée, drag & drop, sync temps réel, blocage de périodes — au standard du marché (souvent score 3 partout).

---

## 5. Opportunités vs sociétés de service (conciergeries)

Les conciergeries (GuestReady, Houst, Cocoonr, Welkeys…) gèrent les biens « à la place » du propriétaire : elles vendent un **service opéré**, pas un logiciel. Implications pour D2/D3 :

- **D3 — le calendrier multi-tenant est l'arme directe contre la conciergerie.** L'argument central d'une conciergerie est « on gère tout pour vous, vous n'avez rien à faire ». Clenzy peut retourner cet argument auprès des **gestionnaires pros** : un calendrier multi-propriété fail-closed + anti-overbooking transactionnel + portail propriétaire transforme le gestionnaire lui-même en quasi-conciergerie outillée. Clenzy n'attaque donc pas la conciergerie : il **arme la conciergerie** (B2B2C) — c'est le bon angle.
- **D2 — le booking direct est la promesse que les conciergeries ne tiennent pas.** Les conciergeries restent très dépendantes des OTA et offrent rarement un vrai site direct de marque. Un booking engine + site direct + paiement intégré permet à un gestionnaire de **réduire sa commission OTA** et de bâtir une marque — argument de revenu net que la conciergerie classique ne propose pas. **Mais** le gap site-builder/SEO de Clenzy affaiblit cette promesse : sans SEO, le site direct ne capte pas de trafic. Comblé, c'est un différenciateur fort face aux conciergeries.
- **Opportunité combinée** : positionner Clenzy comme « le système qui permet à une conciergerie d'opérer 50–500 lots ET de vendre en direct sous sa propre marque » — le multi-tenant (D3) sécurise l'opération, le booking engine (D2) crée le canal direct. C'est cohérent avec la cible cadrage (conciergerie pro FR).

---

## 6. Recommandations & initiatives

| Titre | Type | Impact (1-3) | Effort (S/M/L) | Reach (1-3) | Confiance (0.1-1.0) |
|---|---|:--:|:--:|:--:|:--:|
| Website builder de pages no-code + 5-8 templates STR | Build (D2) | 3 | L | 3 | 0.8 |
| Module SEO du site direct (meta, schema.org, sitemap, hreflang) | Build (D2) | 3 | M | 3 | 0.9 |
| Confirmer / brancher l'email de confirmation booking direct (+ rappels) | Fix (D2) | 3 | S | 3 | 0.7 |
| Édition groupée (bulk rates / min-stay / blocages) depuis le planning | Build (D3) | 2 | M | 3 | 0.8 |
| Capter le panier multi-séjours comme différenciateur marketing (mettre en avant) | Go-to-market (D2) | 2 | S | 2 | 0.6 |
| Approfondir le portail propriétaire côté calendrier (vue + stats + résa pour compte) | Build (D3) | 2 | M | 2 | 0.7 |

**Lecture des priorités :**
- **Quick win** : vérifier/brancher l'email de confirmation (impact fort, effort S) — risque de non-conformité de l'expérience booking si absent.
- **Investissements structurants D2** : builder de pages + SEO sont les deux vrais gaps qui expliquent l'écart de moyenne D2 (1,4 vs 2,2-2,5 pour Hostaway/Guesty/Lodgify). Sans eux, le « booking direct » reste théorique.
- **D3 est déjà au niveau** : ne pas sur-investir ; le bulk-edit et le portail propriétaire sont des compléments d'ergonomie, pas des manques structurels.

---

## 7. Sources

> Recherche web menée en juin 2026 sur des contenus 2024-2026. Niveaux de confiance indiqués dans les matrices.

**Domaine 2 — Booking & site direct :**
- Hostaway — Booking Website Pro / Direct Booking Website Builder : https://www.hostaway.com/features/direct-booking/ ; https://www.travelandtourworld.com/news/article/hostaway-introduces-booking-website-pro-to-help-vacation-rental-managers-boost-direct-bookings-with-ai-powered-tools-and-fully-customisable-websites/ ; https://support.hostaway.com/hc/en-us/articles/9521197987995-Booking-Engine-Embeddable-Search-Bar-and-Calendar-widgets
- Guesty — Guesty Websites / Direct booking solutions / paiements : https://www.guesty.com/features/guesty-websites/ ; https://help.guesty.com/hc/en-gb/articles/9362217514141-Guesty-s-direct-booking-integrations-Guesty-Websites-Guesty-Booking-Engine-API-and-Guesty-Booking-Engine ; https://help.guestyforhosts.com/hc/en-gb/articles/9350507076125-Setting-Up-Auto-Payment-For-Direct-Bookings
- Smoobu — Booking website / website builder : https://www.smoobu.com/en/booking-website/ ; https://www.smoobu.com/en/booking-system-engine-vacation-rental/ ; https://support.smoobu.com/hc/en-us/articles/23888817835282--New-Website-Builder
- Lodgify — Website builder / templates / multilingue : https://www.lodgify.com/vacation-rental-website-builder/ ; https://www.lodgify.com/vacation-rental-website-templates/ ; https://www.lodgify.com/blog/multilingual-vacation-rental-website/
- Hospitable — Direct Booking / website builder / paiement : https://hospitable.com/features/direct-booking ; https://hospitable.com/features/vacation-rental-website-builder ; https://stayfi.com/vrm-insider/2025/12/08/hospitable-direct-booking/
- Avantio — Website design / SEO : https://www.avantio.com/vacation-rental-website-design/ ; https://www.avantio.com/blog/organic-seo-vacation-rentals/
- Smily (BookingSync) — Direct booking website : https://www.smily.com/software/features/direct-booking-website ; https://www.softwareworld.co/software/smily-formerly-bookingsync-reviews/
- Comparatifs booking engines : https://martalebre.com/blog/best-vacation-rental-booking-engines ; https://gethostai.com/blog/best-vacation-rental-website-builder ; https://rategain.com/blog/10-best-vacation-rental-booking-engines-2026/

**Domaine 3 — Calendrier & multi-tenant :**
- Hostaway — Multi-Calendar / multi-units : https://www.hostaway.com/glossary/multi-calendar/ ; https://support.hostaway.com/hc/en-us/articles/6563444445595-Listings-Multi-units ; https://support.hostaway.com/hc/en-us/articles/44243012242203-Mobile-App-Multi-Unit-Calendar-View
- Guesty — Multi-calendar / multi-units / Owners Portal : https://www.guesty.com/features/multi-calendar/ ; https://www.guesty.com/features/multi-units/ ; https://help.guesty.com/hc/en-gb/articles/9365347600541-Managing-Owners-Portal-settings ; https://help.guesty.com/hc/en-gb/articles/24235745381533-New-releases-2025
- Smoobu — Unified calendar / drag-and-drop : https://www.smoobu.com/en/ ; https://support.smoobu.com/hc/en-us/articles/360006559560-How-does-Smoobu-work-with-availability
- Lodgify — Multi-calendar / single-unit view : https://www.lodgify.com/property-management-software/ ; https://www.lodgify.com/blog/single-unit-calendar-view/
- Hospitable — Calendar / multi-property : https://help.hospitable.com/en/articles/5625442-getting-started-with-the-calendar ; https://hospitable.com/new-features-calendar
- Avantio — PMS / Owners Area / agences : https://www.avantio.com/property-management-software/ ; https://www.avantio.com/owners-area/ ; https://www.avantio.com/vacation-rental-owners/
- Smily — Multi-calendar Planning / Owners Portal : https://www.smily.com/software/features/multi-calendar---planning ; https://www.smily.com/software/features/owners-portal
- Guesty — multi-calendar value (anti-double-booking) : https://www.guesty.com/blog/multi-calendar-stop-switching-tabs/
