# Adaptateur Baitly et restauration des décisions en attente

Suite du 25 octobre : [historique et réconciliation en lecture seule](BAITLY-CHAT-HISTORY-RECONCILIATION.md).
La limitation de rechargement reste conservée ; aucune observation de résultat
n'est convertie en succès fournisseur ni en permission de rejouer un effet.

24 octobre 2026. Suite de la candidate #517, dont toutes les CI sont vertes
sur `244428988a5a5e744b1492ef88247e6ae42d2fc7`, scan backend inclus.
Le nouvel adaptateur et sa vue React restent **inactifs** : aucune route
ne remplace encore le chat CopilotKit. Aucun SDK n'est retiré.

## Contrat de reprise

`GET /api/agui/recovery` lit le journal durable dans la conversation appartenant
au sujet authentifié et à son organisation. Les rôles autorisés restent ceux
du chat. Aucun argument d'outil, historique interne, jeton ou exception brute
n'est ajouté à la réponse. Une panne de lecture échoue fermée ; elle ne
fabrique jamais une liste vide autorisant un envoi.

La restauration, le montage React, les abonnements et la reconnexion ne font
aucun POST. Une décision nécessite un clic et une nouvelle lecture serveur.
Les actions expirées, étrangères, déjà décidées ou non restaurables sont
bloquées. Le contexte multi-agent uniquement en mémoire reste non restaurable
après redémarrage du backend.

Avant de retourner un outil au moteur, `PendingToolStore` acquiert sa décision
par une mise à jour SQL conditionnelle : même utilisateur, organisation,
statut PENDING et expiration future. Un seul concurrent peut gagner.
La courte transaction de cette décision se termine avant tout appel d'outil
ou de fournisseur. Les statuts existants CONFIRMED/REFUSED enregistrent une
**décision**, jamais une preuve de succès de l'effet. Si le résultat SQL est
incertain ou qu'un crash suit la décision, aucun outil n'est retourné/rejoué.
Une réconciliation sur preuve reste nécessaire pour ces effets.

## Adaptateur et présentation

- Accumulation immuable du texte, des appels et des résultats ; patches JSON
  validés par `fast-json-patch` avec écritures prototype interdites.
- Réutilisation du répartiteur des neuf renderers existants et de leurs hints.
  La navigation reste une action explicite. HTML Markdown ignoré et images
  distantes Markdown neutralisées, sans requête automatique.
- Composer volatil, aucun stockage local d'authentification, historique ou
  file d'envoi ; diagnostics à codes fixes. Authentification relue à chaque
  requête et cookies HttpOnly conservés.
- Coupure, arrêt, flux invalide ou résultat ambigu : blocage, sans retry.
  Recréer une instance ne constitue pas une preuve autorisant le rejeu.

La dépendance directe `fast-json-patch` déclare la version 3.1.1 déjà résolue
dans le lockfile ; aucune résolution transitive n'est changée.

## Qualification et portes restantes

Les tests utilisent des données synthétiques, des flux HTTP simulés et une
base SQL isolée. Les nouveaux cas couvrent les accès, la lecture sans effet,
les décisions concurrentes, les pannes ambiguës, StrictMode, les clics et
les vrais renderers devis/navigation. Les tests PostgreSQL exécutent le HQL
de la méthode de production sur l'entité réelle ; ils sont obligatoires dans
la recette CI avec vérification de présence des rapports, zéro cas ignoré.
Le passage local H2 ne vaut pas une validation PostgreSQL.

Validation locale : installation propre, typage strict, builds PMS/SDK,
83 contrats frontend et 63 tests backend ciblés réussis, sans échec, erreur
ou cas ignoré. Le candidat est absent du bundle actif.

Cette étape restaure les **décisions en attente**, pas toute la transcription
historique. Après rechargement, une conversation ayant un historique mais
aucune action pending reste bloquée pour révision ; seule une conversation
vierge peut démarrer sans preuve supplémentaire. Une fin de run effectivement
observée dans la session permet un prochain message explicite.

Avant activation : restaurer l'historique complet et qualifier ses preuves de
fin, traiter la découverte/relais/auth, produire les fixtures Java communes,
calibrer les bornes SSE et définir les extensions de protocole. Les douze avis
élevés frontend et les dix-neuf avis élevés du relais restent ouverts jusqu'au
retrait qualifié des SDK. Tests staging réservés à la campagne finale.
