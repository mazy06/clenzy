# Baitly mobile V1 : préparation et recette locale

État du 12 octobre 2026. Les trois parcours sont implémentés : annuaire partagé et réseau privé, suivi propriétaire, demandes et exécution prestataire. Le test interactif sur appareil reste la prochaine étape ; les exports Metro ne remplacent pas un build natif ni une recette utilisateur.

## Ce qui a été vérifié

- Navigation : huit images 3D transparentes cohérentes avec le PMS, dock compact de 64 px, vraie découpe transparente animée et libellés séparés. Visiteur : Services / Logements / Suivi / Compte ; les espaces connectés suivent les capacités métier. Les détails et prompts se trouvent dans `mobile/assets/baitly/navigation/README.md`.
- Découverte publique : Logements présente les portefeuilles de conciergeries ayant choisi de publier leurs indicateurs. Recherche par société/ville, tri par nuits réservées ou satisfaction, comparaison de deux à trois sociétés, puis demande d’étude reprise après connexion. Aucun bien individuel, identité, adresse ou revenu privé n’est publié.
- Vérifications de cette refonte : TypeScript mobile, 18 tests mobiles ciblés, compilation Java et 7 tests PostgreSQL réels du calcul, de la migration Liquibase (rejouée sans changement), de la validation Hibernate et de l’autorisation de publication. Bundle Android exporté ; barre observée sur iPhone 16e. Le parcours connecté du comparateur reste à tester contre le backend applicatif mis à jour : sa nouvelle route répondait encore 404 sur le port 8084 pendant la vérification.

## Écran Services

Services affiche directement les prestataires, avec recherche, filtres métier et ville, fiche et tarif. Aucun onglet de types de prestations ni texte explicatif long. Avant connexion, seul le catalogue public est chargé ; après connexion, le catalogue de l’organisation.

Diagnostic local : 54 fiches privées et 5 indépendants actifs sans revue documentaire valide pour la publication. Le catalogue public répond HTTP 200 avec zéro profil tant que ces dossiers ne sont pas validés dans le PMS. Aucun droit de publication n’a été modifié.

### Catalogue de démonstration local

Activé sur demande pour la recette : `mobile/.env.local` contient
`EXPO_PUBLIC_BAITLY_DEMO_CATALOG=1`. Le mode exige un build de développement et
une API sur localhost, 127.0.0.1, ::1 ou 10.0.2.2. Il reste désactivé dans un build
de production ou avec une API distante. Ce fichier local est ignoré par Git.

Services affiche cinq profils synthétiques avec recherche, métier, ville, tarifs
indicatifs en MAD et fiches consultables. La liste et les fiches portent « Démo ».
Aucun badge vérifié, devis réel ou invitation ne peut
être émis pour ces profils. Les IDs négatifs évitent toute collision avec la base.
Les caches des catalogues réel et démo sont distincts et restent en mémoire.

Douze avis fictifs sont enregistrés dans `clenzy_dev`, dans la table de fixtures
`baitly_demo.provider_reviews`. Ils appartiennent uniquement aux cinq profils
négatifs, sans lien avec un compte réel ou une mission réelle. Les noms,
conciergeries, commentaires et portraits sont synthétiques. Les notes et compteurs
sont calculés à partir de ces avis ; la fiche indique « Démo » dans la section avis.

Le script local est idempotent et exporte la base dans
`mobile/src/features/marketplace/baitlyDemoReviews.json`, instantané utilisé par
le catalogue de démonstration. Il ne s'agit pas d'une lecture live des avis réels :
après modification des fixtures en base, relancer l'export pour actualiser l'app.
Ce schéma de fixtures n'est pas une migration applicative Liquibase et n'est pas
chargé par le serveur. Le script cible exclusivement `clenzy-postgres-dev` /
`clenzy_dev`, sans redémarrage de conteneur.

```sh
rtk proxy python3 scripts/dev/seed-baitly-mobile-reviews.py
rtk proxy python3 scripts/dev/seed-baitly-mobile-reviews.py --check
```

Vérifié sur iPhone 16e : cinq profils affichés avant connexion, filtre Ménage
réduit à Dar Zellige, fiche et deux tarifs accessibles, bouton de devis désactivé,
retour à la liste. TypeScript et 27 tests ciblés réussis, dont les gardes du mode
local, le refus des mutations et les endpoints du catalogue réel.

Les justificatifs de Dar Zellige, Piscines Ourika et Hammam Medina sont des PDF
de test vides de 38 octets. Les quatre candidatures en attente ont un email non
confirmé. Aucun statut documentaire ou droit de publication n’a été modifié.
Le catalogue de démonstration ne remplace pas leur validation réelle.

Pour revenir au catalogue serveur, mettre le flag à `0` puis relancer Metro.
Pour activer ponctuellement sans fichier :

```sh
rtk proxy env EXPO_PUBLIC_BAITLY_DEMO_CATALOG=1 npx expo start --dev-client --port 8081
```

## Publication volontaire et comparateur

La migration Liquibase `0550-baitly-concierge-publications` ajoute le consentement révocable et le snapshot agrégé. Le backend local doit utiliser ce nouveau code et appliquer la migration au boot normal. Le mobile appelle le port configuré dans `EXPO_PUBLIC_API_URL`, par défaut `8084` ; le port `8080` n’est pas son backend par défaut.

Routes : `GET /api/public/concierge-performance` pour les comparaisons ; `GET` et `PUT /api/mobile/concierge-performance` pour l’aperçu et le consentement. Le serveur exige une organisation de type `CONCIERGE`, des droits de gestion et le rattachement à la propre fiche prestataire du compte. Aucune publication automatique des sociétés existantes. Dans Compte, les gestionnaires prestataires accèdent à Publication des performances ; tous les comptes peuvent ouvrir Choisir sa conciergerie.

Période commune : dernière année civile terminée, avec au moins cinq logements actifs du portefeuille actuel sur cette période. Nuits réservées = nuits de réservations enregistrées / nuits calendaires depuis la création des fiches, sans doubler les chevauchements et en excluant les annulations. Ce chiffre n’est pas un taux ajusté des nuits commercialisables : les blocages, imports incomplets et anciens rattachements ne sont pas reconstruits. Les avis concernent les services du prestataire et leur moyenne ne sort qu’à partir de cinq avis. La méthode et la période sont visibles dans l’app. Les publications de l’année précédente doivent être renouvelées pour comparer la nouvelle année terminée.

Le parcours mise en gestion prépare une demande d’étude et permet de consulter/accepter un devis de services existant. Après étude, la conciergerie crée le contrat et son mandat dans le PMS, avec son modèle de document existant. La signature mobile réutilise ce mandat : accepter un devis de service ne vaut pas signature du mandat et ne transfère pas un logement entre organisations.

## Mandats sur mobile

Validation : TypeScript réussi, 32 tests mobiles ciblés et 22 tests Java (isolation propriétaire et signature existante) réussis. Bundle Android exporté. La signature réelle et le lecteur PDF restent à qualifier sur les appareils avec un mandat local.

Compte → Mes mandats de gestion affiche les contrats du propriétaire connecté, uniquement dans son organisation courante (`GET /api/mobile/owner-mandates`). L’identité est résolue depuis le JWT, sans identifiant propriétaire fourni par le client. Le dernier lien de signature disponible ouvre un écran mobile de consultation. Aucun jeton de signature ni document personnel n’est persisté sur disque par le cache de requêtes.

Les liens `clenzy://sign/{token}` et les liens HTTPS des domaines configurés sont reconnus avec ou sans connexion. L’écran lit les informations et le consentement depuis le service existant `/api/public/contract-signature/{token}` : logement, propriétaire, périmètre, commission, dates, encaissement et obligations réglementaires. Le PDF complet est ouvert dans le navigateur intégré du système. Le nom et le consentement explicite sont nécessaires avant signature ; ouvrir un autre mandat efface les choix précédents.

La signature est envoyée une fois, sans relance automatique. Après une erreur réseau, Vérifier le statut de signature relit le serveur avant une nouvelle tentative, avec consentement à renouveler. Un lien annulé, expiré ou déjà signé ne propose aucune signature. Le serveur existant conserve sa preuve et ses gardes de concurrence ; une signature confirmée ne signifie pas automatiquement que le contrat est actif (conflit possible avec un autre mandat). Aucune nouvelle migration n’est nécessaire pour cette étape.

Recette réelle à effectuer après reconstruction du backend : préparer un mandat depuis le PMS pour un compte propriétaire local, ouvrir son PDF sur iOS et Android, signer, contrôler la preuve et le statut du contrat dans le PMS. Vérifier aussi un autre compte et une autre organisation, puis un lien remplacé ou expiré. L’ouverture automatique des liens HTTPS dépend de l’association des domaines avec le build natif ; le schéma `clenzy://` est déjà configuré.


Scénarios complémentaires : aucun consentement = aucune fiche publique ; retrait = disparition du comparateur au rafraîchissement ; seuil insuffisant = publication refusée ; compte d’une autre organisation = refus ; doublons de réservation = nuits comptées une fois ; comparaison = année identique ; connexion depuis une société choisie = demande d’étude préremplie.

## Vérifications précédentes

- Refonte de connexion du 12 octobre : TypeScript, 24 tests mobiles ciblés et 13 tests backend ciblés réussis (session native, catalogue public et isolation du réseau). Affichage vérifié sur simulateur iPhone 16e. La connexion réelle, les fiches privées avec un compte de l'organisation 2 et le challenge Turnstile configuré restent à tester après reconstruction du backend.
- TypeScript mobile et 102 tests mobiles.
- Compilation Java et 34 tests backend ciblés, dont les règles d'architecture, le signalement entre organisations et le refus d'un rapport devenu obsolète.
- Deux tests PostgreSQL réels : changeset Liquibase `0549-baitly-private-network`, seconde application sans changement, validation Hibernate, unicité de relation et consommation concurrente d'une invitation.
- Exports des bundles iOS et Android avec les assets.
- La base PostgreSQL jetable a été arrêtée après les tests. Aucun container Docker existant n'a été redémarré.

## Backend local

Le container actuel `clenzy-server-dev` doit utiliser le nouveau code avant la recette. La migration `0549__baitly_private_network.sql` est enregistrée dans le master Liquibase ; elle doit être appliquée par le démarrage normal du backend avec Liquibase activé. Aucun SQL manuel n'est à appliquer à la base applicative.

Le backend expose désormais :

| Route | Usage |
|---|---|
| `/api/mobile/capabilities` | Espaces et capacités du compte courant |
| `/api/mobile/network` | Relations privées de l'organisation ou invitations du prestataire |
| `/api/mobile/network/members` | Prestataires existants rattachés à l'organisation authentifiée, paginés |
| `/api/public/baitly-session/refresh` et `/logout` | Renouvellement et révocation des sessions natives, validation du refresh token côté serveur |
| `/api/mobile/missions` | Missions explicitement affectées, y compris entre organisations |
| `/api/mobile/owner-missions` | Missions des logements du propriétaire ou de ses demandes sans logement |
| `/api/mobile/missions/{id}` | Fiche et droit d'exécuter cette mission |
| `/api/mobile/missions/{id}/report` | Rapport et étapes enregistrés atomiquement |
| `/api/mobile/missions/{id}/issues` | Signalement par l'intervenant affecté, dans l'organisation du logement |
| `/api/mobile/discussions/{kind}/{id}/open` | Fil contextualisé et contrôle des participants |

Le cycle de devis, les uploads, les notifications, la messagerie et l'effacement des données utilisent les services existants. Un réseau privé ne publie aucune nouvelle fiche et ne change pas les règles d'exposition du catalogue. L'app s'ouvre sur l'annuaire public sans connexion. Les comptes connectés utilisent le catalogue de leur organisation ; les demandes et espaces personnels exigent une connexion.

Le backend doit inclure `GET /api/public/baitly-catalog` et `/{id}` pour la
consultation visiteur. Ces endpoints ne retournent ni coordonnées privées ni
profils exclusifs, inactifs, masqués globalement ou non publiables. Après mise
à jour du code, l'utilisateur doit reconstruire et relancer `clenzy-server-dev` ;
l'assistant ne redémarre aucun conteneur. Le nouveau splash bleu nuit nécessite
également un nouveau build natif.

Le rapport fournit la version de la mission affichée. Un rapport obsolète reçoit un conflit ; la version serveur est rechargée et montrée, tandis que le texte saisi reste disponible pour comparaison. Le lint mobile autonome n'a pas été qualifié : le script hérité existe, mais ESLint et sa configuration mobile ne sont pas présents dans cette installation.

## Identité et configuration

Le parcours courant affiche un formulaire natif Baitly, email/identifiant et mot de passe, et appelle l'endpoint existant `/api/auth/login`. Il n'ouvre plus le navigateur Keycloak. Le mot de passe reste uniquement dans le formulaire ; le jeton d'accès reste en mémoire et le refresh token dans SecureStore. Le backend renouvelle et révoque les tokens avec le même client Keycloak configuré que celui utilisé à la connexion. Les cookies du navigateur ne sont pas utilisés. Le formulaire offre également la réinitialisation par email via l'endpoint existant et conserve le verrouillage et le CAPTCHA du serveur.

Si le CAPTCHA est activé, configurer la clé **publique** `EXPO_PUBLIC_TURNSTILE_SITE_KEY` et l'origine `EXPO_PUBLIC_AUTH_WEB_URL` (par défaut `https://app.baitly.fr`). Cette origine doit être autorisée dans Turnstile et dans `TURNSTILE_ALLOWED_HOSTNAMES` du backend. La vérification apparaît dans une WebView intégrée au formulaire, conformément à la [documentation mobile Turnstile](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/). Aucun secret Turnstile n'entre dans le mobile. Le challenge réel reste à qualifier dans cet environnement configuré.

L'app démarre sur la marketplace. La barre basse visiteur donne accès à Marketplace, Logements, Suivi et Compte ; les espaces privés demandent explicitement une connexion. Après connexion, la barre ajoute Aujourd'hui/Missions et s'adapte à l'espace courant. Compte reste directement accessible. Une demande de devis commencée sur une fiche publique reprend après connexion.

Diagnostic de la base locale au 12 octobre : 63 prestataires, dont 54 actifs exclusifs de l'organisation 2, 5 actifs indépendants et 4 candidatures en attente. Aucune revue documentaire valide n'autorise actuellement une publication publique. Les fiches internes sont consultables dans Réseau privé par un compte de leur organisation, sans publication ni approbation automatique. L'annuaire public reste vide tant que les dossiers indépendants ne sont pas validés via le parcours d'administration existant. Après mise à jour locale pendant la recette, l'endpoint public répond HTTP 200 avec zéro résultat, conformément à ces règles. Les nouveaux endpoints de session et de membres privés nécessitent eux aussi un backend reconstruit avec le dernier code.

Le fichier `mobile/keycloak/baitly-mobile-client.json` conserve la configuration déclarative du parcours PKCE alternatif ; il n'est plus utilisé par le formulaire courant. La promotion staging/production suit le CI/CD et les règles d'infrastructure existantes.

Dans `clenzy-keycloak-dev`, le client mobile existant a été conservé : client public, Authorization Code activé, URIs de retour existantes conservées, PKCE S256 imposé et login direct par mot de passe désactivé. L'attribut S256 a été relu dans la représentation complète du client. Les sessions administratives temporaires utilisées pour cette configuration ont été supprimées.

L'app conserve le schéma `clenzy://` et les identifiants natifs existants. Le retour OAuth exact est `clenzy://auth/callback`. Expo Go ne convient pas à la recette de ce retour ; utiliser un development build.

Valeurs locales par défaut : API `http://localhost:8084`, Keycloak `http://localhost:8086`. Les variables `EXPO_PUBLIC_API_URL` et `EXPO_PUBLIC_KEYCLOAK_URL` permettent de modifier les adresses. Ces variables ne contiennent aucun secret.

Sur Android connecté par ADB, utiliser les redirections avant la recette :

```sh
rtk proxy adb reverse tcp:8084 tcp:8084
rtk proxy adb reverse tcp:8086 tcp:8086
```

Sur téléphone physique sans redirection, configurer `EXPO_PUBLIC_API_URL` avec une adresse du backend accessible depuis le téléphone. Pour le formulaire courant, seul le serveur Baitly échange avec Keycloak.

## Lancement, une fois le backend à jour

Sur Mac Apple Silicon avec un simulateur iOS récent, utiliser le mode simulateur :

```sh
rtk proxy sh scripts/baitly-ios-simulator.sh --device "iPhone 16e" --port 8081
```

Ce mode exclut uniquement le module natif optionnel `tuya-pairing` de
l'autolinking iOS. Plusieurs bibliothèques Tuya ne proposent qu'un simulateur
Intel et excluent ARM, ce qui masque les destinations dans Xcode. L'appairage
Tuya est donc indisponible dans ce build ; la façade existante signale cette
absence. Les autres parcours utilisent leurs vrais services.

Le script répare également un cache CocoaPods incomplet de React Native :
headers `folly` rangés dans un sous-dossier et tranche simulateur absente de
`React.xcframework`. Il réutilise les fichiers et l'archive officielle déjà
téléchargés, puis régénère les liens CocoaPods.

Le hook `postinstall` applique les correctifs persistants : WebView dans le
dossier mobile et Stripe dans les dépendances à la racine du monorepo.
Le correctif Stripe 0.59.0 aligne la déclaration de `STPPaymentStatus` sur
`NSInteger`, comme son SDK Swift, pour les compilateurs Xcode récents.
Référence : https://github.com/stripe/stripe-react-native/issues/2357.

Validation locale du 12 octobre 2026 : compilation Xcode Debug réussie,
installation et ouverture sur iPhone 16e / iOS 26.2, écran de connexion Baitly
affiché. Metro force une seule copie de WebView, celle du dossier mobile qui
correspond au module natif, pour éviter le double enregistrement `RNCWebView`
par une bibliothèque du monorepo. La connexion et les parcours métier restent
à tester avec les comptes locaux.

Pour revenir à un build iPhone physique incluant Tuya, régénérer sans
`BAITLY_IOS_SIMULATOR` puis construire pour l'appareil. Ne pas utiliser le
projet généré en mode simulateur pour distribuer une version avec appairage.

Depuis `mobile/`, construire le development build puis lancer le serveur Metro avec le workflow habituel :

```sh
rtk proxy npx expo prebuild --platform ios --no-install
rtk proxy npx expo run:ios --port 8081
# Ou Android :
rtk proxy npx expo run:android --port 8081
```

Si CocoaPods ne trouve pas `ThingSmartHomeKit (~> 7.5.0)`, le dossier iOS existant
peut avoir été généré avant l'ajout du plugin `withTuyaPairing`. La commande
`prebuild` ci-dessus applique les sources Tuya et la dépendance locale
`ThingSmartCryption` au Podfile sans supprimer le projet natif. `run:ios` installe
ensuite les pods. Un `run:ios` seul ne réapplique pas les plugins à un dossier
`ios/` déjà présent.

Si `Podfile.lock` conserve `SDWebImageWebPCoder 0.15.0` alors qu'`expo-image`
demande `~> 0.14.6`, mettre à jour uniquement cette dépendance depuis `mobile/ios/` :

```sh
rtk proxy pod update SDWebImageWebPCoder --repo-update
```

La dépendance native `expo-image` nécessite un nouveau binaire. La recette locale a confirmé l'affichage du formulaire natif et des quatre onglets visiteurs sur iPhone 16e. Les changements de formulaire et de navigation décrits ici sont en JavaScript ; Metro les applique sans reconstruire le binaire déjà installé.

## Scénarios à tester ensemble

### Services et carte Baitly

La liste présente les prestataires en deux colonnes sur téléphone, avec leurs photos,
leur ville et leur prix. La loupe ouvre la recherche ; les filtres reprennent les
illustrations métier du PMS. Les cinq photos du catalogue de démonstration sont des
visuels d’activité générés, sans association à des entreprises réelles.

La recherche « Prestataire ou ville » fusionne l’enseigne et la ville dans un seul
champ, identique en liste et sur la carte. Le bouton et le champ séparés « Ville »
sont supprimés. Le moteur cherche aussi dans les villes d’intervention déclarées,
tout en conservant les règles de visibilité et la pagination du catalogue.

Les cartes alignent le tarif en bas et affichent les symboles monétaires du PMS
(glyphes vectoriels pour MAD/SAR, symboles Intl pour les autres devises). Les
montants entiers n’affichent pas de décimales inutiles ; les fractions sont conservées.
La région du prestataire règle la présentation, sans convertir ni réétiqueter un
prix dans une autre devise. Le serveur fournit `baseCountryCode` et associe la
devise au prix minimum effectivement affiché. Cette évolution du DTO nécessite
la reconstruction habituelle du backend local pour les fiches réelles ; aucun
conteneur n’a été redémarré par cette tâche.

Le formateur supporte les binaires Hermes dépourvus de `formatToParts()`.
Les trois propositions sont consultables en développement sur
`/baitly-card-proposals.html` : tarif en bas (appliquée), tarif sur la photo,
et liste horizontale compacte. Cette page de comparaison n’entre pas dans les
entrées de compilation du PMS.

Décision produit du 12 octobre 2026 : toutes les nouvelles cartes utilisent le moteur
et le style Baitly intégrés sur `main`, jamais un fond cartographique alternatif.
Le mobile charge `/baitly-provider-map.html`, une entrée publique compilée avec le
PMS, qui partage `mapRuntime.ts`, `baitlyMapStyle.ts` et les archives `/maps/`.
Le pont ne reçoit que les coordonnées et identifiants du catalogue déjà autorisé,
aucun jeton ni adresse privée. Pas de dépendance native supplémentaire.

En local, l’origine est celle de l’API sur le port 3000. Pour une autre installation,
configurer `EXPO_PUBLIC_MAP_WEB_URL` avec l’origine du PMS correspondant (par défaut
`https://app.baitly.fr` hors développement local). L’entrée HTML doit être déployée
avec le PMS avant la distribution du mobile. Le chargement initial nécessite le
réseau et la disponibilité des archives cartographiques.

Une pastille sélectionnée affiche le rayon déclaré et les villes d’intervention,
ainsi qu’une fiche native ouvrant le détail du prestataire. Les données publiques
réelles sont positionnées au centre de leur ville : la localisation et le rayon
autour de ce centre restent indicatifs. Les positions et rayons de la démo sont
fictifs, explicitement signalés. Aucune zone n’est inventée en l’absence de donnée.

La carte est bord à bord, derrière la barre de navigation. Les commandes sont
flottantes et la fiche sélectionnée se superpose sans réduire la carte. Le compteur
et le texte d’aide ont été retirés ; seul le repère « Démo » subsiste pour le catalogue
fictif. Les crédits cartographiques restent accessibles par l’icône d’information.

Recette iPhone 16e : fond Baitly chargé, cinq pastilles visibles, sélection de Dar
Zellige, cercle de 15 km et fiche avec photo, puis ouverture du détail. TypeScript
mobile et client validés ; les 45 tests du catalogue et de la navigation passent.
La compilation de production ciblée de cette entrée HTML, avec son worker MapLibre,
son plugin RTL et ses styles, est validée. La compilation complète du PMS a été
interrompue après une attente prolongée ; elle n’est pas qualifiée par cette recette.

1. Propriétaire : connexion, recherche par métier et ville, demande, devis, acceptation et consultation de la mission liée.
2. Réseau : invitation depuis une fiche, partage volontaire, acceptation dans le compte destinataire, expiration et retrait. Un compte d'une autre organisation ne doit pas voir la relation.
3. Prestataire : sélection de l'espace, réponse au devis, missions individuelles et d'équipe, démarrage, checklist, rapport, photos et signalement.
4. Service distant : brief et livraison sans adresse ni faux contrôle d'arrivée sur site.
5. Réseau coupé : brouillon et médias conservés sur cet appareil ; aucun succès serveur inventé. Après timeout, vérifier l'état avant une nouvelle mutation.
6. Fermeture et relance : reprise du brouillon après authentification du même compte. Une expiration automatique conserve les brouillons autorisés ; une déconnexion volontaire les efface.
7. Compte A puis B : aucun cache, brouillon, média personnel ou compteur de notification de A visible par B.
8. Fil de discussion : lire et écrire ; vérifier le refus après changement d'équipe ou retrait de droits.
9. Notifications : refus de permission OS non bloquant, puis ouverture d'une mission avec relecture serveur.
10. Écran étroit, grand texte, français et arabe système, clair et sombre, caméra et galerie sur appareils réels.

## Limites avant publication

### Profils publics de démonstration

L’onglet public Logements propose deux listes : conciergeries du réseau et
propriétaires recherchant une gestion. Les fiches viennent des mêmes profils
que les auteurs d’avis. Le seed marque explicitement `networkPublished` et
`seekingManagement` ; un avis seul ne publie jamais une recherche de gestion.
Deux conciergeries et trois propriétaires sont listés dans la démo. Les cartes
ouvrent les profils ou la préparation d’un contact, sans envoi réel. Hors démo,
la liste existante de conciergeries à publication volontaire reste utilisée ;
aucune liste de propriétaires réels n’est dérivée de leurs logements privés.

Les auteurs des avis ouvrent six profils fictifs, alimentés par
`baitly_demo.client_profiles` et exportés dans `baitlyDemoClients.json` par le
script de seed local. Ils présentent douze logements, leurs carrousels, leurs
avis voyageurs et l’occupation pondérée par nuits calendaires sur 2024/2025.
Les performances comparent le même portefeuille et ne démontrent aucun effet
causal de Baitly. Aucun utilisateur, logement privé ou revenu réel n’est exposé.
Les domaines `.example` sont fictifs et inactifs. « Confier mon bien » prépare
un projet de démonstration uniquement sur cet écran, sans envoi ni mandat.
Le garde du catalogue local désactive aussi ces profils hors développement local.

Les certificats, builds natifs signés, captures, déclarations stores et recette visuelle ne sont pas encore qualifiés. La bibliothèque native Tuya héritée du projet peut aussi nécessiter ses prérequis de build. Les textes commerciaux, disponibilités et vérifications affichés proviennent du serveur ; aucun avis ou paiement n'est déduit d'un statut de réalisation.

Les documents produit dans `docs/baitly-mobile-v1/` restent ignorés par Git selon la configuration actuelle. Ce guide et les sources du mobile/backend sont dans les chemins suivis par le dépôt. Aucun commit, PR ou déploiement n'a été effectué.
