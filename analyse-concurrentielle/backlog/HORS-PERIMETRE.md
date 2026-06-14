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
- **Effort estimé** : revue S · RTL PMS L · **Statut** : `Ouvert`

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
