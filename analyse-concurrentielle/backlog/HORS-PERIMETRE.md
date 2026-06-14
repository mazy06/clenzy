# Registre des écarts hors-périmètre (parking lot)

> Items volontairement **écartés** d'un incrément pour rester chirurgical, mais à ne pas perdre.
> **Process** : à la **fin de chaque phase**, on repasse ce fichier et on tranche chaque item
> ouvert → `À traiter` (intégré à la phase suivante) / `Reporté` (rester ici) / `Abandonné` (raison).
> Alimenté au fil de l'eau pendant l'exécution. Référence : `42-objectifs-techniques.md`, `30-roadmap.md`.

## Légende statut
`Ouvert` (en attente de revue) · `À traiter` (planifié) · `Fait` · `Reporté` · `Abandonné`

---

## Phase 0

### HP-01 — `getBlockedDays` : validation par-propertyId du lot
- **Source** : CLZ-P0-02 (isolation multi-tenant calendrier)
- **Description** : `CalendarController.getBlockedDays(List<Long> propertyIds, ...)` accepte une liste d'IDs fournie par le client sans valider chacun individuellement contre l'org du tenant.
- **Risque résiduel** : **Faible.** La requête sous-jacente `getBlockedOrMaintenanceDays(propertyIds, ..., orgId)` est **déjà filtrée par `orgId`** → un ID d'une autre org ne renvoie rien (pas de fuite de données). L'écart est de la défense en profondeur (rejet explicite vs résultat vide).
- **Effort estimé** : S · **Statut** : `Fait` (2026-06-14 : boucle `validatePropertyAccess` par propertyId dans `getBlockedDays`)

### HP-02 — `OwnerPortalController` : ownership de `ownerId`
- **Source** : CLZ-P0-02
- **Description** : `getDashboard(ownerId)` / `getStatement(ownerId)` prennent `ownerId` en path sans vérifier que le propriétaire appartient à l'org du tenant.
- **Risque résiduel (corrigé)** : **Réel IDOR sur `getDashboard`** — `findByOwnerId(ownerId)` n'était PAS org-filtré (un ownerId d'une autre org exposait ses biens). `getStatement` était déjà org-scopé.
- **Effort estimé** : S · **Statut** : `Fait` (2026-06-14 : `getDashboard` filtre désormais les biens par `orgId`)

---

### HP-03 — Reste de CLZ-P0-11 (emails réservation)
- **Source** : CLZ-P0-11 (incrément cœur = email de confirmation, chemin payé, livré)
- **Description** : sous-tâches du ticket non incluses dans l'incrément cœur :
  1. Email de confirmation sur le **chemin auto-confirm sans paiement** (`PublicBookingService.reserve()` branche `autoConfirm` + `collectPaymentOnBooking=false`).
  2. **Rappels** pré-séjour (J-7, J-1) + pré-arrivée avec lien livret (scheduler basé sur `property.getTimezone()`).
  3. Entité **`BookingEmailTemplate`** éditable par l'org + migration `0241__create_booking_email_template.sql` (actuellement contenu en dur dans le composer).
  4. **Opt-in/opt-out** guest des emails.
  5. **Arabe (AR) + rendu RTL** des templates (aujourd'hui FR/EN).
- **Risque résiduel** : **Moyen.** L'email de confirmation fonctionne pour le flux dominant (booking avec paiement). Les bookings gratuits/auto-confirmés n'envoient pas encore d'email ; pas de rappels.
- **Effort estimé** : 1 = S (chemin auto-confirm) · 2-5 = M chacun · **Statut** : HP-03.1 (auto-confirm) `Fait` (2026-06-14) · HP-03.2-5 (rappels, template éditable, opt-out, AR/RTL) `Reporté` (AR/RTL → chantier i18n Phase 1 ; rappels → plus tard)

### HP-04 — 2FA : realm Keycloak + wiring sécurité
- **Source** : CLZ-P0-09 (partie applicative livrée : `Organization.mfaRequired` + `MfaPolicyEvaluator` + tests)
- **Description** : enrôlement TOTP + claims `acr/amr` (realm `clenzy-infra`) et câblage de l'enforcement dans la chaîne de sécurité (`SecurityConfigProd`, double-gardé anti-lockout).
- **Risque résiduel** : la 2FA n'est pas encore *appliquée* (evaluator prêt mais non câblé ; realm non configuré).
- **Effort estimé** : M · **Statut** : `À traiter (coordonné)` — handoff détaillé : `tech/2FA-handoff.md` (touche un autre repo + un fichier sensible → PR dédiée revue).

## Phase 1

### HP-05 — Adoption front du delta N/N-1 backend
- **Source** : CLZ-P0-13 (backend livré : `RevenueAnalyticsDto.comparison` calculé serveur)
- **Description** : basculer le front (`useAnalyticsEngine` / `TrendBadge`) pour consommer `comparison` (source unique opposable) au lieu de recalculer le delta côté client.
- **Risque résiduel** : **Faible.** Le backend est désormais autoritatif ; le front affiche encore son approximation jusqu'à la bascule. Pas de double-source bloquante.
- **Effort estimé** : S (front, `tsc`) · **Statut** : `Ouvert`

### HP-06 — Reste de CLZ-P0-10 (édition groupée calendrier)
- **Source** : CLZ-P0-10 (backend livré : `BulkCalendarService` + `BulkCalendarController`, BLOCK/UNBLOCK/PRICE)
- **Description** : (1) **front** : étendre `usePlanningSelection` (multi-select marquee/cases) + prévisualisation d'impact + appel de l'endpoint bulk ; (2) **min-stay/restrictions** en masse (via `RestrictionEngine`, non couvert par le bulk actuel) ; (3) RTL-aware de la sélection.
- **Risque résiduel** : **Faible.** Le bulk backend fonctionne (par bien, tolérant) ; il manque l'UX multi-select et les restrictions en masse.
- **Effort estimé** : front M (tsc) · min-stay M · **Statut** : `Ouvert`

### HP-07 — RTL/arabe : revue native + rendu DOM
- **Source** : CLZ-P0-12 (SDK : pack fr/en/ar + `getDirection`/`t`/formatters livrés)
- **Description** : (1) **revue native** des chaînes arabes du SDK (`booking-sdk/src/i18n.ts`) par un locuteur ; (2) **rendu RTL DOM/CSS** (`dir=rtl`, logical properties) chez les consommateurs — le SDK est headless, il fournit le signal de direction mais pas le rendu : à appliquer dans le **PMS web (React/MUI)** et toute UI booking. C'est le chantier i18n/RTL large (au-delà du SDK).
- **Risque résiduel** : **Moyen** pour le lancement MA/KSA (l'arabe doit être rendu RTL bout-en-bout dans les UIs).
- **Effort estimé** : revue S · RTL PMS L · **Statut** : `À traiter (Phase 2)` — RTL/arabe est cœur du lancement MA puis KSA.

### HP-08 — Reste de CLZ-P0-19 (Factur-X FR)
- **Source** : CLZ-P0-19 (livré : `FrancePdpProvider` + `FacturXCiiBuilder` XML CII + `PdpTransmissionClient` non-configuré→PENDING)
- **Description** : (1) **embarquement PDF/A-3** du XML CII dans le PDF de facture (iText) ; (2) **client PDP réel** (partenaire agréé) marqué `@Primary` + persistance du cycle de vie ; (3) **conformité EN 16931 stricte** (champs/ordre obligatoires complets) + validation par un validateur officiel ; (4) **branchement** dans le flux de génération de facture (après-commit, via `EInvoicingService`).
- **Risque résiduel** : **Moyen** (échéance e-invoicing FR 09/2026 réception). Le XML est généré mais non transmis ni embarqué.
- **Effort estimé** : L · **Statut** : `Ouvert`

### HP-09 — Reste de CLZ-P0-15 (report builder)
- **Source** : CLZ-P0-15 (livré : entité `ReportView` + whitelist `ReportFieldCatalog` + CRUD `ReportViewService` + controller)
- **Description** : (1) **exécution** des agrégations (`ReportQueryService` : traduire dimensions/métriques whitelistées en agrégation SQL paramétrée sur réservations, métriques monétaires consolidées via `CurrencyConverterService` P0-14) ; (2) **share-link** public borné/révocable (pattern `/guide/:token`) ; (3) **front** module `report-builder` (sélection dimensions/métriques, colonnes réordonnables, sauvegarde de vue).
- **Risque résiduel** : **Faible.** Le modèle + la whitelist anti-injection + le CRUD org-scopé sont livrés ; reste l'exécution et l'UI.
- **Effort estimé** : exécution M · share-link S · front L · **Statut** : `Ouvert`

### HP-10 — Reste de CLZ-P0-20 (ZATCA KSA) : crypto + API Fatoora
- **Source** : CLZ-P0-20 (livré : `ZatcaProvider` + `ZatcaUblMapper` UBL 2.1 + `ZatcaQrTlvEncoder` TLV tags 1-5 + `ZatcaApiClient` non-configuré→PENDING)
- **Description** : sous-tâches crypto/réseau non vérifiables en repo seul (nécessitent onboarding ZATCA réel) :
  1. **Onboarding CSID** : génération CSR, obtention du Compliance/Production CSID via l'API d'onboarding (sandbox puis prod).
  2. **Signature XAdES** de l'UBL (clé du CSID) + **hash de facture** + insertion `UBLExtensions`.
  3. **Chaîne PIH/ICV** : Previous Invoice Hash + Invoice Counter Value persistés et chaînés par dispositif/séquence.
  4. **QR complet tags 6-9** (hash facture, signature ECDSA, clé publique, signature cachet) — l'encoder actuel ne fait que les tags 1-5 (B2C simplifié sans crypto).
  5. **Client API réel** (`@Primary`) : `clearance` (B2B, synchrone, &lt; immédiat) + `reporting` (B2C, &lt; 24h) Fatoora + persistance du cycle de vie dans `EInvoiceSubmission`.
  6. **Branchement** dans le flux de génération de facture (après-commit, via `EInvoicingService`, comme HP-08 côté FR).
- **Risque résiduel** : **Moyen** pour le lancement KSA (conformité ZATCA obligatoire B2B/B2C). L'UBL + le QR simplifié sont générés mais **non signés ni transmis** → non conformes en l'état pour une émission réelle. Aucun effet runtime tant que `UnconfiguredZatcaApiClient` reste actif (→ PENDING).
- **Référence** : `tech/ZATCA-implementation-spec.md` (spec détaillée crypto/CSID/PIH/QR).
- **Effort estimé** : L (crypto XAdES + onboarding + chaîne PIH) · **Statut** : `À traiter (Phase 3)` — cœur conformité KSA (avec CLZ-P0-21/22/23).

### HP-11 — Reste de CLZ-P0-18 (taxes par pays dans la simulation)
- **Source** : CLZ-P0-18 (livré : `PriceSimulationService` orchestrant `PriceEngine` → TVA + taxe de séjour via `FiscalEngine` → `PriceBreakdownDto` ; endpoint `POST /api/pricing/simulate` ; tests 5/5 + ArchUnit)
- **Description** : sous-tâches non incluses dans le cœur calcul :
  1. **Front** : afficher la ventilation HT / TVA / taxe de séjour / TTC dans la simulation/devis (et badge « affichage TTC » selon le marché FR/MA/KSA) ; pivot cible-TTC ↔ pilotage-HT.
  2. **Sourcing du taux de taxe de séjour** : aujourd'hui passé en paramètre de requête (taux communal FR / % KSA non modélisés). Persister le taux par commune/bien (`FiscalProfile`/`Property`) pour ne plus dépendre du client.
  3. **Branchement dans le flux de devis réel** (`PublicBookingService` / devis de réservation) : la simulation est pour l'instant un endpoint autonome ; brancher le TTC dans le parcours de réservation et la facture.
- **Risque résiduel** : **Faible.** Le calcul serveur (recalc HT + TVA + taxe de séjour par pays) est livré et testé ; il manque l'exposition UI, le sourcing du taux communal et le câblage au devis de réservation.
- **Effort estimé** : front M · sourcing M · branchement S · **Statut** : `Ouvert`

### HP-12 — CLZ-P0-16 (productisation IA tarification) — bloc différé cohérent
- **Source** : CLZ-P0-17 (livré : modèle `PriceRecommendation` + `PriceRecommendationService` CAS + API CRUD/lifecycle + migration 0241). P0-16 = la couche au-dessus.
- **Description** : (1) **mode par org** `OFF/SHADOW/RECOMMEND/AUTO` (`Organization.pricingAiMode` + migration) ; (2) **job quotidien** de génération de recommandations via `TenantScopedExecutor` (contexte tenant hors HTTP) appelant `AnthropicChatProvider` **hors transaction** + cache, appelant `PriceRecommendationService.propose` ; (3) **intégration cascade `PriceEngine`** : lire la recommandation `ACCEPTED` comme niveau `AI_SUGGESTION` **sous** `RateOverride` (les deux chemins `resolvePrice` mono-date ET `resolvePriceRangeWithSource`) ; (4) **bornes AUTO** (min/max + cap de variation quotidien) ; (5) **dashboard d'acceptation** (front).
- **Risque résiduel** : **Faible** à ce stade (aucune reco générée → boucle dormante). **Décision de scope** : ne PAS toucher le `PriceEngine` (chemin chaud, audit-sensible) ni ajouter de colonne sans consommateur tant que le job de génération n'est pas livré — l'intégration cascade appartient au MÊME incrément que le job (sinon stub spéculatif, audit #14). L'appel LLM est externe (non vérifiable en repo seul).
- **Effort estimé** : L (job + cascade + bornes + UI) · **Statut** : `Ouvert`

### HP-13 — CLZ-P0-05 (routage unifié direct vs Channex par pays) — différé infra
- **Source** : évaluation channel (agent, 2026-06-14). `ChannelConnector`/`ChannelConnectorRegistry` existent (résolution par `ChannelName` uniquement) ; décision direct/Channex aujourd'hui binaire (mapping Channex présent = Channex), deux consumers Kafka autonomes (`clenzy-channel-sync`, `clenzy-channex-sync`) → risque de double-push.
- **Description** : couche de routage par bien+pays (FR → direct prioritaire ; MENA → Channex/CM régional) + préséance explicite anti double-push.
- **Risque résiduel** : **Moyen** (double-push possible aujourd'hui). La couche de routage demande une décision service-level + **test d'intégration Kafka/DB** → non vérifiable sans broker.
- **Effort estimé** : XL · **Statut** : `Ouvert`

### HP-14 — CLZ-P0-06 (sync temps réel dispo/prix Outbox/Kafka) — différé infra
- **Source** : évaluation channel. Consumers Kafka déjà implémentés (`ChannelSyncService`, `ChannexSyncService` sur topic `calendar.updates`) ; logique adapter (résolution prix/restrictions) unit-testable, mais la boucle Outbox → Kafka → consumers exige un **broker live** pour la vérif e2e.
- **Description** : généraliser retries/backoff + **DLT Kafka** sur tous les consumers, indicateur de fraîcheur par OTA, réduction du polling au profit des webhooks. Écritures en `property.getTimezone()` (audit #9).
- **Risque résiduel** : **Moyen.** Le cœur logique est testable ; l'e2e async est infra-dépendant.
- **Effort estimé** : M · **Statut** : `Ouvert`

### HP-15 — CLZ-P0-07 (pushRestrictions par adapter) — partiellement livré, reste OTA externe
- **Source** : évaluation channel. `ChannelConnector.pushRestrictions` **déjà déclaré** (défaut UNSUPPORTED) ; **Airbnb ET Booking l'implémentent déjà** avec tests mock (jour par jour : min/max stay, CTA/CTD). `BookingRestriction` complet (6 types) + `BookingRestrictionRepository.findApplicable`.
- **Description** : étendre `pushRestrictions` aux adapters restants (Expedia, Agoda, …) + OTAs MENA (Gathern…) + réconciliation périodique + alerte watchdog sur divergence.
- **Risque résiduel** : **Faible.** Les 2 canaux majeurs (Airbnb/Booking) sont couverts et testés ; les adapters restants exigent les **contrats API OTA réels** → code spéculatif non vérifiable sans sandbox (audit #14).
- **Effort estimé** : L (par adapter) · **Statut** : `Ouvert`

## Phase 2
_(à alimenter)_

## Phase 3
_(à alimenter)_

## Phase 4
_(à alimenter)_

---

## Journal des revues de fin de phase
| Date | Phase revue | Items traités | Items reportés | Items abandonnés |
|------|-------------|---------------|----------------|------------------|
| 2026-06-14 | Phase 0 | HP-01, HP-02, HP-03.1 (faits) ; HP-04 handoff produit | HP-03.2-5 (rappels/template/opt-out/AR-RTL) | — |
| 2026-06-14 | Phase 1 | HP-07 → promu **Phase 2** (RTL cœur MA/KSA) ; HP-10 → promu **Phase 3** (ZATCA crypto, cœur KSA) | HP-05, HP-06, HP-08, HP-09, HP-11, HP-12 (IA pricing), HP-13/HP-14/HP-15 (channel infra/OTA) — front/infra/externe non vérifiable en repo | — |
