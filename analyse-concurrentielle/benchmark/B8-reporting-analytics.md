# Benchmark B8 — Reporting & Analytics / BI

> Domaine 9 de l'analyse concurrentielle du PMS Clenzy.
> Cible : conciergeries / gestionnaires pro + propriétaires multi-biens, marché France.
> Concurrents : Hostaway, Guesty, Smoobu, Lodgify, Hospitable, Avantio, Smily.
> Grille 0–3. Clenzy noté via inventaire interne (code) ; concurrents via recherche web 2025-2026
> (datée, sourcée, niveau de confiance par ligne dans `data/09-reporting-analytics.csv`).
> Date : 2026-06-13.

---

## 1. Méthodologie & grille de notation

**Échelle 0–3 appliquée à chaque fonctionnalité :**

- **0** — Absent / non documenté
- **1** — Présent mais limité (basique, contournement, ou via API brute uniquement)
- **2** — Solide / standard du marché (natif et exploitable directement)
- **3** — Différenciateur : couverture avancée, personnalisable ou benchmark de marché intégré

**Sources Clenzy** : inventaire interne adossé au code (`inventaire/09-reporting-analytics.md`),
preuves fichier:ligne (`AiAnalyticsService`, `FiscalReportingService`, `AccountingExportService`,
`OwnerStatementService`, `modules/dashboard/*`, `modules/reports/*`).

**Sources concurrents** : pages produit officielles, centres d'aide / support, changelogs et
comparatifs sectoriels 2025-2026 (Hostaway support & features, Guesty features/help, Smoobu support,
Lodgify reporting, Hospitable help/metrics, Avantio + Key Data, Smily/BookingSync manual).

**Clivages structurants du domaine :**
1. **Report builder / dashboards personnalisables** — vues sauvegardables, colonnes/formules ad hoc,
   liens partageables (Hostaway, Guesty, Hospitable) vs. **rapports/onglets fixes** (Smoobu, Smily, Clenzy).
2. **Données marché / benchmark** — BI de comparaison concurrentielle (Key Data, Transparent, AirDNA)
   intégrée nativement (Avantio, Guesty, Lodgify, Hostaway) vs. **donnée interne seule** (Clenzy, Smoobu).
3. **IA décisionnelle** — Guesty Copilot (2026) au-dessus des insights IA classiques.

---

## 2. Panorama du marché (2025-2026)

Le reporting est devenu un terrain de bataille mature, plus différenciant qu'auparavant :

- **Le report builder est désormais standard chez les leaders.** Hostaway propose des « Custom Views »
  (filtres + ordre de colonnes sauvegardés, dates dynamiques « Last Month / YTD ») et un **Formula
  Wizard** ; Guesty laisse « build custom reports » + planification d'envoi ; Hospitable permet de
  **construire et sauvegarder des dashboards** (occupation, revenu, taxes, tâches) et de les transformer
  en **liens privés partageables** à un propriétaire/équipe (confiance 0.8). C'est le standard que
  Smoobu, Smily — et Clenzy — n'atteignent pas (rapports figés).

- **Les owner statements/portals sont une table d'enjeu B2B2C.** Hostaway (relevés brandés avec photos +
  KPIs), Guesty (relevés personnalisés + lien dynamique temps réel), Lodgify (relevés auto mensuels/
  trimestriels avec commissions/frais/net payout), Hospitable (portail white-label par propriétaire) et
  Avantio (Owner's Area) en font un argument central. Clenzy a un socle réel (`OwnerStatementService` +
  `owner-portal/`) mais moins « produit » (relevé email, pas de templates brandés documentés).

- **La donnée marché passe par des spécialistes BI.** Le marché ne construit pas son benchmark in-house :
  il **intègre Key Data Dashboard** (Avantio a annoncé un partenariat KDD en 2025 ; Lodgify expose une
  intégration Key Data) ou **Transparent/AirDNA**. C'est un connecteur, pas un moteur — mais Clenzy n'a
  ni l'un ni l'autre côté reporting (confiance 0.6).

- **IA décisionnelle 2026.** Guesty a lancé **Copilot** (avril 2026) : « real answers from your Guesty
  data », première brique d'« AI-driven decision intelligence » embarquée — un cran au-dessus des
  insights IA classiques (confiance 0.7). La tendance de fond annoncée par tout le secteur : passage du
  reporting descriptif au **prédictif** (forecast de demande locale, pacing) — mais peu de features
  productisées et fiables existent encore en 2025-2026.

- **Forecast : encore immature partout.** Personne ne livre un forecast CA/occupation ML « phare » sur ce
  panel. Hostaway met en avant des « income forecasts » dans son dashboard ; Guesty l'adresse via
  l'analytics IA ; les autres se rabattent sur le benchmark Key Data (descriptif) ou n'en ont pas. Clenzy
  a un forecast d'occupation **heuristique** (saison + week-end + historique ±21 j) — basique mais réel.

**Implication pour Clenzy** : les fondamentaux KPI + reporting fiscal/FEC sont au niveau, voire au-dessus
(FEC = quasi-unique). Le retard est concentré sur **(a) report builder / dashboards personnalisables**,
**(b) comparaison N/N-1 exposée**, **(c) données marché (Key Data/Transparent)** et **(d) maturité du
forecast**. Aucun de ces gaps n'exige un moteur propriétaire : 2 sur 4 sont du connecteur/UX.

---

## 3. Scores par acteur

| Acteur | Score moyen (0–3) | Lecture |
|---|:--:|---|
| **Guesty** | **2,6** | Report builder + Copilot IA (2026) + owner reports planifiés + Key Data ; référence du domaine |
| **Hostaway** | **2,3** | Custom Views + Formula Wizard, owner statements brandés, dashboard « tout-en-un » |
| **Hospitable** | **2,1** | Dashboards personnalisables sauvegardables + liens partageables, portail owner white-label |
| **Lodgify** | **2,1** | RevPAR/ADR natifs, owner statements auto, intégration Key Data ; cible petits hôtes |
| **Avantio** | **2,0** | Owner's Area + **partenariat Key Data** (benchmark marché), reporting standardisé |
| **Smily** | **1,8** | Performance Dashboard avec **comparaison N/N-1** native + exports multi-format ; pas de builder |
| **Clenzy** | **1,7** | Dashboards KPI + **reporting fiscal/FEC fort** ; manque builder, comps marché, BI, forecast mûr |
| **Smoobu** | **1,1** | Statistiques basiques (occupation/revenu/sources) + exports Excel/PDF/CSV ; « hub » entrée de gamme |

> Note : Clenzy noté sur l'état **prod**. L'insight IA (`getAiInsights`) est derrière le flag
> `analytics-ai` ; s'il était livré par défaut et la comparaison N/N-1 exposée, le score remonterait
> vers ~1,9–2,0.

---

## 4. Report builder & forecast (analyse clé demandée)

### 4.1 Qui a un report builder / dashboards personnalisables ?

| Acteur | Report builder / dashboards personnalisables | Nature | Confiance |
|---|:--:|---|---|
| **Guesty** | **Oui** | « Build custom reports » + analytics IA pour surfacer le pertinent + planification d'envoi | 0.8 |
| **Hostaway** | **Oui** | Custom Views (filtres + colonnes sauvegardés, dates dynamiques YTD) + **Formula Wizard** | 0.8 |
| **Hospitable** | **Oui** | Dashboards Metrics personnalisables, sauvegardables, filtres/groupings, **liens partageables** | 0.8 |
| **Lodgify** | Partiel | Rapports exportables par entité (revenu/paiements/occupation), pas de builder ad hoc complet | 0.6 |
| **Avantio** | Partiel | Reporting standardisé + BI Key Data ; pas de builder maison fort documenté | 0.5 |
| **Smily** | Partiel | Performance Dashboard à **vues personnalisables** (filtres période/biens/tags), pas de builder | 0.6 |
| **Smoobu** | **Non** | Statistiques fixes (occupation, revenu, sources) + exports ; pas de builder | 0.7 |
| **Clenzy** | **Non / Partiel** | `reports/Reports.tsx` = 4 onglets **fixes** + filtre période ; pas de vues sauvegardables | 0.8 (interne) |

**Lecture** : les 3 leaders (Guesty, Hostaway, Hospitable) ont franchi le cap du **report builder /
dashboards composables**. Clenzy est dans le tiers bas (rapports figés), au niveau de Smoobu, sous Smily
(qui a au moins des vues paramétrables). C'est le **gap UX n°1** du domaine.

### 4.2 Qui a un forecast (CA / occupation) ?

| Acteur | Forecast | Nature | Confiance |
|---|:--:|---|---|
| **Hostaway** | Partiel | « Income forecasts » annoncés dans le dashboard analytics | 0.5 |
| **Guesty** | Partiel | Adressé via analytics IA / Copilot (décision intelligence), pas un module forecast nommé | 0.5 |
| **Hospitable** | Partiel | Dashboards prospectifs (revenu/occupation à venir) via réservations confirmées | 0.5 |
| **Avantio** | Partiel | Projection surtout via benchmark Key Data (descriptif/comparatif) | 0.5 |
| **Lodgify** | Limité | Reporting descriptif + Key Data ; pas de forecast natif mis en avant | 0.5 |
| **Smily** | Limité | KPI + comparaison N/N-1 ; pas de forecast prédictif documenté | 0.5 |
| **Smoobu** | **Non** | Statistiques rétrospectives uniquement | 0.7 |
| **Clenzy** | **Basique (réel)** | `getForecast` : occupation 30 j, rule-based (saison + week-end + facteur historique ±21 j) + score de confiance | 0.7 (interne) |

**Lecture** : le forecast est **immature sur tout le panel** — personne ne livre un forecast ML « phare ».
Clenzy possède un forecast **d'occupation** fonctionnel mais limité (occupation seule, pas de projection de
CA, horizon fixe, heuristique méditerranéenne codée en dur). Paradoxalement, sa brique de forecast est
**plus explicite** que beaucoup de concurrents qui restent descriptifs — mais elle reste rudimentaire et
peu visible. L'inventaire de départ qui le classait « ABSENT » est inexact : c'est **1**, pas **0**.

---

## 5. Analyse fonctionnelle détaillée

### Dashboards & KPI (parité haute)
- Occupation, revenu, **ADR**, **RevPAR**, sources de réservation : Clenzy les calcule nativement
  (`AiAnalyticsService` `:108-116`), au niveau du marché. Guesty/Hostaway/Hospitable/Lodgify les
  exposent dans des dashboards plus riches (graphes, groupings). Parité fonctionnelle, écart sur la
  **richesse de visualisation et la personnalisation**.

### Reporting fiscal / FEC (avantage net Clenzy)
- `FiscalReportingService` (résumé TVA mensuel/trimestriel/annuel, multi-devise) + **export FEC DGFiP**
  (`AccountingExportService.exportFec`) : c'est un **différenciateur quasi-unique** sur ce panel
  international. Les concurrents US/EU n'ont pas le FEC ni la logique TVA française fine (Avantio/Smily,
  acteurs EU, peuvent s'en approcher — noté 1, à vérifier). Confiance 0.5-0.6.

### Owner reports / portail propriétaire (parité basse Clenzy)
- Tout le marché en fait un argument fort (Hostaway relevés brandés ; Guesty relevés planifiés + lien
  temps réel ; Hospitable portail white-label ; Lodgify relevés auto ; Avantio Owner's Area). Clenzy a
  le socle (`OwnerStatementService` email mensuel + `owner-portal/`) mais **moins produit** : pas de
  templates brandés/white-label documentés, planification limitée à la logique payout. Gap de finition.

### Comparaison N vs N-1 (gap d'exposition)
- **Smily** l'expose explicitement (« compare your indicators to similar periods from the previous
  year »), Guesty/Hospitable via leurs dashboards composables. Clenzy a la **donnée** historique en
  interne (facteur historique du forecast) mais **ne l'expose pas** : seul un sélecteur de période existe.
  Gap purement UX/affichage.

### Données marché / comparables (gap structurel)
- Le marché intègre **Key Data Dashboard** (Avantio = partenariat annoncé 2025 ; Lodgify = intégration ;
  Guesty/Hostaway exposent des market insights) ou Transparent/AirDNA. **Clenzy = 0** côté reporting
  (signaux marché éventuellement délégués à PriceLabs côté pricing, non surfacés en BI). Confiance 0.6.

### Intégration BI externe (gap commun)
- Quasi personne n'a un vrai connecteur Metabase/Tableau/Looker/Power BI natif sur ce panel ; l'API et
  les exports CSV servent de pont. Guesty pousse le plus loin (analytics avancées + API). Clenzy = 0
  (pas d'API analytics publique pour BI ; l'API `/api/ai/analytics` est interne). Faible différenciation
  car le marché y est globalement peu mature (notes 0-2).

### Exports (parité)
- CSV/Excel : universels (Smoobu Excel/PDF/CSV, Hospitable CSV, Smily multi-format, Lodgify PDF/sheet).
  Clenzy : CSV (réservations, payouts) + PDF (iText) + FEC + SEPA XML — large couverture, **Excel natif
  non confirmé** (CSV ouvrable dans Excel). Parité.

### Insights IA
- Guesty (Copilot 2026) devant ; Clenzy a `getAiInsights` (LLM Anthropic, anonymisation, budget tokens)
  mais **derrière flag `analytics-ai`** → non livré par défaut. Hostaway/Lodgify/Avantio/Hospitable :
  IA plutôt orientée pricing/messaging que reporting. Parité potentielle si Clenzy livre l'insight IA.

---

## 6. Forces, gaps et parités de Clenzy

### Top 3 avantages de Clenzy
1. **Reporting fiscal + export FEC (DGFiP)** — `FiscalReportingService` (TVA multi-devise mensuel/
   trimestriel/annuel) + `AccountingExportService.exportFec`. **Différenciateur quasi-unique** sur le
   panel : aucun concurrent international ne produit un FEC conforme norme France. Couplé à la conformité
   NF (domaine 8), c'est un bunker réglementaire FR.
2. **Forecast d'occupation natif (même basique)** — `getForecast` (saison + week-end + facteur historique
   + confiance). Plus **explicite** que beaucoup de concurrents restés descriptifs ; brique réutilisable
   pour une vraie feature forecast.
3. **Socle owner reporting orienté conciergerie** — `OwnerStatementService` (relevé mensuel auto) +
   `owner-portal/` + couplage `OwnerPayout`/`CommissionInvoiceService`. Aligné B2B2C, à finir côté produit.

### Top 3 gaps de Clenzy
1. **Pas de report builder / dashboards personnalisables** — gap UX n°1. Les 3 leaders ont des vues
   sauvegardables, colonnes/formules ad hoc et liens partageables ; Clenzy a des onglets figés.
2. **Pas de données marché / comparables (Key Data, Transparent, AirDNA)** — gap structurel. Le marché
   intègre KDD nativement (Avantio, Lodgify) ; Clenzy n'a aucun benchmark concurrentiel en reporting.
3. **Comparaison N vs N-1 non exposée + forecast incomplet (CA absent)** — la donnée existe mais n'est ni
   affichée (delta période) ni complète (forecast = occupation seule, pas de CA projeté).

### Parités acquises
- **KPI cœur** (occupation, revenu, **ADR**, **RevPAR**, sources) au niveau du marché.
- **Exports** (CSV / PDF) larges (et FEC/SEPA en plus).
- **Owner statements** présents (socle), **insight IA** présent (mais flag OFF).

---

## 7. Initiatives recommandées

Format : `Titre | Type | Impact (1-3) | Effort (S/M/L) | Reach (1-3) | Confiance (0.1-1.0)`

1. **Exposer la comparaison N vs N-1 dans dashboards & rapports** | Parité | 2 | S | 3 | 0.8
   *La donnée historique existe (`calculateHistoricalFactor`, reservations N-1). Ajouter delta % + courbe
   période vs période précédente dans `DashboardOverview`/`Reports`. Effort S (UX + une requête N-1),
   reach 3 (chaque utilisateur), comble un gap pur d'affichage que même Smily/Guesty offrent.*

2. **Report builder léger : vues sauvegardables + liens partageables** | Parité+ | 3 | M | 2 | 0.7
   *Permettre de sauvegarder des vues (filtres période/bien/canal + colonnes) et de générer un lien
   partageable (à la Hospitable). Comble le gap UX n°1 vs les 3 leaders. Effort M (persistance vues +
   tokens de partage org-scopés), reach 2 (managers/conciergeries surtout).*

3. **Compléter le forecast : projection de CA + horizon paramétrable** | Différenciation | 2 | M | 2 | 0.6
   *Étendre `getForecast` de l'occupation au **CA projeté** (occupation × ADR résolu via PriceEngine) et
   rendre l'horizon configurable. Capitalise sur une brique déjà unique ; positionne Clenzy sur le
   prédictif que tout le secteur annonce. Effort M, confiance 0.6 (fiabilisation modèle).*

4. **Livrer l'insight IA de reporting (lever le flag `analytics-ai`)** | Parité | 2 | S | 2 | 0.7
   *`getAiInsights` est déjà implémenté (LLM Anthropic, anonymisation, budget tokens, circuit breaker).
   L'activer en mode encadré rapproche Clenzy de Guesty Copilot/Hostaway. Effort S (conf + garde-fous +
   UI), reach 2. Quasi gratuit en code.*

5. **Connecteur données marché via Key Data Dashboard (ou Transparent)** | Différenciation | 2 | L | 2 | 0.5
   *Intégrer Key Data (pattern partenariat Avantio 2025) pour surfacer un benchmark concurrentiel
   local/régional dans le reporting. Comble le gap comps sans bâtir un moteur de données. Effort L
   (partenariat + intégration + UI), confiance 0.5 (dépend de l'accès KDD/Transparent).*

---

## Sources principales (2025-2026)

- Hostaway — Analytics & Reporting, Owner Statements, Custom Views, Formula Wizard, Financial Reporting :
  hostaway.com/features/analytics-and-reporting, support.hostaway.com (Owner Statements, Filters and
  Custom Views, Formula Wizard, Expenses & Extras), changelog.hostaway.com
- Guesty — Reporting & Analytics, Analytics/Insights, Advanced Analytics, **Copilot** (avril 2026),
  owner reports planifiés : guesty.com/features/reporting-tools, guesty.com/features/analytics,
  help.guesty.com (Advanced Analytics Overview), guesty.com/blog/guesty-copilot
- Smoobu — Integrated Statistics, exports Excel/PDF/CSV, API occupancy reports : smoobu.com/en/guides/statistics,
  support.smoobu.com (Download bookings list), comparatifchannelmanager.fr (Smoobu API)
- Lodgify — Reporting tools (occupancy/ADR/RevPAR/channel mix), Owner Statements auto, intégration Key Data :
  lodgify.com/reporting, lodgify.com/owner-statements, lodgify.com/accounting, keydatadashboard.com/lodgify
- Hospitable — Metrics dashboards personnalisables + liens partageables, exports CSV, Owner Portal & Statements
  white-label : hospitable.com/features/analytics-and-reporting, help.hospitable.com (Dashboards in Metrics,
  Metrics Walkthrough, Exports), hospitable.com/features/owner-portal-statements
- Avantio — Owner's Area, **partenariat Key Data Dashboard** (BI benchmark, 2025), reporting transparent :
  avantio.com/blog/owner-transparency, avantio.com/blog/business-intelligence-for-vacation-rentals,
  keydatadashboard.com/blog/avantio-announces-partnership-with-key-data-dashboard
- Smily (ex-BookingSync) — Performance Dashboard (vues personnalisables + **comparaison N/N-1**), exports
  multi-format : manual.bookingsync.com (Performance Dashboard tab, Exports, Tracking and Analytics),
  softwareworld.co (Smily reviews 2025)
- Tendances marché / forecast / IA : Hostaway blog (pricing factors, Summer 2025 report), StayFi/Rentals
  United (vacation rental statistics 2026), Key Data Dashboard
