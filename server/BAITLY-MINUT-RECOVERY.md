# Baitly : réception et reprise durable Minut

Ce journal concerne les événements admis par le nouveau consumer. Il n’établit pas
une garantie de livraison au voyageur ou au staff, et ne certifie pas le compte Minut.
Les tests distants restent réservés à la campagne staging finale.

## Admission et données conservées

Un événement pris en charge doit avoir un identifiant stable, une date UTC
interprétable et un capteur Minut actif non simulé, rattaché sans ambiguïté à une
organisation et un logement. La normalisation reconnaît `type`/`event_type`,
`id`/`event_id`, et l’identifiant propre aux webhooks d’organisation
`webhook_event_id`. Aucune identité aléatoire ni empreinte du payload complet ne
remplace un identifiant absent. Les champs inconnus ne deviennent pas des actions.

Les identifiants externes sont hachés pour la déduplication. Le journal contient
uniquement les références métier internes nécessaires, le type, la mesure éventuelle,
les dates, l’empreinte de sens métier et la progression. Il ne conserve ni payload,
nom, adresse email, jeton, code d’accès ni diagnostic fournisseur. Ces données restent
des données métier à soumettre à la politique de rétention ; aucune durée ou purge
automatique n’est inventée ici.

La transition locale et son intention sont enregistrées ensemble dans une
transaction indépendante. Un doublon doit correspondre à la même empreinte,
organisation, appareil et propriété. Une identité réutilisée avec un autre contenu
est refusée. Une erreur de parsing ou d’admission n’est plus avalée : Kafka peut
appliquer sa politique de reprise/quarantaine existante.

## Progression et incertitude

| État | Signification | Reprise automatique |
|---|---|---|
| READY | Prochaine étape jamais tentée | Oui, par le worker, avec contrôle de ressource |
| STARTED | Intention externe commise avant l’appel ; résultat non prouvé | Non |
| UNKNOWN | L’appel ou sa confirmation a échoué ; effet possible | Non |
| DONE | Étapes déléguées et confirmations enregistrées, ou aucun changement d’état | Non |
| SUPERSEDED | Épisode remplacé avant sa prochaine étape | Non |
| REVIEW | Événement historique ou retardé, sans effet local/externe | Non |

Chaque tentative est propriétaire de son étape ; un autre worker ne peut ni la
confirmer ni la réarmer. Une confirmation perdue après commit est reconnue par la
progression conservée. Une confirmation réellement perdue laisse un blocage plutôt
qu’un second appel. Un crash après intention et avant appel reste conservateur :
STARTED n’est jamais transformé automatiquement en READY par expiration d’un bail.

Parcours : hors ligne = diffusion temps réel puis délégation au moteur
d’automatisation ; retour en ligne = diffusion temps réel ; bruit valide = évaluation
puis publication Kafka avec identifiant interne stable et ACK attendu. L’heure
d’occurrence reste stable à la reprise. Le worker ne refait pas les étapes confirmées.

Une confirmation Redis signifie acceptation du broker, pas réception sur chaque
écran. Une délégation au moteur d’automatisation ou au service d’alertes ne prouve
pas le succès de chaque action interne : leurs historiques restent à rapprocher.
Le délai de trois secondes borne l’attente de l’ACK Kafka, pas le blocage initial
du producer sur ses métadonnées. Aucun message de succès global n’en est déduit.

Le curseur d’épisode empêche un travail READY d’un ancien épisode de notifier après
une nouvelle transition. L’état online courant est aussi contrôlé avant chaque étape :
un rafraîchissement par une autre source peut rendre une alerte en attente obsolète.
Admission et démarrage verrouillent dans le même ordre appareil puis événement ;
la progression est relue après attente. Le verrou est libéré avant l’appel externe.
Un événement de connectivité strictement plus ancien que
la transition conservée est placé en REVIEW. Une action déjà STARTED/en vol lors
d’une transition, suppression ou réaffectation ne peut pas être rappelée.

## Mise en service à qualifier

La migration Liquibase 0599 crée une borne de mise en service immuable. Les messages
antérieurs à cette borne n’ont pas de preuve de traitement dans l’ancien consumer :
ils sont placés en REVIEW sans être rejoués. Les messages sans date/identité fiable
restent refusés ; ils ne doivent pas être rejoués en masse en inventant ces champs.

La campagne finale doit vérifier que les anciennes versions du consumer ne traitent
plus en parallèle pendant l’activation du journal. Le nouveau code ne peut pas
dédupliquer un effet réalisé par une ancienne instance qui ignore ce journal.
Un rollback vers cet ancien consumer après création de la borne doit donc être
traité comme un nouveau cutover à qualifier ; ne pas réactiver ce flux en supposant
que la borne prouve les effets réalisés pendant le rollback.
Déploiement uniquement par PR/CI/CD ; aucun changement manuel de schéma ou d’état.
Ni réarmement SQL ni appel générique de replay des automatisations ne constitue une
réconciliation des UNKNOWN. Une future opération de rapprochement devra exiger
preuve, droits d’organisation et revue du seul effet concerné.

La normalisation du consumer ne modifie pas la vérification HTTP historique
`X-Minut-Signature`. La documentation actuelle décrit aussi une enveloppe `event`
avec `hook_digest` et des secrets par webhook. Ce contrat HTTP, les secrets réels,
le rattachement des comptes, les types de bruit liés au home et le rapprochement
entre identifiants des différentes surfaces restent à qualifier avant activation
fournisseur. Les tests synthétiques ne prouvent pas ce raccordement.

Références primaires : [événements](https://developer.minut.com/events/events-reference/),
[webhooks](https://developer.minut.com/events/webhooks/),
[webhooks d’organisation](https://developer.minut.com/events/organization-webhooks/).

## Validation

Le contrôleur publie le corps HTTP comme chaîne via le JsonSerializer commun.
Le listener Minut force donc `spring.json.value.default.type=java.lang.String` :
le défaut Map des autres consumers ne peut pas décoder cette chaîne. Les en-têtes
de type restent ignorés ; le retry/DLT et le groupe Kafka restent inchangés.
`BaitlyMinutKafkaContractTest` reproduit le rejet avec le défaut global puis vérifie
le passage des octets sérialisés à l’admission, avec les codecs réels verrouillés.
Ce test sans broker ne remplace pas la qualification Kafka de la campagne staging.
L’override est prévu par [Spring Kafka 3.1](https://docs.spring.io/spring-kafka/reference/3.1/kafka/receiving-messages/listener-annotation.html).

Le collecteur privé des journaux expose cinq agrégats Minut sans label client :
`minut.ready`, `minut.uncertain`, `minut.review` et les deux âges READY/incertain
en secondes, sous `baitly.recovery.*`. STARTED et UNKNOWN sont comptés ensemble.
Un défaut d’une des trois lectures SQL conserve l’échantillon précédent et sa
date, tout en invalidant la santé ; un ancien zéro ne devient pas une preuve de
bonne santé. Les résultats historiques REVIEW ne sont pas des incidents à rejouer.
Les règles opérationnelles associées n’activent aucun traitement : elles demandent
examen du worker ou rapprochement de preuve. Elles doivent être livrées après ce
backend, uniquement lors de la campagne finale approuvée.

Les suites locales couvrent parsing, confidentialité, ordre d’appel, confirmation,
time-out et interruption. La recette CI impose `BaitlyMinutRecoveryPostgresTest` :
migration réelle sélectionnée depuis le master et appliquée deux fois, transactions
indépendantes, concurrence, redémarrage, preuve perdue, identités et ownership,
changement d’épisode, cutover et publication incertaine sans second envoi.
La présence des tests PostgreSQL et l’absence de cas ignorés doivent être vérifiées
dans les XML de la révision finale. Les tests staging restent différés.

## Avertissements voyageurs : protection des canaux

Le fan-out bruit prepare le canal avant d'acquerir la fenetre Redis. Sans canal,
aucun claim n'est pris. Sans Redis, ou avec un retour SETNX nul, aucun message
n'est tente ; une lecture de l'historique seule ne serialise pas les envois.

OpenWA est selectionne avant l'envoi pour le texte, Meta pour le template.
Une exception, meme UnsupportedOperationException, apres une tentative ne
declenche ni texte de secours, ni email, ni liberation de la fenetre. Un
identifiant WhatsApp vide est un resultat incertain. Un echec de sauvegarde
apres delegation conserve egalement la fenetre. Les diagnostics ne contiennent
ni email, libelle libre, exception fournisseur, cause ou exception supprimee.

Limite historique de la candidate #503, remplacee par le journal durable ci-dessous :
la protection reposait sur une fenetre Redis de 24 heures. Expiration, perte de Redis,
crash et rollback de la transaction initiale exigent encore un journal durable des
avertissements. Le journal Minut ne prouve pas chaque effet du fan-out. Le retour
normal de l'email signifie delegation au service existant, pas reception en boite.
Aucun UNKNOWN ne doit etre rejoue sur la seule absence de marqueur notified_*.
La concurrence du cooldown entre sources bruit et la sortie des envois de la
transaction initiale restent a traiter avant de declarer ce sous-lot durable.

## Statut capteur et diagnostics HTTP

Le polling Minut/Tuya exige un champ online/offline booleen explicite et coherent.
Une panne, un corps vide, une forme invalide, des flags contradictoires ou le seul
last_heard_from_at ne prouvent pas un statut courant. Dans ces cas l'appel echoue
avec un diagnostic fixe, avant toute mutation de online ou last_seen_at. La lecture
suivante peut retenter le GET ; aucune commande ni notification externe n'est ajoutee.

Les lectures MINUT/TUYA reussies utilisent une ecriture partielle independante :
online, last_seen_at et updated_at seulement. Un snapshot immuable precede le GET ;
le CAS exige encore le meme ID, organisation, logement, type, identifiant externe,
etat online et date de rafraichissement, avec capteur ACTIVE non simule. Une reponse
retardee est refusee si ces champs ont change ; aucune metadata du capteur n'est
refusionnee et aucun snapshot JPA n'est modifie apres le CAS. updated_at ne recule
pas si une modification de metadata est plus recente que le debut du GET.
Le verrou SQL couvre
uniquement l'ecriture, jamais l'appel fournisseur. Une horloge reculee ne fait pas
reculer la date. Le parcours Baitly IoT conserve son contrat et sa persistance
existante ; sa concurrence reste distincte de ce lot Minut/Tuya.

Le controller bruit ne renvoie plus le message brut d'une IllegalArgumentException,
meme nul. Les erreurs gardent leurs codes 400/500 et les refus AccessDeniedException
sont transmis au gestionnaire de securite. Logs du CRUD, polling, evaluation et
notifications sans nom de capteur, adresse email, identite utilisateur, libelle
horaire libre, message fournisseur ou graphe d'exception. Les donnees necessaires
au contenu du message continuent a etre envoyees au destinataire autorise ; elles
ne sont pas ajoutees aux diagnostics.

La campagne staging finale doit verifier panne Redis, delai/perte de reponse
WhatsApp, absence de repli apres tentative, confirmation vide, echec de sauvegarde,
reponses Minut/Tuya ambigues, refus inter-organisation et reprise apres statut
explicite. Les tests locaux de ces chemins emploient des doubles, sans fournisseur,
broker ni notification reelle. Le test RedisOutageSemanticsIT a ete aligne, mais
son exercice Testcontainers n'est pas execute dans cette vague locale.

BaitlyNoiseStatusPersistenceTest execute le vrai SQL avec H2 localement et la base
PostgreSQL dediee de CI : metadata preservee, portee modifiee, desactivation,
simulation, suppression, episode et date concurrente, etat initial NULL, deux
resultats concurrents et commit independant du rollback appelant. Il ne valide
pas le schema Liquibase complet : aucune migration n'est ajoutee dans ce lot.

## Avertissements voyageurs durables : suite de la candidate #503

La migration 0600 ajoute un journal PostgreSQL partage. Redis n'arbitre plus
les avertissements. Chaque tentative a un proprietaire UUID et une reference
d'alerte unique. La reservation est verrouillee puis l'alerte ; l'organisation,
le logement, le voyageur et sa date de mise a jour sont revalides, ainsi que
le sejour actif, la date et le sens de l'alerte. Les messages, coordonnees,
noms et corps fournisseurs ne sont jamais stockes dans ce journal.

Les alertes precedant la borne MAX(id) prise par la migration, ou deja marquees
notifiees, passent en REVIEW et ne sont pas envoyees. Les versions anciennes
doivent cesser de traiter le flux avant cette bascule ; un rollback vers un
binaire qui ignore le journal ne garantit pas la deduplication.

STARTED est commis avant le provider. Un crash ou timeout conserve STARTED/UNKNOWN
sans expiration ; aucun nouveau canal ni nouvelle alerte du meme sejour ne
peut contourner ce blocage. Un recu WhatsApp non vide est requis et seule son
empreinte SHA-256 est stockee. Pour l'email, ACCEPTED signifie delegation au
service existant, pas reception en boite. Une meme alerte n'est jamais reenvoyee,
meme apres 24 h. Une nouvelle alerte du sejour peut etre admise apres la fenetre
d'une delegation acceptee ; un resultat inconnu ne se debloque jamais ainsi.

L'acceptation est commitee avant la reparation locale des flags. Une reparation
perdue ne degrade pas la preuve. Le worker ne traite que les preuves ACCEPTED
dont le marqueur manque, par lots de 50 ; il n'appelle jamais un provider,
n'efface pas d'intention et ne rearme ni STARTED ni UNKNOWN. Les updates sont
partiels et preservent acquittement et notes. Une erreur est repoussee dans
la file sans modifier accepted_at, pour ne pas affamer les preuves suivantes.

Le chemin configure envoie au voyageur apres commit de l'alerte uniquement.
Tout envoi voyageur suspend la transaction de son appelant : aucune transaction
ni verrou SQL n'entoure l'appel provider. Le journal ne garantit pas une livraison
automatique si le processus s'arrete entre le commit de l'alerte et le premier
callback ; ce cas n'a encore aucun effet externe et reste a traiter par une
outbox de delegation distincte. Les notifications proprietaire/in-app et le
cooldown de creation des alertes entre sources restent hors de ce sous-lot.

Cinq jauges privees sous baitly.noise.warning suivent l'incertitude, son age,
les reparations en attente et la sante/fraicheur du snapshot. Collecte hors
scrape, timeout SQL 5 s, aucune etiquette client. Une panne conserve les anciennes
valeurs et leur date, avec sante invalide. Les trois regles operationnelles
associees necessitent ce backend avant activation ; aucun test de notification
reelle ni rechargement de monitoring n'est execute dans ce lot.

Aucune purge, retention legale ou operation de rearmement n'est ajoutee.
La perte du journal PostgreSQL lui-meme reste dependante de FR09, en attente.
Reconciliation d'un inconnu uniquement avec preuve et par voie PR/CI/CD,
jamais par une mutation SQL manuelle suggeree en production.

Validation locale de cette extension au 24 octobre 2026 : 214 tests Java cibles,
aucun echec, erreur ou ignore. Le journal execute 32 cas, avec la migration 0600
rejouee pour verifier son idempotence. H2 local ne remplace pas PostgreSQL :
la recette financiere CI inclut obligatoirement ces tests sur PostgreSQL dedie.
Les IT gates, fournisseurs et la campagne staging restent a executer en fin de lot.

## File durable de premiere delegation, fan-out proprietaire et cooldown

Suite cumulative de #504. La migration 0601 ajoute une file transactionnelle
avant tout premier envoi des canaux configures. Une erreur d'enqueue remonte :
l'alerte et la file sont annulees ensemble. Aucun effet externe ne part de
dispatch. Le worker peut reprendre une ligne PENDING apres redemarrage sans
dependre du callback afterCommit ni de Redis.

La file conserve uniquement des references internes, versions et faits de
l'alerte, jamais adresse, texte, nom, template rendu ou recu brut. Le sejour
et le voyageur presents a la creation sont figes par ID et version. Un sejour
absent/ambigu ne devient pas un nouveau destinataire plus tard. La configuration,
le logement et le proprietaire sont revalides ; changement de version, de portee,
de proprietaire, suppression, desactivation ou compte inactif refusent l'ancien
travail. Les contacts prepares restent en memoire et sont figes avant l'intention.

Seuls les travaux jamais tentes expirent apres quinze minutes : pas de message
ancien envoye tardivement. STARTED/UNKNOWN n'expirent jamais. La borne de migration
exclut les alertes historiques, sans backfill. Arreter les anciens producteurs
avant la bascule ; un ancien binaire ignorant ces journaux ne doit pas etre relance
comme rollback de deduplication.

Chaque destinataire email proprietaire a une ligne distincte, avec deduplication
conservative insensible a la casse et conservation de la premiere adresse de
la configuration pour l'envoi. STARTED + UUID est commis avant SMTP, hors
transaction. Le retour normal prouve delegation SMTP, pas remise en boite. Une
erreur de retour ou de preuve conserve STARTED/UNKNOWN et ne renvoie jamais
les destinataires ACCEPTED ou incertains ; les autres destinataires restent
independants. Aucun identifiant SMTP local fabrique n'est utilise comme preuve.

Pour l'in-app, la methode stricte existante ne fait que des ecritures locales.
Notification et preuve ACCEPTED sont commises ensemble sous verrou de ligne.
Preference desactivee donne SKIPPED, sans pretendre une notification. L'org est
explicite pour le scheduler ; seuls le proprietaire actif du scope ou un
proprietaire platform staff autorise est admissible. Les marqueurs agreges
notified_email/notified_in_app ne passent a vrai que si toutes les lignes du
canal sont acceptees, par update partiel preservant notes et acquittement.
Les reparations et lectures de file sont bornees a 25 par passage.

Les cinq jauges privees existantes incluent maintenant l'incertitude email
proprietaire et les reparations proprietaire effectivement possibles. La file
voyageur ne double pas le compte du journal voyageur. Pas de tag client.
La collecte echoue fermee si la migration de file manque, sans publier un faux zero.

La migration 0602 indexe le cooldown par organisation/logement/severite/date.
Toutes les sources passent par un verrou de configuration ; seuils et creneaux
sont relus en SQL apres acquisition, sans se fier a un snapshot JPA anterieur.
Creation, file et cooldown partagent la transaction, avec timeout 10 s. Les
modifications et suppressions de configuration prennent le meme verrou, et la
revision avance meme pour les modifications de creneaux seules. Aucun
fournisseur n'est appele sous ce verrou. Le compteur d'escalade est aussi
explicitement borne a l'organisation.

Limites distinctes : les autres actions du moteur d'automatisation restent
dans leur cycle existant ; leur callback global n'est pas transforme en outbox
generique par ce lot. SEND_NOISE_WARNING autonome conserve le journal #504
et refuse les doublons/incertitudes, sans promesse de reprise de tout le moteur.
Les travaux expirant avant tentative sont conserves en SKIPPED, pas declares
livres. Conservation/retention, preuve distante d'un UNKNOWN, perte de PostgreSQL
(FR09) et qualification materielle/fournisseur restent des sujets separes.
Aucun rejeu, purge ni correction SQL manuelle de production n'est prescrit.
Les tests staging restent pour la campagne finale.

Validation locale de cette vague : 216 tests Java cibles (dont neuf cas scheduler imbriques),
zero echec/erreur/ignore ; 30 cas de file et admission avec migrations 0600/0601/0602
reelles et rejouees, concurrence et parcours voyageur complet. Six tests Python
du manifeste passes. Ces preuves H2 locales doivent etre completees par la
recette PostgreSQL CI, puis la campagne staging finale. Aucun fournisseur reel.

Le bail ShedLock du worker est borne a une minute, inferieure aux quinze minutes
de fraicheur PENDING : un crash avant premier appel ne doit pas consommer toute
la fenetre de reprise. L'exclusion d'effet est portee par les intentions durables
par item, pas par le bail scheduler. Plusieurs workers peuvent donc se chevaucher
sans renvoyer une tentative deja commencee. Qualifier ce redemarrage reel en staging.
