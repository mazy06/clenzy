# Baitly : demandes entrantes de gestion et d’estimation

## Parcours livré

- PMS : Vente & distribution → Prospection → Ma page publique. Un gestionnaire
  disposant de `baitly-crm:manage` peut publier ou retirer son profil de conciergerie,
  renseigner sa présentation et choisir les services présentés. Les logements,
  médias et réglages de visibilité déjà enregistrés sont conservés.
- Site : `/conciergeries` et `/conciergeries/{uuid}`. Les profils sont ceux du
  module de publication existant, avec une vérification de publication à chaque lecture.
- Le propriétaire choisit gestion ou estimation, décrit son projet et demande une
  réponse par email ou téléphone. Il voit le nom de la conciergerie destinataire.
- PMS : la boîte « Demandes de gestion et d’estimation » et la fiche contact
  affichent les demandes, leur provenance et leur état : à traiter, en cours, clôturée.

Le formulaire transmet une demande d’estimation à la conciergerie ; il ne calcule
pas une estimation. Les réponses sont traitées par l’équipe via le canal demandé.

## Isolation, rapprochement et provenance

Le serveur détermine l’organisation depuis le profil publié. Le corps public ne
contient aucun identifiant d’organisation ou de contact CRM. Le traitement JDBC
porte toujours un périmètre explicite et ne dépend pas du tenant du visiteur.

La transaction prend le même verrou d’organisation que les écritures CRM du lot 1.
Elle rapproche les emails/téléphones normalisés et leurs identités historiques.
Un nouveau contact reçoit le type propriétaire et la provenance `PUBLIC_FORM`.
Un contact existant conserve ses données, son statut, son archive, sa provenance et
ses autorisations. Les rapprochements ambigus, archivés ou avec coordonnées
différentes sont signalés pour vérification. Ils restent visibles dans la boîte
des demandes, même si le contact est archivé.

Chaque demande conserve son propre instantané : coordonnées déclarées, projet,
canal de réponse, UUID du profil source, date serveur et version d’information.
Les UTM et le domaine référent sont des déclarations du navigateur, affichées comme
non vérifiées. Aucun paramètre d’URL ne choisit l’organisation destinataire.

Une clé de requête rend une même soumission idempotente. Le navigateur conserve
la clé lors d’une reprise identique et en crée une autre si le contenu change.
Les clés étrangères composées protègent le rattachement organisation/contact/profil.
La suppression du compte ayant publié la page ne détruit pas l’historique CRM :
le lien au profil est détaché et son UUID d’origine reste dans l’instantané.

## Contact et protection du formulaire

La case de demande de réponse est obligatoire et décochée. Cette demande reste
limitée au traitement du projet : aucune autorisation de campagne commerciale
n’est ajoutée au journal du lot 1. Les coordonnées saisies restent déclaratives,
sans vérification d’email dans ce lot.

Le formulaire réutilise le captcha configuré pour les surfaces publiques et
possède un champ piège. Son compteur Redis partagé limite les soumissions à dix
par heure et par IP. Si le compteur est indisponible, l’écriture publique est
refusée. La réponse publique ne révèle aucun identifiant CRM ni l’existence
préalable d’un contact.

Les lectures privées exigent `baitly-crm:view` et la gestion de l’organisation ;
les changements d’état et la publication exigent aussi `baitly-crm:manage`.

## Livraison

Changeset Liquibase : `0569-baitly-management-inquiries`, après `0568`.
Déployer par le CI/CD habituel le serveur, le PMS et le site. Le serveur applique
la migration au démarrage. Aucun SQL manuel ni redémarrage Docker n’est requis
dans la préparation locale de cette livraison.

Le build du site produit une coquille dédiée aux routes UUID : elles fonctionnent
en accès direct avec Nginx, sans figer les profils dans l’image ou le sitemap.
Les fiches chargent leurs données publiées en direct et leur coquille reste
`noindex`. L’annuaire possède sa route et ses métadonnées FR/EN/AR.

## Validation

- Tests PostgreSQL réels : Liquibase appliqué deux fois, routage par organisation,
  concurrence, reprise, identités historiques, refus conservés, contraintes et
  retrait du compte éditeur sans perte des demandes.
- Tests de sécurité Spring : droits de lecture/écriture et gestion d’organisation.
- Tests MVC publics : demande explicite, limitation, captcha, reçu sans données CRM.
- Tests React : choix du destinataire, demande décochée, erreurs, reprise et
  changement de projet, téléphone requis selon le canal.
- Contrôles du build et des routes de publication, typechecks PMS/site/discovery,
  recette navigateur hors ligne en français et arabe à 375/768/1024/1440 px.

Le test HTTP natif des routes est disponible dans
`client/tooling/check_baitly_discovery.py` et nécessite un binaire Nginx local.
