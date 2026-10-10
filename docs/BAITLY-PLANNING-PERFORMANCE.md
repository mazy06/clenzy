# Baitly : performance et montée en charge du planning

Audit du 10 octobre 2026. Périmètre : chargement du planning, calculs frontend,
requêtes et configuration serveur identifiables dans le dépôt. Aucun test de
charge serveur n'a été exécuté dans cet audit ; aucune capacité de production
n'est donc certifiée.

## Ce que mesurent les 119 ms et 4 ms

Comparaison locale de l'ancienne et de la nouvelle fonction `detectConflicts`,
sur le même jeu synthétique de 2 500 réservations réparties entre 50 logements.
Les 2 450 paires trouvées étaient identiques. Les temps observés étaient environ
119 ms et 4 ms : environ 30 fois plus rapide sur ce cas précis.

L'ancienne méthode était celle remplacée lors de la refactorisation de cette
fonction. Ce résultat ne mesure ni le chargement complet du planning, ni SQL,
ni le réseau, ni React, ni les performances avec des utilisateurs simultanés.
C'est une mesure ponctuelle, pas une distribution p95/p99 ni une garantie.

## Corrections réalisées

### Chargement visible et détails : deuxième lot du 10 octobre 2026

Les deux captures staging fournies montrent des détails de réservations en
1,36–1,96 s, presque entièrement en attente du premier octet, même avec les
assets en cache. Cela ne constitue pas une mesure SQL ni une preuve de capacité.

- Lecture dédiée des détails, bornée à 100 logements et 62 jours, après validation
  d'accès existante. La requête est toujours limitée à l'organisation. Elle charge
  les réservations et les seules valeurs associées utilisées par le DTO, sans
  hydrater logement, voyageur ou intervention. Les conversions JPA déchiffrent
  email et téléphone ; les noms chiffrés inutilisés du voyageur ne sont pas lus.
- Conversion DTO partagée avec le mapper existant : mêmes commissions réelles ou
  estimées, coordonnées, statut financier et URL de photo. Aucun cache de PII ajouté.
- Histogramme `baitly_planning_reservations_seconds` avec deux valeurs fixes de
  `phase` : `read` (requête et matérialisation, déchiffrement inclus) et `mapping`
  (conversion DTO). Aucun identifiant utilisateur/organisation dans les labels.
- Les détails de la zone réellement visible passent avant ceux du buffer. Après
  résolution ou erreur des lots prioritaires, les voisins peuvent démarrer. Le
  défilement conserve l'annulation et le délai de stabilisation de 250 ms.
- Le préchargement dashboard/propriétés depuis le planning attend la résolution
  des détails prioritaires. Les autres routes gardent leur préchargement habituel.

Preuves locales : 22 réservations lues et converties avec un seul statement SQL,
sans chargement de relation ; email/téléphone déchiffrés, nom chiffré inutilisé
volontairement illisible, réservation masquée et organisation étrangère exclues.
Un voyageur d'une autre organisation ne fournit aucune coordonnée. Tests de
priorité avec promesses différées, erreurs, changement de fenêtre et annulation.
Suite planning et test complémentaire : 524 tests ; 38 tests Java ciblés,
typecheck TypeScript et build de production réussis.

Validation attendue en staging après déploiement : comparer durée HTTP des détails,
les deux phases serveur, délai avant briques visibles et chargements froid/chaud
sur les mêmes comptes. Les tests locaux ne permettent pas d'annoncer un gain en ms.

- Catalogue dédié, projeté et paginé par 200 logements : toutes les pages sont
  lues, sans plafond silencieux de 1 000. Photos sous forme d'adresses, sans
  charger les blobs ; noms du propriétaire lus séparément pour préserver les
  convertisseurs de chiffrement JPA.
- `/planning/index` fournit une projection légère des réservations du
  portefeuille pour conserver recherche, filtres, occupation et conflits hors
  page. Les données personnelles et financières détaillées viennent de
  `/planning/reservations`, uniquement pour les logements affichés et celui du
  panneau ouvert. Lots bornés à 500 logements pour l'index, 100 pour les détails,
  et fenêtres serveur limitées à 62 jours. L'ancien `/planning/data` reste
  disponible pour compatibilité mais n'est plus utilisé par ce parcours.
- Validation d'accès groupée : utilisateur lu une fois, projection des logements
  par lot, avant toute lecture métier. Les règles de propriétaire, personnel de
  plateforme et organisation sont conservées, y compris le refus d'un lot mixte.
- Les lectures catalogue, index, détails, tarifs et minimums partagent une file
  de quatre requêtes actives par navigateur. Une lecture annulée en attente est
  retirée de la file ; cette borne ne limite pas les utilisateurs simultanés côté
  serveur.
- La grille calcule directement les IDs en conflit, sans matérialiser les paires.
  Tri et balayage : O(n log n), mémoire O(n), même si tous les séjours se
  superposent. L'occupation fusionne les intervalles par logement puis utilise
  un tableau de différences ; départ exclusif et annulations sont préservés.
- Les trois requêtes d'interventions du planning chargent aussi `serviceRequest`
  pour éviter les lectures supplémentaires de cette relation.
- Le panneau d'action est chargé à l'ouverture via `React.lazy`. Le build émet
  un chunk séparé d'environ 103 Ko bruts ; ce chiffre n'est pas une mesure du
  gain réseau total ou du temps d'interaction.

- Les trois fonctions `combine` de `usePlanningData`, `usePlanningPricing` et
  `usePlanningMinNights` ont une identité stable. Le code installé de TanStack
  (`node_modules/@tanstack/query-core/src/queriesObserver.ts`, `_combineResult`)
  relance le calcul si cette identité change. Pour les tarifs et minimums,
  reconstruire une `Map` recréait aussi sa référence, donc les props de grille.
- Les requêtes de données, prix et minimums transmettent désormais le signal
  d'annulation de TanStack jusqu'à `fetch`. Quitter une fenêtre sans autre
  observateur annule sa lecture côté navigateur. Cela ne garantit pas l'arrêt
  d'une requête SQL déjà démarrée côté serveur.
- Les tests utilisent un vrai `QueryClient` : 20 rendus locaux préservent les
  deux index, une modification de prix est bien affichée, et le démontage annule
  les requêtes en cours.

## Risques restants, dans l'ordre de traitement

### Vérification locale du lot

- 520 tests frontend planning passent, ainsi que le typecheck TypeScript et le
  build de production.
- 128 tests Java ciblés passent, dont les contrôles d'accès et les requêtes de
  projection exécutées réellement sur H2. Les lectures d'index et de projection
  d'accès testées exécutent chacune une requête sans hydrater d'entités.
- Catalogue de 1 101 logements : pagination complète vérifiée côté client et
  requête paginée vérifiée côté JPA. Index client découpé en lots de 500.
- Conflits : équivalence avec l'ancien résultat sur un jeu aléatoire et cas de
  10 000 séjours superposés. Occupation comparée au calcul naïf, incluant jours
  non triés, doublons, départ exclusif et annulations.
- File de lectures : concurrence, annulation en attente et libération après
  erreur vérifiées. Script k6 contrôlé hors réseau pour les quatre routes et
  les formes des réponses ; aucun test de charge réseau exécuté.

Ces preuves ne remplacent ni les plans PostgreSQL réels ni la mesure de charge.
L'interface n'a pas fait l'objet d'une nouvelle preview visuelle dans ce lot.

| Priorité | Constat vérifiable | Conséquence | Travail à faire et preuve attendue |
|---|---|---|---|
| P1 | L'index léger reste global ; interventions, demandes de paiement et blocages restent chargés sur le portefeuille. Le catalogue est entièrement lu. | Travail et volume encore proportionnels au portefeuille, malgré les détails de réservation limités à la page. | Mesurer octets, SQL et p95 sur 10/100/1 000 logements, puis envisager recherche et agrégats serveur en préservant conflits et rattachements hors page. |
| P1 | Le test existant `load-test.js` monte à 50 VUs et ne lit pas `/planning/data`. | Il ne détermine pas la capacité du nouveau parcours planning, ni celle de plusieurs organisations. | Scénario dédié fourni ci-dessous, avec plusieurs comptes, débit imposé, p95/p99, erreurs, 429 et itérations abandonnées. Exécution sur staging représentatif. |
| P2 | Les interventions utilisent encore des entités et DTO complets. | Hydratation potentiellement coûteuse même après ajout du fetch de `serviceRequest`. | Compter SQL et allocations avec 100 puis 1 000 interventions ; envisager une projection dédiée. |
| P2 | Les index réservations repérés portent séparément sur organisation, propriété et dates. La lecture planning combine ces critères et le chevauchement. | Le coût dépend du plan PostgreSQL et de la taille réelle des tables. | `EXPLAIN (ANALYZE, BUFFERS)` sur données staging réalistes. Choisir un index composite/partiel ou une stratégie de plages selon le plan, puis migration Liquibase. Ne pas ajouter des index à l'aveugle. |
| P2 | Les lectures d'arrière-plan sont désormais bornées mais la file est FIFO. | Préchargement encore potentiellement inutile lors de navigations rapides. | Mesurer cache, annulations et délai de la fenêtre visible avant de modifier la priorité et la politique de préchargement. |
| P2 | Le build signale des chunks volumineux et des modules importés à la fois statiquement et dynamiquement. | Téléchargement et exécution initiale restent coûteux, notamment sur mobile. | Mesurer les chunks réellement chargés au planning ; différer les panneaux lourds jusqu'à ouverture. Comparer JS transféré, temps d'exécution et interactions sur un appareil ralenti. |

## Ce qui existe déjà et doit être préservé

- Une lecture d'index groupe les quatre collections globales par tranche et lot.
- Tarifs et minimums chargés pour la page de logements affichée, en lot.
- `PlanningPricingService.pricingRows` groupe les lectures métier en quatre
  requêtes annoncées par le code, dans une transaction en lecture seule.
  Cette borne ne comprend pas les validations d'accès du controller.
- Pagination des lignes et memo des composants, index des événements par propriété,
  et un seul observateur de largeur partagé pour les briques.
- Histogrammes HTTP existants et routage des transactions read-only vers une
  datasource de lecture en profil prod.

La configuration prévoit 25 connexions primary et 15 replica par instance,
surchargeables par variables d'environnement. Sans URL replica distincte, les
deux pools utilisent la même base. Le dépôt ne prouve pas qu'une replica distincte
est réellement déployée. Ajouter des instances multiplie les pools : dimensionner
le budget de connexions global avec PostgreSQL, plutôt qu'augmenter chaque pool.

Un cache serveur éventuel doit inclure organisation, périmètre autorisé, logement
et dates, avec invalidation lors des mutations. Ne pas cacher des réponses
personnalisées sous une simple clé de dates. La cohérence après modification et
l'isolation entre organisations doivent être testées avant adoption.

## Scénario de charge dédié

Script : `tests/performance/baitly-planning-load.js`.

Une itération effectue quatre GET en parallèle : index du portefeuille sur une
tranche, détails de réservation, tarifs et minimums de nuits de la première page.
Chaque compte du script cible au maximum 500 logements, et la page au maximum
100. Le test ne simule pas l'assemblage de plusieurs lots d'un plus grand
portefeuille, ni le catalogue. Il s'agit d'un scénario
de lectures par fenêtre, pas d'une simulation complète du navigateur et de son
cache, de tous les buffers, de l'authentification ou des écritures.

Le modèle à débit imposé permet de continuer à proposer des lectures lorsque le
serveur ralentit. Des `dropped_iterations` indiquent que le générateur n'a pas pu
suivre ; vérifier aussi ses ressources avant d'attribuer cela au serveur.
Références : [ramping-arrival-rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-arrival-rate/)
et [dropped iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/).

Préparer un fichier externe, non versionné, de comptes de staging avec jetons de
durée suffisante. Chaque compte ne doit cibler que ses logements de test :

```json
[
  { "token": "<JWT du compte A>", "propertyIds": [101, 102] },
  { "token": "<JWT du compte B, autre organisation>", "propertyIds": [201, 202] }
]
```

Exemple d'exécution sur un staging préparé, à adapter ; non exécuté dans cet audit :

```sh
rtk proxy env BASE_URL=https://<staging> PERF_ACTORS_FILE=/tmp/baitly-perf-actors.json \
  PLANNING_WINDOWS_PER_SECOND=10 PLANNING_VUS=100 \
  PLANNING_FROM=2026-10-01 PLANNING_TO=2026-10-31 \
  k6 run tests/performance/baitly-planning-load.js
```

Le fichier de comptes contient des secrets : le conserver hors dépôt et hors
artifacts CI. Les métriques utilisent des noms de routes constants, sans token,
ID de compte ou ID de logement comme label.

Le débit par défaut est 10 fenêtres/s, soit 40 GET/s proposés. Exécuter ensuite
des paliers 25/50/100 fenêtres/s si le palier précédent passe. Utiliser assez de
comptes distincts pour ne pas mesurer uniquement la limite par utilisateur de
300 requêtes/min évoquée dans les hooks : à 40 GET/s répartis uniformément,
8 comptes atteindraient déjà cette limite moyenne, sans marge. Identifier les
429 séparément ; ne pas désactiver la protection pour masquer un résultat.

Seuils proposés, à valider produit : p95 API < 500 ms, p99 < 1 500 ms, erreurs
< 1 %, p95 fenêtre < 1 500 ms, aucune itération abandonnée. Ces seuils sont des
objectifs, pas des résultats obtenus. Les réponses doivent être des collections
valides et ne contenir que les propriétés du compte ciblé.

Pour chaque palier enregistrer : débit réellement atteint, CPU, heap/GC Java,
connexions Hikari actives/en attente, durée et nombre SQL, buffers/locks PostgreSQL,
retard replica, octets par réponse et erreurs. Répéter sur caches froids/chauds,
petits/grands portefeuilles et plusieurs organisations. Ajouter ensuite mutations
et synchronisations OTA simultanées, puis un plateau long pour détecter les fuites.

La capacité sera le dernier palier soutenu respectant ces seuils sur cette
infrastructure et ce jeu de données. Un nombre d'utilisateurs inscrits seul ne
permet pas de la déduire : il faut sessions actives, fréquence de lecture,
taille des portefeuilles et débit des écritures.

## Mesurer l’affichage du planning Baitly

Une réponse réseau terminée et un LCP rapide ne disent pas quand les réservations sont affichées. Le planning expose des entrées User Timing, visibles dans la trace Chrome Performance :

| Entrée | Signification |
| --- | --- |
| `baitly.planning.mount` | Montage de la page, après les étapes de démarrage et d’authentification. |
| `baitly.planning.data-ready` | Commit React avec préférences résolues, index initial réglé et détails de la période visible disponibles. Une erreur de lecture empêche la publication d’un succès. |
| `baitly.planning.ready` | Le contenu prêt a traversé deux callbacks de frame dans un document visible. |
| `baitly.planning.mount-to-ready` | Durée entre le montage de la page et ce repère d’affichage. |
| `baitly.planning.navigation-to-ready` | Durée depuis le début du document, uniquement au premier montage quand le document a été chargé directement sur `/planning`. Inclut le démarrage et le SSO. |

Ces repères sont publiés une fois par montage. Une navigation ou un démontage annule les callbacks en attente. Le repère `ready` marque une occasion de peinture du contenu commité, pas la fin des animations, le chargement de toutes les photos ou une preuve que chaque pixel a été peint. La bande de captures de la trace reste la vérification visuelle.

Le préchargement des écrans fréquents démarre après ce repère, pendant l’inactivité du navigateur. Les périodes voisines continuent de charger en arrière-plan. Les prix et indicateurs complémentaires ne conditionnent pas ce repère : le planning peut afficher les réservations avant ces compléments.

Pour comparer deux versions, utiliser le même compte, la même période, le même zoom et les mêmes logements. Conserver le même réglage de cache et refaire plusieurs mesures. Une capture avec un profil de navigateur sans extensions aide à distinguer le coût du produit de celui des outils. Comparer le CLS, les tâches longues et `mount-to-ready` avec l’arrivée des réponses API et la bande de captures. Ces mesures à un utilisateur ne remplacent pas un test de charge multi-comptes.

Les marqueurs ne contiennent aucun identifiant utilisateur ou de logement. Ils restent dans les API Performance du navigateur et ne déclenchent pas de nouvelle requête de télémétrie.
