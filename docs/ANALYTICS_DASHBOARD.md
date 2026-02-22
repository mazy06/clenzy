# Dashboard Analytics — Documentation technique

## Vue d'ensemble

L'onglet **Analytics** du Dashboard fournit une analyse approfondie de la performance du portfolio locatif. Il est composé de **11 sections horizontalement scrollables**, chacune contenant des widgets (cards KPI, graphiques Recharts, tableaux, sliders interactifs).

Toutes les computations sont faites **100% frontend** (pas de nouvel endpoint backend). Les donnees proviennent des API existantes : reservations, proprietes, interventions.

---

## Architecture

```
DashboardAnalyticsContent.tsx
  |
  |-- useDashboardOverview()     --> Stats cards (Row 1, inchange)
  |-- useAnalyticsEngine()       --> Toutes les donnees analytics (Row 2+)
  |     |
  |     |-- reservationsApi.getAll()   --> Reservations (React Query)
  |     |-- propertiesApi.getAll()     --> Proprietes (React Query)
  |     |-- interventions (prop)       --> Interventions (du parent)
  |     |
  |     |-- computeGlobalKPIs()
  |     |-- computeRevenueMetrics()
  |     |-- computeOccupancyMetrics()
  |     |-- computePricingMetrics()
  |     |-- computeForecast()
  |     |-- computeRecommendations()
  |     |-- computeClientMetrics()
  |     |-- computePropertyPerformance()
  |     |-- computeBenchmark()
  |     |-- computeBusinessAlerts()
  |
  |-- ScrollableSection (layout)
  |-- AnalyticsWidgetCard (layout)
  |
  |-- 11 sections :
       AnalyticsGlobalPerformance
       AnalyticsRevenue
       AnalyticsOccupancy
       AnalyticsPricingIntelligence
       AnalyticsForecasts
       AnalyticsRecommendations
       AnalyticsClientAnalysis
       AnalyticsPropertyPerformance
       AnalyticsBenchmark
       AnalyticsSimulator
       AnalyticsAlerts
```

---

## Fichiers

### Hook principal

| Fichier | Role |
|---------|------|
| `client/src/hooks/useAnalyticsEngine.ts` | Moteur de calcul (~450 lignes). Fetch reservations + proprietes via React Query, compute tous les KPIs dans `useMemo`. Retourne un objet `AnalyticsData` type. |

### Composants layout

| Fichier | Role |
|---------|------|
| `analytics/ScrollableSection.tsx` | Section avec titre UPPERCASE, sous-titre, badge compteur, contenu horizontal scrollable (scroll-snap, scrollbar fine 4px, gradient mask droite). |
| `analytics/AnalyticsWidgetCard.tsx` | Card widget reutilisable : titre, valeur, sous-titre, trend indicator (TrendingUp/Down), icone, tooltip MUI, skeleton loader, `scrollSnapAlign: start`, `minWidth` configurable. |

### 11 sections

| # | Fichier | Contenu |
|---|---------|---------|
| 1 | `AnalyticsGlobalPerformance.tsx` | 7 KPI cards : RevPAN, ADR, taux occupation, revenu total, marge nette, ROI, duree moyenne sejour. Chaque card avec trend indicator. |
| 2 | `AnalyticsRevenue.tsx` | AreaChart revenus/depenses 6 mois, PieChart donut repartition par canal (Airbnb/Booking/Direct/Autre), BarChart horizontal top 5 proprietes, card revenu moyen par reservation. |
| 3 | `AnalyticsOccupancy.tsx` | BarChart empile occupe/vacant par mois, BarChart horizontal taux par propriete, card nuits vacantes, heatmap calendrier 42 jours (grille coloree). |
| 4 | `AnalyticsPricingIntelligence.tsx` | LineChart prix moyen vs RevPAN (dual series), BarChart prix par type de propriete, card prix optimal, card elasticite prix/occupation. |
| 5 | `AnalyticsForecasts.tsx` | 3 cards prevision (30j/90j/365j), ComposedChart avec historique (ligne pleine) + projection (pointilles) + zone de confiance (area), tableau 3 scenarios (optimiste/realiste/pessimiste). |
| 6 | `AnalyticsRecommendations.tsx` | Cards de recommandations triees par impact estime en euros. Chaque card : icone type, titre, description, impact euro, chip confiance %, dot priorite. Types : pricing, calendar, cost, risk. |
| 7 | `AnalyticsClientAnalysis.tsx` | PieChart reservations par source, cards duree moyenne sejour + nombre moyen voyageurs + total reservations, BarChart horizontal top proprietes par popularite. |
| 8 | `AnalyticsPropertyPerformance.tsx` | Scoreboard : une card par propriete classee par score (0-100). Chaque card : rang, nom, barre de progression score coloree, metriques (RevPAN, occupation, revenu, marge nette). |
| 9 | `AnalyticsBenchmark.tsx` | RadarChart comparaison moyenne portfolio vs meilleure propriete (4 axes : RevPAN, Occupation, Marge, Score), cards moyenne portfolio + meilleure propriete + ecart-type dispersion. |
| 10 | `AnalyticsSimulator.tsx` | 2 sliders MUI interactifs : ajustement prix (-50% a +50%) et occupation cible (20-100%). Resultats en temps reel : revenu projete, occupation projetee, RevPAN projete. Utilise l'elasticite prix/occupation. |
| 11 | `AnalyticsAlerts.tsx` | Cards alertes triees par severite (critical > warning > info). Bordure gauche coloree. Chaque alerte : icone, titre, description, chip severite, action suggeree. Badge compteur sur le titre de section. |

### Barrel

| Fichier | Role |
|---------|------|
| `analytics/index.ts` | Re-export de tous les composants |

### Fichiers modifies

| Fichier | Changement |
|---------|------------|
| `DashboardAnalyticsContent.tsx` | Reecrit pour orchestrer les 11 sections avec `useAnalyticsEngine`. Row 1 (DashboardStatsCards) conserve intact. Row 2+ = sections analytics dans `DashboardErrorBoundary`. |
| `i18n/locales/fr.json` | +90 cles `dashboard.analytics.*` |
| `i18n/locales/en.json` | +90 cles `dashboard.analytics.*` |

---

## KPIs et formules

### Performance globale

| KPI | Formule | Unite |
|-----|---------|-------|
| **RevPAN** | Revenu total / (nombre proprietes actives x jours periode) | EUR/nuit |
| **ADR** | Revenu total / nuits occupees | EUR/nuit |
| **Taux occupation** | Nuits occupees / nuits disponibles x 100 | % |
| **Revenu total** | Somme `totalPrice` des reservations sur la periode | EUR |
| **Marge nette** | (Revenu - Couts interventions) / Revenu x 100 | % |
| **ROI** | (Revenu - Couts) / Couts x 100 | % |
| **Duree moy. sejour** | Somme nuits / nombre reservations | jours |

Chaque KPI est calcule sur la **periode courante** et la **periode precedente** (meme duree) pour afficher un trend (hausse/baisse/stable).

### Previsions

Algorithme : **Weighted Moving Average** sur les 3 derniers mois (poids 3/2/1) avec un facteur de saisonnalite :
- Ete (juin-septembre) : +10%
- Hiver (novembre-fevrier) : -10%
- Reste : x1

La zone de confiance s'elargit progressivement dans le futur (+3% par mois).

### Recommandations

Moteur **rule-based** qui evalue des seuils :

| Regle | Condition | Priorite |
|-------|-----------|----------|
| Occupation faible | taux < 60% | High |
| Nuits vacantes | gap > 10 nuits | Medium |
| Marge faible | marge nette < 65% | Medium |
| Revenus en baisse | growth < -5% | High |
| Prix sous-evalue | ADR < 80% du prix catalogue | Medium |
| Propriete sous-performante | occupation < 40% | Low |

Chaque recommandation inclut un **impact estime en euros** et un **niveau de confiance** (%).

### Score propriete

Score composite (0-100) :
- Taux occupation : 40%
- RevPAN normalise : 30%
- Marge nette : 30%

Couleurs : vert (>= 80), orange (50-79), rouge (< 50).

### Simulateur

Utilise l'elasticite prix/occupation (coefficient par defaut : -0.8) :
- Variation prix +X% --> variation occupation = X% x elasticite
- Occupation cible T% --> prix necessaire = prix base x (1 + (T - occupation base) / (occupation base x elasticite))

---

## Design system

### Palette Clenzy

| Token | Couleur | Usage |
|-------|---------|-------|
| Primary | `#6B8A9A` | Titres, lignes principales, barres |
| Success | `#4A9B8E` | Valeurs positives, previsions |
| Warning | `#D4A574` | Attention, prix |
| Error | `#C97A7A` | Alertes critiques, baisse |
| Info | `#7BA3C2` | Informationnel |

### Canaux de reservation

| Canal | Couleur |
|-------|---------|
| Airbnb | `#FF5A5F` |
| Booking | `#003580` |
| Direct | `#4A9B8E` |
| Autre | `#94A3B8` |

### Typographie compacte

- Titres section : `0.75rem`, `uppercase`, `fontWeight: 700`, `letterSpacing: 0.04em`
- Valeurs KPI : `1.125rem`, `fontWeight: 700`, `tabular-nums`
- Labels : `0.6875rem`, `fontWeight: 600`
- Sous-titres : `0.5625rem`, `text.disabled`

### Scroll horizontal

- `overflow-x: auto`, `scroll-snap-type: x mandatory`
- Scrollbar : hauteur 4px, thumb `rgba(0,0,0,0.12)`, hover `rgba(0,0,0,0.25)`
- Gradient mask droite 24px (fondu vers blanc)
- Chaque widget : `scroll-snap-align: start`

### Loading states

- AnalyticsWidgetCard : Skeleton MUI (`variant="rectangular"` pour icone, `variant="text"` pour texte)
- Charts : placeholder "..." centre
- Sections complexes (recommendations, alerts) : cards fantomes avec `opacity: 0.5`

---

## Donnees sources

### Reservations (`reservationsApi.getAll()`)

```typescript
interface Reservation {
  id: number;
  propertyId: number;
  propertyName: string;
  guestName: string;
  guestCount: number;
  checkIn: string;    // YYYY-MM-DD
  checkOut: string;   // YYYY-MM-DD
  status: 'confirmed' | 'pending' | 'cancelled' | 'checked_in' | 'checked_out';
  source: 'airbnb' | 'booking' | 'direct' | 'other';
  totalPrice: number;
}
```

### Proprietes (`propertiesApi.getAll()`)

```typescript
interface Property {
  id: number;
  name: string;
  status: string;       // 'ACTIVE', etc.
  nightlyPrice: number;
  type: string;
  bedroomCount: number;
  city: string;
}
```

### Interventions (via `useDashboardOverview`)

```typescript
interface InterventionLike {
  estimatedCost?: number;
  actualCost?: number;
  type: string;
  status: string;
  scheduledDate?: string;
  createdAt?: string;
}
```

---

## Permissions et roles

L'onglet Analytics complet (11 sections) n'est visible que par les roles **ADMIN**, **MANAGER** et **SUPERVISOR** (`canViewCharts = true`).

Les **Stats Cards** (Row 1) restent visibles pour tous les roles avec des metriques adaptees (HOST voit ses proprietes, TECHNICIAN voit ses interventions, etc.).

---

## React Query

| Query Key | Source | staleTime |
|-----------|--------|-----------|
| `['analytics-reservations']` | `reservationsApi.getAll()` | 60s |
| `['analytics-properties']` | `propertiesApi.getAll()` | 60s |
| `['dashboard-overview', ...]` | Existant (stats cards) | 60s |

Toutes les computations derivees sont dans `useMemo` pour eviter les recalculs inutiles.

---

## Heatmap calendrier

La section Occupation inclut un heatmap des 42 derniers jours (6 semaines) :
- Chaque jour = carre 14x14px
- Couleur basee sur le taux d'occupation du jour :
  - `>= 80%` : vert (`#4A9B8E`)
  - `>= 50%` : bleu-gris (`#6B8A9A`)
  - `>= 20%` : orange (`#D4A574`)
  - `> 0%` : rouge (`#C97A7A`)
  - `0%` : gris (`#F1F5F9`)
- Hover : `transform: scale(1.3)` + tooltip natif avec date et pourcentage

---

## Filtrage par periode

Le filtre de periode (7j / 30j / 90j / 1 an) est controle par le composant parent `Dashboard.tsx` et propage via la prop `period` a `DashboardAnalyticsContent`, puis a `useAnalyticsEngine`.

Les computations filtrent les reservations et interventions en fonction de la periode selectionnee. Les previsions utilisent toujours l'historique complet (6 derniers mois) independamment du filtre.
