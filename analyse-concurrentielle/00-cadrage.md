# Phase 0 — Cadrage de la campagne d'analyse concurrentielle

> **Produit analysé :** Clenzy — PMS (Property Management System) SaaS multi-tenant pour la location courte durée.
> **Date du cadrage :** 2026-06-13
> **Méthode :** inventaire interne adossé au code (vérité terrain, statut + preuve fichier) ; benchmark concurrents daté et sourcé en Phase 1.
> **Source de vérité interne :** ce document + les fichiers `inventaire/` et la section « Inventaire interne » de chaque rapport `benchmark/`.

---

## 1. Stack & architecture (rappel synthétique)

| Couche | Technologie | Constat code |
|--------|-------------|--------------|
| Backend | Java 21 / Spring Boot 3.2, JPA/Hibernate | `server/src/main/java/com/clenzy/` — packages `booking/ payment/ fiscal/ integration/ service/ controller/ tenant/` |
| Frontend | React 18 / TS / MUI | `client/src/modules/` — 40+ modules métier |
| Mobile | React Native / Expo | `mobile/src/screens/` — **85 écrans .tsx**, MMKV, biométrie, EAS OTA updates |
| Auth | Keycloak 24 (realms `clenzy` + `clenzy-guests`) | `config/SecurityConfig.java`, `tenant/TenantFilter.java` |
| BDD | PostgreSQL 16 + pgvector | migrations Liquibase `db/changelog/changes/NNNN__*.sql` |
| Messaging | Kafka (KRaft) — Outbox pattern | `config/KafkaConfig.java` (topic `calendar.updates`) → `ChannexSyncService` |
| Paiement | Stripe + PayTabs + CMI + Payzone (PayPal retiré) | `payment/provider/` |
| Payout | Stripe Connect + Wise + Open Banking PIS + SEPA XML | `payment/payout/executor/` |
| IA | Assistant multi-provider (Anthropic/OpenAI/Bedrock) + RAG pgvector | `service/agent/` (27 tools) |

**Multi-tenant :** `organization_id` + `@Filter` Hibernate sur les entités métier, `TenantFilter` post-JWT *fail-closed* (403 si org non résolue), platform staff (SUPER_ADMIN/SUPER_MANAGER) cross-org.

---

## 2. Segment réel visé (déduit du code)

**Conclusion : cible primaire = conciergeries / gestionnaires professionnels (modèle B2B2C), cible secondaire = propriétaires-bailleurs multi-biens. Ancrage France.**

Preuves code :
- `OrganizationType` = `INDIVIDUAL` / **`CONCIERGE`** / **`CLEANING_COMPANY`** / `SYSTEM` (`model/Organization.java`).
- **`ManagementContract`** (`model/ManagementContract.java:1-189`) : mandats de gestion propriété↔propriétaire, types `FULL_MANAGEMENT/BOOKING_ONLY/MAINTENANCE_ONLY/CUSTOM`, **PaymentModel** `DIRECT/OWNER_COLLECTS/CONCIERGE_COLLECTS/OTA_COHOST_SPLIT`, `CommissionBase GROSS/NET_OF_OTA_FEE`.
- **`OwnerPayout`** (`model/OwnerPayout.java:1-148`) : reversements multi-propriétaires automatisés (PENDING→APPROVED→PAID) + `CommissionInvoiceService` (facture de commission NF).
- Module `owner-portal/` (portail propriétaire) + `portfolios/` (regroupement de biens par gestionnaire).
- Rôles opérationnels terrain : `TECHNICIAN/HOUSEKEEPER/SUPERVISOR/LAUNDRY/EXTERIOR_TECH` → équipes d'une conciergerie.

**Taille de portefeuille visée :** PME du STR — conciergerie ~5–50 collaborateurs / quelques dizaines à quelques centaines de lots. Facturation SaaS par siège (cf. §6) → montée en charge linéaire.

**Couverture géographique :** code FR + Maroc + KSA (`ExchangeRate` EUR/MAD/SAR ; `FiscalProfile` FR/MA/KSA ; calculateurs `France/Morocco/SaudiTaxCalculator`), **mais** `fiscal.multi-country.enabled=false` → **production = France** aujourd'hui ; MENA est une ambition non activée (OTAs MENA absents, RTL absent).

---

## 3. Panel d'acteurs retenu (à confirmer/ajuster en Phase 1)

### 3.1 PMS concurrents (éditeurs) — 7 comparables
| Acteur | Pourquoi pertinent | Axe de comparaison fort |
|--------|--------------------|--------------------------|
| **Hostaway** | PM/agences en croissance, channel manager natif, marketplace | Référence « PMS pro » direct |
| **Guesty** | Enterprise PM, multi-propriétaires, owner portals, trust accounting | Cible aspirationnelle de Clenzy (B2B2C) |
| **Smoobu** | Très présent Europe/France, petits hôtes | Bas de gamme / entrée de marché |
| **Lodgify** | Orienté site web + booking direct | Booking engine / site direct |
| **Hospitable** | Automatisation messagerie + IA, hôtes indépendants | Communication / IA / automation |
| **Avantio** | Agences européennes, gestion propriétaires, présence FR | Multi-owner + marché EU/FR |
| **Smily (BookingSync)** | Origine française, agences/PM | Marché FR + agences |

### 3.2 Spécialistes Guest Experience / Livret (domaine 7)
**Touch Stay, Duve, Chekin, Enso Connect, Hostfully Guidebooks** — *réutiliser le benchmark existant* (`docs/Analyse_Concurrentielle_Livret_Accueil_Baitly_2026-06.pdf`).

### 3.3 Sociétés de service (conciergeries / property managers) — ≥ 3
**GuestReady, Houst, Pass the Keys** (internationaux) + acteurs FR : **Cocoonr, HostnFly (ex), Wello, BnbLord/Hostmaker-like, Welkeys**. *(à confirmer par recherche web — axe 2 du positionnement)*

---

## 4. Taxonomie & pondération des domaines

Pondération calibrée pour le segment **conciergerie pro / multi-owner FR** (somme = 100 %).

| # | Domaine | Pondération | Justification |
|---|---------|:----------:|---------------|
| 1 | Channel Management | **11 %** | Cœur de l'anti-double-réservation ; table d'enjeu n°1 du STR |
| 2 | Moteur de réservation & site direct | **6 %** | Réduction dépendance OTA ; important mais secondaire pour conciergerie |
| 3 | Calendrier & multi-logements / multi-tenant | **8 %** | Vue portefeuille = quotidien du gestionnaire |
| 4 | Tarification dynamique / Yield | **9 %** | Levier de revenu direct |
| 5 | Opérations — Ménage & Maintenance | **9 %** | Différenciateur conciergerie (équipes terrain) |
| 6 | Communication voyageurs | **11 %** | Volume de travail n°1 d'une conciergerie |
| 7 | Guest Experience & Livret | **7 %** | Upsell + satisfaction ; marché de spécialistes |
| 8 | Finance & Compta | **11 %** | Reversements + conformité NF = bunker Clenzy |
| 9 | Reporting & Analytics / BI | **7 %** | Pilotage + reporting propriétaires |
| 10 | Intégrations & API / Écosystème | **6 %** | IoT/serrures + extensibilité |
| 11 | Application mobile | **5 %** | Terrain + gestion nomade |
| 12 | Admin, sécurité & conformité | **5 %** | RBAC, RGPD, réglementation locale |
| 13 | IA & automatisation | **5 %** | Émergent, fort potentiel de différenciation |

---

## 5. Grille de scoring commune (imposée à tous les sous-agents)

| Score | Signification |
|:-----:|---------------|
| **0** | Absent |
| **1** | Basique / contournement manuel |
| **2** | Standard du marché |
| **3** | Avancé / différenciant |

- **Notre produit :** score justifié par **preuve code** (fichier:ligne).
- **Concurrents :** score + **niveau de confiance** (`Confirmé` / `Probable` / `À vérifier`) + **source datée**.
- Score d'un domaine = **moyenne (pondérée si besoin) de ses fonctionnalités**.
- Si une info concurrent est introuvable → « non documenté » (jamais d'extrapolation).

---

## 6. Business model (constat code) — pour l'agent Pricing

- **Abonnement SaaS** implémenté : `SubscriptionService.java`, `OrganizationBillingService.java`, `Organization.stripe_subscription_id`.
- **Tarif codé** : base **30 €/mois/org** (`PricingConfigService DEFAULT_PMS_MONTHLY_CENTS=3000`) **+ 10 €/siège** au-delà du 1er (`DEFAULT_PMS_PER_SEAT_CENTS=1000`).
- **Périodes** : `BillingPeriod MONTHLY(×1.0) / ANNUAL(×0.80) / BIENNIAL(×0.65)`.
- **Le « 39 €/bien/mois » du pitch n'est PAS dans le code** → narratif commercial (modèle par siège ≠ par bien). *Confiance : Probable — à approfondir par l'agent T3.*
- Forfaits `ESSENTIEL/CONFORT/PREMIUM` présents mais semblent liés aux **devis de prestation** (`PricingConfigService`), pas à l'abonnement SaaS — à clarifier.

---

## 7. Cartographie interne consolidée — score « nous » par domaine

Scores provisoires (0–3) adossés au code (Phase 0). Les sous-agents valident à la fonctionnalité près en Phase 1.

| # | Domaine | Score nous | Preuves clés (fichiers) | Réserves |
|---|---------|:----------:|--------------------------|----------|
| 1 | Channel Management | **2** | Channex mature (`integration/channex/`), iCal (`ICalSyncScheduler`), adapters Airbnb/Booking/Expedia | Airbnb host-profile TODO ; MENA = enums ; dépendance Channex |
| 2 | Booking engine & direct | **2** | `PublicBookingService` (61KB), Stripe Checkout, `VoucherEngine`, SDK headless | RTL/AR absent ; SDK sans i18n ; finalisations |
| 3 | Calendrier & multi-tenant | **3** | `CalendarEngine` (lock pg_advisory + outbox), `@Filter` org, `portfolios/` | — |
| 4 | Pricing / Yield | **2** | `PriceEngine` 8 niveaux, `YieldRule`, PriceLabs natif | IA pricing feature-flag OFF ; Beyond = stub ; taxes hors pipeline |
| 5 | Opérations ménage/maintenance | **3** | `InterventionService`, photos avant/après, `TeamService`, `PropertyInventoryService`, écrans mobile terrain | Planning auto partiel ; anomalies séparées des interventions |
| 6 | Communication voyageurs | **2** | `ConversationService` (inbox multi-canal), WhatsApp Meta+OpenWA, `AutomationService`, templates | SMS absent ; **réponses IA absentes** ; inbox OTA partielle |
| 7 | Guest Experience & Livret | **2** | `WelcomeGuide` complet (upsells, POIs, activités, analytics), `PublicGuide.tsx` | KYC non branché au flux guest ; **caution absente** |
| 8 | Finance & Compta | **3** | NF (`InvoiceNumberingService`+contrainte 0226), FEC, 4 rails paiement, 4 rails payout, `CommissionInvoiceService`, Pennylane | QuickBooks/Xero/Sage = OAuth sans sync ; Odoo absent |
| 9 | Reporting & Analytics | **2** | Dashboards (`DashboardOverview/Charts/Planning`), `FiscalReportingService`, exports PDF/CSV/FEC | **Forecast absent** ; comparaison N/N-1 partielle |
| 10 | Intégrations & API / IoT | **2** | Nuki, Minut, KeyNest, Tuya, caméras go2rtc, `MarketplaceService`, API publique | API publique à maturer ; OTAs partenaires (HomeToGo/GYG/Klook) absents |
| 11 | Application mobile | **3** | 85 écrans RN, MMKV offline, biométrie, EAS, signature canvas | App « manager » à confirmer vs terrain |
| 12 | Admin, sécurité & conformité | **2** | Keycloak, RBAC 8 rôles + 84 permissions, audit, RGPD (`GdprService`), SES interne | **QTSP FR = claim faux** ; déclaration voyageurs absente |
| 13 | IA & automatisation | **2** | Assistant multi-provider, RAG pgvector 2-stage, 27 tools, mémoire | Détection d'anomalies absente ; vision minimale ; IA non tissée aux ops |

> **Score interne pondéré provisoire** (avant benchmark) ≈ **2,4 / 3**. À recalculer en Phase 2 à la fonctionnalité près.

---

## 8. Écarts « marketing vs code » à retenir (transparence)

| Claim pitch (23 mai 2026) | Réalité code | Verdict |
|----------------------------|--------------|---------|
| « Channel Manager via Channex (M2-M3, à venir) » | Channex **déjà implémenté & mature** | ✅ Meilleur que le pitch |
| « 4 QTSP FR (Yousign/Universign/DocaPoste) + DocuSign + eIDAS » | Seul **CLENZY_CUSTOM (SES)** actif ; DocuSeal non branché ; QTSP = enums | ❌ **Faux** |
| « SMS Twilio + WhatsApp » | **SMS absent** ; WhatsApp Meta+OpenWA OK | ⚠️ Partiel |
| « Réponses IA / suggestions » | **Absent** (sentiment analysis seul) | ❌ |
| « OTAs MENA Almosafer/Cleartrip/Hala (stubs activables) » | **Enums sans adapter** | ❌ |
| « 5 rails paiement (dont PayPal) » | 4 rails (**PayPal retiré**) | ⚠️ |
| « Pennylane/Odoo/QuickBooks/Xero » | Pennylane complet ; QB/Xero/Sage OAuth sans sync ; **Odoo absent** | ⚠️ Partiel |
| « Vérification d'identité + caution (livret) » | KYC non branché ; **caution absente** | ❌ |
| « Forecast dispo/CA » | **Absent** | ❌ |
| « Multi-langue FR/EN/AR + RTL (booking) » | FR/EN ; **AR/RTL absent** | ⚠️ |
| « PriceEngine 6 niveaux » | **8 niveaux** | ✅ Meilleur |
| « App mobile 67 écrans » | **85 écrans** | ✅ Meilleur |
| « 39 €/bien/mois » | Code = **30 €/org + 10 €/siège** | ⚠️ Commercial |

---

## 9. Lotissement Phase 1 — déploiement des sous-agents

**10 agents « domaine » + 3 agents transverses = 13 sous-agents en parallèle.**
Chacun reçoit : périmètre, taxonomie, grille 0–3, panel d'acteurs, format de rapport imposé. Livrables : `benchmark/<lot>.md` + `inventaire/<domaine>.md` + `data/<lot>.csv`.

| Lot | Domaines | Périmètre benchmark |
|-----|----------|---------------------|
| **B1** | 1 | Channel Management |
| **B2** | 2 + 3 | Booking engine/site direct + Calendrier/multi-tenant |
| **B3** | 4 | Tarification / Yield |
| **B4** | 5 + 11 | Opérations ménage/maintenance + App mobile terrain |
| **B5** | 6 | Communication voyageurs |
| **B6** | 7 | Guest Experience & Livret (réutilise benchmark existant) |
| **B7** | 8 | Finance & Compta |
| **B8** | 9 | Reporting & Analytics / BI |
| **B9** | 10 + 12 | Intégrations/API/IoT + Admin/sécurité/conformité |
| **B10** | 13 | IA & automatisation |
| **T1** | — | Marché, tendances STR, réglementation FR/CH/UE |
| **T2** | — | Sociétés de service (conciergeries) — axe 2 |
| **T3** | — | Pricing & business model des PMS |

---

## 10. Garde-fous (rappel)

1. Vérité terrain depuis le code (statut + preuve).
2. Veille datée + sourcée + niveau de confiance.
3. Pas d'invention (« non documenté » si introuvable).
4. Même taxonomie + même grille partout (comparabilité).
5. Reformuler, ne pas recopier les sources (PI).
6. Livrables en **français**.
