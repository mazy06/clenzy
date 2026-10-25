# Historique du chat et réconciliation en lecture seule

Suite : [preuve durable de fin](BAITLY-CHAT-DURABLE-COMPLETION.md). Le nouveau
reçu qualifie uniquement les tours purement textuels démontrés ; les effets
d'outils, les anciennes conversations sans reçu et les contradictions restent
bloqués, sans rejeu.

25 octobre 2026. Suite cumulative de #518, toujours sans activation du candidat
React, retrait de SDK, modification de route active ou déploiement.

## Correction de CI #518

La première tête `e599301` échouait sur une seule assertion parmi les tests
backend exécutés : `AgentConfirmationFlowTest` attendait un identifiant d'outil
dans l'erreur d'accès. La protection avait justement remplacé ce diagnostic
par un message neutre. L'assertion attend maintenant le code fixe et vérifie
toujours que l'outil ne s'exécute pas. Les cinq tests de ce flux passent.
Correction publiée sur #518, tête `06cc7be790edd2300f780737f58124cdac9aaef5`.
Ses CI relancées doivent être suivies sur cette tête, pas sur l'ancienne.

## Source de vérité et portée

`GET /api/agui/recovery` ajoute l'historique texte ordonné par date puis ID et
les observations de réconciliation. Le propriétaire et l'organisation sont
vérifiés avant lecture ; chaque message retourné est également validé contre
ce périmètre. IDs dupliqués, rôle inconnu ou lecture indisponible : échec fermé.
La transaction de lecture utilise REPEATABLE_READ pour ne pas assembler des
versions contradictoires des messages et décisions. Elle ne fait aucun appel
fournisseur et ne modifie aucun statut.

L'historique retourne les textes utilisateur/assistant, des IDs stables et
la présence des pièces jointes. Il **ne retourne pas** les arguments d'outils,
leur historique interne, les contenus bruts des résultats, les URLs privées
des pièces jointes, les erreurs de trace ni les requêtes stockées dans les runs.
Ces données métier restent derrière les contrôles d'accès existants ; aucune
copie n'est envoyée à la télémétrie ni stockée dans le navigateur.

## Ce que prouve chaque observation

| Observation | Signification et règle |
|---|---|
| AWAITING_DECISION | PENDING non expiré, sans résultat trouvé. Seul le CAS de décision peut autoriser une reprise explicite. |
| EXPIRED | Décision expirée, aucun envoi proposé. |
| DECLINED | Refus enregistré ; aucune preuve générale sur l'état d'un fournisseur n'en est déduite. |
| RESULT_RECORDED | Un message résultat non vide existe pour cet appel dans cette conversation et organisation. Cela ne signifie pas « effet réussi ». |
| UNCERTAIN | Décision enregistrée sans résultat exploitable ; blocage conservé. |
| CONFLICT | Résultats multiples, ou résultat déjà présent pour un PENDING legacy ; reprise bloquée. |

Le contrôle **backend** de consommation consulte désormais aussi la présence
d'un résultat avant de prendre la décision. Un ancien PENDING resté ouvert
après une résolution best-effort ne peut donc pas exécuter à nouveau l'outil.
Un résultat d'erreur bloque aussi ce chemin : il ne prouve pas qu'aucun effet
partiel n'a eu lieu. Une panne de cette lecture ne retourne aucun outil.
Le CAS reste obligatoire lorsque le résultat est absent. Les appels fournisseurs
restent hors transaction ; aucun mécanisme ne prétend garantir leur succès.

## Adaptateur et présentation

La restauration remplace les lignes affichées par la lecture autoritative avec
des IDs stables, sans les ajouter à une file d'envoi ou aux messages sortants.
Les événements live continuent d'utiliser les renderers existants. Les anciens
résultats et pièces jointes apparaissent comme présences enregistrées ; leurs
widgets/contenus ne sont pas reconstruits à partir d'informations manquantes.

Une observation incertaine ou contradictoire bloque aussi une décision lorsque
la nouvelle lecture juste avant le clic révèle ce problème. Ni StrictMode,
ni reconnexion, ni nouveau montage, ni bouton de lecture ne produisent de POST.
Les preuves incohérentes côté client sont refusées avant présentation/envoi.

## Limites avant activation

`AgentRunRecorder` est asynchrone et best-effort ; COMPLETED, l'absence d'un run,
un texte assistant final ou RESULT_RECORDED ne constituent pas une preuve
durable de fin sans effet incertain. Une conversation historique reste donc
consultable mais bloquée pour un nouveau message après rechargement.

Restent à qualifier : reçu durable de fin et correspondance entre tous les
effets et leurs preuves métier, historique structuré des neuf rendus et pièces
jointes autorisées, restauration de l'état, découverte/relais et fixtures Java
partagées. Les contenus omis ne sont jamais reconstitués par appel fournisseur
ou rejeu de l'action. Aucun bouton de forçage n'est ajouté.

Les recettes locales/CI sont synthétiques ; la recette PostgreSQL obligatoire
reste distincte du passage local H2. Tests staging uniquement lors de la
campagne finale regroupée. Les avis de dépendances et FR10/FR11 restent ouverts.

Validation locale : 77 tests backend ciblés sans échec/erreur/ignoré, dont neuf
sur l'historique et les preuves ; 87 contrats frontend en lot complet, puis
les 15 cas de l'adaptateur avec un cas supplémentaire de fin SSE contradictoire
(88 cas uniques). Typage applicatif et strict des tests, builds PMS/SDK réussis.
Le candidat reste absent du bundle actif. Les suites et la recette PostgreSQL
sont obligatoires en CI ; leurs résultats sont à confirmer sur la nouvelle tête.
