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

## Démarrage et lecture serveur : lot suivant

PostHog est importé dynamiquement uniquement lorsqu'une clé est configurée. Son
initialisation, l'ajout du replay Sentry et le chargement du widget Crisp attendent
le repère d'affichage du planning puis une période idle. Les autres routes attendent
deux frames. Un délai de secours de 10 secondes évite de bloquer ces outils si la
page échoue ; le callback idle est lui-même borné à 5 secondes. Sentry conserve
la capture initiale des erreurs. Les événements PostHog explicites sont mis en
attente dans une file mémoire limitée à 200, sans stockage supplémentaire ; une
initialisation échouée vide cette file. Le masquage des textes, attributs et inputs
des replays est conservé. L'autocapture ne commence qu'à l'initialisation différée.

Les réponses réussies de `/api/planning/reservations` exposent `Server-Timing` :
`authz` mesure la validation d'accès au lot et `details` l'appel transactionnel
de lecture/conversion des détails. Ces durées ne mesurent pas les filtres de
sécurité en amont, la sérialisation JSON ou le réseau. Les histogrammes existants
`baitly_planning_reservations_seconds` séparent ensuite `read` et `mapping`.
Les labels sont fixes et ne contiennent aucune donnée personnelle. Le prochain
HAR permet de comparer ces phases au délai d'attente du premier octet, avant
de choisir une optimisation SQL ou de déchiffrement. Aucun gain serveur ni
capacité multi-utilisateurs ne peut être déduit de l'ajout de ces repères.
## Lecture des coordonnées et démarrage : prochain relevé staging

Les détails du planning lisent désormais les réservations sans leurs coordonnées,
puis les seules coordonnées des voyageurs distincts présents dans cette lecture.
Deux requêtes groupées remplacent la jointure qui déchiffrait les mêmes colonnes
pour chaque séjour. Les deux lectures restent filtrées par organisation ; les
identifiants voyageurs viennent uniquement des réservations déjà autorisées.
Aucun cache de coordonnées n'est conservé entre requêtes. Les paramètres AES,
la clé et le comportement strict en cas de déchiffrement invalide sont inchangés.

Le convertisseur utilise désormais le pool Jasypt de la même implémentation
`StandardPBEStringEncryptor`, avec l'algorithme et le générateur d'IV configurés
par `AES256TextEncryptor`. Le pool est borné au nombre de processeurs disponibles,
avec un maximum de quatre instances ; aucun thread de travail supplémentaire
n'est créé. Les clés, la dérivation, les sels, les IV et le format stocké restent
compatibles. Les tests vérifient la lecture des anciens chiffrés par le pool,
la lecture des nouvelles écritures par l'ancien lecteur, et les lectures et
écritures simultanées de huit utilisateurs synthétiques.

Le probe local sur des valeurs synthétiques montre que le lecteur unique
sérialise quatre requêtes de 182 champs (environ 290 ms au total après chauffe,
contre environ 80 ms avec quatre lecteurs indépendants sur cette machine).
Ce résultat identifie une contention, sans prédire le temps sur le staging ni
certifier une capacité utilisateurs. Le pool vise la concurrence entre requêtes ;
il ne divise pas le coût cryptographique d'une requête isolée et reste limité
par les ressources CPU du serveur.
Le même probe exécuté avec le pool Jasypt configuré comme le convertisseur
mesure environ 106 à 178 ms pour les quatre lectures, contre 297 à 389 ms pour
le lecteur partagé, selon la chauffe et la charge locale. Ces chiffres restent
des mesures synthétiques de déchiffrement, pas des latences HTTP.

`Server-Timing` conserve `authz` et `details`, avec quatre repères supplémentaires :

| Repère | Périmètre |
| --- | --- |
| `rows` | Lecture et hydratation des réservations sans coordonnées |
| `contacts` | Déduplication des voyageurs, lecture et déchiffrement des coordonnées |
| `decrypt` | Temps cumulé dans le déchiffreur pendant `contacts` |
| `mapping` | Conversion des lignes et coordonnées en DTO |

`decrypt` est inclus dans `contacts`, et les quatre phases sont incluses dans
`details` : ne pas additionner ces durées imbriquées. `rows` et `contacts` ne
sont pas des mesures SQL pures. `details` inclut aussi l'encadrement transactionnel.
Le test de projection réel vérifie vingt séjours d'un même voyageur : deux
déchiffrements de coordonnées au lieu de quarante, et aucun chargement de ses
autres champs chiffrés. Avec presque uniquement des voyageurs distincts, le gain
sera limité ; le prochain HAR doit mesurer le bilan des deux requêtes.

Le code de Sentry Replay est importé après le premier affichage du planning,
via le même ordonnanceur que les analytics. La collecte d'erreurs Sentry reste
initialisée au démarrage. Le login, la palette de commandes et les illustrations
du guide sont également des imports dynamiques : le planning ne télécharge pas
les modules qu'il n'affiche pas. Le lanceur du guide et les raccourcis restent
disponibles dans la coquille.

La trace Performance comprend des repères fixes `baitly:boot:*` : `auth-start`,
`session-received`, `me-received`, `entry-evaluated`, `translations-ready`,
`root-render`, `user-ready`, en plus des repères existants du planning.
Ils ne contiennent aucune donnée de compte. Le début de navigation et les
Resource Timings restent nécessaires pour mesurer téléchargement et évaluation
des dépendances avant ces repères. Les parcours sans session ou en erreur
peuvent omettre certains repères.

Pour comparer au relevé 8, garder le même compte, la même fenêtre et les mêmes
conditions de cache. Enregistrer aussi un relevé sans extensions actives :
React DevTools intervient dans les profils précédents. Comparer le moment où
la grille complète est visible, pas seulement le LCP du header. Vérifier
`Server-Timing`, les repères boot et que le chunk Replay arrive après le repère
de disponibilité du planning. Plusieurs rechargements sont nécessaires pour
distinguer un gain reproductible d'une variation de charge du staging.

## Relevé 9 et publication conjointe des prix

Comparaison des traces du 10 octobre à 08:05 et 09:10, même fenêtre centrale
et 98 séjours pour 11 logements :

| Mesure | Relevé 8 | Relevé 9 |
| --- | ---: | ---: |
| Navigation → planning prêt | 4 957 ms | 2 188 ms |
| Montage → planning prêt | 1 917 ms | 1 514 ms |
| Réponse détaillée centrale HTTP | 1 050 ms | 1 113 ms |
| Réponse prix centrale HTTP | 308 ms | 141 ms |
| Blocage du thread principal, premières 5 s | 1 399 ms | 294 ms |

Le relevé 9 utilise davantage le cache : 203 ressources du frame principal
servies depuis le cache navigateur/service worker contre 80 dans le relevé 8.
Ces captures ne constituent donc pas une mesure contrôlée du gain du code.
Le LCP (684 ms) concerne toujours le header ; le repère du planning est plus
pertinent pour cette grille. Le CLS est de 0,032, contre 0,000065 auparavant.

Les nouveaux repères isolent le démarrage : entrée évaluée à 193 ms,
session reçue à 387 ms, profil reçu à 558 ms, planning monté à 673 ms.
Sur la réponse centrale, `rows` vaut 31 ms, `contacts` 985 ms, dont
770 ms de déchiffrement, et `mapping` 0,5 ms. Le coût dominant reste donc
celui des coordonnées, sans amélioration démontrée de cette réponse HTTP.

Les prix centraux sont reçus à 1 578 ms et les détails à 2 041 ms.
Pour supprimer leur publication décalée, le squelette initial reste affiché
jusqu'au règlement des requêtes de prix et de détails pour la période visible.
Les prix prioritaires sont demandés avant ceux du buffer voisin ; ces derniers
ne conditionnent pas la publication. Les prix désactivés ne sont pas attendus.
Une erreur est affichée sans attente infinie. Après publication initiale,
la grille reste montée pendant le scroll pour préserver sa position.

Le repère `baitly.planning.ready` attend maintenant aussi les prix visibles.
Il mesure donc une grille initiale plus complète. Au prochain relevé, comparer
les réponses, ce repère et les captures visuelles, avec les mêmes conditions
de cache et plusieurs rechargements pour confirmer la reproductibilité.

## Investigation des quatre chantiers prioritaires

1. **Coordonnées.** Préparer une lecture des briques sans téléphone, avec email
   et avatar conservés pour l'indicateur d'email manquant. Le panneau récupère
   la fiche complète à son ouverture. Comparer cette lecture à l'endpoint
   complet, avec les mêmes voyageurs et `Server-Timing`.
2. **Multi-comptes.** Le workflow infra `Baitly planning staging benchmark`
   prépare douze comptes machine répartis dans douze organisations de test.
   Il propose 1, puis 5 et éventuellement 10 fenêtres/s ; un palier échoué
   empêche toute augmentation supplémentaire. Aucun test réseau n'est validé
   tant que les résultats du workflow n'ont pas été examinés.
3. **Portefeuilles.** Quatre comptes pour chacune des tailles 10, 100 et
   1 000 logements. Le scénario peut parcourir toutes les pages du catalogue,
   découpe l'index en lots de 500 et garde détails/prix sur la première page.
   Il vérifie le catalogue complet et le périmètre de chaque réponse.
4. **SQL et interventions.** Recueillir schéma/index et plans PostgreSQL
   `EXPLAIN (ANALYZE, BUFFERS)` sur ces fixtures, avant tout nouvel index.
   Préparer la projection des interventions et de leurs rattachements, avec
   isolation de l'organisation et conservation des fins après minuit.

### Fixtures staging et périmètre des mesures

Le workflow n'est dispatchable que depuis `main`, avec le domaine fixe
`app.clenzy.fr`, contrôlé sur le VPS avant tout appel Keycloak, SQL ou API.
L'environnement GitHub `production` est son **nom historique pour le staging**,
comme dans le CD ; `production-baitly` n'est jamais une cible de ce workflow.
Il partage la file de déploiement staging pour éviter un déploiement pendant
la mesure. Le mode `schema` ne lit que les métadonnées, sans créer de compte.

Les clients `baitly-perf-*` sont des identités machine applicatives de test,
avec rôle `SUPER_ADMIN` et profil rattaché à leur organisation dédiée : cela
inclut les interventions comme dans le parcours de l'administrateur observé.
Ils n'ont aucun rôle d'administration Keycloak. Ils sont marqués explicitement,
désactivés à la sortie du workflow et n'ont pas de connexion interactive.
Un client existant non marqué est refusé. Un jeton déjà émis peut rester valide
jusqu'à son expiration de cinq minutes ; aucun secret ni jeton n'est publié.

Chaque logement contient quatre séjours de quatre nuits, sans chevauchement,
avec quatre IDs voyageurs distincts, et une intervention. Les coordonnées
chiffrées proviennent d'un voyageur synthétique créé par l'API et sont copiées
uniquement dans les fixtures : même texte fictif, IDs distincts pour conserver
le travail de déchiffrement. Les réservations ont leurs automatisations
suspendues. Les organisations/données restent disponibles pour refaire une
mesure ; les comptes machine sont désactivés entre les exécutions.

Les acteurs et secrets sont conservés dans des fichiers privés temporaires
en mode 0600, hors des artifacts. Ceux-ci contiennent uniquement les métriques,
plans, métadonnées, SHA du code de mesure et échantillons CPU/RSS Docker,
connexions/buffers PostgreSQL. Les métriques excluent le tag URL ; leurs labels
de route sont fixes. `planning_response_bytes` mesure le corps UTF-8 décompressé,
pas les octets effectivement transférés sur le réseau.

Le scénario mesure les lectures API : les lots d'index sont proposés en
parallèle, sans reproduire toute la file du navigateur. Il ne mesure pas le
temps d'affichage React, les écritures, les OTA ou un environnement de production.
Les plans SQL utilisent des lectures représentatives sur les données synthétiques ;
ils ne constituent pas une capture automatique de toutes les requêtes Hibernate.
La RSS Docker n'est pas la heap/GC Java et les connexions PostgreSQL ne remplacent
pas les métriques d'attente Hikari. Ces limites doivent accompagner les résultats.

Le mode `baseline` utilise `/planning/reservations`, et le mode `cards`
`/planning/reservation-cards`. Les fixtures sont réutilisées pour comparer les
deux lectures. Les modes `schema`, `baseline`, `cards` et `disable` n'effectuent
aucun redémarrage de container. Les seuils k6 restent des objectifs : un workflow
rouge peut signaler une mesure terminée avec des seuils dépassés, pas un échec
du déploiement.

### Lectures applicatives préparées pour la comparaison

- `/planning/reservation-cards` applique les mêmes gardes logement/organisation,
  limites et `Server-Timing` que la lecture complète, mais ne sélectionne pas le
  téléphone. L'email et l'avatar restent disponibles pour les briques et l'alerte
  d'email manquant. `/planning/reservations` conserve son contrat complet.
- Le panneau demande la réservation complète à son ouverture. La requête est
  annulable et appartient à la même famille de cache que le planning, pour être
  invalidée après une modification. La grille reste consultable pendant cette
  lecture et en cas d'erreur du panneau.
- L'index utilise une projection des interventions et une lecture groupée de
  leurs liens explicites vers les réservations. Les noms chiffrés des intervenants
  sont lus séparément, par identifiant distinct et par lots de 500 : la répétition
  d'une personne ne multiplie pas ses déchiffrements. Le repli via la demande de
  service et les fins après minuit sont conservés.

Le contrôle `schema` du staging a réussi (workflow infra `38036790728`). Il
confirme les index `(organization_id, scheduled_date)` et
`(property_id, scheduled_date)` des interventions. Aucun index supplémentaire
n'est encore décidé : il faut les plans et les mesures sur les fixtures.
Le premier provisioning a reçu un HTTP 401 avant le lancement de la charge ;
les clients ont été désactivés à la sortie. La PR 428 ajoute uniquement aux
clients de test l'audience `clenzy-api` exigée par la sécurité JWT existante.
La nouvelle référence est lancée par le workflow `38037278661` ; aucune valeur
de capacité n'est déclarée avant examen de ses résultats.
