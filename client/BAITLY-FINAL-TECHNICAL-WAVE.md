# Vague technique regroupée avant campagne staging

Cette vague regroupe les quatre chantiers restants sur la candidate cumulative
#524. La CI #524 et son artefact PostgreSQL sont vérifiés : 117 cas SQL sans
échec, erreur ou ignoré, sur 87edfd6ed04ad43d15ebaf8b93611ecbf06195ef.

## Chat et reprises

Le contrat explicite `durable-writes-v3` ajoute un certificat de continuation
0612, sans modifier les anciens changesets, politiques ou reçus. Toute nouvelle
admission est verrouillée par propriétaire/organisation/conversation avant un
appel modèle. Une requête et un appel d’outil déjà engagés ne sont pas rejoués.

La fin complète exige une couverture de l’historique et de tous les reçus,
décisions et résultats, une seule fin observée, sans erreur ou effet inconnu.
Un refus ne devient sûr qu’après persistance du résultat et d’une preuve distincte
attestant l’absence d’invocation. La décision reste conservée. Les pauses après
effet et les pauses successives sont couvertes ; une coupure après commit sans
résultat ou certificat reste bloquante, même après redémarrage.

Les lots de plusieurs confirmations attendent les décisions restantes avant de
rappeler le modèle. Le dernier appel reconstruit l’historique depuis la base et
vérifie chaque résultat. Un lot mixte est présenté entièrement à la confirmation,
y compris ses lectures, afin de ne pas exécuter silencieusement un sous-ensemble.
Le contexte multi-agent perdu et les effets sans preuve restent bloqués.

Les preuves métier restent bornées aux deux mutations internes déjà qualifiées.
Neuf implémentations concrètes de requêtes locales ont une liaison de lecture
distincte, créée dans la transaction d’admission d’appel. Un nom ou descripteur
identique fourni par une autre classe ne suffit pas. Navigation et taxe conservent
leurs preuves précédentes. Les autres effets, notamment fournisseurs et mémoire
`remember_fact`, ne sont pas promus en succès par cette migration. La poursuite
d’un ancien tour multi-agent ou non qualifié reste bloquée sur ce nouveau contrat.
Les nouveaux tours v3 choisissent le moteur séquentiel existant avant tout appel
de routage ou effet ; ils ne démarrent pas un spécialiste parallèle dépourvu de
preuves pour ensuite tenter un fallback. Le moteur multi-agent et les autres
parcours de supervision conservent leur configuration. La certification des
effets parallèles et des autres mutations n’est pas prétendue par cette vague.

## Intégration native et suppression des SDK

La route `/agui-spike` garde son emplacement et ses droits, et utilise le chat
natif Baitly à la place de CopilotKit. Elle conserve texte/Markdown, flux SSE,
état/patches, neuf renderers, décisions explicites, historique et navigation.
Un montage ou une reconnexion ne poste rien. Les images Markdown ne sont pas
chargées automatiquement et la navigation reste interne et explicite.

L’URL conserve l’identifiant de conversation après la fin, pause ou interruption,
pour retrouver l’état serveur au rechargement. La découverte Java authentifiée
précède chaque envoi ; les credentials sont relus après rafraîchissement. Aucun
token ou état métier nouveau n’est enregistré dans le stockage navigateur.
Un historique ancien sans preuve est lisible, sans autorisation de reprise.
Le choix explicite d’une nouvelle conversation ne rejoue aucun ancien message.

Les rendus historiques proviennent d’une présentation JSON bornée et filtrée,
sous le contrôle d’accès existant de la récupération ; contenu outil brut,
arguments, secrets techniques et diagnostics ne deviennent pas une requête.
Le superviseur existant, déjà indépendant de ces SDK, conserve ses transports.

Un oracle de **43 événements synthétiques** a été produit avec le SDK installé
avant son retrait et figé dans `fixtures/baitly-sdk-oracle.json`. Il est vérifié
côté frontend et contre le traducteur Java. Aucun ancien SDK vulnérable n’est
réinstallé comme dépendance de test. Les parseurs acceptent LF, CRLF et CR.
Les types ES2022 déjà utilisés dans l’application sont désormais explicites dans
tsconfig, sans changement de cible d’émission ES2020 ou polyfill implicite.

CopilotKit/AG-UI/A2UI et Zod 3 sont retirés des deux graphes. Le relais Node garde
son service et ses routes compatibles comme proxy SSE, sans modèle ou agent
partagé, sans retry ni diagnostic distant. Corps borné, credentials par requête,
redirections refusées et coupure propagée. Les audits deviennent des prérequis
de publication ; les seuils high/critical sont bloquants.

## Chiffrement authentifié et migration compatible

`BTF1:<version>:<base64>` utilise AES-256-GCM, nonce aléatoire 96 bits, tag 128 bits,
et en-tête authentifié. La clé dérive du secret de déploiement via PBKDF2-HMAC-SHA256
(210 000 itérations, domaine Baitly distinct, dérivation une fois par codec).
La robustesse du secret de déploiement reste nécessaire ; aucun secret nouveau
n’est fabriqué ou affiché dans cette vague.

Le converter, les lecteurs historiques d’API/channel/Airbnb et le service OAuth
partagé lisent ce format. Le codec commun conserve la lecture CBC avec **une clé
legacy épinglée**, sans essayer plusieurs mots de passe jusqu’à obtenir un padding
valide. Le format CBC ancien ne devient pas rétroactivement authentifié.
Version, nonce, ciphertext, tag altérés ou clé GCM incorrecte échouent sans valeur,
cause brute ou fallback plaintext, même en mode legacy tolérant.

Le backfill existant reconnaît et vérifie le nouveau format avant de décider
quoi que ce soit ; une donnée authentifiée illisible ne devient jamais du clair
à chiffrer à nouveau. Une valeur Base64 ambiguë reste bloquée. Les mises à jour
sont conditionnelles à la valeur source exacte et les diagnostics sont fixes.

Le service de rotation est un primitive explicite SUPER_ADMIN, tenant-scopé,
pour sept colonnes utilisateurs/check-in vérifiées contre les entités JPA.
Il travaille cellule par cellule, sans runner automatique : lecture, ré-encryption
et roundtrip vérifié, puis CAS sous transaction courte. Conflit, erreur de commit
ou ciphertext invalide n’inventent pas un succès. Après réponse perdue, une lecture
authentifiée de la version courante fournit la preuve ; aucun appel fournisseur.
Les autres colonnes restent lisibles et migrent lors de leurs écritures métier.
Cette préparation ne constitue pas une migration déjà effectuée des données réelles.

### Séquence de déploiement à conserver

1. Livrer les **lecteurs** sur toutes les répliques, avec
   `baitly.security.field-encryption.authenticated-writes=false` (défaut).
2. Vérifier les versions réellement déployées et les lectures historiques en
   staging. Puis activer la propriété par la configuration CI/CD, jamais par
   modification manuelle de production. Aucune rotation de secret implicite.
3. Qualifier les nouvelles écritures, la rotation bornée, les conflits et la
   reprise sur données synthétiques. Promouvoir ensuite les mêmes lecteurs en
   production et y répéter la séquence d’activation après validation staging.
4. Un retour arrière conserve un lecteur BTF1. Revenir à un ancien binaire qui
   ne lit que CBC est interdit une fois les premières écritures BTF1 effectuées.

Les paramètres `key-version`, `previous-passwords` et `legacy-password` sont sous
`baitly.security.field-encryption`. Les précédentes versions GCM sont sélectionnées
par leur numéro exact ; la clé CBC historique doit rester explicitement disponible
lors d’une vraie rotation. Les objectifs FR09 et le coffre-fort restent distincts.

## Campagne finale

CI complète et PostgreSQL/JSONB de cette nouvelle tête restent requis avant
intégration. Puis recette staging regroupée : droits et deux organisations,
découverte/auth, neuf rendus réels et historiques, lots/refus/reprises/coupures,
absence de double effet et fuite, état/patches, consentement, migrations et
rollout du chiffrement, métriques et alertes des vagues précédentes.
Les tests synthétiques ne qualifient pas un fournisseur réel ou une fonction
encore fermée. Pas de déploiement, mutation de données réelles ou notification
externe dans cette vague. Ne pas intégrer séparément les PR intermédiaires.
