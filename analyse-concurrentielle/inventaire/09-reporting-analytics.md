# Inventaire interne — Domaine 9 : Reporting & Analytics / BI

> Vérité terrain adossée au code Clenzy (statut + preuve fichier).
> Grille 0–3. Score par fonctionnalité justifié par preuve code (fichier:ligne).
> Date : 2026-06-13.

---

## 1. Périmètre du domaine

Pilotage de l'activité du gestionnaire/conciergerie et de ses propriétaires :
dashboards KPI temps réel, indicateurs de revenu/occupation (RevPAR, ADR), performance
par canal OTA, reporting par propriétaire (owner reports/statements), reporting fiscal,
exports (PDF / CSV / Excel / FEC), comparaisons périodiques (N vs N-1), prévisions
(forecast CA / occupation), données marché / comparables, intégration BI externe
(Metabase/Tableau/Looker/Power BI), API analytics et générateur de rapports personnalisés
(report builder).

---

## 2. Cartographie du code — ce qui existe réellement

### 2.1 Dashboards KPI temps réel — **Score 2**

- Module front `client/src/modules/dashboard/` : `DashboardOverview.tsx`, `DashboardCharts.tsx`,
  `DashboardPlanning.tsx`, `DashboardStatsCards.tsx`, `ChannelHealthWidget.tsx`,
  `DashboardRecentActivities.tsx`, `DashboardAnalyticsContent.tsx`, `DashboardDateFilter.tsx`.
- KPIs financiers adaptés par rôle (admin / manager / host) : occupation, revenu, ADR, RevPAR
  (`DashboardOverview.tsx:210-211, 349-354` ; libellé code `occupancyRate`).
- Hooks dédiés : `useDashboardOverview.ts`, `useDashboardStats.ts`, `useDashboardData.tsx`,
  `useDashboardPlanning.ts`, `useDashboardReady.ts` ; config `config/dashboardConfig.ts`,
  types `types/dashboard.ts`.
- Santé des canaux (`ChannelHealthWidget.tsx`) = monitoring de la synchro OTA dans le dashboard.
- **Réserve** : dashboards fixes (cartes KPI + quelques graphes), pas de tableaux de bord
  personnalisables/sauvegardables par l'utilisateur (pas de drag-drop de widgets, pas de vues
  enregistrées). Filtre de période présent (`DashboardDateFilter.tsx`) mais sans comparaison N/N-1 rendue.

### 2.2 Revenu / occupation / ADR / RevPAR — **Score 2**

- `server/.../service/AiAnalyticsService.java` calcule, par propriété et période :
  occupancy rate, total revenue, **ADR** (`adr`, `:108-110`), **RevPAR** (`revPar`, `:111`),
  ventilation occupancy/revenu par mois (`:114-115`) et **bookings par source/OTA**
  (`calculateBookingsBySource`, `:116, 246-252`).
- DTO `dto/RevenueAnalyticsDto.java` (occupancyRate, ADR, RevPAR, occupancyByMonth,
  revenueByMonth, bookingsBySource, forecast).
- Exposé via `controller/AiAnalyticsController.java` → `GET /api/ai/analytics/{propertyId}`
  (`@PreAuthorize("isAuthenticated()")`, org-scopé via `TenantContext`).
- Performance par OTA = `bookingsBySource` (répartition par canal) — présent mais limité au
  comptage par source, pas de matrice complète revenu/marge par canal.

### 2.3 Reporting par propriétaire (owner reports) — **Score 2 (sous-estimé par l'inventaire de départ)**

- `service/OwnerStatementService.java` : relevé de reversement mensuel par propriétaire (email
  HTML auto-portant, commentaire code : « différenciateur clé pour les conciergeries »).
- `service/OwnerPortalService.java` + `controller/OwnerPortalController.java` : portail
  propriétaire dédié ; DTOs `OwnerDashboardDto`, `OwnerStatementDto`, `OwnerPropertySummaryDto`,
  `OwnerPayoutDto`.
- Front `client/src/modules/owner-portal/OwnerPortalPage.tsx`, hooks `useOwnerPortal.ts`,
  `useOwnerPayoutConfig.ts`, API `services/api/ownerPortalApi.ts`.
- Couplé à `OwnerPayout` / `CommissionInvoiceService` (cf. domaine 8 Finance).
- **Réserve** : relevé envoyé par email (pas de PDF brandé téléchargeable documenté) ; pas de
  templates de relevé personnalisables/white-label ; pas de planification (schedule) auto documentée
  hors logique payout.

### 2.4 Reporting fiscal — **Score 3**

- `service/FiscalReportingService.java` : résumé TVA par période (mensuel / trimestriel / annuel),
  ventilation par taux + catégorie, **consolidation multi-devises** vers la devise de base
  (`getVatSummary`, `getMonthlyVatSummary`, `getQuarterlyVatSummary`, `getAnnualVatSummary`).
- `controller/FiscalReportingController.java`, DTO `VatSummaryDto`.
- Couplé au socle fiscal (`fiscal/FiscalEngine.java`, `FiscalProfile`, calculateurs FR/MA/KSA) —
  cf. domaine 8. C'est un point fort structurel (conformité NF + FEC).

### 2.5 Exports — **Score 3**

- `service/AccountingExportService.java` :
  - **FEC** (Fichier des Écritures Comptables, norme DGFiP France) — `exportFec` (`:115`),
    séparateur tab, header DGFiP (`:122-123`).
  - **CSV** réservations — `exportReservationsCsv` (`:176`).
  - **CSV** reversements propriétaires — `exportPayoutsCsv` (`:206`).
  - **SEPA XML** (virements) — `generateSepaXml` (`:74`).
  - `controller/AccountingExportController.java`.
- **PDF** (iText) : `service/ReportService.java` génère 4 familles de rapports (financier,
  interventions, équipes, propriétés) avec en-tête/pied de page brandés (`PdfTemplateHelper`).
- **Réserve** : le PDF `ReportService` est adossé aux **interventions** (revenu = `estimatedCost`
  d'interventions, pas le CA réservations) — orienté opérations/prestation, pas un P&L réservations.

### 2.6 Insights IA (`AiAnalyticsService`) — **Score 2 (partiel, flag-gated)**

- `getAiInsights` (`AiAnalyticsService.java:336-374`) : envoie les analytics à un LLM (Anthropic)
  via `AiProviderRouter`, anonymisation (`AiAnonymizationService`), budget tokens
  (`AiTokenBudgetService`), circuit breaker + retry, prompts `AiAnalyticsPrompts`.
- **Gate** : `aiProperties.getFeatures().isAnalyticsAi()` — lève `AiNotConfiguredException` si
  `clenzy.ai.features.analytics-ai=false` (`:338-341`). Donc **non livré par défaut** (dépend
  de la conf org + clé). Le DTO de sortie `AiInsightDto` est structuré (insights JSON).

### 2.7 Forecast CA / occupation — **Score 1 (présent mais heuristique, pas « absent »)**

> Correction de l'inventaire de départ : un forecast existe bel et bien, mais rudimentaire.

- `AiAnalyticsService.getForecast` (`:131-141`) + `forecastForDate` (`:146-173`) : prévision
  d'**occupation** jour par jour sur **30 jours** après la période (`getAnalytics` appelle
  `forecast = getForecast(... to.plusDays(30) ...)`, `:118-119`).
- Modèle **rule-based** : occupation de base par saison (`SEASON_BASE_OCCUPANCY` HIGH/MID/LOW),
  facteur week-end (`getDayTypeFactor`), **facteur historique** (fenêtre ±21 j de l'an passé,
  `calculateHistoricalFactor :280-297`), score de **confiance** (`calculateForecastConfidence`).
- Limites : **occupation uniquement** (pas de forecast CA / revenu projeté), horizon fixe 30 j,
  heuristique saisonnière codée en dur (marché méditerranéen), pas de ML, pas de pacing/pickup.
- → Noté **1** (basique) plutôt que 0. La projection de revenu et un horizon paramétrable manquent.

### 2.8 Comparaison N vs N-1 — **Score 1 (partiel)**

- Sélecteur de période présent : `dashboard/DashboardDateFilter.tsx`, `reports/PeriodSegmented.tsx`
  (7j / 30j / 90j / 1 an), `useTabKeyParam`.
- Le `calculateHistoricalFactor` du forecast regarde l'an passé, mais **aucun rendu UI** de
  comparaison période vs période précédente (pas de delta %, pas de courbe N vs N-1) n'a été trouvé
  (grep `previousPeriod|comparison|delta|évolution` sans hit dans dashboard/reports).
- → **1** : la donnée historique existe en interne, mais la comparaison N/N-1 n'est pas exposée.

### 2.9 Intégration BI externe (Metabase / Tableau / Looker / Power BI) — **Score 0**

- Aucune trace de connecteur BI, d'entrepôt de données, d'export programmatique vers un outil BI,
  ni de data API documentée pour BI. **Absent**.

### 2.10 Données marché / comparables (comps) — **Score 0**

- Pas de connecteur Key Data / Transparent / AirDNA ni de benchmark de marché natif.
  Les signaux marché seraient délégués à PriceLabs (cf. domaine 4 Pricing), pas surfacés en reporting. **Absent**.

### 2.11 Report builder (générateur de rapports personnalisés) — **Score 0/1**

- `reports/Reports.tsx` : 4 onglets **fixes** (financier, interventions, équipes, propriétés),
  permission `reports:view`, filtre de période. Pas de construction de rapport ad hoc (choix de
  colonnes, formules, vues sauvegardées). → proche de **0**, noté **1** car les rapports paramétrables
  par période/type existent.

### 2.12 API analytics — **Score 2**

- `GET /api/ai/analytics/{propertyId}` (analytics complets) + `/ai-insights` (LLM). Authentifié,
  org-scopé. Pas d'API publique « analytics » documentée pour consommation tierce/BI (≠ API interne).

---

## 3. Synthèse score interne du domaine

| Fonctionnalité | Score | Preuve |
|---|:--:|---|
| Dashboards KPI temps réel | 2 | `modules/dashboard/*` |
| Revenu / occupation / ADR / RevPAR | 2 | `AiAnalyticsService` `:108-116`, `RevenueAnalyticsDto` |
| Performance par canal OTA | 2 | `calculateBookingsBySource :246-252` |
| Reporting propriétaire (owner reports) | 2 | `OwnerStatementService`, `OwnerPortalService` |
| Reporting fiscal (TVA multi-devise) | 3 | `FiscalReportingService` |
| Exports PDF | 2 | `ReportService` (iText) |
| Exports CSV / Excel | 2 | `AccountingExportService` (CSV ; Excel non natif) |
| Export FEC (DGFiP) | 3 | `AccountingExportService.exportFec :115` |
| Insights IA | 2 | `AiAnalyticsService.getAiInsights` (flag `analytics-ai`) |
| Forecast CA / occupation | 1 | `getForecast :131` (occupation, heuristique, 30 j) |
| Comparaison N vs N-1 | 1 | sélecteur de période seul, pas de delta UI |
| Données marché / comps | 0 | absent |
| Intégration BI externe | 0 | absent |
| Report builder | 1 | onglets fixes, pas de builder |
| API analytics | 2 | `/api/ai/analytics/*` (interne) |

**Score moyen interne (non pondéré)** ≈ **1,7 / 3**.

> Le score « 2 » du cadrage Phase 0 reste défendable au niveau domaine (dashboards + fiscal/FEC
> solides), mais la moyenne fonctionnelle fine ressort plutôt à **1,7** : les fondamentaux KPI sont
> là, les manques sont concentrés sur forecast, comparaison N/N-1, comps marché, BI et report builder.

---

## 4. Écarts « inventaire de départ vs code » relevés

| Affirmation inventaire | Réalité code | Verdict |
|---|---|---|
| « Forecast CA/occupancy = ABSENT » | `getForecast` produit un forecast **d'occupation** 30 j (rule-based + facteur historique) | ⚠️ Inexact : présent mais **basique** (occupation seule, pas CA) → score 1, pas 0 |
| « Reporting propriétaire (`ReportDetails`) » | `ReportDetails.tsx` = rapports internes (financier/interventions/équipes/propriétés). Le **vrai** owner reporting est `OwnerStatementService` + `owner-portal/` | ✅ Owner reporting plus riche que cité |
| « Comparaison N vs N-1 = partielle (UI period selector) » | Confirmé : sélecteur de période, **pas** de comparaison N/N-1 rendue | ✅ Exact |
| « Pas d'intégration BI » | Confirmé (aucun connecteur Metabase/Tableau/Looker) | ✅ Exact |
| « Insights IA implémenté/partiel » | Confirmé : `getAiInsights` derrière flag `analytics-ai` (non livré par défaut) | ✅ Exact |
