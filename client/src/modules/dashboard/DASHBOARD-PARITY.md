# Dashboard — inventaire exhaustif de la projection

> Source : `modules/admin/design-system/sections-demos.tsx` → `BDashboardSectionDemo`
> (galerie : Projections › Dashboard › « Défaut »).
>
> Consigne : **rien ne doit être mis de côté.** Chaque élément de la projection
> est listé ici avec son besoin en données. Une ligne non traitée doit être
> justifiée, pas oubliée.
>
> Colonne « Backend » remplie après relevé des endpoints existants.

## 1. En-tête de page

| # | Élément | Donnée nécessaire |
|---|---|---|
| 1.1 | Titre « Dashboard » | — |
| 1.2 | Sous-titre : **date du jour en toutes lettres** + **nombre de logements actifs** | date locale ; compte des logements actifs |
| 1.3 | Pastille d'icône (maison) dans l'en-tête | — |
| 1.4 | **Badge d'ornement du titre** : « N à traiter », ton warning | compte des éléments du bloc 6 |
| 1.5 | **Sélecteur de période** 7 j / 30 j / 90 j, dans les actions | pilote tous les blocs à période |
| 1.6 | Bouton primaire « + Réservation » | route de création |
| 1.7 | Pas de bouton retour (`showBackButton={false}`) | — |

## 2. Rangée de six tuiles KPI

Grille : 2 colonnes en mobile, 3 en `lg`, **6 en `xl`**.

| # | Tuile | Valeur | Unité | Indice (hint) | Teinte d'icône |
|---|---|---|---|---|---|
| 2.1 | Occupation | 84 | % | **+8 pts** vs période préc. | défaut |
| 2.2 | Revenus | montant | — | **+15 %** vs période préc. | `text-success` |
| 2.3 | ADR | montant | — | « prix moyen par nuit vendue » | défaut |
| 2.4 | RevPAR | montant | — | « revenu par nuit disponible » | défaut |
| 2.5 | Réservations | 27 | — | « dont N arrivées cette semaine » | défaut |
| 2.6 | Note moyenne | 4,8 | /5 | « N avis sur la période » | `text-warning` |

Détails à ne pas perdre : les montants passent par `<Money>` (devise de
l'utilisateur, `decimals={0}`) ; les indices 2.1 et 2.2 mettent la **variation en
gras** ; 2.1 est en **points**, 2.2 en **pourcentage**.

## 3. Graphique « Revenus — 6 derniers mois »

| # | Élément | Donnée nécessaire |
|---|---|---|
| 3.1 | Barres **empilées** Direct / OTA, 6 mois glissants | revenu mensuel ventilé en deux familles de canaux |
| 3.2 | Légende inline dans l'en-tête de carte (pastilles `chart-1` / `chart-2`) | — |
| 3.3 | Axe X = mois abrégé sur 3 lettres, sans ligne d'axe ni graduation | — |
| 3.4 | Grille horizontale seule (`vertical={false}`) | — |
| 3.5 | Infobulle au survol, sans curseur vertical | — |
| 3.6 | Rayons : bas arrondi sur `direct`, haut arrondi sur `ota` | — |

## 4. Répartition du revenu par canal

Composant existant : `components/baitly/RevenueByChannelCard`.

| # | Élément | Donnée nécessaire |
|---|---|---|
| 4.1 | Une ligne par canal : nom, **pourcentage**, **montant**, **couleur de marque** | revenu par canal sur la période |
| 4.2 | Tri décroissant par part | — |

## 5. Opérations du jour — trois cartes

Chaque carte a un titre en **capitales, petit, gris**, précédé d'une icône teintée
et suivi du **compte entre parenthèses**.

### 5.a Arrivées aujourd'hui — icône `LogIn`, teinte succès

| # | Élément | Donnée nécessaire |
|---|---|---|
| 5.a.1 | Avatar du voyageur (initiales) | nom du voyageur |
| 5.a.2 | Nom + **pastille de canal colorée** (Airbnb, Direct…) | canal d'origine |
| 5.a.3 | Ligne secondaire : logement · **note / demande spéciale** | ex. « Lit bébé demandé », « Check-in autonome » |
| 5.a.4 | **Heure d'arrivée** en gras, alignée à droite, `tabular-nums` | heure de check-in |

### 5.b Départs aujourd'hui — icône `LogOut`, teinte info

| # | Élément | Donnée nécessaire |
|---|---|---|
| 5.b.1 | Avatar + nom du voyageur | — |
| 5.b.2 | Ligne secondaire : logement · **motif d'attention** (« caution à libérer ») | statut de la caution |
| 5.b.3 | Heure de départ | heure de check-out |
| 5.b.4 | **Bouton d'action « Libérer la caution »** en pied de carte | action sur la caution |

### 5.c Ménages du jour — icône `Brush`, teinte primaire

| # | Élément | Donnée nécessaire |
|---|---|---|
| 5.c.1 | Avatar de **l'intervenant** | intervenant assigné |
| 5.c.2 | Nom du **logement** en ligne principale | — |
| 5.c.3 | Ligne secondaire : intervenant · **fenêtre horaire** (« 11:00 → 15:00 », « avant 15:00 ») | fenêtre de rotation |
| 5.c.4 | **Pastille de statut** à points : En cours (warn) / Planifié (neutre) | statut de l'intervention |

## 6. Bloc « À traiter (N) »

Icône `TriangleAlert` warning. Lignes séparées par un filet, **pas de cartes**.

| # | Élément | Donnée nécessaire |
|---|---|---|
| 6.1 | **Icône dans un carré teinté**, une couleur par nature d'alerte | — |
| 6.2 | Titre + ligne de détail tronquée | — |
| 6.3 | **Bouton d'action à droite**, libellé propre à l'alerte | — |
| 6.4 | Type A — **solde à percevoir** : référence de résa, voyageur, montant restant en gras, « avant l'arrivée » · action *Encaisser* | reste dû par réservation |
| 6.5 | Type B — **avis sans réponse** : note, logement, extrait du commentaire, canal, ancienneté · action *Répondre* | avis non répondus |
| 6.6 | Type C — **calendrier désynchronisé** : canal, logement, ancienneté du dernier succès · action *Resynchroniser* | santé de synchronisation par canal |

## 7. Occupation par logement

| # | Élément | Donnée nécessaire |
|---|---|---|
| 7.1 | Une ligne par logement : nom tronqué (largeur fixe) | — |
| 7.2 | **Barre de progression** sur fond `bg-field` | taux d'occupation par logement |
| 7.3 | **Seuils de couleur** : ≥ 70 % succès · ≥ 50 % primaire · sinon warning | — |
| 7.4 | Pourcentage aligné à droite, `tabular-nums` | — |

## 8. Tableau « Prochaines arrivées (7 jours) »

| # | Élément | Donnée nécessaire |
|---|---|---|
| 8.1 | En-tête de carte + bouton fantôme « Tout le planning » avec chevron RTL | — |
| 8.2 | Colonne **Guest** : avatar 24 px + nom en gras | — |
| 8.3 | Colonne **Logement** | — |
| 8.4 | Colonne **Arrivée** : date courte en toutes lettres (« Ven. 25 juil. ») | — |
| 8.5 | Colonne **Nuits**, alignée à droite, `tabular-nums` | nb de nuits |
| 8.6 | Colonne **Canal** : pastille à point, couleur de marque | — |
| 8.7 | Colonne **Statut** : pastille à point — Solde dû (warn) / Payée (ok) / Confirmée (neutre) | statut de paiement |
| 8.8 | Colonne **Total** : montant aligné à droite | — |
| 8.9 | Lignes **cliquables** (`cursor-pointer`) | route de la fiche réservation |

## 9. Éléments transverses

| # | Élément |
|---|---|
| 9.1 | Toutes les cartes : `rounded-xl border border-border bg-card p-4` |
| 9.2 | Espacement vertical uniforme `gap-4`, grilles internes `gap-3` |
| 9.3 | Titres de section en capitales `text-xs`, titres de carte en `cn-font-heading text-[15px]` |
| 9.4 | Tous les montants via `<Money>`, tous les nombres en `tabular-nums` |
| 9.5 | Le sélecteur de période (1.5) doit **piloter** les blocs 2, 3, 4 et 7 |

---

## B. Ce que l'écran RÉEL porte et que la projection ignore

> Symétrique du §A. La projection est une **vue simplifiée** : elle ne montre ni
> les variantes par rôle, ni les encarts conditionnels. Tout ce qui suit existe
> aujourd'hui et **ne doit pas disparaître** en portant la projection.

### B.1 Variantes par rôle

`showFinancialKpis` / `showServices` / `showSidebar` / `showAiWidget`
(`DashboardOverview.tsx:199-205`) = admin | manager | host.

- [ ] **Rôles financiers** : les 6 KPI monétaires ci-dessus.
- [ ] **Rôles opérationnels** (ménage, technicien, superviseur) : un jeu de KPI
      **entièrement différent** — Interventions à venir / terminées / Demandes /
      Gains / Prochain versement (`DashboardOverview.tsx:421-483`).
      ⚠️ La projection ne connaît que la variante financière.
- [ ] Colonne latérale droite, widget IA et widget Services : masqués hors
      admin/manager/host.

### B.2 Encarts conditionnels

- [ ] `OnboardingChecklist` (`modules/dashboard/OnboardingChecklist.tsx`) —
      toujours monté, avec sa modale d'import iCal.
- [ ] **Voile flouté** bloquant les sections tant que l'onboarding n'est ni
      terminé ni rejeté (`DashboardOverview.tsx:288-323`).
- [ ] `MissingContractsDashboardAlert` — N logements sans contrat.
- [ ] `UpgradeBanner` — hôte au forfait `essentiel`.
- [ ] `ContractCTABanner` — plateforme uniquement, rejetable et persisté.
- [ ] Chip **« Channel Manager »** dans les actions d'en-tête.
- [ ] Onglets `overview` / `simulator` — affichés seulement s'il y en a plus d'un.

### B.3 Widgets absents de la projection

- [ ] `ServicesStatusWidget` — bruit, serrures, boîtes à clés, booking engine.
- [ ] `ActionCountersWidget` — 5 compteurs cliquables (urgences, paiements,
      reversements, demandes, interventions du jour).
- [ ] `MiniPlanningWidget` — timeline 7 jours × 5 logements.
- [ ] `AiUsageWidget` — consommation IA.
- [ ] `BillingOverviewWidget` — c'est lui qui alimente la répartition par canal
      (bloc §4 de la projection). Toggle mois / année à conserver.

### B.4 Robustesse à ne pas perdre

- [ ] `DashboardErrorBoundary` autour de **chaque** widget.
- [ ] `DashboardSkeleton` en superposition tant que `useDashboardReady` n'a pas
      reçu ses clés (`kpis`, `onboarding`).
- [ ] Sélecteur de période réel : **4 options** (7 j / 30 j / 90 j / 1 an), pas 3.

### B.5 Écarts de nommage relevés

- Le KPI existant est un **RevPAN** (revenu par *nuit* disponible), pas un
  **RevPAR** (par *chambre* disponible). La projection écrit « RevPAR » avec
  l'indice « revenu par nuit disponible » — c'est donc bien un RevPAN mal
  étiqueté. **À trancher** : renommer la projection ou changer le calcul.
- La comparaison existante est en **pourcentage** partout ; la projection veut
  des **points** pour l'occupation (§2.1).

### B.6 Dette relevée au passage (hors périmètre, à signaler)

- `DashboardOverview.tsx:135-137` : `hasPricing` / `hasChannels` /
  `hasBillingProfile` sont alimentés par **5 requêtes réseau** et jamais lus.
- `DashboardOverview.tsx:196` : `isSupervisor` déclaré, jamais utilisé.
- `DashboardSkeleton.tsx:150` : ternaire `showFinancialKpis ? 6 : 6`.
- `useDashboardReady.ts:20-32` : `markReady` non mémoïsé.
- `ContextualTipsWidget` / `ChannelHealthWidget` désactivés en dur
  (`SHOW_LEGACY_SIDEBAR_WIDGETS = false`).

---

## C. Couverture des données par bloc de la projection

| Bloc | Existe côté front | Endpoint |
|---|---|---|
| 2.1 Occupation | ✅ | `GET /dashboard/overview-summary` |
| 2.2 Revenus | ✅ | idem |
| 2.3 ADR | ✅ | idem |
| 2.4 RevPAR | ⚠️ c'est un **RevPAN** | idem (`revPan`) |
| 2.5 Réservations | ❌ | — |
| 2.6 Note moyenne | ❌ sur le dashboard (`reviewsApi` existe ailleurs) | — |
| 2.x Variation vs période préc. | ✅ en % (`KpiTrend.growth`) | idem |
| 3 Revenus mensuels direct/OTA | ❌ | — |
| 4 Répartition par canal | ✅ | `GET /dashboard/billing-overview?scope=` |
| 5.a Arrivées du jour | ❌ | — |
| 5.b Départs du jour | ❌ | — |
| 5.c Ménages du jour | ⚠️ compteur toutes interventions confondues | idem |
| 6 À traiter (liste) | ⚠️ compteurs seulement, pas de liste | idem |
| 7 Occupation par logement | ❌ sur le dashboard (`GET /properties/kpi-summaries` existe) | — |
| 8 Prochaines arrivées | ❌ | — |

## D. Suivi d'implémentation

### Vague 1 — Backend ✅

Constat de départ : la couche analytics était **bien plus fournie que prévu**.
Occupation, revenus, ADR, RevPAN, variation N‑1, répartition par canal et
occupation par logement existaient déjà. Les requêtes manquantes existaient en
repository sans être exposées. Le travail a donc été d'**exposer**, pas de calculer.

**Trois requêtes ajoutées** (les données étaient là) :
- `GuestReviewRepository.findPublicWithoutHostResponse(orgId)` — généralise
  `findNegativeWithoutResponse`, qui ne remontait que les notes sous un seuil ;
  le bloc « à traiter » veut **tous** les avis en attente de réponse.
- `SecurityDepositRepository.findHeldByReservationIds(ids)` — cautions encore
  retenues pour un lot de réservations, en **une** requête (pas de N+1).
- `ICalFeedRepository.findStaleOrFailing(orgId, staleBefore)` — flux en échec,
  jamais synchronisés, ou muets depuis 24 h.

**Nouveau `DashboardOperationsController`** (`/api/dashboard`) :

| Route | Sert | Blocs de la projection |
|---|---|---|
| `GET /operations/today` | arrivées, départs, ménages du jour | §5.a, §5.b, §5.c |
| `GET /upcoming-arrivals?days=7` | prochaines arrivées | §8 |
| `GET /action-items` | soldes dus, avis sans réponse, flux désynchronisés | §6 |

`DashboardOperationsService` suit la discipline de
`DashboardOverviewSummaryService` : org-scope depuis le contexte tenant, scoping
par rôle (HOST → ses logements, opérationnels → leurs interventions), lecture
seule, **aucune entité JPA exposée**, dates dans la zone du `Clock` applicatif.
Toutes les listes sont **bornées à 20 lignes** — une organisation avec 400
arrivées le même jour ne doit pas les transporter.

Vérification : `mvn package` → **BUILD SUCCESS, 13 041 tests, 0 échec**,
règles ArchUnit comprises.

### Vague 1bis — Backend restant

- [ ] **Nombre de réservations** (§2.5) — à ajouter à
      `DashboardOverviewSummaryDto` (`KpiTrendDto bookings`).
- [ ] **Note moyenne + nombre d'avis** (§2.6) — les quatre méthodes repo
      existent (`averagePublicRatingByOrgId`, `countPublicByOrgId`) mais ne sont
      exposées par **aucun** contrôleur admin.
- [ ] **Revenus mensuels direct vs OTA** (§3) — faisable **sans code serveur**
      via `POST /api/reports/views/execute` avec
      `{dimensions:["PERIOD","CHANNEL"], metrics:["REVENUE"], granularity:"MONTH"}`.
      À trancher : réutiliser le Report Builder ou ajouter un champ dédié à
      `PortfolioAnalyticsDto.RevenueMetrics`.

### Vague 1bis — Backend complété ✅

- `DashboardOverviewSummaryDto` gagne **`bookings`** (`KpiTrendDto`) et
  **`guestRating`** (`average`, `count`).
- « Réservations de la période » = celles qui **commencent** dans la fenêtre :
  un séjour à cheval n'est pas compté deux fois.
- Deux requêtes d'avis ajoutées, **bornées à la période ET au périmètre de
  l'hôte** : `GuestReview` ne portant qu'un `propertyId` sans relation, le
  filtre propriétaire passe par un `EXISTS`. Sans lui, un hôte aurait vu la
  moyenne de toute l'organisation, logements des autres compris.

### Vague 2 — Front : couche API + hooks ✅

- `services/api/dashboardOperationsApi.ts` — types + trois appels.
- `hooks/useDashboardOperations.ts` — trois requêtes **séparées** volontairement :
  la journée en cours bouge à chaque arrivée, les éléments à traiter au fil de
  l'eau, les arrivées à venir sont quasi statiques. Durées de fraîcheur
  distinctes (1 min / 2 min / 5 min).
- `dashboardOverviewApi` étendu (`bookings`, `guestRating`), avec un commentaire
  qui signale que `revPan` est un **RevPAN**, pas un RevPAR.

### Vague 3 — Front : assemblage ✅ (partiel)

`modules/dashboard/blocks/DashboardOperationsBlocks.tsx` — trois blocs en
Baitly UI, montés dans `DashboardOverview` **derrière `showFinancialKpis`** :
un intervenant garde ses propres KPI et son planning, sans arrivées ni soldes.
Chaque bloc a son `DashboardErrorBoundary` — un endpoint en échec masque **sa**
carte, pas le dashboard.

| Bloc | §  | État |
|---|---|---|
| Opérations du jour (arrivées / départs / ménages) | §5 | ✅ |
| À traiter | §6 | ✅ |
| Prochaines arrivées (7 j) | §8 | ✅ |
| KPI Réservations | §2.5 | ✅ |
| KPI Note moyenne | §2.6 | ✅ |

Détails tenus : pastille de canal colorée, heure d'arrivée en `tabular-nums`,
fenêtre de ménage (« 11:00 → 15:00 » / « avant 15:00 »), icône teintée par
nature d'alerte, statut de paiement où **le solde dû prime sur le statut brut**,
et un **état vide propre par carte** — un dashboard sans arrivée le dit au lieu
d'afficher une carte creuse.

### Vague 4 — les quatre éléments restants ✅

| § | Élément | Mise en œuvre |
|---|---|---|
| §3 | Revenus mensuels direct vs OTA | `MonthlyRevenueSplitCard` — **aucun code serveur** : le moteur de rapports croise déjà `PERIOD × CHANNEL` en granularité `MONTH`. Le regroupement direct/OTA se fait côté client, avec une règle prudente : **tout canal inconnu compte comme OTA**, pour ne jamais gonfler le direct par accident. |
| §7 | Occupation par logement | `OccupancyByPropertyCard` — `occupancy.byProperty` du portefeuille, trié décroissant. Seuils de couleur de la projection tenus (≥ 70 % succès, ≥ 50 % primaire, sinon warning) et `role="progressbar"` correctement annoté. |
| §1.4 | Badge « N à traiter » | Chip warning sur le titre, **onglet Vue d'ensemble uniquement**, masqué à zéro. Alimenté par `useDashboardActionItems` — **déjà monté** par `ActionItemsCard`, donc React Query dédoublonne : aucun appel réseau supplémentaire. |
| §1.2 | Sous-titre contextuel | « Mercredi 23 juillet · 4 logements actifs ». Remplace la description figée de l'onglet : sur un écran consulté quotidiennement, la date et le parc actif valent mieux qu'un rappel de ce que contient la page. Le mécanisme `resolveTabHeader` est **intact** — seul le libellé de l'onglet Vue d'ensemble change. |

Couverture de la projection : **§1 à §8 rendus**, à l'exception de §4 ci-dessous.

### Vague 5 — recentrage sur la projection ✅

Le rendu mixte MUI / Baitly ne tenait pas. L'écran est désormais **entièrement**
en Baitly UI, sur la disposition de la projection.

**Supprimés** — absents de la projection, et seuls consommateurs de leurs fichiers :

| Fichier supprimé | Ce qu'il portait |
|---|---|
| `ServicesStatusWidget.tsx` | bruit, serrures, boîtes à clés, booking engine |
| `ActionCountersWidget.tsx` | 5 compteurs cliquables — remplacés fonctionnellement par « À traiter » |
| `MiniPlanningWidget.tsx` | timeline 7 jours × 5 logements |
| `AiUsageWidget.tsx` | consommation IA |
| `BillingOverviewWidget.tsx` | revenus par canal — **repris** en Baitly (`RevenueByChannelBlock`), bascule mois/année comprise |
| `ContextualTipsWidget.tsx` · `ChannelHealthWidget.tsx` | désactivés en dur depuis longtemps |
| `ContractCTABanner.tsx` | CTA contrats, plateforme uniquement |
| `DashboardSkeleton.tsx` | squelette MUI — remplacé par un squelette à la trame de la grille |

`AnalyticsWidgetCard` et `GridSection` ne sont **pas** supprimés : 10 à 11 autres
écrans (Rapports) en dépendent. Ils ne sont simplement plus utilisés ici.

**Conservés hors projection, délibérément** :
- le **guide de démarrage** et son voile — ils disparaissent d'eux-mêmes une fois
  la configuration terminée, donc n'écartent pas du rendu cible ;
- la **variante rôles opérationnels**, portée en `StatTile` (même kit) : la
  projection ne décrit que la vue gestionnaire, et un intervenant n'a que faire
  d'un RevPAN. Invisible pour les rôles que la projection vise.

**Faille corrigée au passage** : `/api/dashboard/operations/*` renvoyait les
arrivées, départs et soldes dus de **toute l'organisation** à n'importe quel
utilisateur authentifié — un intervenant compris. Les trois endpoints renvoient
désormais des listes vides pour les rôles opérationnels, qui ne voient que leurs
propres interventions.

### Couverture finale

**§1 à §8 de la projection sont rendus**, en Baitly UI, sur la disposition
d'origine — y compris §4, dont le toggle mois/année a survécu à la bascule.

⚠️ **Rien de tout cela n'a été vu à l'écran.** Le typage, les tests unitaires et
`mvn package` garantissent la structure, pas le rendu.
