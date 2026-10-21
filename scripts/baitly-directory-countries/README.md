# Annuaire Baitly : France, Maroc et Arabie saoudite

L'édition publique OSM/Overture couvre aussi le Maroc. Voir
[le fonctionnement, les commandes et la comparaison data.gov.ma](MOROCCO.md).
Le job `saudi-public-source` conserve son identifiant pour compatibilité, mais
construit maintenant SA et MA en matrice. Le CD utilise l'opérateur commun
`com.baitly.ops.BaitlyPublicDirectoryImport`, avec un pays explicite.

## Édition saoudienne OSM et Overture

Le job `saudi-public-source` construit désormais une édition commune : extraction
OSM existante, puis Overture Places via le client officiel anonyme. Le rectangle
de téléchargement inclut les pays voisins ; **la frontière nationale OSM et le
code pays SA sont tous deux vérifiés** avant de retenir un établissement Overture.
La release effectivement téléchargée est enregistrée dans le manifeste et chaque
preuve. La fréquence reste hebdomadaire, avec ingestion horaire par environnement.
Le CI backend prépare et publie aussi cette édition avant chaque déploiement sur
`main` (staging) et `production`. Le dispatch vers l'infrastructure dépend du succès
de cette préparation et de la construction de l'image. Les secrets OVH existants
`BAITLY_MAPS_AWS_ACCESS_KEY_ID` et `BAITLY_MAPS_AWS_SECRET_ACCESS_KEY` sont requis.

Le script `clenzy-infra/scripts/deploy.sh` attend le serveur sain et ses migrations,
puis lance `com.baitly.ops.BaitlySaudiDirectoryImport` dans l'image déployée.
Cet opérateur sans serveur web ni schedulers utilise le pipeline existant, son
verrou Redis, ses checkpoints et sa publication transactionnelle. Il exige une
édition combinée OSM/Overture, attend son statut `COMPLETED`, puis attend que
l'index spatial corresponde à la révision courante. Un échec ou un délai dépassé
fait échouer le CD ; les données déjà publiées restent disponibles. Un réimport
de la même édition ne recrée pas les entreprises. Intégrer les changements des
**deux dépôts** avant d'activer ce flux ; aucun environnement distant n'a été
modifié par les tests locaux.

En développement, `baitly.directory.sa.osm.local-directory` permet de lire
`latest.json` et son `public-SHA.jsonl` générés localement. Les contrôles de taille,
hash, frontière, identité et provenance restent identiques. La base applicative
conserve les fiches ; ce dossier est une source de test, pas leur stockage.
Une édition combinée déjà chargée ne doit pas être remplacée par l'ancien stock
OSM seul. Recréer le backend avec le nouveau code est nécessaire pour bénéficier
de cette protection et des nouveaux automatismes ; l'opérateur local ne le redémarre pas.

Le mapping exact `SERVICES` de `build_baitly_saudi_public_snapshot.py` retient les
prestataires de nettoyage, blanchisserie, nuisibles, jardin/piscine, réparation,
plomberie, électricité, climatisation, serrurerie, déménagement, gestion de biens,
traiteur, restauration/cafés (même périmètre qu'OSM) et décoration intérieure.
Les catégories primaires et leurs ancêtres explicites sont vérifiés, sans déduction
depuis le nom de l'entreprise. Les alias réels `hvac_service`, `mover` et
`key_and_locksmith` sont notamment pris en charge.
Les catégories générales, automobiles, santé et industrie sont exclues.
Un score Overture inférieur à 0,5, un lieu fermé, une
licence inconnue ou une position hors frontière est écarté. Ce score est une
estimation de présence, pas une certification juridique ou une garantie de contact.

Les identités `SA:OVERTURE:UUID` ne sont jamais assimilées à un SIRET, CR ou UNN.
Une correspondance automatique avec OSM nécessite le même service, au plus 50 m,
et soit le même nom et la même adresse textuelle, soit le même téléphone et le même
domaine web à au plus 10 m. Les correspondances doivent être univoques dans les deux sens. Un
nom similaire seul, un site de chaîne seul ou la seule proximité ne suffit pas.
Les candidats ambigus sont isolés dans `review.jsonl`, livré en artifact CI,
et ne produisent pas de doublon publié. Ce fichier est destiné à la revue opérateur ;
aucun nouvel écran de validation n'est ajouté par ce changement.

La fiche OSM conserve son identifiant et ses contacts déjà présents. Les champs
vides peuvent être complétés par Overture avec une preuve par champ. Les conflits
restent dans les preuves et ne remplacent pas automatiquement la donnée OSM.
Les identifiants sources sont conservés comme alias pour les réimports CRM.
La source, la licence, la release, le score et les références amont sont conservés
en base. Les suppressions et corrections CRM privées ne sont pas écrasées.
Une réutilisation publique des coordonnées n'accorde aucune autorisation de campagne.

Les données Overture Places portent CDLA-Permissive-2.0, Apache-2.0 ou CC0-1.0 selon
leurs sources ; le catalogue combiné conserve aussi les obligations ODbL d'OSM.
Conserver les textes de licence et les notices applicables lors de la redistribution.
[Licences Overture](https://docs.overturemaps.org/attribution/#places).
[CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/).

Le snapshot `public-SHA256.jsonl` et son manifeste utilisent le répertoire public
saoudien existant. Le serveur accepte encore les anciennes éditions OSM seules.
La migration Liquibase `0593` ajoute l'identité Overture et l'unicité des alias actifs.
Il n'y a ni nouveau fournisseur payant, ni clé API, ni extension de base requise.

Vérification locale reproductible sans publication ni base applicative :

```bash
rtk proxy python -m unittest discover -s scripts/directory -p 'test_baitly_saudi_*.py'
rtk proxy python scripts/directory/build_baitly_saudi_osm_snapshot.py --out /tmp/baitly-sa-public
rtk proxy python scripts/directory/build_baitly_saudi_public_snapshot.py --out /tmp/baitly-sa-public
```

La génération OSM écrit aussi `sa-boundary.geojson`. Un fichier Overture national
déjà téléchargé peut être fourni via `--overture-input fichier.geojsonseq --release
AAAA-MM-JJ.N`. Ne jamais utiliser un extrait urbain comme édition nationale : cette
option est réservée aux fichiers nationaux complets et aux tests isolés.
Le dernier manifeste n'est remplacé qu'après réussite des deux collectes ; le
workflow le publie après le snapshot immuable. Un téléchargement échoué ne retire
aucune donnée existante. Staging et production ingèrent séparément cette édition
commune après leur déploiement CI/CD. Ne pas appliquer manuellement la migration
ou un import directement en production.

## Périmètre livré

L'extension réutilise les références JDBC de l'annuaire, sa table de staging,
ses preuves de source, ses agrégats PostgreSQL/PostGIS, ses caches Redis/Caffeine
et les copies CRM propres aux organisations. Aucune nouvelle entité entreprise,
aucun scraping et aucun appel payant activé par défaut.

France : stock Sirene, ADEME RGE, enrichissement OSM hors ligne, recherche
interactive SIRET et géocodage BAN/IGN existants. La publication et les retraits
Sirene sont désormais explicitement limités à `FR`.

Maroc : adaptateur de **projection autorisée** OMPIC/RCC/DirectInfo, au format
JSONL Baitly décrit ci-dessous. Ce format n'est pas présenté comme un export
natif OMPIC. Le mapping du fichier réellement obtenu devra être confirmé avec
son contrat et un échantillon. Aucune API publique de collecte nationale
exhaustive n'a été confirmée pendant l'audit.

Arabie saoudite : **import public OSM automatique**, sans société, clé ou abonnement,
pour les professionnels cartographiés et leurs coordonnées disponibles. Le fichier
GCC Geofabrik est filtré par la frontière nationale OSM, pas par un rectangle.
L'identité `SA:OSM:node/…|way/…|relation/…` n'est pas un numéro de registre.
Les offres et la validité juridique ne sont pas certifiées par OSM.

L'adaptateur de projection autorisée, ou fichier d'identifiants
autorisés interrogés par le client officiel Wathq. Le client réalise des recherches
par identifiant, **pas une énumération nationale**. Une liste initiale autorisée
reste nécessaire. Les réponses sandbox ne sont jamais publiées dans l'annuaire.

Les flux OMPIC et Wathq restent désactivés en l'absence de sources autorisées.
Le flux saoudien OSM est activé par défaut et consomme l'édition publique publiée
par CI/CD ; il n'énumère pas les registres et sa couverture dépend d'OSM.

## Identités, services et provenance

`siret` reste un identifiant français, nullable uniquement pour les lignes étrangères.
La clé de référence est `(country_code,identifier_type,identifier)` :

| Pays | Identifiant publié | Identifiants supplémentaires |
| --- | --- | --- |
| FR | SIRET de 14 chiffres | règles France inchangées |
| MA | ICE de 15 chiffres, ou RC qualifié par tribunal | ICE, `RC=TRIBUNAL:NUMERO`, COURT, IF, CNSS si autorisés |
| SA | UNN de 10 chiffres commençant par 7 | CR de 10 chiffres comme alias/recherche |
| SA (OSM) | `OSM` : `node/id`, `way/id`, `relation/id` | aucune identité légale inventée |

La validation est structurelle ; elle ne certifie pas l'existence juridique d'un numéro.
Les alias contradictoires arrêtent la publication au lieu de créer un doublon.
Les caractères arabes et les zéros initiaux sont conservés. Ne pas transformer un
code NMA/ISIC en code NAF : `activity` garde le code source, `service` utilise une
famille existante, issue d'un mapping de source vérifié. Aucun service n'est déduit
d'un nom commercial.

Comme pour ADEME, un téléphone, email ou site facultatif invalide est omis sans
écarter toute l'entreprise. Un préfixe téléphonique international explicitement
fourni est conservé ; aucun indicatif de pays n'est deviné. L'identité, les champs
principaux et la cohérence de l'édition restent des validations bloquantes.

Les colonnes physiques historiques `sirene_latitude`, `sirene_longitude` et
`sirene_retrieved_at` sont conservées pour éviter de reconstruire la colonne
géographique générée et ses index. Elles portent la position/date de la source
principale ; **`base_source` fournit sa provenance réelle** pour les autres pays.
Les API n'étiquettent donc pas les positions étrangères « Sirene ».

Les preuves sont enregistrées dans `baitly_directory_source_evidence`. Les champs
bruts utiles Wathq sont conservés, mais pas les dirigeants, capitaux et mobiles
privés présents dans le dossier complet. Les copies CRM étrangères sous contrat
utilisent `PARTNER`. Les références OSM saoudiennes utilisent `OPEN_DATA` avec
licence ODbL et URL de l'objet source. Cela n'accorde aucune autorisation de
prospection et ne remplace pas les règles de contact existantes.

## Activation locale et CI/CD

### OSM saoudien sans compte fournisseur

Le job indépendant `saudi-public-source` du workflow `baitly-directory-sources.yml`
télécharge l'extrait public GCC de Geofabrik et construit les géométries des nœuds,
chemins et relations. Il publie un snapshot JSONL immuable et son manifeste SHA-256,
**manifeste en dernier**, sous `maps/directory/sa/` dans le bucket public existant.
Il se déclenche à la promotion sur `production`, chaque dimanche à 03:41 UTC, ou
manuellement avec les règles de publication existantes. Les secrets d'écriture
du bucket `BAITLY_MAPS_AWS_ACCESS_KEY_ID` / `BAITLY_MAPS_AWS_SECRET_ACCESS_KEY` sont
ceux du workflow existant ; aucune clé SPL/Wathq n'est utilisée.

Chaque environnement conserve sa propre base. Après déploiement, le worker saoudien
vérifie le manifeste commun toutes les heures et enregistre les éditions nouvelles
dans **sa base**, puis l'index cartographique existant se reconstruit automatiquement.
Le code seul ne crée pas de données si le job source n'a pas encore publié d'édition.
Le serveur ne télécharge jamais le PBF du Golfe ni ne sollicite Overpass/Nominatim.

Configuration OSM :

```properties
baitly.directory.sa.osm.enabled=true
baitly.directory.sa.osm.cache-directory=/app/tmp/baitly-directory/sa-osm
```

`sa.enabled` reste réservé à une source de registre explicitement configurée :
si activé, cette source a priorité sur OSM dans le worker saoudien. Le mode par
défaut est `sa.enabled=false` et `sa.osm.enabled=true`. La migration `0592` autorise
les identités OSM saoudiennes dans la table existante et suit Liquibase au boot.

Une réimportation utilise la clé `(SA,OSM,type/id)` et conserve l'ID de la fiche.
Les doublons de même nom normalisé et même position (à six décimales) sont regroupés
dans l'édition ; leurs champs de contact vides sont complétés. Les rapprochements
par nom approximatif, numéro partagé ou proximité seule ne sont pas automatiques.
Les établissements absents d'une **édition complète** sont retirés uniquement de
la source OSM saoudienne. Une chute de volume excessive ou un fichier incomplet
conserve la dernière version publiée. Les fiches supprimées restent supprimées.
Les copies CRM et leurs corrections propres à chaque organisation restent privées
et ne sont pas écrasées par le rafraîchissement de l'annuaire.

Les services proviennent uniquement des tags OSM documentés dans `SERVICES` de
`scripts/directory/build_baitly_saudi_osm_snapshot.py` : blanchisserie, nettoyage,
artisanat de maintenance, réparation, jardinage, sécurité, nuisibles, déménagement,
gestion immobilière, restauration et experts du logement. Un champ manquant reste
vide ; aucun adresse, email, téléphone ou immatriculation n'est inventé.
L'attribution OpenStreetMap et les obligations ODbL restent applicables au catalogue.

Vérification hors base applicative :

```bash
rtk proxy python -m unittest discover -s scripts/directory -p 'test_*.py'
rtk proxy python scripts/directory/build_baitly_saudi_osm_snapshot.py --out /tmp/baitly-sa-osm-edition
```

Les dépendances se trouvent dans `scripts/directory/requirements.txt` (Pyosmium et
Shapely). L'extraction ne lit aucune base applicative et n'effectue aucun envoi vers
un fournisseur. `--input chemin/gcc.osm.pbf` permet de vérifier une édition locale.

### Sources de registres sous autorisation

Migrations `0589` (pays, sources, identités, staging), `0590` (identités CRM),
`0591` (cellules cartographiques). Elles suivent le master Liquibase et s'appliquent
au démarrage après déploiement habituel. Les nouvelles sources restent désactivées.
Les migrations `0587/0588` existantes ne sont pas modifiées.

Configurer les propriétés suivantes dans la configuration privée de l'environnement
(secrets dans le gestionnaire de secrets/CI, jamais dans Git). Exemple local :

```properties
baitly.directory.ma.enabled=false
baitly.directory.ma.reuse-authorized=false
baitly.directory.ma.snapshot=/app/tmp/baitly-directory/ma.jsonl
baitly.directory.ma.manifest=/app/tmp/baitly-directory/ma.manifest.json
baitly.directory.sa.enabled=false
baitly.directory.sa.reuse-authorized=false
baitly.directory.sa.snapshot=/app/tmp/baitly-directory/sa.jsonl
baitly.directory.sa.manifest=/app/tmp/baitly-directory/sa.manifest.json
baitly.directory.countries.check-ms=60000
baitly.directory.sa.wathq.enabled=false
baitly.directory.sa.wathq.environment=sandbox
baitly.directory.sa.wathq.detail=info
baitly.directory.sa.wathq.production-authorized=false
baitly.directory.sa.wathq.production-url=
baitly.directory.sa.wathq.daily-request-limit=0
baitly.directory.sa.wathq.daily-budget-halala=0
baitly.directory.sa.wathq.cost-halala.info=0
baitly.directory.sa.wathq.cost-halala.fullinfo=0
baitly.directory.sa.wathq.min-interval-ms=1000
```

Clés privées distinctes : `baitly.directory.sa.wathq.sandbox-api-key` et
`baitly.directory.sa.wathq.production-api-key`. Le plafond et le prix effectif
doivent être configurés, taxes comprises, avant la production. Le prix d'un
`fullinfo` ne doit pas être assimilé à celui de `info`.

Spring accepte ces propriétés via un fichier privé chargé par
`SPRING_CONFIG_ADDITIONAL_LOCATION` ; ne pas supposer qu'une substitution manuelle
des tirets dans un nom de variable d'environnement sera identique au binding Spring.
Le contrat habituel du projet reste `rtk ...` pour les commandes.

Après fourniture du fichier autorisé et vérification de sa licence de redistribution,
passer les deux drapeaux du pays à `true` dans sa configuration. Le worker démarre
au prochain tick du serveur déjà lancé :

```bash
rtk proxy env JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -f server/pom.xml spring-boot:run
```

Adapter cette commande au profil/configuration locale habituels. Aucun redémarrage
Docker n'est exécuté par cette implémentation. Pour staging/production, les fichiers
licenciés et leurs accès doivent être livrés par le CI/CD dans un stockage privé ;
**ne pas utiliser le bucket public des snapshots OSM/Sirene**.

Les routes authentifiées existantes acceptent `country=FR|MA|SA` : liste,
`/map`, `/map/ranked`, `/map/clusters`, tuiles MVT et `/synchronization`.
Le sélecteur de pays existant de la carte et du CRM transmet ce paramètre.
Le statut ne retourne ni clé API, ni chemin de fichier, ni réponse brute.

## Format d'entrée et exemples fictifs

Un manifeste JSON adjacent au fichier JSONL, avec le SHA-256 exact du fichier :

```json
{
  "country":"MA","source":"OMPIC","mode":"projection","version":"edition-autorisee-1",
  "sha256":"REMPLACER_PAR_64_CARACTERES_HEXADECIMAUX",
  "count":1,"sourceUrl":"https://www.directinfo.ma/",
  "licence":"REFERENCE_DU_CONTRAT_AUTORISE",
  "retrievedAt":"2026-10-20T12:00:00Z","complete":false,"publishable":true
}
```

Exemple MA, **fictif, à ne pas publier** :

```json
{"active":true,"identifierType":"ICE","identifier":"001234567890123","name":"Fixture entretien","address":"Rue de test","city":"Rabat","postalCode":"10000","activity":"","service":"CLEANING","phone":"+212537000000","email":"contact@example.org","website":"https://example.org","identifiers":{"RC":"RABAT:1234","COURT":"RABAT"}}
```

Exemple SA en projection autorisée, **fictif** :

```json
{"active":true,"identifierType":"UNN","identifier":"7001272475","name":"شركة اختبار","address":"","city":"الرياض","postalCode":"","activity":"","service":"MAINTENANCE","identifiers":{"CR":"1010711252"}}
```

Exemple SA en mode `wathq-seeds` (manifeste `country=SA`, `source=WATHQ`,
`complete=false`) :

```json
{"active":true,"identifierType":"UNN","identifier":"7001272475","service":"MAINTENANCE"}
```

L'entreprise est publiée sous son UNN retourné par Wathq après correspondance exacte
de l'identifiant demandé et vérification du statut actif. `info` n'inclut pas
les coordonnées de contact du dossier complet ; des champs vides restent vides.
La réponse de ce schéma n'apporte pas une adresse de rue ou des coordonnées GPS :
aucun point au centre de Riyad n'est inventé. Les lignes sans position restent
consultables dans la liste CRM ; la carte n'affiche que des positions disponibles.

Exemple de sortie abrégée :

```json
{"country_code":"MA","identifier_type":"ICE","identifier":"001234567890123","siret":null,"base_source":"OMPIC","service":"CLEANING","latitude":null,"longitude":null}
```

## Reprise et limites opérationnelles

Les phases, curseurs et codes d'échec se trouvent dans `baitly_directory_sync`, par pays ; le
staging reste dans `baitly_directory_sync_stage`. Les éditions sont contrôlées
par SHA-256 et nombre de lignes. Les données deviennent publiques uniquement
après validation de l'ensemble de l'édition. Une erreur conserve la version publiée.
Des identités dupliquées dans un fichier doivent être corrigées dans sa projection
avant publication ; elles ne sont jamais fusionnées par nom.

Chaque worker a un bail Redis renouvelé et des checkpoints SQL contrôlés par révision.
Le réseau reste hors transaction SQL. Les tentatives payantes sont réservées
atomiquement dans Redis avant appel ; l'échec de Redis interdit l'appel.
HTTP 429 respecte `Retry-After` et diffère la reprise sans épuiser les trois essais.
HTTP 400/401/403/404 demande une revue ; les autres échecs disposent d'un backoff
borné puis s'arrêtent après trois échecs consécutifs. Fournir une nouvelle version
de manifeste après correction. Un timeout peut avoir été facturé par Wathq ;
sa réservation n'est jamais remboursée automatiquement.

Un snapshot `complete=true` retire uniquement les références absentes de sa source
et de son pays. Les projections ne contiennent que des entreprises explicitement actives (`active=true`), selon leur statut vérifié dans la source. Une baisse de plus de moitié d'un stock de plus de cent références
arrête la publication. Les listes Wathq de seeds sont toujours partielles et ne
peuvent pas retirer toutes les autres entreprises. La publication en transaction
unique a un délai de 60 secondes ; qualifier le volume autorisé en staging avant
d'activer un très gros export. Le worker projection traite au plus 5 000 lignes par
tick, par lots de 1 000 ; Wathq traite au plus 100 seeds, avec checkpoints immédiats
pour éviter les pertes d'appels. Le hash du manifeste complet distingue aussi les
changements de licence et de portée, sans se limiter au hash du fichier.

## Accès externes restant à fournir

- OMPIC/DirectInfo : contrat de réutilisation et de redistribution, export réel
  et schéma. [Mentions légales DirectInfo](https://www.directinfo.ma/assets/documents/Mentions-legales-directinfo.pdf).
- Wathq : autorisation de l'usage commercial prévu, seeds autorisés, clés,
  URL/version de production confirmée et budget. Le sandbox vérifié utilise
  `https://api.wathq.sa/sandbox/commercial-registration` avec l'en-tête `apiKey`.
  [API officielle](https://developer.wathq.sa/en/api/31),
  [conditions FAQ](https://developer.wathq.sa/en/faq),
  [tarifs officiels](https://developer.wathq.sa/en/Pricing).
- SPL : l'architecture permet un enrichissement d'adresse, mais **aucun connecteur
  réseau SPL n'est livré ni activé** tant que le contrat d'usage en annuaire, le
  schéma/API souscrit et les quotas ne sont pas confirmés. Les pages publiques
  décrivent les capacités sans établir un droit de géocodage massif et stockage
  pour cet annuaire. [Présentation SPL](https://splonline.com.sa/en/national-address-api/),
  [portail développeur](https://api.address.gov.sa/).
- `data.gov.ma` et `open.data.gov.sa` : aucune édition exploitable exhaustive avec
  licence et schéma vérifiés n'a été obtenue pendant l'audit ; pas d'endpoint inventé.

## Vérification

Les tests unitaires utilisent des réponses synthétiques, sans réseau fournisseur.
Les tests PostgreSQL appliquent réellement les changesets pertinents, y compris
les contraintes d'identité et les cellules MVT. Ils vérifient l'isolation France,
la conservation des données privées CRM et l'absence de consentement implicite.

```bash
rtk proxy env JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -f server/pom.xml -Dtest=BaitlyDirectoryCountryStockTest,BaitlyWathqClientTest test
rtk proxy env JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -f server/pom.xml -Dtest=BaitlyDirectoryCountryPostgresTest,BaitlyNationalDirectoryPostgresTest,BaitlyProfessionalDirectoryPostgresTest,BaitlyCrmProfessionalImportsPostgresTest -Dbaitly.directory.test.jdbc=jdbc:postgresql://127.0.0.1:5433/baitly_directory_test_HEXADECIMAL test
```

La seconde commande exige une base locale jetable nommée avec un suffixe hexadécimal
et un rôle de test adapté ; ne jamais la diriger vers la base applicative.
