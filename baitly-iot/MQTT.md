# MQTT/TLS dans Baitly

## Transport et identité

MQTT **3.1.1**, QoS **1**, sans message retained. Mosquitto hébergé par Baitly termine TLS (1.2 minimum, 1.3 possible) et exige un certificat client individuel. Aucun cloud fabricant ni hub dans le logement n'intervient. Le récepteur Java se connecte au listener privé avec son propre certificat, signé par une autre CA.

```text
Appareil → Wi-Fi → Internet → Mosquitto Baitly :8883 (mTLS)
                                  ↑
             Récepteur Java → :8884 privé (mTLS, autre CA)
                    ↓
             PostgreSQL IoT dédié
                    ↑
             API privée ← PMS
```

Mosquitto utilise le **CN du certificat signé**, et non le username déclaré par le client, pour les ACL et le client ID. Un appareil ne peut donc pas évincer un autre appareil en usurpant son client ID. Les deux listeners n'acceptent pas la même CA ; une identité d'appareil ne peut pas devenir celle du récepteur.

Le CN d'appareil est **SHA-256 du secret courant**, sous forme de 64 caractères hexadécimaux minuscules. Cette empreinte n'est pas un mot de passe : la clé privée et le certificat signé sont nécessaires. Le provisionnement de confiance vérifie l'enregistrement et le rattachement avant émission. Ne jamais signer un CN arbitraire fourni par un navigateur. Les clés de CA restent hors broker, service IoT et PMS.

| Topic | Droits de l'appareil |
| --- | --- |
| `baitly/devices/<empreinte>/measurements` | Publication pour sa propre empreinte seulement |
| `baitly/devices/<empreinte>/acks` | Lecture pour sa propre empreinte seulement |

La mesure reprend le [contrat JSON HTTP](README.md#contrat-de-mesure-sonore), sans secret, organisation, logement, audio ou commande. Maximum 4 Kio. Les validations, limites par appareil, transactions, contrôle de révocation et déduplication sont communs aux deux transports.

L'accusé applicatif est envoyé **après le commit SQL** :

```json
{"eventId":"27f9c99b-04d9-4b1e-bc01-495721e8530b","status":200,"duplicate":false}
```

PUBACK seul ne prouve pas la persistance. L'appareil conserve la mesure jusqu'à cet accusé. En cas de timeout, il réessaie avec les mêmes `eventId`, date et contenu, avec temporisation croissante. Un doublon valide reçoit `200` et `duplicate:true`. Les refus donnent 400, 401, 409, 413 ou 429 ; `eventId` peut être nul lorsque le message n'a pas pu être identifié. Une panne SQL n'émet aucun succès. Le broker ne conserve ni retained ni sessions durables : la reprise appartient à l'appareil.

Une révocation ou rotation bloque immédiatement les écritures suivantes, y compris sur une session déjà connectée. Après rotation, un **nouveau certificat avec le nouveau CN** est nécessaire. Un ancien certificat peut encore ouvrir une session TLS tant qu'il est valide pour la CA, mais son ancienne empreinte ne permet plus d'écrire. Pour couper aussi cette connexion, l'exploitation doit déployer une CRL et déconnecter la session ; cette automatisation n'est pas livrée.

## Serveur et isolation

Références : `deploy/mosquitto.conf`, `devices.acl`, `ingestion.acl`. Elles ciblent Mosquitto 2.0.x ; utiliser une version maintenue et auditée au déploiement. Adapter les chemins par CI/CD, avec certificats et ACL en lecture seule, permissions restrictives et propriétaire du processus broker. Aucun listener non chiffré n'est déclaré. Le port privé 8884 reste sur la boucle locale.

Variables du **service IoT uniquement** :

```dotenv
BAITLY_IOT_MQTT_ENABLED=true
BAITLY_IOT_MQTT_HOST=localhost
BAITLY_IOT_MQTT_PORT=8884
BAITLY_IOT_MQTT_CA_FILE=/etc/baitly-iot/server-ca.crt
BAITLY_IOT_MQTT_CLIENT_STORE=/etc/baitly-iot/ingestor.p12
BAITLY_IOT_MQTT_CLIENT_STORE_PASSWORD=<secret PKCS12>
```

Le PKCS12 contient uniquement la clé et le certificat du récepteur. La validation du certificat serveur et du nom DNS est obligatoire. Un échec de connexion TLS ou de souscription initiale fait échouer le démarrage. Le client se reconnecte et se réabonne après une coupure.

Sur une **VM IoT distincte**, `deploy/isolation.nft.example` refuse les nouvelles connexions vers le PMS et sa base ; seules les sorties vers PostgreSQL IoT et un résolveur explicite sont autorisées. Remplacer les adresses TEST-NET et prévoir les accès d'administration par CI/CD. `deploy/nginx-private-api.conf` fournit HTTPS privé vers 8096, avec source limitée au PMS par le pare-feu et secret machine exigé par Java. Son certificat doit être approuvé par le client PMS.

Ces configurations ne sont **pas installées**. Ne pas appliquer cette référence de pare-feu sur une machine partagée ou derrière les règles Docker existantes : l'adaptation et les tests d'infrastructure restent nécessaires. Le runtime garde le profil `hardened`, son compte SQL restreint et son cluster dédié. Le broker n'a aucun accès SQL ni secret PMS. Aucune migration métier n'est nécessaire pour MQTT.

## Test manuel sans matériel

Le bouton de simulation de l'interface existante injecte par l'API privée. Le **simulateur CLI MQTT** traverse réellement TLS, les ACL, le broker et PostgreSQL. Les deux parcours gardent les appareils simulés exclus des alertes voyageurs.

1. Dans Baitly, créer un simulateur via le « + » existant pour un logement de test. Récupérer sa clé temporaire avec le contrôle de simulation existant et la définir dans `BAITLY_IOT_DEVICE_TOKEN`, sans l'inscrire dans l'historique shell.
2. Définir `BAITLY_MQTT_P12_PASSWORD` dans l'environnement de test. Créer les CA jetables avec la commande suivante. Elle génère trois autorités de deux jours et les identités serveur/récepteur, **uniquement pour un test local**. Elle refuse un dossier existant.

```sh
rtk proxy python3 baitly-iot/scripts/mqtt_pki.py init-test --directory /chemin/nouveau-pki-test
```

3. Adapter les chemins de la configuration Mosquitto au dossier généré, lancer le broker local et activer le récepteur Java avec les variables ci-dessus. Le certificat serveur de test désigne `localhost`. Les clés de signature restent uniquement dans cet environnement de test.
4. Calculer SHA-256 du secret courant, puis émettre l'identité d'appareil :

```sh
rtk proxy python3 baitly-iot/scripts/mqtt_pki.py issue-device \
  --directory /chemin/nouveau-pki-test --fingerprint <empreinte-sha256>
```

L'outil crée `device-<empreinte>.crt`, `.key` et `.p12`, sans écraser d'identité existante. L'émission est une opération de confiance hors runtime ; la commande ne valide pas à elle seule le propriétaire du capteur.

5. Installer le client dans un venv et envoyer une mesure :

```sh
rtk proxy python3 -m venv /tmp/baitly-mqtt-venv
rtk proxy /tmp/baitly-mqtt-venv/bin/pip install -r baitly-iot/scripts/requirements.txt
rtk proxy /tmp/baitly-mqtt-venv/bin/python baitly-iot/scripts/simulate_noise.py \
  --transport mqtt --mqtt-host localhost --mqtt-port 8883 \
  --ca-file /chemin/nouveau-pki-test/server-ca.crt \
  --cert-file /chemin/nouveau-pki-test/device-<empreinte>.crt \
  --key-file /chemin/nouveau-pki-test/device-<empreinte>.key --level 62.4
```

La commande ne réussit qu'après l'accusé Baitly. Rafraîchir ensuite la fiche et l'historique du simulateur dans le PMS. Pour tester un doublon, relancer deux fois avec les mêmes `--event-id` **et** `--measured-at`. Révoquer le simulateur pour vérifier le refus des mesures suivantes.

En exploitation, borner aussi les descripteurs du processus broker (par exemple 1024 pour cette configuration à 128 connexions). Le lanceur de test applique cette limite au seul enfant Mosquitto : certaines JVM macOS lui transmettent autrement une limite démesurée que le backend poll utilise pour dimensionner ses structures.

## Tests automatisés

`MqttJourneyTest` lance son propre Mosquitto local, crée les certificats temporaires, utilise le vrai simulateur CLI, persiste dans PostgreSQL avec Liquibase et lit la même API privée que le client PMS. Il teste les ACL entre appareils, les autorités séparées, l'absence de certificat, la rotation et la révocation. Il ne lance ni navigateur ni conteneur et ne démontre pas le pare-feu d'une infrastructure non déployée.

Définir `BAITLY_IOT_MQTT_TEST=true`, en plus des variables du PostgreSQL de test existantes, avec Mosquitto, OpenSSL et le client Python disponibles. `BAITLY_MOSQUITTO_BINARY` et `BAITLY_IOT_TEST_PYTHON` sélectionnent les exécutables si nécessaire. La CI installe les dépendances et active ces tests.

Références : [Mosquitto : authentification, TLS et ACL](https://mosquitto.org/man/mosquitto-conf-5.html), [Eclipse Paho Java](https://github.com/eclipse-paho/paho.mqtt.java), [Paho Python](https://eclipse.dev/paho/files/paho.mqtt.python/html/client.html).
