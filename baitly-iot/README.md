# Baitly IoT pour les capteurs Wi Fi sans hub

Baitly IoT reçoit les mesures de capteurs connectés directement au Wi-Fi du logement. Ce service Java 21 et Spring Boot possède sa propre base PostgreSQL et ses migrations Liquibase. Le PMS conserve les utilisateurs, les logements, les autorisations et les règles d'alerte.

Le service autonome utilise Spring Boot 4.0.8 et son ensemble cohérent de dépendances
corrigées (Spring Framework 7, Spring Security 7), avec Tomcat 11.0.27 pour les
correctifs publiés après le BOM. Le PMS conserve sa pile
existante. Le module officiel de compatibilité Jackson 2 maintient temporairement
le contrat JSON strict, avec Jackson 2.21.5 géré par le BOM ; les contrôles de champs
inconnus, doublons, taille et profondeur restent testés. Liquibase reste en 4.29.2
pour préserver les migrations existantes. La migration ultérieure vers Jackson 3
devra conserver ces mêmes contrôles. Voir le [guide Spring Boot 4](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide).

Le service implémente le registre, la révocation, l'ingestion HTTP, l'historique sonore et un client PMS. Baitly ne fabrique pas de capteur : il raccorde des appareils du marché dont le connecteur et le protocole sont compatibles. La compatibilité doit être qualifiée par marque, modèle et version de firmware ; le Wi-Fi seul ne la garantit pas. Aucun catalogue de modèles compatibles n'est encore validé.

L'espace Objets connectés utilise son unique bouton d'ajout pour **enregistrer un nouvel appareil physique** (Baitly crée son identité et affiche une seule fois sa clé), **rattacher un appareil déjà enregistré**, ou ajouter un simulateur sans matériel lorsque l'environnement l'autorise. Le service interne prend actuellement en charge les mesures de bruit uniquement ; les autres types conservent leurs connecteurs existants. La configuration Wi-Fi de l'appareil (saisie de la clé et de l'adresse d'envoi) et les adaptateurs propres aux modèles retenus dépendent du matériel choisi.

**Sécurité avant exposition : lire [SECURITY.md](SECURITY.md).** Les ports ingestion (8095) et administration privée (8096) sont distincts. Le profil `hardened` exige un compte SQL runtime restreint et des migrations exécutées séparément par CI/CD. La séparation réseau du PMS et de sa base doit être assurée par l'infrastructure ; elle n'est pas déployée par ce module.

Le transport **MQTT/TLS avec certificat par appareil**, les ACL du broker dédié et le simulateur MQTT sont décrits dans [MQTT.md](MQTT.md). Le bouton de simulation de l'interface reste un parcours par API privée ; le simulateur CLI MQTT teste aussi le transport réseau.

## Architecture et responsabilités

```text
Capteur Wi-Fi → box du logement → HTTPS → Baitly IoT → PostgreSQL IoT
                                               ↑
                             API interne authentifiée
                                               ↑
                                         PMS Baitly
```

Le capteur initie une connexion sortante ; aucune ouverture de port du logement n'est nécessaire. Le service écoute sur la boucle locale par défaut. Un reverse proxy devra terminer TLS et exposer uniquement `POST /api/v1/measurements` vers 8095. Les routes `/internal/v1/**` sont refusées sur ce port et accessibles uniquement sur le connecteur privé 8096, réservé au PMS. Le service IoT ne doit disposer d'aucune route sortante vers le PMS ou sa base métier.

Le Wi-Fi est celui du logement, utilisé par l'appareil pour accéder à Internet. Le gestionnaire se connecte au PMS depuis son bureau, son domicile ou un réseau mobile ; il ne partage pas le réseau local du logement. Le libellé utilisateur est **Connexion au service Baitly**, pour éviter la confusion avec Wi-Fi Direct ou une communication locale entre le navigateur et l'appareil. Aucun accès entrant à la box du logement ni aucune adresse IP locale saisie dans le PMS n'est nécessaire pour ce parcours.

### Assistant par marque, modèle et QR code

Le « + » existant propose un guide par **marque et modèle exact** pour les connexions
des fabricants. `client/src/modules/connected-objects/deviceOnboardingCatalog.ts`
contient les profils documentaires initiaux : Minut M2/M3 et certaines serrures Nuki
avec Wi-Fi intégré. Ce catalogue **n'est pas une certification Baitly** : les profils
documentent le transport, le parcours d'installation et la dépendance au compte/API
du fabricant. Aucun essai sur matériel réel n'a encore validé ces modèles avec Baitly.

Pour le nouveau parcours sans hub, un modèle non référencé bloque la progression,
y compris un appareil portant seulement le logo Tuya / Smart Life. Les connecteurs
et les appareils déjà rattachés restent présents ; leur existence ne garantit pas
qu'un nouveau modèle soit utilisable à distance sans passerelle. Les points de remise
de clés gardent leur parcours de service existant. Le choix **Appareil déjà enregistré /
simulateur** conserve l'import technique d'un appareil déjà enregistré dans Baitly IoT
et le parcours complet de test sans matériel. Il ne provisionne pas un appareil du marché.

Le lecteur QR est une **aide locale à l'identification**, pas un endpoint de claim :

- Caméra uniquement sur action explicite, avec repli vers la saisie manuelle si le
  navigateur ne fournit pas `BarcodeDetector` pour `qr_code`.
- Arrêt des pistes caméra après lecture, fermeture du panneau, changement d'étape ou
  démontage, même si l'autorisation caméra arrive tardivement.
- Contenu borné à 2 048 caractères, jamais envoyé à une API, journalisé ou conservé
  dans un stockage navigateur. Le contenu saisi est effacé après classification.
- Seul le format de lien court HTTPS `m.smart321.com` documenté par Tuya présélectionne
  l'écosystème, sans inférer le modèle, l'identifiant d'appareil ou son propriétaire.
- Les codes Matter et Wi-Fi reçoivent une explication dédiée. Un QR Wi-Fi ne fournit
  aucune autorisation IoT ; Matter seul ne fournit pas l'accès distant sans contrôleur.
- Aucun lien scanné n'est ouvert ni récupéré. Aucun rattachement ou provisionnement
  n'est déclenché par un scan. L'identifiant et le modèle précédents sont effacés pour
  éviter de réutiliser la sélection d'un autre appareil.

**Caméra en production :** les configurations Nginx actuellement versionnées dans
`clenzy-infra/nginx/baitly/security-headers.conf` et `clenzy-infra/nginx/nginx.conf`
déclarent `Permissions-Policy: camera=()`. La lecture caméra reste donc soumise à une
revue et à une modification ciblée de cette politique avant déploiement ; les fichiers
de sécurité n'ont pas été modifiés pour ce formulaire. En attendant, le choix manuel
de marque/modèle et le contenu QR copié depuis le téléphone restent utilisables. Les
tests caméra utilisent une fixture, pas un appareil réel ni les headers de production.

Les connexions Minut/Nuki utilisent encore la saisie de l'identifiant du compte fabricant.
Leur découverte automatique et l'activation par QR **ne sont pas implémentées** dans ce
formulaire. Le backend existant de Baitly IoT ne reçoit que son propre UUID préenregistré,
jamais une URL QR ou un identifiant de série quelconque du fabricant.

Pour automatiser davantage, un adaptateur doit vérifier côté serveur les droits sur le
compte fabricant et le modèle/protocole réel, découvrir les appareils accessibles,
éventuellement consommer une procédure de claim autorisée par le fabricant, puis vérifier
la première mesure avant d'annoncer une connexion opérationnelle. Un QR ne remplace
pas l'installation Wi-Fi locale ni le consentement. Aucune interface d'activation
arbitraire ou d'accès direct à la base du PMS ne doit être ajoutée.

Sources : [Wi-Fi Minut](https://support.minut.com/en/articles/2215928-wifi-and-connectivity),
[installation QR Minut](https://support.minut.com/en/articles/16451670-bulk-install-for-minut-sensors),
[API QR Tuya](https://developer.tuya.com/en/docs/cloud/28ea250f14?id=Kd4fdhlgyw4f1),
[appairage QR Tuya avec étape locale](https://developer.tuya.com/en/docs/iot-device-dev/robot_qrcode_distribution_network?id=Kfpeckjh633uf),
[API Nuki](https://docs.nuki.io/guide/overview/concepts/),
[FAQ Matter](https://csa-iot.org/all-solutions/matter/matter-faq/).

Le modèle retenu doit disposer d'un connecteur qui implémente ce contrat HTTPS, ou d'un adaptateur serveur qui traduit son protocole natif. Le choix du matériel déterminera ce transport ; la prise en charge HTTP ne rend pas un appareil Tuya existant compatible.

## Identité et isolation des organisations

L'API interne utilise un secret machine PMS vers IoT, distinct des secrets des appareils. Cette identité est administratrice du registre. Elle ne représente pas un utilisateur final et ne doit jamais être distribuée au navigateur ou aux appareils.

L'enregistrement fixe l'organisation et le logement. Le PMS doit vérifier les droits de l'utilisateur sur le logement avant tout appel interne de provisionnement. Le registre ne possède pas les tables du PMS : il ne peut pas vérifier lui-même l'existence de ce logement.

Chaque appareil reçoit un secret aléatoire de 256 bits, retourné uniquement lors de l'enregistrement. Seule son empreinte SHA-256 est stockée. L'authentification résout l'appareil à partir de cette empreinte ; aucun identifiant d'organisation, de logement ou d'appareil n'est accepté dans une mesure. Le format JSON est strict et les corps sont limités à 4 Kio.

La révocation désactive immédiatement les nouvelles authentifications. L'ingestion reverrouille l'appareil et revérifie l'empreinte de la clé en transaction pour sérialiser les mesures, la rotation et la révocation. Les lectures et révocations internes recherchent le couple organisation et appareil, avec une réponse 404 en cas de mauvais rattachement.

## Contrat de mesure sonore

```http
POST /api/v1/measurements
Authorization: Bearer <secret propre au capteur>
Content-Type: application/json
```

```json
{
  "eventId": "27f9c99b-04d9-4b1e-bc01-495721e8530b",
  "measuredAt": "2026-10-16T12:00:00Z",
  "windowSeconds": 10,
  "laeqDbA": 62.4
}
```

`measuredAt` est la fin UTC de la fenêtre acoustique, `windowSeconds` sa durée de 1 à 300 secondes, et `laeqDbA` le niveau continu équivalent pondéré A, entre 0 et 150 dB(A). Le firmware doit calculer cette grandeur correctement ; une valeur relative de microphone ne constitue pas un LAeq calibré.

Le capteur conserve le même `eventId` et le même contenu lors d'une nouvelle tentative. La clé primaire `(device_id, event_id)` assure la déduplication en base. Un contenu modifié sous le même identifiant provoque une réponse 409. PostgreSQL conserve les dates à la microseconde ; l'ingestion normalise cette précision avant comparaison.

L'accusé HTTP 200 est envoyé après la transaction. Il prouve la persistance de la mesure, pas l'envoi d'une notification au voyageur. La réponse indique `duplicate: true` pour une mesure déjà enregistrée.

Les mesures datant de plus de sept jours ou de plus de trente secondes dans le futur sont refusées. Une mesure reçue en retard reste dans l'historique. Le registre conserve séparément l'heure de réception et la dernière heure de mesure ; celle-ci ne recule jamais. Un appareil est en ligne uniquement si ces deux dates sont récentes, avec une tolérance de trois intervalles de transmission.

Les champs inconnus, notamment les champs audio et de routage d'organisation, sont rejetés. L'API ne stocke ni audio ni identifiants de voyageurs. Le firmware devra également garantir l'absence d'enregistrement et de transmission audio.

## API interne

Toutes les routes exigent `Authorization: Bearer <BAITLY_IOT_SERVICE_TOKEN>` sur le port privé 8096. Ce secret n'est pas accepté pour l'ingestion de mesures.

| Méthode et route | Effet |
| --- | --- |
| `POST /internal/v1/organizations/{orgId}/devices` | Enregistre un appareil et retourne son secret une fois |
| `GET /internal/v1/organizations/{orgId}/devices` | Liste les appareils de l'organisation |
| `GET /internal/v1/organizations/{orgId}/devices/{id}` | Retourne le rattachement et la connectivité |
| `DELETE /internal/v1/organizations/{orgId}/devices/{id}` | Révoque le secret, conserve l'historique |
| `GET /internal/v1/organizations/{orgId}/devices/{id}/measurements` | Lit l'historique |
| `PUT /internal/v1/organizations/{orgId}/devices/simulators/{id}` | Enregistre un simulateur de façon idempotente |
| `POST /internal/v1/organizations/{orgId}/devices/{id}/simulate` | Insère une mesure uniquement pour un simulateur |
| `POST /internal/v1/organizations/{orgId}/devices/{id}/credentials` | Remplace le secret de l'appareil et retourne le nouveau une fois |
| `PUT /internal/v1/organizations/{orgId}/devices/physical/{id}` | Enregistre un appareil physique de façon idempotente, sans retourner de secret |
| `POST /internal/v1/organizations/{orgId}/devices/{id}/mqtt-identity` | Remplace l'identité MQTT (CN du certificat) ; les anciens certificats ne peuvent plus écrire |
| `POST /internal/v1/organizations/{orgId}/devices/{id}/erasure` | Révoque et masque l'appareil ; le job de rétention le supprime avec son historique. Idempotent |

Exemple de corps d'enregistrement :

```json
{"propertyId": 11, "name": "Baitly salon", "reportingIntervalSeconds": 60}
```

L'historique exige `from` et `to` en ISO 8601 avec décalage UTC, sur sept jours au maximum. Le paramètre facultatif `propertyId` fait vérifier le rattachement au logement dans le même appel (404 sinon) : le PMS l'utilise pour n'émettre qu'une requête par rafraîchissement. La borne `from` est incluse et `to` exclue. `limit` vaut 1000 par défaut, 10000 au maximum. Si la limite est atteinte, les dernières mesures de la période sont retournées, dans l'ordre chronologique ; ce contrat ne constitue pas un export exhaustif paginé.

## Raccordement au PMS

`server/src/main/java/com/clenzy/integration/baitlyiot/BaitlyIotClient.java` est un client serveur avec délais réseau bornés et sans suivi de redirection. Sa configuration est facultative : les intégrations existantes continuent sans Baitly IoT.

Configurer le PMS avec `BAITLY_IOT_BASE_URL` et `BAITLY_IOT_SERVICE_TOKEN`. Spring les associe aux propriétés `baitly.iot.base-url` et `baitly.iot.service-token`. L'URL doit être HTTPS ; HTTP est accepté uniquement sur la boucle locale pour le développement.

Variables facultatives du PMS :

| Variable | Défaut | Effet |
| --- | --- | --- |
| `BAITLY_IOT_INGESTION_URL` | vide | Adresse HTTPS publique d'envoi des mesures, affichée lors de l'enregistrement d'un appareil |
| `BAITLY_IOT_SIMULATORS_ENABLED` | `false` | Autorise les simulateurs (création, mesures de test, clé du simulateur Python). À activer en développement et en staging, jamais en production |
| `BAITLY_IOT_MAX_CONCURRENT_REQUESTS` | `16` | Appels IoT simultanés par instance PMS ; au-delà, attente d'une seconde puis échec |

En local, `BAITLY_IOT_BASE_URL=http://127.0.0.1:8096` cible le connecteur privé. Le simulateur continue à utiliser `http://127.0.0.1:8095`. En déploiement intermachines, utiliser la destination privée chiffrée définie par l'infrastructure.

Toutes les routes de **gestion** (`/api/baitly-iot/**` : création, enregistrement, rattachement, clés, identité MQTT, révocation, suppression) vérifient l'organisation et exigent le propriétaire du logement ou un administrateur. Un HOST ne peut pas gérer le capteur d'un autre propriétaire de son organisation. Les **lectures** génériques du bruit et du statut (`/api/noise-devices/**`) suivent la même règle que les autres capteurs : tout membre de l'organisation peut les consulter, comme la liste des objets.

- `POST /api/baitly-iot/noise-devices/register` enregistre un **appareil physique** : `requestId` (UUID stable pour une tentative et ses reprises), `propertyId`, `name`, `roomName` et `reportingIntervalSeconds` (10 à 3600, 60 par défaut) facultatifs. Le PMS enregistre l'appareil à distance (PUT idempotent), sauvegarde le lien local puis génère sa clé. La réponse contient une seule fois `token`, `externalDeviceId`, `mqttIdentity` et `ingestionUrl`. Rejouer la même requête réutilise l'enregistrement et génère une nouvelle clé : une réponse perdue ne bloque jamais l'appareil. L'appareil est rattaché au propriétaire du logement, même si un administrateur l'a enregistré.
- `POST /api/baitly-iot/noise-devices` crée un **simulateur** ; refusé (403) si `BAITLY_IOT_SIMULATORS_ENABLED` est désactivé.
- `POST /api/baitly-iot/noise-devices/attach` rattache un appareil **déjà enregistré** (`externalDeviceId`). Le serveur vérifie l'ownership du logement, le rattachement distant, l'absence de révocation et le caractère non simulé avant d'enregistrer le lien local.
- `POST /api/baitly-iot/noise-devices/{id}/credentials` génère une nouvelle clé (l'ancienne cesse aussitôt de fonctionner) ; `POST .../{id}/mqtt-identity` remplace l'identité MQTT d'un appareil physique actif.

Le statut (`GET /api/baitly-iot/noise-devices/{id}`) indique `awaitingFirstMeasurement` tant qu'aucune mesure n'a été reçue : la connexion n'est annoncée qu'à la première mesure enregistrée.

L'ancien POST générique `/api/noise-devices` refuse le type fonctionnel `BAITLY` : le rattachement direct passe obligatoirement par ce contrôle de propriété dédié. Les connecteurs de marque existants gardent leur parcours habituel.

Le PMS enregistre le simulateur à distance avec un PUT idempotent, puis sauvegarde son rattachement local. Une contrainte unique sur les identifiants externes Baitly empêche une reprise concurrente de créer deux lignes locales. Si le service IoT a enregistré le capteur mais que la sauvegarde PMS échoue, rejouer la même requête termine l'opération. Aucun appel réseau n'est effectué dans une transaction PMS.

Les routes existantes de lecture du bruit et du statut utilisent ensuite le client IoT. Les dates de mesures sont conservées en ISO UTC. Un échec réseau remonte comme une erreur, au lieu d'un faux historique vide. Le statut du capteur est sauvegardé après l'appel HTTP, hors transaction réseau.

Le type `BAITLY` tient dans la colonne `noise_devices.device_type` existante. Le changeset PMS `0274__drop_legacy_enum_check_constraints.sql` retire déjà sa contrainte legacy. Le changeset `0561__baitly_iot_simulated_noise_devices.sql` ajoute le marqueur `simulation` et l'index unique Baitly. Côté base IoT, le changeset `0002__add_simulated_devices.sql` ajoute le même marqueur au registre. Les capteurs existants restent non simulés par défaut.

La suppression passe par `DELETE /api/baitly-iot/noise-devices/{id}` : demande d'**effacement** distante d'abord (révocation immédiate, appareil masqué, suppression de l'appareil et de son historique au prochain passage du job de rétention), suppression locale ensuite. Si la demande échoue, le rattachement local reste visible et l'opération échoue ; la demande étant idempotente, un nouvel essai aboutit. L'ancien DELETE générique refuse les capteurs Baitly. Une révocation sans suppression conserve le capteur et son historique consultables jusqu'à la fin de la durée de rétention.

## Parcours de test dans le PMS

Après configuration et démarrage du PMS et de Baitly IoT avec leurs migrations :

1. Se connecter comme propriétaire du logement ou administrateur, puis ouvrir **Objets connectés**.
2. Utiliser le **+ / Ajouter un objet** existant, sélectionner **Capteurs sonores**, puis **Connexion au service Baitly**. Choisir **Simulateur, sans matériel** (visible seulement si `BAITLY_IOT_SIMULATORS_ENABLED=true`), continuer, sélectionner le logement, saisir un nom et éventuellement une pièce, puis **Ajouter le simulateur**. Pour un appareil physique neuf, choisir **Nouvel appareil à enregistrer** : l'écran suivant affiche une seule fois l'identifiant, la clé, l'identité MQTT et l'adresse d'envoi à saisir dans l'appareil. Pour un appareil déjà présent dans le registre, choisir **Appareil déjà enregistré dans Baitly** et renseigner son identifiant.
3. La fiche s'ouvre sur ce capteur. Saisir un niveau sonore et choisir **Envoyer une mesure de test**. Le retour de succès correspond à la persistance côté IoT.
4. Vérifier le niveau, la date de réception et la liste des dix dernières mesures. L'heure est affichée dans le fuseau du logement, avec repli Europe/Paris.
5. Pour tester un émetteur externe, ouvrir **Utiliser le simulateur Python**, générer et copier la clé, puis définir `BAITLY_IOT_DEVICE_TOKEN` dans le terminal. Le script vise `http://127.0.0.1:8095` par défaut ; utiliser `--url` pour une autre instance.
6. Envoyer d'autres mesures avec le script. La fiche et l'historique se rafraîchissent toutes les trente secondes, ou immédiatement avec **Rafraîchir**.
7. Révoquer le capteur : le script doit ensuite recevoir HTTP 401. L'historique reste disponible. Supprimer le capteur retire son rattachement du PMS après confirmation de la révocation.

La clé du capteur reste uniquement en mémoire dans le panneau ouvert. Elle n'entre ni dans localStorage ni dans le cache React Query ; fermer le panneau ou changer de capteur l'efface. Générer une nouvelle clé invalide la précédente. La clé du service PMS vers IoT ne transite jamais dans l'interface.

Les capteurs simulés sont exclus de `NoiseAlertScheduler` : aucune mesure synthétique ne déclenche d'alerte métier, d'automatisation ou de message aux voyageurs. L'ordonnanceur traite chaque configuration d'alerte dans le contexte de son organisation (`TenantScopedExecutor`) et ignore tout capteur d'une autre organisation : sans ce contexte, le garde d'organisation refusait chaque lecture et aucune alerte bruit ne partait, quel que soit le fournisseur.

## Rétention, effacement et exploitation

- **Rétention** : `IotRetentionMain` (même archive, sans serveur HTTP) supprime les mesures plus anciennes que `retentionDays` (90 par défaut, entre 8 et 3650, car l'ingestion accepte sept jours de retard), puis les appareils dont l'effacement a été demandé avec tout leur historique. Les suppressions sont faites par lots de 5 000 lignes. Il s'exécute avec un **rôle SQL dédié** (SELECT et DELETE uniquement) et un fichier privé `url` / `username` / `password` / `retentionDays` ; le runtime ne reçoit jamais ce droit DELETE. L'infrastructure le lance chaque jour (`baitly-iot-retention.timer` dans `clenzy-infra/iot`).
- **Santé et métriques** : `GET /actuator/health` et `GET /actuator/prometheus` sur le port privé 8096, accessibles uniquement depuis la boucle locale et sans authentification. Aucun détail, identifiant d'appareil ni secret n'y figure. Le compteur `baitly_iot_ingress_total{transport, status, duplicate}` couvre HTTP et MQTT (401, 413, 415, 429, 409, doublons…) ; `baitly_iot_mqtt_queue` et `baitly_iot_mqtt_connected` suivent le récepteur MQTT. Les métriques JVM, Tomcat et Hikari standard sont également exposées.

## Exécution locale

Définir les variables de `.env.example` dans l'environnement du processus, avec une base dédiée et un secret service aléatoire d'au moins 32 caractères. Spring ne charge pas automatiquement ce fichier `.env.example`. Ne pas utiliser une base de production.

Depuis la racine du dépôt, avec Java 21 :

```sh
rtk mvn -f baitly-iot/pom.xml spring-boot:run
```

En développement local, Liquibase crée le schéma au démarrage ; aucun Hibernate `update` n'intervient. En profil `hardened`, un job CI/CD séparé applique les migrations avant le boot et le runtime ne reçoit aucun identifiant de migration. Aucun conteneur existant n'a besoin d'être modifié pour compiler ou tester ce module.

Le job empaqueté utilise `IotMigrationMain` via le `PropertiesLauncher` Spring Boot,
avec un fichier privé contenant `url`, `username` et `password`. Il ne démarre pas
de serveur HTTP. La CI exécute ce job deux fois sur sa base jetable après `verify`
avec `scripts/check_migration_entrypoint.py`, puis prépare une archive vérifiée par
SHA-256 sur `main`. Elle ne déclenche aucun déploiement. Le workflow manuel et les
frontières réseau préparés dans `clenzy-infra/iot/README.md` restent désactivés par défaut.

Après enregistrement d'un appareil, placer son secret dans `BAITLY_IOT_DEVICE_TOKEN`, puis envoyer une mesure synthétique :

```sh
rtk proxy python3 baitly-iot/scripts/simulate_noise.py --level 62.4
```

Le script n'affiche pas les secrets et refuse les redirections. Les options `--event-id` et `--measured-at` permettent de rejouer exactement une mesure ou de simuler un retard de transmission. Il ne mesure aucun son réel.

## Tests

```sh
rtk mvn -f baitly-iot/pom.xml test
```

Pour exécuter les tests API et les migrations sur un cluster PostgreSQL jetable, définir `BAITLY_IOT_TEST_DATABASE_URL`, `BAITLY_IOT_TEST_DATABASE_USER` et éventuellement `BAITLY_IOT_TEST_DATABASE_PASSWORD`. La suite efface les tables IoT à chaque test et le test de privilèges crée puis détruit sa propre base et son propre rôle aléatoires. Ce test exige une identité de provisionnement sur ce cluster jetable ; elle n'est jamais le compte runtime. Ne jamais utiliser de base existante du PMS ni de cluster de production. Sans URL de test, les tests API et de privilèges sont explicitement ignorés. La CI fournit ce cluster et exécute toute la suite.

Les tests couvrent l'authentification, le secret haché, sa rotation, l'indépendance de l'identité MQTT, la révocation, l'effacement, la rétention, l'enregistrement physique idempotent, les accès croisés entre organisations, les quotas (adresse bloquée sans effet sur le budget global, proxy local, MQTT), la santé et les métriques, les limites de payload, les doublons concurrents, les conflits d'identifiant, l'ordre des mesures, la fraîcheur et les dates invalides. Les tests frontend couvrent l'enregistrement d'un appareil physique et l'affichage unique de sa clé, le masquage du simulateur désactivé, la rotation confirmée des clés, la création, l'envoi, la révocation, la suppression et l'indisponibilité du service.

Le test PMS `BaitlyIotJourneyIT` peut cibler une instance IoT de test réelle avec `BAITLY_IOT_TEST_BASE_URL` (port privé), `BAITLY_IOT_TEST_INGESTION_URL` (port des mesures) et `BAITLY_IOT_TEST_SERVICE_TOKEN`. Il traverse le controller PMS, le client HTTP et la base IoT ; les repositories PMS sont des doublures isolées. Il ne se connecte jamais à la base du PMS existant. `BaitlyIotMigrationTest` vérifie le changeset 0561 sur PostgreSQL à partir de la définition réelle de la table legacy.

## Suite du développement

Avant exposition Internet : appliquer le contrat de `SECURITY.md`, provisionner la VM isolée (le déploiement reste en attente), configurer TLS et l'accès privé de l'API interne, qualifier les limites de débit sous charge réelle, définir les quotas disque, les sauvegardes et les seuils d'alerte sur les métriques. Rotation des clés, identité MQTT indépendante, limites applicatives, rétention, effacement, santé et métriques sont implémentés.

Le premier appareil permettra d'implémenter et tester le transport réel, le stockage hors connexion et les mises à jour de firmware. Aucun de ces comportements matériels n'est garanti par le simulateur.

Le PMS conserve son ordonnanceur d'alertes (toutes les cinq minutes, désormais correctement rattaché à l'organisation de chaque configuration). Cette tranche n'ajoute pas d'événements Kafka ni de notifications IoT en temps réel. Avant activation opérationnelle d'appareils physiques Baitly, qualifier la fraîcheur, les agrégations acoustiques, la latence et les règles de notification avec le matériel retenu.
