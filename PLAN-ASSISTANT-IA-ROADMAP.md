# Plan d'implémentation — Assistant IA / Superviseur multi-agent (feuille de route produit complète)

> Objectif : faire passer l'assistant multi-agent d'un niveau **descriptif** (il liste)
> à **prédictif/prescriptif** (il anticipe et recommande), sur tous les modules, pour
> en faire le produit le plus complet possible. Couvre les 14 suggestions de l'analyse
> + les fondations transverses.
>
> Source d'analyse : cartographie des 8 specialists / 45 tools (voir aussi
> [PLAN-SUPERVISEUR-DONNEES-REELLES.md](PLAN-SUPERVISEUR-DONNEES-REELLES.md)).

## 0. Principes & rappel d'architecture

- **Orchestrateur** (`OrchestratorAgent`) → délègue via `delegate_to` à un **specialist** →
  chaque specialist a sa boucle LLM + ses **tools**.
- **Tool** = `@Component implements ToolHandler` dans `service/agent/tools/`, décrit par un
  `ToolDescriptor(name, description, jsonSchema, requiresConfirmation)`, auto-découvert par
  `ToolRegistry`, et **rattaché à un specialist** (liste de tools du specialist).
- **Règles d'or** (à respecter pour chaque nouveau tool) :
  - Analyse/lecture → **read-only** (`requiresConfirmation=false`). Action/mutation → **write**
    (`requiresConfirmation=true`).
  - Argent/prix/annulation → **jamais auto** : `suggest` par défaut (la constellation propose,
    l'humain valide). Recalcul serveur, jamais de montant venant du client.
  - **≤ 10 tools par specialist** (au-delà, le routing LLM se dégrade — cf. `SpecialistRegistry`).
    `data_analyst` est déjà à **15** → rebalancing requis (Phase 0).
  - **Multi-tenant** : tout calcul passe par l'org courante (filtre Hibernate / `TenantContext`).
  - **Surface double** : chaque capacité sert (a) le **chat** assistant ET (b) les **suggestions
    autonomes** de la constellation (un insight au-dessus d'un seuil → `SupervisionSuggestion`).

## Phase 0 — Fondations (prérequis de tout le reste)

### F0-A. Rebalancing des specialists + activation de l'agent `fin` ✅ FAIT
- **Problème** : `data_analyst` = 15 tools (> 10) ; agent **Finance (`fin`)** dormant (aucun specialist).
- **Livré & vérifié** (`mvn package`, SpecialistRegistryTest 8/8, MultiAgent 8/8, OrchestratorAgent 27/27, ArchUnit 1/1, `tsc`) :
  - `FinanceSpecialist` (`name=finance`) avec 5 tools « argent » : `list_invoices`,
    `get_billing_overview`, `get_owner_payout_summary`, `get_financial_summary`, `get_properties_performance`.
  - `data_analyst` allégé **15 → 10** (cluster opérationnel : logements/résa/occupation/tendances) + description recentrée.
  - Mapping `finance → fin` ajouté backend (`SupervisionModuleRegistry`) + front (`specialistMapping.ts`)
    → **l'agent `fin` de la constellation est activé**.
- **Valeur** : routing fiable (≤10/specialist) + l'agent Finance devient vivant.

### F0-B / F0-C — construits AVEC les lots P0 (pas de scaffolding vide)
- La couche analytique (F0-B) et le pont insight→suggestion (F0-C) seront créés au fil des tools
  P0 qui les utilisent (YAGNI : pas de services vides anticipés).

### F0-B. Couche analytique partagée
- Créer un package `service/agent/analytics/` avec des **services de calcul** réutilisables
  (séparés des tools, testables unitairement) : `RevenueAnalyticsService`,
  `OpsAnalyticsService`, `GuestAnalyticsService`, `PricingRecommendationService`,
  `ReviewSentimentService`.
- **Perf** : pour les agrégats lourds (forecast, rentabilité par logement, attribution canal),
  prévoir des **vues matérialisées / tables d'agrégat** rafraîchies par un `@Scheduled`
  (ex. `analytics_property_pnl_daily`) plutôt que de tout recalculer à chaque appel LLM.
- **Effort** : M (socle réutilisé partout).

### F0-C. Pont « insight → suggestion autonome »
- Règles de seuil qui transforment un insight en `SupervisionSuggestion` org-scopée (déjà
  construite) : ex. élasticité+occupation faible → suggestion « baisser X% », avis ≤ 2★ sans
  réponse → suggestion « répondre », ménage non assigné avant arrivée → suggestion « assigner ».
- Implémenté comme `SupervisionInsightToSuggestion` appelé par le scan autonome.
- **Effort** : M. **Dépend de** : la plupart des tools P0.

### F0-D. Garde-fous
- Budget tokens par feature (déjà éditable) ; mode `suggest` par défaut sur tout ce qui touche
  prix/argent ; plafond de scans/jour (déjà fait) ; dédup des suggestions (déjà fait).

---

## Phase P0 — Fort ROI, faisable, nourrit directement la constellation

### P0-1. Recommandation de prix continue + élasticité réelle  *(agent `rep`)* ✅ FAIT
- **Découverte** : l'élasticité réelle existe DÉJÀ (`SimulationService.resolveElasticity` : override
  `PropertyPricingConfig` → estimation empirique `PropertyElasticityEstimate` → défaut 0.5). Le vrai
  manque était la **recommandation continue**, pas l'élasticité.
- **Livré & vérifié** (`mvn package`, `PricingRecommendationServiceTest` 4/4, SpecialistRegistry 8/8, ArchUnit 1/1) :
  - `PricingRecommendationService` (couche `analytics/`) : segmente l'horizon en semaines, repère
    via le **calendrier réel** les créneaux qui sous-vendent (occupation faible → baisse) ou
    sur-vendent (→ hausse), puis **valide chaque proposition via `simulatePricingChange`**
    (élasticité réelle) — les propositions revenue-négatives sont écartées.
  - Tool read-only `recommend_price_adjustments` (param `propertyId` requis, `windowDays`) rattaché
    à `insights` (5→6). Ne modifie JAMAIS les tarifs (mode suggest).
  - Test unitaire : baisse validée, hausse, baisse supprimée par simulation négative, occupation
    moyenne → rien.
- **Raffinement futur** : pondérer par météo/événements (P1-9) ; impact revenu par créneau (vs
  property-level aujourd'hui).

#### (spéc d'origine, pour mémoire)
- **Aujourd'hui** : `simulate_pricing_change` avec élasticité **figée à 0.5**, one-shot.
- **À construire** :
  - `PricingElasticityService` : estime l'élasticité **par logement/saison** depuis l'historique
    (prix appliqué × occupation réalisée), repli sur une valeur de marché si données insuffisantes.
  - **Tool** `recommend_price_adjustments` (read-only) : pour une propriété/fenêtre, renvoie les
    créneaux où ajuster + delta recommandé + revenu projeté + confiance.
  - Job `@Scheduled` (hebdo) qui recalcule l'élasticité et alimente une table d'agrégat.
- **Constellation** : produit des suggestions « baisser/monter de X% sur ce créneau » (mode suggest).
- **Données** : `CalendarDay`, `Reservation`, `RateOverride`, PriceEngine, saisonnalité.
- **Valeur** : **levier revenu n°1** (yield). Passe de la simulation à la **reco actionnable**.
- **Effort** : L. **Garde-fous** : delta max, plancher de revenu, jamais auto-appliqué.

### P0-2. Attribution canal nette de commission  *(agent `fin`)* ✅ FAIT
- **Découverte** : la commission OTA réelle existe par réservation (`Reservation.otaFeeAmount`,
  nullable) + le canal (`Reservation.source`).
- **Livré & vérifié** (`mvn package`, `ChannelAttributionServiceTest` 3/3, SpecialistRegistry 8/8, ArchUnit 1/1) :
  - `ChannelAttributionService` (couche `analytics/`) : revenu brut / commission / **net** par canal
    (Airbnb/Booking/Vrbo/direct/autre) sur N mois, part %, taux de commission, + recommandation
    d'arbitrage du mix. Commission = valeur **réelle** (`otaFeeAmount`) si connue, sinon **taux par
    défaut** par canal (marqué « estimé »).
  - Tool read-only `get_channel_attribution` (param `months`, défaut 3) rattaché à `finance` (5→6).
  - Test unitaire : commission réelle vs estimée, exclusion des annulées, canal direct sans commission.
- **Raffinement futur** : taux de commission configurables par org (vs défauts) ; multi-devises.

#### (spéc d'origine, pour mémoire)
- **Aujourd'hui** : `get_billing_overview` donne le revenu **brut** par canal, sans coût d'acquisition.
- **À construire** :
  - Modéliser/tracer la **commission par canal** (Airbnb/Booking/direct…) : taux par canal
    (config) ou montant réel si dispo, persisté sur la réservation/facture.
  - **Tool** `get_channel_attribution` (read-only) : revenu **net de commission** par canal,
    part %, marge nette, comparaison période, recommandation de mix.
- **Constellation** : suggestion « ta dépendance Booking coûte X% de marge, pousse le direct ».
- **Valeur** : arbitrage du **mix de distribution** → marge directe.
- **Effort** : M (le gros est le tracking commission). **Dépend de** : F0-A (FinanceSpecialist).

### P0-3. Détection proactive d'anomalies opérationnelles  *(agent `ops`)* ✅ FAIT
- **Livré & vérifié** (`mvn package`, `OpsRiskServiceTest` 4/4, SpecialistRegistry 8/8, MultiAgent 8/8, ArchUnit 1/1) :
  - `OpsRiskService` (couche analytique `service/agent/analytics/`, démarre F0-B) détecte 3 risques :
    **arrivée sans ménage** (HIGH), **intervention en retard** (MEDIUM), **sync canal en retard** (MEDIUM),
    triés par sévérité, org-scopés.
  - Tool read-only `detect_operational_risks` (param `windowDays`, défaut 3) rattaché à `operations`.
  - Test unitaire couvrant les 3 cas + cas « ménage présent → pas de risque ».
- **Dette à suivre (F0-A-bis)** : `operations` passe à **13 tools** (déjà 12 avant) — au-dessus de la
  limite de routing de 10. Rebalancing à faire (séparer le cluster « monitoring read-only » :
  list_cleaning_tasks, get_interventions_by_status, get_channel_sync_status, get_noise_alerts,
  detect_operational_risks) — non bloquant (warning), traité dans un lot dédié.

#### (spéc d'origine, pour mémoire)
- **Aujourd'hui** : ops ne fait que CRUD + 1 camembert. Aucune détection.
- **À construire** :
  - `OpsRiskService` : détecte les risques **à fenêtre courte** — ménage non assigné avant une
    arrivée, sync canal en retard > 24 h, chevauchement/double-booking, check-in sans code d'accès,
    intervention en retard.
  - **Tool** `detect_operational_risks` (read-only) : liste priorisée des risques + action suggérée.
- **Constellation** : **LE** use-case du scan autonome → suggestions « assigner ménage à la résa
  X », « résoudre la sync Airbnb du logement Y ».
- **Données** : `Intervention`, `Reservation`, `CalendarDay`, `ChannelSyncHealth`, `SmartLockAccessCode`.
- **Valeur** : anti **no-show / double-booking / mauvais avis**. Réduction directe du risque.
- **Effort** : M. Fort impact, faisabilité élevée (jointures existantes).

### P0-4. Sentiment + thèmes des avis  *(agent `rep`)* ✅ FAIT
- **Livré & vérifié** (`mvn package`, `ReviewSentimentServiceTest` 3/3, SpecialistRegistry 8/8, ArchUnit 1/1) :
  - `ReviewSentimentService` (couche `analytics/`), **v1 déterministe sans coût LLM** : sentiment via
    la **note** (1-5), thèmes via **lexique normalisé sans accents** (propreté, bruit, arrivée,
    équipements, qualité-prix, emplacement, communication), tendance récente (90 j), avis à risque
    réputationnel non répondus.
  - Tool read-only `analyze_reviews` rattaché à `insights` (6→7).
  - Test unitaire : thème propreté NEGATIVE + négatifs non répondus, avis positifs sans risque, vide.
- **Raffinement futur** : extraction de sentiment fine par LLM (cache + batch).

#### (spéc d'origine, pour mémoire)
- **Aujourd'hui** : `list_reviews` renvoie des avis **bruts**.
- **À construire** :
  - `ReviewSentimentService` : score de sentiment + extraction de **thèmes** (propreté, bruit,
    check-in, équipements, rapport qualité-prix) via LLM (batch, cache pour ne pas re-scorer).
  - **Tool** `analyze_reviews` (read-only) : tendance satisfaction, thèmes récurrents positifs/négatifs
    par logement, avis à risque réputationnel.
- **Constellation** : suggestion « répondre à l'avis 2★ non traité », « 3 avis citent la propreté →
  action ménage ».
- **Valeur** : réputation = **ranking + conversion OTA**. Boucle avis → action corrective.
- **Effort** : M (coût LLM maîtrisé par cache/batch).

---

## Phase P1 — Valeur claire, construction modérée

### P1-5. Rentabilité nette par logement  *(agents `fin` + `ops`)*
- **Tool** `get_property_pnl` (read-only) : revenu − (ménage + maintenance + commissions canal) par
  logement sur période → marge nette, classement, biens déficitaires.
- **Données** : revenu (résa), coûts interventions (service paiement intervention), commissions (P0-2).
- **Constellation** : suggestion « logement Z en marge négative 3 mois → revoir prix/coûts ou sortir ».
- **Valeur** : **décision de portefeuille** sur la vraie marge. **Effort** : M. **Dépend de** : P0-2.

### P1-6. Segmentation & ciblage guest  *(agent `com`)* ✅ FAIT
- **Livré & vérifié** (`mvn package`, `GuestAnalyticsServiceTest` 2/2, SpecialistRegistry 8/8, ArchUnit 1/1) :
  - `GuestAnalyticsService` (couche `analytics/`) : segmente les voyageurs en **NEW** (1 séjour),
    **REPEAT** (≥2), **VIP** (dépense ≥ 2× la moyenne) — par segment : nombre, dépense totale/moyenne,
    exemples, + recommandation de ciblage. Réutilise `GuestService.listGuests` (stats déjà calculées).
  - Tool read-only `segment_guests` rattaché à `communication` (5→6).
  - Test unitaire : mix de profils → segments corrects + recommandation VIP ; vide.
- **→ Premier apport d'ANALYSE pour l'agent `com`** (jusque-là purement transactionnel) : les 5 agents
  de la constellation produisent désormais de la vraie analyse.
- **Affinage futur** : segment AT_RISK (churn) — nécessite la date du dernier séjour (non exposée
  par `GuestListDto`) ; ciblage des messages par segment (write).

#### (spéc d'origine, pour mémoire)
- `GuestAnalyticsService` : segments (récurrents, haute valeur, à risque de churn, 1re visite).
- **Tools** : `segment_guests` (read-only) + extension de `send_guest_message` au **ciblage par
  segment** (write, confirmation).
- **Constellation** : suggestion « 12 guests récurrents arrivent ce mois → message VIP / upsell ».
- **Valeur** : **rétention** + upsell personnalisé. **Effort** : M.

### P1-7. Forecast d'occupation/demande long terme (90–365 j)  *(agent `rev`)*
- Étendre `get_occupancy_forecast` (30 j) → `forecast_demand_longterm` (read-only, horizon configurable),
  modèle saisonnalité multi-années (+ events P1-9). Sortie : occupation projetée + intervalle de confiance.
- **Valeur** : planification **capacité, staffing, trésorerie**. **Effort** : L (besoin historique 2-3 ans).

### P1-8. Coût & SLA des opérations  *(agent `ops`)*
- **Tool** `get_ops_analytics` (read-only) : coût ménage/maintenance par logement, **turnaround time**
  (départ→prêt), taux de retard, charge par intervenant/équipe.
- **Constellation** : suggestion « turnaround moyen > 4 h sur logement W → risque sur arrivées serrées ».
- **Valeur** : marge cachée + qualité de service. **Effort** : M.

### P1-9. Météo / événements → prix automatique  *(agents `context` → `rep`)*
- Brancher `get_weather_forecast` + `get_local_events` **dans** `recommend_price_adjustments` (P0-1) :
  un festival J+20 ou une météo défavorable pondère la reco de prix automatiquement.
- **Valeur** : **demand-aware pricing** sans effort manuel. **Effort** : S. **Dépend de** : P0-1.

---

## Phase P2 — Différenciation / itérations suivantes

### P2-10. Maintenance prédictive  *(agent `ops`)*
- `PredictiveMaintenanceService` : fenêtre de maintenance estimée (usure ∝ occupation + historique
  interventions + signaux capteurs). **Tool** `predict_maintenance_needs` (read-only).
- **Valeur** : intervenir **avant** la panne/le mauvais avis. **Effort** : L (modèle + données capteurs).

### P2-11. Benchmarking concurrence  *(agent `rev`)*
- **Tool** `get_market_benchmark` (read-only) : positionnement prix/occupation vs marché local.
- **Valeur** : positionnement. **Effort** : L+ (dépend d'une **source de donnée externe** OTA/agrégateur
  — à sourcer ; bloquant). **Risque** : disponibilité/coût de la donnée marché.

### P2-12. Batch operations multi-logements  *(agents `ops`/`com`)*
- Variantes batch (write, confirmation) : `block_calendar_days(propertyIds[], range)`,
  `assign_interventions([...])`, ciblage messages par segment (P1-6) avec détection de conflits.
- **Valeur** : **scalabilité** 50+ logements. **Effort** : M.

### P2-13. Nouveaux workflows guidés  *(agent `workflow`)*
- Ajouter : **résolution d'incident** (bruit/dégât), **repricing saisonnier**, **reporting
  propriétaire**, **optimisation d'une nouvelle annonce**.
- **Valeur** : standardise les procédures complexes, réduit les erreurs. **Effort** : M (par workflow).

### P2-14. Suggestions promos / upsells avec garde-fous  *(agents `rev`/`ops`)*
- **Tools read-only** `suggest_promotion` / `suggest_upsells` (propose, ne crée pas) à partir de
  l'occupation et du segment guest ; création effective laissée à l'UI ou à un write confirmé.
- **Valeur** : revenu additionnel maîtrisé. **Effort** : M. **Dépend de** : P1-6.

---

## Séquencement & dépendances (vue d'ensemble)

| Lot | Agent | Effort | Dépend de | Type de tool | Effet constellation |
|---|---|---|---|---|---|
| F0-A rebalancing + FinanceSpecialist | infra/`fin` | S | — | — | active l'agent `fin` |
| F0-B couche analytique | infra | M | — | — | socle |
| F0-C pont insight→suggestion | infra | M | tools P0 | — | rend les scans actionnables |
| **P0-1** reco prix continue | `rep`/`rev` | L | F0-B | read-only | suggestions prix |
| **P0-2** attribution canal nette | `fin` | M | F0-A | read-only | suggestion mix canal |
| **P0-3** anomalies ops | `ops` | M | F0-B | read-only | suggestions ménage/sync |
| **P0-4** sentiment avis | `rep`/`com` | M | F0-B | read-only | suggestions avis |
| P1-5 P&L par logement | `fin`/`ops` | M | P0-2 | read-only | suggestion portefeuille |
| P1-6 segmentation guest | `com` | M | F0-B | read-only + write | suggestion ciblage |
| P1-7 forecast long terme | `rev` | L | F0-B | read-only | planification |
| P1-8 coût/SLA ops | `ops` | M | F0-B | read-only | suggestion qualité |
| P1-9 météo/events→prix | `context`/`rep` | S | P0-1 | (enrichit P0-1) | prix demand-aware |
| P2-10 maintenance prédictive | `ops` | L | F0-B | read-only | suggestion maintenance |
| P2-11 benchmark concurrence | `rev` | L+ | source externe | read-only | positionnement |
| P2-12 batch ops | `ops`/`com` | M | P1-6 | write | scalabilité |
| P2-13 workflows | `workflow` | M | — | read-only | procédures |
| P2-14 promos/upsells | `rev`/`ops` | M | P1-6 | read-only | revenu additionnel |

**Ordre recommandé** : F0-A → F0-B → (P0-1, P0-3 en parallèle) → P0-2 → P0-4 → F0-C → P1 → P2.
(F0-A/F0-B d'abord car tout en dépend ; P0-1 et P0-3 sont les deux plus gros ROI.)

## Garde-fous transverses (rappel)

- Tout tool prix/argent : **read-only ou write confirmé**, jamais auto-appliqué ; mode `suggest`.
- Recalcul **serveur** systématique ; multi-tenant strict (org courante).
- Coût LLM des analyses (sentiment, insights) : **cache + batch + budget tokens** par feature.
- Respect du plafond ≤ 10 tools/specialist (rebalancer si besoin lors de chaque ajout).
- Chaque nouveau tool : **test unitaire** du service de calcul + descriptor vérifié + `mvn package` + ArchUnit.

## Définition de « fait » par lot

- Service de calcul + test unitaire ; tool `@Component` + descriptor ; rattachement specialist (≤10) ;
  vérif `mvn package` + ArchUnit + (si front) `tsc` ; pont constellation (F0-C) le cas échéant ;
  i18n des libellés exposés si rendu côté front.
