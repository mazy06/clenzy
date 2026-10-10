# Baitly : performance et montée en charge du planning

Audit du 10 octobre 2026. Périmètre : chargement du planning, calculs frontend,
requêtes et configuration serveur identifiables dans le dépôt. Les premières
mesures locales ont été complétées par des tests API sur staging, décrits en
fin de document. Aucune capacité de production n'est certifiée.

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

1. **Coordonnées.** Lecture déployée des briques sans téléphone, avec email
   et avatar conservés pour l'indicateur d'email manquant. Le panneau récupère
   la fiche complète à son ouverture. Les tests vérifient le contrat et la
   comparaison API utilise les mêmes voyageurs que la lecture complète.
2. **Multi-comptes.** Le workflow infra `Baitly planning staging benchmark`
   prépare douze comptes machine répartis dans douze organisations de test.
   Il propose 1, puis 5 et éventuellement 10 fenêtres/s ; un palier échoué
   empêche toute augmentation supplémentaire. Aucun test réseau n'est validé
   tant que les résultats du workflow n'ont pas été examinés.
3. **Portefeuilles.** Quatre comptes pour chacune des tailles 10, 100 et
   1 000 logements. Le scénario peut parcourir toutes les pages du catalogue,
   découpe l'index en lots de 500 et garde détails/prix sur la première page.
   Il vérifie le catalogue complet et le périmètre de chaque réponse.
4. **SQL et interventions.** Schéma/index et plans PostgreSQL
   `EXPLAIN (ANALYZE, BUFFERS)` recueillis sur ces fixtures avant le nouvel index.
   Projection déployée des interventions et de leurs rattachements, avec
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
Un portefeuille partage ici un propriétaire et un intervenant. Ce cas exerce
la déduplication d'une même personne ; le gain sera moindre sur un portefeuille
ayant un propriétaire ou un intervenant distinct pour chaque logement.

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

### Lectures applicatives déployées pour la comparaison

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
`(property_id, scheduled_date)` des interventions. Les plans sur les fixtures
ont ensuite motivé le changeset 0547 présenté ci-dessous.
Le premier provisioning a reçu un HTTP 401 avant le lancement de la charge ;
les clients ont été désactivés à la sortie. La PR 428 ajoute uniquement aux
clients de test l'audience `clenzy-api` exigée par la sécurité JWT existante.
Deux autres erreurs de préparation (route de profil et mise à jour du mapper
d'audience) ont été corrigées avant la référence complète `38038127277`.

### Référence de charge staging du 10 octobre (workflow 38038127277)

Les douze comptes techniques et leurs organisations ont été créés : 4 comptes
pour chacune des tailles 10, 100 et 1 000 logements, soit 4 440 logements,
17 760 séjours, 17 760 voyageurs et 4 440 interventions synthétiques au total.
Les clients ont été désactivés à la sortie ; les données sont réutilisables.
Les appels ont vérifié le périmètre des logements et le catalogue complet.

Débit cible identique de 1 fenêtre/s, catalogue parcouru intégralement :

| Portefeuille | Fenêtres terminées | Catalogue p95 / page | Index p95 / lot | Détails p95 | Fenêtre API p95 | Taux de contrôles en erreur | Itérations non démarrées |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 logements | 164 | 256 ms | 365 ms | 508 ms | 767 ms | 0 % | 0 |
| 100 logements | 164 | 644 ms | 303 ms | 459 ms | 1 121 ms | 0 % | 0 |
| 1 000 logements | 134 | 8 828 ms | 10 001 ms | 8 374 ms | 45 348 ms | 14,8 % | 31 |

Le palier multi-comptes (12 identités, sans relecture du catalogue, cible
1 fenêtre/s) a terminé 164 fenêtres, sans erreur, sans 429 et sans itération
non démarrée. Fenêtre API p95 637 ms, index p95 621 ms, détails p95 598 ms.
Les objectifs de 500 ms p95 de l'index/détails restent dépassés : le scénario
n'a pas lancé le palier 5 fenêtres/s. Le workflow termine donc avec le code
de seuil k6 99, après les mesures et le nettoyage, pas avec un échec de setup.

Les valeurs API ne sont pas des temps de peinture React. Le taux d'erreur
agrège les contrôles de réponse et de catalogue, pas uniquement les statuts
HTTP. Les timeouts de la cohorte 1 000 ont atteint la limite de 10 secondes.
Les portefeuilles sont testés successivement, pas comme une comparaison à
concurrence strictement identique de tous leurs appels SQL.

Les plans représentatifs révèlent 500 scans de `reservations` par lot de
500 interventions : environ 17 994 lignes parcourues à chaque scan,
258 500 blocs déjà en cache visités et 1 628 / 1 720 ms d'exécution SQL sur
les deux lots du portefeuille 1 000. Les lectures représentatives des
réservations seules prennent 8 / 14 ms. Les index existants des interventions
ne corrigent pas le sous-plan de recherche des réservations liées.

Les 48 échantillons Docker ont observé un maximum de CPU de 349 % pour
`pms-server` (plusieurs cœurs), 52 % pour PostgreSQL et 9 % pour Redis. La RSS
serveur au pic CPU était de 1,80 GiB pour une limite de container de 2,5 GiB.
Ce sont des échantillons globaux, pas des métriques heap/GC ni une preuve
d'absence d'attente Hikari. Aucun deadlock PostgreSQL n'a été comptabilisé
sur l'intervalle observé.

Corrections motivées par cette référence :

- changeset Liquibase 0547 : index partiel
  `(organization_id, intervention_id, id)` des réservations liées, partagé
  par le rattachement groupé et l'exclusion des interventions masquées ;
- catalogue : sélection des identifiants propriétaires, puis lecture de
  leurs noms par personne distincte sur la page. Pour 200 logements du même
  propriétaire, deux déchiffrements remplacent les 400 de la projection
  répétée. Le périmètre suit les logements autorisés, y compris un propriétaire
  membre de plusieurs organisations ;
- aucune nouvelle indexation des dates de réservation décidée à ce stade,
  leur lecture représentative n'étant pas le coût dominant mesuré.

La PR 429 a fusionné le premier lot au SHA `4fbd45a17776dfa52b70e5e7871f10d672704960`.
La PR 432 a fusionné les corrections mesurées au SHA
`d860c6eb78e60427bed1fabf6fe04d259c26b604`. Le CD backend staging
`38042454640` a réussi le 10 octobre à 09:47 UTC, avec ce tag d'image et la
destination vérifiée `https://app.clenzy.fr`.
Les métadonnées staging exportées par `38042718411` confirment la présence de
`idx_baitly_reservation_org_intervention` avec les trois colonnes et le prédicat
partiel prévus, après ce déploiement Liquibase.

Le changeset réel a aussi été exécuté sur PostgreSQL 15 en CI : l'index est
valide, le plan de rattachement l'utilise et les liens retournés restent
identiques. Les tests H2 vérifient zéro déchiffrement sur la projection du
catalogue, puis deux déchiffrements pour 200 logements partageant un propriétaire,
y compris un propriétaire rattaché à plusieurs organisations. Ces tests ne
remplacent pas la mesure API staging.

### Réutilisation des comptes de test

La première tentative après déploiement (`38042718411`) s'est arrêtée avant
toute charge : `/api/me` a renvoyé 500 pendant le provisioning. Le diagnostic
staging filtré a identifié un refus de réconciliation d'identité, prévu en
409 mais transformé en 500 par le gestionnaire global. Les compteurs de
correspondance ont confirmé qu'un profil synthétique existait avec l'email et
l'organisation attendus, mais plus avec le sujet de son compte de service.

Cause corrigée dans la PR 433 : les mises à jour partielles de clients
omettaient `serviceAccountsEnabled`, ce qui supprimait l'utilisateur de service
dans Keycloak 26. Ce flag reste maintenant à `true` lors de l'activation et de
la désactivation du client, lequel reste désactivé entre les exécutions.
Le comportement est explicite dans
[ClientResource de Keycloak 26](https://github.com/keycloak/keycloak/blob/26.0.0/services/src/main/java/org/keycloak/services/resources/admin/ClientResource.java#L739).
La réparation refuse toute ancienne identité encore présente. Elle ne peut
mettre à jour que les douze profils synthétiques prévus, après vérification
du domaine, email haché, organisation dédiée, rôle/statut, membership OWNER,
volume et marqueur des propriétés, avec comparaison de l'ancien sujet.
Les logements, voyageurs et réservations restent identiques.

Les workflows de diagnostic ne publient ni logs bruts ni identifiants :
seulement classes d'exception, codes SQL/HTTP, catégories fixes et compteurs
de correspondance. Le correctif des fixtures passe 14 tests Python locaux
et la CI. Le statut erroné 500 au lieu de 409 reste un sujet distinct du
gestionnaire global d'erreurs ; aucune règle d'authentification n'a été assouplie.
Le diagnostic post-nettoyage `38045731353` confirme une seule correspondance
du profil synthétique, de son email et de son sujet dans l'organisation attendue :
l'identité du premier compte est maintenant conservée après l'exécution.

### Comparaison après optimisation : workflow 38044214930

Mesure terminée sur `app.clenzy.fr`, même période, douze organisations et
mêmes volumes vérifiés que la référence. Code des outils au SHA
`52f0bf6fa4b61de2eca6d8697cb05978fd93cfed` ; backend déployé au SHA `d860c6e`.
Les trois cohortes et le scénario multi-comptes ont terminé sans erreur de contrôle, sans 429,
sans timeout à 10 secondes et sans itération non démarrée. Le workflow termine
avec le code k6 99 parce que certains objectifs de latence restent dépassés.

P95, en millisecondes ; la fenêtre inclut ici toutes les pages séquentielles
du catalogue avant les lectures de planning en parallèle :

| Portefeuille | Fenêtre avant → après | Catalogue / page avant → après | Index / lot avant → après | Détails complets → briques | Erreurs avant → après | Non démarrées avant → après |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 767 → 1 040 | 256 → 227 | 365 → 366 | 508 → 542 | 0 % → 0 % | 0 → 0 |
| 100 | 1 121 → 710 | 644 → 231 | 303 → 325 | 459 → 435 | 0 % → 0 % | 0 → 0 |
| 1 000 | 45 348 → 1 975 | 8 828 → 261 | 10 001 → 579 | 8 374 → 575 | 14,8 % → 0 % | 31 → 0 |

Sur 1 000 logements, le p95 de la fenêtre baisse de 95,6 % (environ 23 fois),
et 164 fenêtres terminent contre 134. Sur 100, 165 fenêtres terminent contre
164. Sur 10, 164 terminent dans les deux mesures, mais le p95 global augmente :
les prix passent de 238 à 649 ms. Une seule exécution ne permet ni d'attribuer
cette variation ni de promettre un gain universel sur les petits portefeuilles.

Le scénario multi-comptes sans catalogue, cible 1 fenêtre/s, termine
164 fenêtres dans les deux versions, avec zéro erreur, 429 ou itération perdue :

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Fenêtre p95 | 637 ms | 639 ms |
| Index p95 | 621 ms | 613 ms |
| Détails/briques p95 | 598 ms | 547 ms |
| Fenêtre p99 | 722 ms | 784 ms |

L'index et les briques restent au-dessus de 500 ms p95 ; le palier
5 fenêtres/s n'a donc pas été exécuté. Ce résultat valide la stabilité au
faible débit testé, pas une capacité multi-utilisateurs élevée. La cohorte
1 000 dépasse également l'objectif de fenêtre API à 1 500 ms.

Les plans réels représentatifs de 500 interventions passent de
1 628 / 1 720 ms à **18,6 / 22,1 ms**. Le sous-plan `reservations` utilise
`idx_baitly_reservation_org_intervention` : environ 1 499 / 1 500 blocs en
cache visités, contre 258 500 par lot précédemment. Les 500 scans complets
sont remplacés par 500 recherches indexées. Les lectures représentatives
des réservations restent à 8 / 14 ms ; ce nouvel index cible bien le coût
identifié plutôt que la sélection des séjours.

Les 46 échantillons après correction observent un pic CPU serveur de 292 %
et une RSS de 1,63 GiB à ce pic, contre 349 % et 1,80 GiB dans la référence.
PostgreSQL culmine à 54 % contre 52 %. Aucun deadlock supplémentaire n'est
comptabilisé. Ce sont des observations globales sur une exécution, influencées
par la chauffe et le trafic ambiant, pas une mesure causale de heap ou de GC.

### Ce qui reste à qualifier

- Extraire les phases `Server-Timing` déjà exposées par les briques dans le
  scénario k6, puis instrumenter les phases fixes de l'index (accès, séjours,
  interventions, demandes, jours bloqués). Les latences HTTP restantes ne
  prouvent pas que SQL ou le déchiffrement restent seuls responsables.
- Répéter les petits portefeuilles avec une chauffe comparable, en particulier
  les prix de la cohorte 10. Ne pas masquer cette régression ponctuelle par le
  gain spectaculaire du portefeuille 1 000.
- Atteindre les seuils du palier multi-comptes avant la montée 5/10 fenêtres/s,
  puis prolonger la durée et diversifier propriétaires, intervenants et statuts.
  Un test distribué devra distinguer capacité backend et limites par IP.
- Refaire une trace navigateur avec la même période pour vérifier le temps
  d'affichage complet. Les 1,98 s API de ce scénario ne remplacent pas les
  2,19 s `baitly.planning.ready` observés auparavant à un utilisateur.

Les quatre chantiers prioritaires ont maintenant une implémentation et une
mesure : coordonnées à la demande, douze comptes relançables, trois tailles
de portefeuille et correction SQL des interventions. Le passage à une charge
élevée reste à valider au-delà du palier effectivement exécuté.

### Répétitions des petits portefeuilles

Le mode `small` du workflow infra privilégie les portefeuilles de 10 et 100
logements, avec quatre organisations synthétiques par taille. Il réutilise
les mêmes fixtures et le même backend que la comparaison précédente.
Le provisioning conserve les douze comptes relançables, mais les comptes
de 1 000 logements ne participent pas à cette mesure.

Une chauffe de 90 secondes par taille précède trois répétitions de trois
minutes, toujours à une fenêtre par seconde et avec catalogue complet.
L'ordre est 10/100, puis 100/10, puis 10/100. Les résumés de chauffe restent
séparés des mesures ; une erreur métier, un 429 ou une fenêtre non démarrée
pendant la chauffe interrompt le scénario. Les comptes sont désactivés à
la sortie. Ce mode n'augmente jamais le débit à 5 ou 10 fenêtres/s.

Les phases fixes `authz`, `details`, `rows`, `contacts`, `decrypt` et `mapping`
du header `Server-Timing` des briques sont exportées en millisecondes,
sans descriptions ni identifiants. Leur durée n'inclut pas tout le trajet
HTTP, `details` recouvre les sous-phases et `contacts` inclut `decrypt` :
ne pas additionner les six.

Les P95 sont comparés par répétition, avec leur intervalle min/max et la
médiane des trois P95. Cette médiane n'est pas un P95 global des échantillons.
Le test k6 n'utilise pas le cache HTTP d'un navigateur : la chauffe concerne
les caches serveur et les mêmes données. Le rendu React doit être mesuré
séparément par une trace navigateur.

Limite de représentativité : les fixtures gardent le rôle technique
`SUPER_ADMIN` pour rendre les comparaisons avant/après identiques. Un `HOST`
ajoute un filtre propriétaire au catalogue et une lecture de son entité
utilisateur dans `validatePropertyAccessBatch`, qui déchiffre ses champs.
Les résultats ne qualifient donc pas encore ce parcours propriétaire.
Une mesure dédiée au rôle `HOST` devra suivre ; une projection limitée à
l'identifiant et au rôle est un candidat à étudier, en conservant exactement
les contrôles de propriété et d'organisation.

### Résultats répétés : workflow 38047760471

Exécution réussie le 10 octobre sur `app.clenzy.fr`, outils au SHA
`5d72fa5c140e79a25b3bc2b912fb1f5a76eb6837`, backend inchangé au SHA `d860c6e`.
La chauffe puis les six répétitions ont terminé ; les objectifs k6 de latence,
erreurs, limitations et fenêtres non démarrées sont tous respectés dans les
six répétitions retenues après chauffe.
Les comptes sont désactivés par le nettoyage final.

P95 en millisecondes : la colonne précédente correspond à une seule exécution
du workflow 38044214930 ; la nouvelle médiane est celle des trois P95 de série.
Les différences ne constituent pas un gain causal de code : le backend est
identique, la chauffe et les répétitions qualifient la stabilité.

| Mesure | 10 : précédente | 10 : médiane nouvelle | 10 : intervalle des trois | 100 : précédente | 100 : médiane nouvelle | 100 : intervalle des trois |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Fenêtre API avec catalogue | 1 040 | 637 | 629–670 | 710 | 666 | 664–692 |
| Catalogue / page | 227 | 213 | 212–219 | 231 | 231 | 220–243 |
| Index / lot | 366 | 286 | 282–286 | 325 | 308 | 292–316 |
| Briques | 542 | 425 | 421–428 | 435 | 423 | 412–432 |
| Prix | 649 | 238 | 234–240 | 243 | 237 | 230–239 |
| Nuits minimales | 332 | 265 | 262–266 | 278 | 264 | 256–265 |

493 fenêtres mesurées pour les portefeuilles de 10, 492 pour ceux de 100 :
**985 fenêtres, zéro erreur de contrôle, zéro 429 et zéro fenêtre perdue**.
La lenteur ponctuelle des prix à 649 ms ne se reproduit pas dans ces trois
passages. Cela soutient une stabilité au débit testé, pas une preuve que la
lenteur précédente ne pourra plus survenir ni une capacité à forte concurrence.

**Le premier passage de chauffe reste lent** : sur 10 logements, fenêtre
P95 1 483 ms, prix 644 ms, catalogue 648 ms, index 685 ms, briques 803 ms
et nuits minimales 667 ms. Les cinq endpoints dépassent alors l'objectif
P95 de 500 ms, avec zéro erreur, 429 ou fenêtre perdue. La chauffe 100
qui suit est à 774 ms par fenêtre et respecte ses seuils. La lenteur initiale
mérite donc une investigation distincte : l'origine (chauffe JVM/caches,
trafic ambiant ou transport) n'est pas isolée par ces résumés.
Durant cette première chauffe, le service de détails reste à 235 ms P95
et le déchiffrement des contacts à 122 ms, proches des répétitions.
La dégradation HTTP apparaît donc sans hausse comparable de ces phases
mesurées : instrumenter aussi les traitements avant le controller et le
transport, sans déduire un résidu par soustraction de percentiles.

Phases des briques, médiane des trois P95, en millisecondes :

| Phase | 10 logements | 100 logements |
| --- | ---: | ---: |
| Autorisation `authz` | 12,0 | 12,9 |
| Service de détails `details` | 225,7 | 234,7 |
| Lecture et hydratation `rows` | 114,7 | 118,4 |
| Contacts `contacts` | 127,6 | 132,3 |
| Déchiffrement des contacts `decrypt` | 125,0 | 124,2 |
| Assemblage `mapping` | 0,14 | 0,15 |

Le déchiffrement des contacts reste un coût mesuré. `rows` inclut l'appel
JPA et l'hydratation ; ce n'est pas un temps SQL isolé. Les plans SQL
représentatifs exportés ne sont pas une capture de la requête Hibernate
réelle. Le header commence dans le controller et ne couvre ni toute la
sécurité en amont, ni la sérialisation HTTP, ni le réseau. Ne pas soustraire
des P95 de phases pour calculer un résidu : ils ne portent pas forcément
sur les mêmes requêtes.

Les 80 échantillons globaux observent un pic CPU backend de 118 % avec
1,70 GiB de RSS à ce pic, PostgreSQL 75 % et Redis 8 %. Les connexions
PostgreSQL passent de 12 à 14 ; aucun deadlock supplémentaire n'est relevé.
La cohorte 1 000 ne reçoit aucune charge mesurée dans ce mode : ces chiffres
ne sont pas directement comparables au précédent pic backend à 292 %.

Prochaines qualifications prioritaires pour les petits portefeuilles :

- scénario avec rôle propriétaire réel, puis projection d'autorisation
  limitée à l'identifiant et au rôle si les tests préservent tous les refus ;
- capture de la requête Hibernate des briques et coût d'hydratation ;
- audit des usages de l'email sur les briques avant tout remplacement
  éventuel par un indicateur de présence, avec email complet au panneau ;
- montée progressive du débit sur ces mêmes petits portefeuilles et nouvelle
  trace navigateur pour vérifier la publication simultanée.

### Recentrage initial après publication groupée du planning

La publication simultanée des prix et des briques retardait le montage du
défileur après le chargement du catalogue. L'ancien effet marquait le
recentrage initial comme effectué avant que ce défileur existe : la grille
pouvait apparaître au début du buffer, dans le passé.

La PR 436 attend le vrai défileur et positionne l'ancre avant peinture.
Aujourd'hui reste en 7e colonne (six colonnes précédentes visibles), pour
les trois zooms. Les rafraîchissements suivants préservent le défilement de
l'utilisateur. Validation : 30 tests ciblés, TypeScript, build Vite et CI
frontend réussis. Le commit main est `f134d0bb8deea61b85927cda0f74f4a0c05a9acd`.
Le CD staging `38048609565` a réussi. La lecture publique de l'asset principal
`/assets/index-BTNe4dop.js` confirme que `app.clenzy.fr` sert ce SHA frontend.
