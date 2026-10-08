# Baitly : recette des encaissements et reversements Stripe

**État courant du 6 octobre :** la recette partagée Baitly/Stripe est reportée à la fin des travaux de code, à la demande de l'utilisateur. Les paragraphes historiques ci-dessous ne décrivent pas une nouvelle validation du code actuel. La [recette automatisée commune local/CI](automated-financial-recipe.md) exécute les suites serveur, PostgreSQL, frontend et HTTP sans toucher au sandbox ; le [plan final](../../docs/payments-sandbox/final-circuit-recipe-checklist.md) conserve les opérations à exercer depuis Baitly.

**Dernière validation isolée : 2 042 tests serveur, 77 tests interface et 36 tests Python réussis**, zéro échec ni test ignoré ; typage application et tests réussi. [Rapports et limites](../../docs/payments-sandbox/loyalty-credit-validation.md). Les passes ci-dessous sont historiques et leurs nombres ne doivent pas être additionnés.

**Dépenses société :** désignation explicite avant émission, destinataire confirmé par Finance et refus de toute confirmation périmée. [Validation PostgreSQL et interface](../../docs/payments-sandbox/expense-company-validation.md), migration 0509 non chargée dans le PMS.

**Protection supplémentaire des séjours :** [événements tardifs et concurrence](../../docs/payments-sandbox/reservation-payment-order-validation.md), défaut reproduit puis corrigé. La campagne finale conserve les variantes non encore raccordées, dont le crédit fidélité.

**Complément remboursements externes :** séries de remboursements externes sur intervention individuelle, avoirs et récupérations après transfert, refus avant comptabilisation et blocage du solde en cas d'incident. **1 927 tests backend et 75 tests frontend** passent sans échec ni test ignoré ; les deux contrôles TypeScript passent également. Les [preuves détaillées](../../docs/payments-sandbox/external-refund-series-validation.md) distinguent PostgreSQL réel, réseau simulé et opérations de recette finale encore à faire.

**Treizième tranche validée dans le sandbox, 6 octobre 2026 :** après 35 EUR encaissés et 5 EUR remboursés, Baitly a émis un unique transfert Connect de **30 EUR** vers le compte de test de Jean Martin, à la clôture de la mission 332. Stripe confirme `livemode=false`, montant, destination et métadonnées ; le compte prestataire affiche « envoyé ». Dossier 6 SENT, journal 2 TRANSFERRED, référence `tr_1UNQQJQxlvbxDIrYbI1qzOdw`. Commission nulle, remboursement et avoir uniques, journal historique intact. La réception bancaire reste distincte. Les **768 tests serveur**, la migration 0504 exécutée et la recette sont détaillés dans les [preuves et limites du reversement résiduel](../../docs/payments-sandbox/residual-provider-payout-validation.md).

**Suite de recette, 6 octobre :** correctif de replanification chargé après accord (213 tests serveur, 9 tests interface). Capacité ménage déclarée par Jean Martin, trois pièces de simulation validées avec revue limitée à `FR / ITEM:cleaning-turnover` jusqu'au 7 octobre. Mission replanifiée sur un créneau disponible, puis démarrée et terminée par Jean Martin ; images AVANT/APRÈS autorisées et persistées, aucune prestation réelle. Chronomètre UTC et date de fin effective corrigés côté interface (9 tests ciblés). Défaut de persistance des pièces corrigé et recetté sur la mission TEST SANDBOX 352 : 6/6 conservées après navigation, désélection/rechargement à 5/6, revalidation puis clôture à 6/6 avec les deux photos et les trois étapes persistées. Les sauvegardes sont séquentielles et les erreurs visibles ; les boucles de resynchronisation photo/étapes et le chargement tardif du logement sont corrigés. 22 tests interface et TypeScript passent. Aucun nouveau transfert : le dossier 7 reste BLOCKED à 0 EUR, le transfert 332 reste intact. Détail dans la recette liée ci-dessus.

**Douzième tranche chargée et recettée, 6 octobre 2026 :** rapprochement automatique d'un unique remboursement externe partiel sur une intervention Stripe EUR encaissée seule, prorata comptable, avoir lié, montants distincts dans Finance et correction des alertes masquées dans « À traiter ». **686 tests serveur et 30 tests frontend passent**, ainsi que TypeScript et Vite. Après chargement autorisé, le remboursement existant de **5 EUR sur 35 EUR** est rapproché sans nouvelle restitution ; l'avoir **FA2026-00023 (-5 EUR)** est lié et l'incident résolu automatiquement. Deux rejeux ne créent aucun doublon et les écritures historiques sont conservées. Finance affiche les 30 EUR conservés de l'intervention ; avec les 100 EUR conservés du séjour partiellement remboursé, les KPI filtrés totalisent **130 EUR**. Voir les [contrôles et limites du remboursement externe partiel](../../docs/payments-sandbox/partial-external-refund-validation.md). Les paragraphes suivants conservent l'historique des tranches précédentes.

État au 5 octobre 2026 : les encaissements unitaires et le remboursement d'intervention ont été exercés depuis Baitly dans le sandbox. Les **10 contrôles réseau Stripe directs**, dont transfert Connect et versement bancaire simulé, sont des preuves distinctes ; ils ne valident pas à eux seuls le parcours PMS. Le circuit complet reste inachevé. Voir l'[audit du circuit financier](AUDIT-CIRCUIT-2026-10-05.md) pour les ruptures confirmées, les 546 tests ciblés de cette revue et l'ordre des corrections. Aucun paiement réel ni déploiement n'a été effectué pendant l'audit.

Reprise après audit : isolation des propriétaires, refus des confirmations manuelles, blocage des anciens virements manuels/exports SEPA, initialisation du journal sans encaissements déduits et reprise des liens Checkout corrigés localement. **760 tests backend** passent sur cette première tranche ; TypeScript, le build frontend et le JAR serveur sont validés. Cette tranche est chargée sur le serveur local ; Finance reste accessible après rechargement.

Seconde tranche : les nouveaux paiements groupés disposent de parts par intervention persistées avant Stripe, d'une confirmation atomique, d'une protection contre les rejeux et d'un financement des reversements limité à chaque part. **913 tests backend**, sans échec ni test ignoré, passent sur 53 classes principales et 218 suites JUnit ; `mvn package` Java 21 réussit. La migration **0502** est testée sur PostgreSQL isolé, notamment avec la RLS. Le nouveau JAR est chargé et la migration 0502 exécutée localement. Un lot de 90 € créé et payé dans le sandbox Baitly depuis Finance confirme deux interventions (55 € et 35 €), leurs allocations et le journal. Le rejeu du webhook ne crée aucun doublon. Un premier lot non payé créé avec la configuration du compte propriétaire demeure à rapprocher ; il n'est pas compté comme encaissé. Les remboursements par ligne, factures, remboursements externes, litiges et dépenses restent à terminer : voir le suivi en tête de l'audit.

Avant raccordement : **98 tests backend** réussis, sans test ignoré, dont les deux recettes PostgreSQL ; **22 tests Python** réussis pour le précontrôle et les garde-fous de la recette réseau. **Un test réseau supplémentaire** relit les opérations fictives avec le `StripeGateway` et le SDK Java réellement utilisés par Baitly. Le YAML du workflow est analysable ; l'exécution GitHub Actions reste à effectuer après publication. Voir le [rapport de recette du 5 octobre](SANDBOX-REPORT-2026-10-05.md) pour les résultats et limites.

Validation du raccordement : **821 tests backend Stripe**, **13 tests frontend de connexion/retour**, **22 tests Python** et **1 relecture Java du sandbox** réussis avec le SDK final. Ces ensembles complètent la recette PostgreSQL précédente ; ils ne constituent pas une suite globale de tout le PMS.

Recette propriétaire dans le navigateur : connexion OAuth observée, reprise Stripe depuis « Mes versements » corrigée et vérifiée, retour après inscription incomplète vérifié sans fausse activation. **30 tests Connect ciblés** couvrent le correctif de reprise des comptes Standard. L'utilisateur a terminé la vérification Stripe : les capacités sont actives, le guide indique **8/8** et le retour affiche « Votre compte de versement est prêt ». Une vérification automatique bornée (12 tentatives espacées de 5 secondes) couvre l'activation différée après retour, et l'URL de retour reste rechargeable sans conserver le code OAuth. Les transferts de ce bénéficiaire depuis Baitly restent non validés.

Troisième tranche chargée : prévention d'un second paiement entre demande de service et intervention convertie, relecture sous verrou, conservation des tentatives ambiguës et protection contre un webhook rapide. **373 tests backend** réussis, sans échec ni test ignoré, dont une concurrence JPA réelle ; JAR construit et protections chargées avec les tranches suivantes. La reprise après expiration d'une demande de service et le rapprochement complet de ses documents restent ouverts.

Quatrième tranche : factures rattachées à leur dette, destinataires corrigés, confirmation canonique et garde contre un second encaissement. **428 tests backend et 6 tests frontend** passent. Après redémarrage, la facture fictive TEST-FACTURE-20261005 de **45 €** est payée depuis Finance sur le sandbox Baitly : facture et mission PAID, transaction 40 COMPLETED, allocation et journal équilibrés sans doublon. Une mission déjà payée est refusée avant une nouvelle collecte. Les factures de commission et de séjour ne sont pas encore recettées dans l'interface. Une tentative impayée de commission sur le compte propriétaire (transaction 39), ainsi que le lot 37, restent à rapprocher. Voir le rapport pour la configuration locale à conserver et les limites.

Cinquième tranche chargée et recettée : remboursement intégral de **45 EUR** demandé depuis Finance pour le Cottage des Tanneurs, confirmé par Stripe puis affiché Remboursé. Une seule transaction de remboursement et trois paires de contre-écritures, conservées après deux rejeux signés du webhook. **410 tests backend** valident cette tranche ; le correctif de suivi UI ajouté après la recette porte la sélection frontend à **12 tests réussis**, avec TypeScript et build Vite valides. Le JAR recompilé par l'utilisateur contient les mêmes classes applicatives que l'artefact testé. La configuration Stripe Baitly a été restaurée avec la surcharge locale autorisée, à conserver aux prochains redémarrages. Les lots/partiels, annulations publiques, avoirs liés et remboursements externes restent ouverts. Voir le rapport pour les preuves et limites.

Sixième tranche chargée et recettée : l’avoir **FA2026-00012 de -45 EUR** a été créé automatiquement pour le remboursement 41, avec un lien vers la facture FA2026-00007 conservée payée. **400 tests backend** et **15 tests frontend** réussis ; migration 0503 testée sur PostgreSQL isolé puis exécutée sur le serveur local, TypeScript et Vite validés. Finance, les liens de téléchargement et le PDF AVOIR ont été contrôlés. Un seul avoir subsiste après reprise du worker, sans nouveau remboursement ni doublon comptable. La configuration Stripe Baitly a été rétablie sur le serveur seul ; conserver la surcharge locale aux prochains lancements. Les avoirs partiels, de lot et de séjour restent hors de cette tranche. Voir le rapport pour les preuves et limites.

Septième tranche chargée et recettée le 6 octobre : annulation publique avec décision durable, remboursement confirmé avant changement de statut, contre-écritures atomiques et reprise du même dossier. Deux séjours fictifs ont été remboursés à hauteur de **220 EUR intégralement** et **100 EUR sur 200 EUR**. Le retour public après Checkout est corrigé et validé sur un troisième séjour : interruption, reprise, paiement de 220 EUR puis remboursement intégral. Le voyageur reste sur le parcours public. Les tests du correctif de retour comptent **236 tests backend et 21 tests frontend**, sans échec. Voir la [recette des annulations et du retour public](../../docs/payments-sandbox/booking-cancellation-validation.md).

Huitième tranche : avoirs de séjour intégraux et partiels, liés aux remboursements confirmés. **222 tests backend**, dont la requête de reprise et les contraintes de la migration 0503 sur PostgreSQL jetable, passent sans échec ni test ignoré. Le JAR testé a été chargé avec l'autorisation explicite de l'utilisateur, sans modifier la configuration Stripe. Le worker a créé les avoirs **FA2026-00016 (-220 EUR), FA2026-00017 (-100 EUR) et FA2026-00018 (-220 EUR)** ; les factures d'origine restent payées, sans nouveau remboursement ni nouvelle contre-écriture. Voir la [recette des avoirs de séjour](../../docs/payments-sandbox/booking-credit-notes-validation.md). Les constats « annulations publiques » et « avoirs de séjour » encore ouverts dans les tranches historiques ci-dessus sont remplacés par ces deux validations ; les autres limites persistent.

Neuvième tranche chargée et recettée : remboursement d'une prestation entière dans un lot Stripe EUR, avec réserve durable, contre-écritures limitées à cette part et avoir lié. **353 tests backend** passent sans échec ni test ignoré. Depuis Finance, **35 EUR** ont été remboursés sur le lot de 90 EUR ; la prestation sœur de **55 EUR reste PAID**. L'avoir **FA2026-00019 (-35 EUR)** est créé automatiquement ; deux rejeux signés conservent un remboursement, un avoir et six écritures équilibrées. Voir la [recette des remboursements de lot](../../docs/payments-sandbox/batch-refund-validation.md). Les fractions libres de prestation, anciens lots sans parts, remboursements externes et compensations de transferts restent hors périmètre. Le rapprochement des factures historiques non remboursées reste ouvert, notamment FA2026-00011 encore ISSUED malgré sa mission payée.

Dixième tranche chargée et recettée : rapprochement automatique des factures encore émises, envoyées ou en retard malgré un encaissement Stripe confirmé, y compris les parts d'un lot. **433 tests backend** réussissent. **FA2026-00011 (55 EUR)** est maintenant PAID, liée au paiement 38 avec la date historique de sa part. Finance affiche ce statut et actualise ses KPI. Les 214 écritures du journal, le remboursement de 35 EUR et son avoir sont conservés ; aucune transaction ni facture supplémentaire. Le défaut documentaire signalé dans la neuvième tranche est résolu pour ce périmètre. Voir les [preuves et limites du rapprochement documentaire](../../docs/payments-sandbox/invoice-matching-validation.md).

Onzième tranche chargée et recettée : détection des remboursements Stripe sans métadonnées de décision Baitly. **596 tests backend** réussissent. Après encaissement depuis Finance, un remboursement direct Stripe de **35 EUR** confirme automatiquement la mission 329, ses six contre-écritures et l'avoir **FA2026-00021 (-35 EUR)** ; deux rejeux signés ne créent aucun doublon. Un autre remboursement direct de **5 EUR sur 35 EUR** reste à rapprocher, sans avoir ni annulation intégrale ; Baitly bloque une demande de remboursement supplémentaire et affiche une notification. Les 214 écritures antérieures sont intactes. Le rapprochement partiel, le message de refus trop générique et l'alerte absente du widget « À traiter » restent à traiter. Le blocage des reversements est testé automatiquement, sans nouvelle recette bancaire depuis l'interface. Voir les [preuves et limites des remboursements externes](../../docs/payments-sandbox/external-refund-validation.md).

## Trois validations distinctes

### Rechargement local en conservant le sandbox Baitly

Quand le serveur utilise le JAR de son image Docker, le lanceur suivant vérifie le projet, l'image et la configuration privée sans afficher de secret :

```sh
rtk proxy python3 scripts/payments/stripe_sandbox_local.py
```

L'opérateur peut ajouter `--reload-server` pour recréer uniquement `clenzy-server-dev`, sans reconstruire l'image ni redémarrer les dépendances ou le frontend. Le fichier privé `.env.baitly-stripe.local` prévaut sur les anciennes variables du shell. La surcharge `docker-compose.stripe-sandbox-env.yml` n'utilise pas le montage JAR de `docker-compose.stripe-local.yml` ; elle évite ainsi de remplacer une image reconstruite par un ancien fichier `server/target`. Un démarrage avec le seul Compose de base réintroduit les paramètres de `.env.dev` : refaire ce contrôle avant toute recette financière. Le lanceur n'est pas un contrôle d'identité Stripe ni une validation du parcours métier.

| Validation | Ce qu'elle prouve | Ce qu'elle ne prouve pas |
| --- | --- | --- |
| Contrat automatisé PostgreSQL | Migrations financières, signature HTTP, journal, transactions, RLS, isolation bénéficiaire, reprises | Connexion réseau, configuration et comportement réel du sandbox Stripe |
| Précontrôle Stripe en lecture seule | Clé test, identité plateforme attendue, accès aux comptes, capacités et solde test EUR positif | Correspondance avec la configuration Baitly, onboarding OAuth, encaissement et reversement complets |
| Recette fonctionnelle Baitly + Stripe | Parcours réel de test, du paiement au rapprochement et à l'affichage | Réception de fonds réels en banque ou autorisation réglementaire d'un autre pays |

Une CI verte ou `PRECHECK_PASSED` n'autorise pas à annoncer la troisième validation terminée.

## Recette automatisée

Le workflow `.github/workflows/ci-payout-recipe.yml` lance les tests financiers sur PostgreSQL éphémère, sans secret Stripe. Il échoue si les deux recettes Liquibase sont ignorées. Il ne déclenche aucun déploiement. Après ajout à GitHub, son statut peut être rendu obligatoire dans les règles de branche ; ce réglage n'est pas effectué par ce fichier.

`PayoutTransferJournalLiquibaseTest` applique deux fois les migrations 0492 et 0494–0500 ; `OwnerPayoutFundingLiquibaseTest` couvre 0493. Le schéma préalable est une fixture minimale : ce n'est pas un démarrage de toute l'application à partir d'une base vide. Les schémas et rôles de test sont supprimés à la fin.

Le nouveau parcours HTTP utilise le contrôleur webhook, la vérification HMAC du SDK Stripe, les proxys transactionnels Spring, les repositories et le provider RLS de l'application. Seul le réseau Stripe est simulé ; les autres domaines du contrôleur (abonnements, boutique…) sont hors du scénario. La chaîne complète Spring Security n'est pas montée par ce test ; les tests de droits restent complémentaires.

Scénarios contrôlés : signature altérée ou expirée, en-tête absent, événement du compte plateforme ou compte inconnu, état canonique différent du corps reçu, livraison en double, séparation personne/société, lecture étrangère refusée, interruption de pagination sans écriture partielle, reprise du même événement, divergence test/réel et ancien événement « payé » reçu après un échec. Les appels réseau doivent rester hors transaction SQL et seuls les appels Stripe de lecture attendus sont autorisés par le test.

En local, utiliser exclusivement une instance PostgreSQL jetable liée à localhost, dont le compte peut créer des schémas/rôles (authentification locale sans mot de passe pour ces harness existants). Ne pas pointer vers la base du PMS, même locale. Java 21 et les dépendances Maven sont nécessaires :

```sh
cd server
rtk mvn -Dtest=PayoutTransferJournalLiquibaseTest,OwnerPayoutFundingLiquibaseTest,StripeBankPayoutHandlerTest,StripePayoutGatewayTest -Dbaitly.test.jdbc=jdbc:postgresql://127.0.0.1:55439/postgres test
```

Le paramètre JDBC doit être fourni : autrement les recettes DB sont volontairement ignorées. La CI vérifie explicitement ce cas. Aucun conteneur de développement n'a besoin d'être relancé pour exécuter ces tests isolés.

La recette des nouveaux lots utilise également `InterventionAllocationLiquibaseTest` (migration 0502, contraintes et RLS), `InterventionBatchPersistenceTest` (vrais repositories et journal, retour en arrière et rejeu) et les suites de création, confirmation canonique, droits et financement. Exemple ciblé, avec la même base jetable :

```sh
cd server
rtk mvn -Dtest=InterventionAllocationLiquibaseTest,InterventionBatchPersistenceTest,InterventionBatchInitiationTest,InterventionBatchCheckoutServiceTest,InterventionBatchReconciliationServiceTest,AllocatedPaymentConfirmationTest,ProviderPayoutPolicyTest -Dbaitly.test.jdbc=jdbc:postgresql://127.0.0.1:55439/postgres test
```

Les dépendances réseau Stripe de ces tests sont simulées ; leur réussite ne remplace pas le paiement d'un lot depuis le PMS dans le sandbox.

## Accès sandbox et précontrôle

### Configuration locale reprise le 5 octobre 2026

L'environnement existant **environnement de test Baitly** est la plateforme française `acct_1U6AEiQxlvbxDIrY`. Aucun nouveau compte plateforme n'a été créé. Les paramètres Connect enregistrés prévoient un Dashboard Express et l'inscription hébergée ou intégrée par Stripe ; les frais et pertes sont à la charge de la plateforme.

OAuth a été activé dans ce sandbox et les deux URI exactes utilisées par `PaymentConnectService` ont été enregistrées :

```text
http://localhost:3000/payment-connect/return?scope=PERSONAL&flow=oauth
http://localhost:3000/payment-connect/return?scope=ORGANIZATION&flow=oauth
```

La connexion officielle Stripe CLI a été autorisée sur ce compte. Son profil de test est conservé dans `tmp/baitly-stripe-local/stripe/config.toml`, avec permissions privées. Les clés de test, le secret du listener, le client OAuth et l'origine locale sont préparés dans `.env.baitly-stripe.local` (permissions `0600`). Ces deux chemins sont ignorés par Git. Les clés CLI expirent après 90 jours ; renouveler cette connexion à échéance. Ne jamais afficher ces fichiers dans les logs ou les ajouter à un commit.

La configuration privée a été chargée après accord utilisateur. Les recettes du 6 octobre ont ensuite installé des JAR testés dans le même conteneur, sans montage de `server/target`, et activé localement la surveillance des versements bancaires dans `/app/config`. Le lanceur refuse désormais une recréation Compose si elle ferait perdre ces modifications du JAR ou de la configuration. Pour charger du code, conserver le même conteneur, sauvegarder le JAR actif et vérifier son empreinte avant remplacement. Le frontend reste actif.

**Alignement vérifié le 6 octobre :** `stripe-java 33.4.0` cible `2026-08-26.dahlia`. Le relais doit utiliser la version par défaut du compte, actuellement `2026-07-29.dahlia`, compatible avec ce SDK. Ne pas utiliser `--latest` : cette option a dérivé vers `2026-09-30.endive` et produit des HTTP 503 sur les événements typés. Le relais sans cette option est validé sur un paiement de 200 EUR et son remboursement de 100 EUR. Aucune version globale du compte ou de la production n'a été modifiée. Recontrôler la version annoncée par le listener si le SDK ou le compte change.

**Un seul relais par destination locale :** une nouvelle recette a découvert un second processus `--latest` en parallèle du relais compatible. Le bon relais livrait HTTP 200 et le doublon HTTP 503 pour le même événement. Ce doublon a été arrêté. Avant de démarrer un listener, vérifier le PID enregistré et sa commande, sans afficher les secrets. Ne pas conclure qu'un webhook a échoué uniquement à partir d'un rejet du doublon ; recouper son identifiant avec le relais conservé et les écritures métier.

Les changements de contrat sont pris en compte pour les factures (parent et paiements), les coordonnées de livraison Checkout et le mode Checkout intégré. Un événement signé destiné à un handler typé mais incompatible retourne désormais HTTP 503, au lieu de recevoir un acquittement trompeur. Les handlers de versement bancaire conservent leur relecture canonique. Les anciens essais REST et leurs clés d’idempotence gardent leur version initiale dans le rapport privé. La livraison `account.updated` a été vérifiée ; son acceptation ne prouve pas encore un effet métier sur un bénéficiaire rattaché depuis Baitly.

Le compte connecté existant `acct_1U6AObQxlvdQij3V` reste limité et n'a pas été modifié. Un bénéficiaire fictif distinct a été créé pour cette recette, puis son onboarding officiel de test terminé ; il reçoit les transferts et dispose d'un compte bancaire de test. Ses références sont conservées dans le rapport privé. Aucun compte Stripe de cette recette n'est rattaché arbitrairement à un utilisateur Baitly : le parcours métier doit créer ou connecter ses bénéficiaires depuis l'application. L'API indique toujours `charges_enabled=false`, `payouts_enabled=false`, `details_submitted=false` pour la plateforme, malgré les opérations fictives autorisées par le sandbox. Le précontrôle reste donc conservateur et ne certifie pas l'activation de la plateforme.

La configuration préparée s'applique depuis la racine du dépôt avec cette commande, **à exécuter par l'utilisateur** conformément à la règle Docker du projet :

```sh
rtk proxy python3 scripts/payments/stripe_sandbox_local.py --reload-server
```

Sans `--reload-server`, le lanceur reste en lecture seule. Avec cette option, il utilise `docker-compose.stripe-sandbox-env.yml` sans montage de JAR, vérifie le projet, le compte de test et la conservation de l'image. L'ancienne surcharge `docker-compose.stripe-local.yml` monte un JAR de `server/target` potentiellement obsolète : ne pas l'utiliser pour le serveur actuel.

Seul `clenzy-server-dev` est recréé par ce lanceur. Cela recharge la configuration, pas du nouveau code : une nouvelle image ou un JAR testé doit être chargé séparément. Les rechargements de recette ont été explicitement autorisés ; cette exception ne modifie pas la règle Docker générale du projet.

Pour Stripe CLI, utiliser le profil Baitly isolé, et non le profil global déjà associé à un autre compte :

```sh
rtk proxy env XDG_CONFIG_HOME="$PWD/tmp/baitly-stripe-local" \
  tmp/baitly-stripe-local/bin/stripe listen --all-snapshot \
  --forward-to http://localhost:8084/api/webhooks/stripe \
  --forward-connect-to http://localhost:8084/api/webhooks/stripe
```

La commande est lancée pour cette recette après chargement de la configuration locale et vérification du JAR. Elle couvre plateforme et comptes connectés. Le secret de signature attendu doit correspondre au listener effectivement démarré ; ne pas le confondre avec celui d'une destination webhook enregistrée dans le Dashboard.

Références : [version du SDK Java](https://docs.stripe.com/sdks/set-version), [écoute locale des webhooks](https://docs.stripe.com/webhooks), [fonctionnement du relais Stripe CLI](https://github.com/stripe/stripe-cli/blob/master/pkg/proxy/proxy.go).

Utiliser un sandbox dédié à Baitly France. Le précontrôle ne crée ni sandbox, ni compte, ni solde. Il utilise le contrat API `2026-08-26.dahlia` du SDK `stripe-java 33.4.0`. Vérifier à nouveau les versions du SDK et du relais lors de chaque montée de version.

Configurer l'environnement GitHub **`stripe-sandbox`** avec branches autorisées et approbation avant utilisation :

| Type | Nom | Valeur attendue |
| --- | --- | --- |
| Secret | `BAITLY_STRIPE_SANDBOX_KEY` | Clé restreinte `rk_test_…` de préférence, avec lecture des comptes Connect et soldes, y compris sous `Stripe-Account` |
| Variable | `BAITLY_STRIPE_SANDBOX_PLATFORM` | Identifiant exact `acct_…` du compte plateforme de ce sandbox |
| Variable | `BAITLY_STRIPE_SANDBOX_BENEFICIARIES` | Identifiants Connect de test séparés par virgules ; prévoir au moins une personne et une société |

Injecter ces mêmes variables par le gestionnaire de secrets pour une exécution locale. Ne pas mettre les clés dans le dépôt, dans une commande, dans une conversation ou dans un rapport. Une clé sans les droits de lecture requis produit un échec, sans élargissement automatique des permissions.

```sh
rtk proxy python3 -m unittest discover -s scripts/payments -p 'test_*.py' -v
rtk proxy python3 scripts/payments/stripe_sandbox_preflight.py
```

Le workflow manuel propose `sandbox_preflight`, désactivé par défaut, et ne lit les secrets qu'après la recette automatique. Les PR n'ont pas accès à ces secrets. Les protections effectives de l'environnement doivent être configurées dans GitHub ; elles ne sont pas créées par le YAML.

Le script effectue uniquement des GET vers `https://api.stripe.com`, refuse les redirections et les clés live, valide l'identité du compte courant et `livemode=false` sur chaque solde. Il ne considère pas un champ `livemode` absent sur l'objet Account v1 comme une preuve de mode test. Le solde positif est un prérequis minimal, pas une vérification de suffisance pour tous les montants de la recette. Les pays autres que FR sont hors de ce scénario, sans préjuger de leur prise en charge générale par Stripe.

Les sorties ne contiennent ni identifiants de compte, ni montants, ni données KYC, ni corps d'erreur PSP. Codes de sortie : `0` précontrôle passé, `1` erreur ou prérequis métier manquant, `2` configuration absente. Le rapport garde toujours `baitly_end_to_end_verified=false`.

## Recette réseau isolée

`stripe_sandbox_recipe.py` exige `--execute`, une clé test et l'identité exacte du sandbox Baitly. Avant toute écriture, il vérifie le compte France et `livemode=false` sur le solde. Les requêtes restent limitées à l'API officielle Stripe, sans redirection, avec une clé d'idempotence par opération. Conserver le même rapport privé pour reprendre un essai ; après 23 heures, le script refuse sa réutilisation pour éviter un doublon après expiration des clés Stripe.

Après injection de `BAITLY_STRIPE_SANDBOX_KEY` et `BAITLY_STRIPE_SANDBOX_PLATFORM` par le gestionnaire de secrets :

```sh
rtk proxy python3 scripts/payments/stripe_sandbox_recipe.py --execute \
  --report tmp/baitly-stripe-local/recipe-20261005.json --phase payments
```

Les phases `connect` et `bank-failure` restent explicites. `connect` crée un bénéficiaire fictif avec Accounts v2, puis nécessite son onboarding officiel avant les transferts. Cela ne migre pas le parcours de création de compte de l'application, qui utilise encore l'API historique. La phase `bank-failure` requiert le droit d'ajouter la banque officielle de test ; la clé CLI actuelle le refuse (`oauth_not_supported`). Ne pas élargir automatiquement ses permissions.

Le rapport local contient des références Stripe de test, mais aucun secret ni réponse brute. Il doit rester hors Git et privé (`0600`). Un statut `API_CHECKS_PASSED` n'est possible que lorsque tous les contrôles enregistrés sont terminés avec succès ; `PENDING` ou `BLOCKED` garde le résultat global `INCOMPLETE`.

`StripeSandboxReadIT` est un test réseau volontairement exclu de la recette locale habituelle. Il s'active avec `BAITLY_STRIPE_SANDBOX_READ=true`, la clé test et les références `BAITLY_STRIPE_TEST_RUN`, `BAITLY_STRIPE_TEST_PAYMENT`, `BAITLY_STRIPE_TEST_TRANSFER`, `BAITLY_STRIPE_TEST_BENEFICIARY`, `BAITLY_STRIPE_TEST_PAYOUT` issues du rapport privé. Exécution : `rtk mvn -Dtest=StripeSandboxReadIT test` depuis `server`. Il ne crée aucune opération et ne modifie pas la base PMS. Il ne doit pas être activé dans une CI accessible aux PR externes.

## Parcours fonctionnel à exécuter dans le sandbox

Utiliser l'application Baitly de recette, déployée par CI/CD avec migrations et configuration test. Ne jamais modifier les données de production pour fabriquer ces cas. Configurer le webhook Connect de cet environnement vers `/api/webhooks/stripe`, avec son secret de signature distinct, pour les événements `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `payout.canceled`, `payout.reconciliation_completed` ainsi que les événements de compte déjà utilisés. Vérifier la livraison des événements des comptes connectés, pas uniquement ceux de la plateforme.

| Cas | Action depuis Baitly / Stripe de test | Résultat attendu et preuve à conserver |
| --- | --- | --- |
| Plateforme | Ouvrir le guide en tant que staff plateforme | Aucune obligation de créer un bénéficiaire personnel pour opérer la plateforme |
| Propriétaire | Créer ou connecter un compte depuis Baitly ; revenir du parcours officiel | État du compte relu, bénéficiaire personnel correct, pas de faux « connecté » après abandon |
| Prestataire indépendant | Rejouer pour ménage, maintenance et une autre catégorie marketplace | Même politique de versement quelle que soit la catégorie, compte du prestataire concerné |
| Conciergerie/société | Administrateur de société : connecter le compte société, sélectionner ce bénéficiaire pour une mission | Destination société explicite ; un simple membre ne peut pas la configurer ni lire ses versements |
| Encaissement | Régler une réservation ou mission avec un moyen de paiement test via Baitly | Paiement confirmé et reçu plateforme traçable ; refus ou paiement en attente ne finance pas un reversement |
| Répartition | Approuver un reversement propriétaire et des prestations via les écrans Baitly | Un transfert par source, montant/devise/destination exacts, écritures métier et journal cohérentes |
| Répétition | Répéter la validation ou rejouer le webhook de test | Pas de second transfert ; même référence et même clé d'idempotence |
| Réponse perdue | En environnement isolé, interrompre la réponse d'un transfert émis puis consulter le dossier | Rapprochement requis ; la relecture rattache une preuve existante, sans réémission |
| Banque | Faire progresser un payout automatique test rapprochable contenant le transfert | Source `destination_payment`, compte, devise et montant concordants avant l'affichage « versé selon Stripe » |
| Absence de preuve | Consulter un payout manuel ou un rapprochement incomplet | Réception bancaire non confirmée ; aucun succès déduit du seul transfert Connect |
| Échec tardif | Simuler un échec bancaire avec les mécanismes officiels de test | Échec visible pour staff et bénéficiaire ; ancien webhook payé sans effacement de l'alerte |
| Rattrapage | Suspendre la livraison d'un webhook de recette, activer le monitoring uniquement dans cet environnement par configuration CI/CD | Payout retrouvé par relecture ; aucun mouvement supplémentaire dans Stripe |
| Isolation | Ouvrir « Mes versements » avec deux personnes et avec personne/société | Chaque destinataire voit uniquement son périmètre, même avec plusieurs clients émetteurs |

Pour chaque ligne, consigner le commit, la version API, le sandbox, le rôle testé, la date, les références de test utiles et le résultat observé dans un espace interne restreint. Aucun secret, document KYC ou donnée bancaire ne doit figurer dans le rapport public. Un scénario non exercé reste **non validé**, jamais « OK par analogie ».

Les capacités doivent être vérifiées explicitement : le sandbox Stripe peut autoriser certaines opérations même si une capacité n'est pas active. Utiliser les moyens, comptes et événements de test documentés par Stripe, sans inventer une réception bancaire réelle.

## Conditions avant activation

1. Recette automatique sans test financier ignoré ; migrations revues et validées aussi sur l'environnement de recette complet.
2. Précontrôle réussi et configuration Baitly correspondante contrôlée : clé, client OAuth test, retours autorisés, secret de webhook Connect.
3. Parcours fonctionnel ci-dessus documenté et tous les écarts résolus.
4. Avant tout déploiement de ce SDK, aligner aussi la version des destinations webhook de cet environnement avec Dahlia. Une destination restée en `2023-10-16` recevra HTTP 503 pour les événements typés ; ne pas déployer en production sans migration coordonnée des destinations.
5. Activation du monitoring et déploiement par PR/CI/CD après revue ; aucune activation automatique depuis ce précontrôle.

Les PSP du Maroc et d'Arabie saoudite restent des intégrations distinctes. Cette recette Stripe France ne valide ni leur onboarding, ni leurs mécanismes de collecte/répartition, ni leurs reversements.

Références officielles consultées le 5 octobre 2026 : [tests Connect](https://docs.stripe.com/connect/testing), [lecture des comptes](https://docs.stripe.com/api/accounts/retrieve), [lecture des soldes et mode](https://docs.stripe.com/api/balance/balance_retrieve).
