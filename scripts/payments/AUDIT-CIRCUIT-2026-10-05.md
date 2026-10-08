# Audit du circuit financier Baitly

Revue du 5 octobre 2026 du code local et des recettes disponibles. **Le circuit n'est pas encore complet.** Les encaissements unitaires Stripe et les protections des reversements sont largement raccordés ; des ruptures subsistent sur les lots, les factures, les remboursements et certaines écritures historiques.

Cette revue ne lance aucun paiement, remboursement ou transfert, ne change aucune donnée métier et ne certifie pas la production. Les observations ci-dessous viennent du code ; les opérations effectivement exercées depuis Baitly sont distinguées des tests unitaires et des essais Stripe directs.

## Reprise de l'implémentation, après l'audit

### Suite autorisée du 6 octobre, suivi de validation

L'utilisateur autorise l'enchaînement des correctifs et les rechargements locaux nécessaires. Toutes les opérations PSP restent dans le sandbox Baitly ; aucune mise en production ni transaction réelle n'est incluse.

**Consigne du 6 octobre, suite de l'implémentation :** l'utilisateur demande de reporter la recette sandbox complète à la fin des travaux de code. Continuer les corrections et les tests automatisés isolés, puis exécuter une seule campagne finale depuis Baitly et Stripe. Ne pas confondre tests automatisés réussis et parcours sandbox validés. La campagne finale est suivie dans la [checklist dédiée](../../docs/payments-sandbox/final-circuit-recipe-checklist.md).

**Clôture des trois compléments du 7 octobre :** affectations multiples avec une preuve Stripe unique, récupération après transfert propriétaire fondée sur le net figé et avoir de commission, remise offerte EARN/GRANT avec documents et reprise/restauration des points. Migrations 0512 à 0515 ; **2 277 tests serveur, 101 tests interface, 36 tests Python et deux contrôles TypeScript réussis**, campagne `tmp/baitly-financial-completion-04/summary.json`. [Rapport courant, résultats et limites](../../docs/payments-sandbox/refund-completion-validation.md). Aucun chargement dans le PMS partagé ; recette finale encore distincte. Les mentions « ouverts » des tranches historiques ci-dessous ne décrivent plus ces trois compléments.

**Complément du 7 octobre, preuve externe de lot :** une preuve Stripe entière peut être affectée explicitement à une prestation depuis Finance, avec motif, auteur et montant immuables par le parcours applicatif. Le rapprochement reprend seulement après relecture canonique, puis comptabilise le cumul, les avoirs et la récupération éventuelle du net prestataire. Une preuve non affectée bloque aussi le solde à reverser. **2 264 tests serveur / 342 suites, 100 tests interface, 36 tests Python et les deux contrôles TypeScript passent** dans la campagne `tmp/baitly-financial-external-batch-03/summary.json` et le journal Python `/private/tmp/baitly-financial-python-04.log`. [Portée précise et limites](../../docs/payments-sandbox/ota-supplier-reservation-validation.md). Répartir une seule preuve entre plusieurs prestations, rembourser un séjour déjà reversé et traiter les crédits fidélité restent ouverts. La décision remise offerte ou avoir a été redemandée ; aucune politique documentaire n'est inventée. Aucun chargement dans le PMS partagé.

**Tranche OTA, fournisseurs et réservations externes :** rapprochement documentaire de versements OTA, achats fournisseurs avec invitation ou règlement externe, remboursements externes successifs de séjours sans crédit ni reversement engagé. Les **2 238 tests serveur / 340 suites, 92 tests interface, 36 tests Python et deux contrôles TypeScript** passent. Les preuves et limites sont consignées dans le [rapport de cette tranche](../../docs/payments-sandbox/ota-supplier-reservation-validation.md). Les migrations 0510/0511 et les nouveaux correctifs ne sont pas chargés dans le PMS partagé. Les cas complexes explicitement bloqués restent à implémenter.

**Complément fidélité et parrainage :** checkout réduit raccordé à la confirmation, consommation exacte sous verrou, montant cash séparé du crédit, financement propriétaire borné au reçu et suppression des gains sur séjours non payés. Les scénarios PostgreSQL concurrents et les migrations historiques du crédit sont exercés. [Preuves, limites et décision documentaire en attente](../../docs/payments-sandbox/loyalty-credit-validation.md). Le choix réduction/avoir demandé à l’utilisateur conditionne la clôture des factures et avoirs concernés ; le circuit complet reste ouvert.

**Complément dépenses société :** choix explicite et immuable, isolation PostgreSQL, confirmation du bénéficiaire affiché et absence de repli personnel. **1 948 tests serveur et 77 tests interface**, avec les contrôles TypeScript, passent. [Preuves et limites](../../docs/payments-sandbox/expense-company-validation.md).

**Complément événements tardifs :** le chemin historique de réservation pouvait dégrader un paiement confirmé. Le défaut est reproduit puis corrigé sous verrou ; **137 tests ciblés** passent. [Preuves et limites](../../docs/payments-sandbox/reservation-payment-order-validation.md). La confirmation et le financement du crédit fidélité sont traités dans le complément ci-dessus ; ses documents, remboursements et l’acompte direct historique restent ouverts.

**Tranche remboursements externes, toujours sans sandbox partagé :** rapprochement des remboursements externes successifs d'une intervention EUR, ordre durable malgré les notifications désordonnées, contre-écritures et outbox atomiques, avoirs cumulés exacts et reprise des récupérations prestataire. Un remboursement externe refusé avant comptabilisation ne consomme plus le budget ; un incident tardif ou une relecture incomplète continue de bloquer le solde, y compris pour une série. **1 927 tests backend / 285 suites** et **75 tests frontend**, avec les deux contrôles TypeScript, passent sans échec ni test ignoré. [Preuves et limites](../../docs/payments-sandbox/external-refund-series-validation.md). Code non chargé dans le PMS ; recette navigateur/Stripe réservée à la campagne finale.

**Tranche précédente :** rapprochement d'un remboursement externe unique après transfert avec répartition de commission historique ; blocage après échec tardif ambigu ; commissions OTA émises tant que le règlement n'est pas prouvé et imports concurrents sérialisés ; confirmation de séjour/solde sous verrou avec contrôle du montant, de la devise et de l'organisation ; alertes de litige/récupération conservées après versement bancaire ; erreurs HTTP et doubles clics Finance corrigés. Ses **1 896 tests backend (285 suites), 75 tests frontend, 36 tests Python et deux contrôles TypeScript** sont décrits dans le [rapport précédent](../../docs/payments-sandbox/automated-circuit-validation-2026-10-06.md). Le [lanceur local/CI](automated-financial-recipe.md) impose des rapports frais et toutes les suites requises.

| Point | État actuel | Critère de clôture |
| --- | --- | --- |
| Récupération après reversement prestataire | Recette historique Finance sur 352 sans commission : 70 EUR transférés, 10 EUR remboursés et récupérés, deux avoirs, 60 EUR conservés. [Preuves](../../docs/payments-sandbox/checkout-expiry-and-payout-retry-validation.md). Répartition partielle avec commission désormais implémentée, migration 0508 et recette finale non chargées | Recette avec commission et incidents après versement bancaire à effectuer dans la campagne finale |
| Litiges | Gagné/perdu recettés ; rattrapage paginé des événements manqués ajouté, testé et chargé. [Contrôles](../../docs/payments-sandbox/finance-followup-validation.md) | Recette du rattrapage sans webhook et incidents après transfert à compléter |
| Paiements et remboursements multiples | Séries et ventilation multiple d’une preuve externe implémentées avec journal, avoirs, récupération et solde | Recette finale et transfert du solde du lot à exercer ; anciennes preuves incomplètes à rapprocher |
| Reversements propriétaires | Solde après remboursement, commission TTC et documents raccordés ; recette UI : 100 EUR encaissés, 50 EUR remboursés, 50 EUR transférés. [Preuves](../../docs/payments-sandbox/owner-residual-payout-validation.md) | Commission non nulle dans l'interface et réception bancaire à compléter |
| Dépenses et réassorts | Règlement du prestataire individuel recetté depuis Finance : 30 EUR encaissés, 25 EUR transférés au propriétaire et 5 EUR à Jean Martin. [Preuves](../../docs/payments-sandbox/expense-payout-validation.md). Choix société maintenant implémenté et testé, migration 0509 | Recette société et réception bancaire à effectuer ; nouveaux achats fournisseurs par invitation ou justificatif externe à recetter, retenue des règlements externes non automatisée |
| Crédit fidélité et parrainage | Confirmation EUR, remise offerte EARN/GRANT, facture/avoir cash, restitution et reprise de récompenses liées à leur origine implémentées | Recette finale ; réservation/expiration du crédit, crédit acheté et historiques ambigus restent hors périmètre |
| OTA et commissions | Import distinct du règlement ; facture de commission désormais ISSUED sans preuve et génération concurrente protégée, tests PostgreSQL réussis | Source documentaire OTA et bancaire implémentée avec correction traçable ; recette finale distincte, aucune disponibilité Stripe ni commission payée présumée |
| Autres bénéficiaires et incidents bancaires | Payout manuel de test 1 EUR observé, événements hors ordre et deux rejeux acceptés sans doublon ; aucune attribution bancaire présumée. [Preuves](../../docs/payments-sandbox/bank-monitoring-validation.md) | Société, plusieurs prestataires, rapprochement automatique, échec bancaire et récupération après interruption |
| Exploitation et livraison | Lanceur commun local/CI, rapports frais et manifeste vérifié ; résultats de la tranche courante dans le rapport OTA/fournisseurs, historique des validations conservé | Historique ambigu, limites métier listées dans le dernier rapport, exécution GitHub et livraison CI/CD |
| Recette sandbox finale complète | À faire **après clôture des travaux de code**, à la demande de l'utilisateur | Parcours Baitly → Stripe → webhooks → journal → documents → reversements, incidents et non-régression des anciennes preuves ; [checklist](../../docs/payments-sandbox/final-circuit-recipe-checklist.md) |

La validation automatisée, le chargement local et la recette depuis l'interface sont trois résultats distincts. Une ligne reste ouverte tant que ses contrôles requis ne sont pas effectués.

**Correctifs de code du 6 octobre, après report de la recette finale :** rapprochement bancaire borné au net effectivement justifié par toutes les pages de mouvements ; aucun crédit brut déclaré reçu si le lot contient des débits non affectés ou un total incohérent. Les refus métier du parcours de remboursement successif conservent leur explication en HTTP 400 au lieu de 500. **165 tests / 15 suites passent**, incluant PostgreSQL/RLS, webhooks signés avec PSP simulé, bénéficiaires, récupérations et remboursements. Aucune migration ni modification frontend ; code non encore chargé dans le serveur local. [Preuves, portée et limites](../../docs/payments-sandbox/bank-net-attribution-validation.md).

**Point suivant, remboursement partiel après reversement avec commission :** implémentation locale et tests isolés, sans nouvelle opération sandbox. La base est le net et la commission enregistrés lors du transfert, pas les tarifs actuels. Chaque remboursement prend la différence de deux proratas cumulés du net, arrondis au centime (HALF_UP) ; la commission finance le complément exact. Le dernier remboursement épuise les deux parts sans dépassement. Une récupération précédente incertaine ou une ventilation incohérente bloque la nouvelle décision avant l'appel PSP.

La migration **0508** ajoute la part de commission et la base brute, immuables, avec reprise des anciennes récupérations intégrales ou sans commission. Un remboursement au centime dont la part prestataire vaut zéro attend la preuve du remboursement client, puis passe à `NO_RECOVERY_REQUIRED` sans appel Stripe ni fausse référence `trr_`. Finance expose la ventilation et le total du remboursement ; la projection bénéficiaire reste limitée au montant repris à ce bénéficiaire. Les transferts initiaux restent des preuves historiques. Les contre-écritures continuent d'inverser les écritures réellement comptabilisées ; la ventilation de financement ne crée pas une seconde commission dans le journal.

Validation de cette tranche : **313 tests serveur / 20 suites**, sans échec, erreur ni test ignoré, dont migration PostgreSQL/RLS et réexécution sans changement, allocations successives, remboursements au centime, replays, contre-écritures équilibrées, avoirs et protections des projections. **24 tests interface** et TypeScript passent. Le test du remboursement partiel avec commission a d'abord reproduit le refus historique avant correction. Journaux locaux : `/private/tmp/baitly-commission-final.log`, `/private/tmp/baitly-commission-ui-final.log`, `/private/tmp/baitly-commission-typecheck.log`. Chargement local, contrôle visuel et recette Stripe différés à la campagne finale. Cette tranche porte sur les remboursements de prestations demandés depuis Baitly, y compris une part de paiement groupé ; elle ne certifie ni une récupération après versement bancaire, ni un remboursement externe après transfert, ni le remboursement d'une facture de commission séparée.

**Suite de la mission 352 :** expiration réelle de la tentative 63, nouvel encaissement de 70 EUR depuis Finance, facture FA2026-00033 automatiquement rapprochée, puis transfert Connect de 70 EUR confirmé vers Jean Martin. Le refus initial pour solde disponible insuffisant n'a créé aucun transfert. Après chargement du dernier correctif, Finance a remboursé 5,01 puis 4,99 EUR : deux récupérations Stripe confirmées, deux avoirs et 60 EUR conservés. Le suivi reste distinct du versement bancaire. Les contrôles de remboursement et d'avoir après expiration passent la suite de 1 216 tests ; [recette détaillée](../../docs/payments-sandbox/checkout-expiry-and-payout-retry-validation.md).

**Remboursements partiels de lot recettés :** mission 320, part de 55 EUR du lot de 90 EUR : 5,01 EUR puis 4,99 EUR remboursés depuis Finance, deux avoirs, 45 EUR conservés. La restitution de 35 EUR de la mission 304 est inchangée. 978 tests serveur / 140 suites sans échec ni test ignoré, 13 tests interface et TypeScript validés. Correctif chargé en local ; aucune migration. [Preuves et limites](../../docs/payments-sandbox/batch-partial-refund-validation.md).

**Retour des liens Finance corrigé :** les nouvelles sessions de réservation reviennent sur le parcours public du séjour, avec relecture de son statut ; repli neutre lorsqu'aucun moteur n'est actif. URL Stripe réellement créée depuis Finance sur le séjour fictif 552, page d'interruption et responsive vérifiés. 14 tests serveur et 12 tests interface ciblés, TypeScript et packaging valides. [Recette et limites](../../docs/payments-sandbox/reservation-payment-return-validation.md).

**Suite du 6 octobre :** garde finale des reversements propriétaires, contrôle des dépenses, reprise des litiges et des notifications tardives de remboursement chargés. Le formulaire distingue le montant libre d'un encaissement seul et le remboursement intégral d'une part de lot ; ce dernier a été vérifié dans Finance sur la prestation 414 sans émission. La recette propriétaire a ensuite confirmé le transfert du solde du séjour 551. La création des réservations lance désormais ses automatisations après commit, corrigeant une violation de clé étrangère découverte pendant cette recette. [Détail des correctifs](../../docs/payments-sandbox/finance-followup-validation.md) et [preuves du solde propriétaire](../../docs/payments-sandbox/owner-residual-payout-validation.md).

**Treizième tranche validée dans le sandbox, 6 octobre :** après 35 EUR encaissés et 5 EUR remboursés, Baitly a émis un unique transfert Connect de **30 EUR** vers le compte de test de Jean Martin, à la clôture de la mission 332. Stripe confirme `livemode=false`, montant, destination et métadonnées ; le compte prestataire affiche « envoyé ». Dossier 6 SENT, journal 2 TRANSFERRED, référence `tr_1UNQQJQxlvbxDIrYbI1qzOdw`. Commission nulle, remboursement et avoir uniques, journal historique intact. La réception bancaire reste distincte. Les **768 tests serveur**, la migration 0504 exécutée et la recette sont détaillés dans les [preuves et limites du solde prestataire](../../docs/payments-sandbox/residual-provider-payout-validation.md).

**Suite de recette, 6 octobre :** correctif de replanification chargé après accord (213 tests serveur, 9 tests interface). Capacité ménage déclarée par Jean Martin, trois pièces de simulation validées avec revue limitée à `FR / ITEM:cleaning-turnover` jusqu'au 7 octobre. Mission replanifiée sur un créneau disponible, puis démarrée et terminée par Jean Martin ; images AVANT/APRÈS autorisées et persistées, aucune prestation réelle. Chronomètre UTC et date de fin effective corrigés côté interface (9 tests ciblés). Défaut de persistance des pièces corrigé et recetté sur la mission TEST SANDBOX 352 : 6/6 conservées après navigation, désélection/rechargement à 5/6, revalidation puis clôture à 6/6 avec les deux photos et les trois étapes persistées. Les sauvegardes sont séquentielles et les erreurs visibles ; les boucles de resynchronisation photo/étapes et le chargement tardif du logement sont corrigés. 22 tests interface et TypeScript passent. Aucun nouveau transfert : le dossier 7 reste BLOCKED à 0 EUR, le transfert 332 reste intact. Détail dans la recette liée ci-dessus.

**Douzième tranche chargée et recettée, 6 octobre :** le remboursement externe existant de **5 EUR sur 35 EUR** est rapproché avec statut partiel, contre-écritures proportionnelles et avoir **FA2026-00023 (-5 EUR)**. Finance présente 35 EUR initiaux, 5 EUR remboursés et 30 EUR conservés, sans nouvelle action de restitution. Le dashboard ne masque plus une catégorie entière après plafonnement des autres ; l'incident est résolu automatiquement après rapprochement. **686 tests serveur et 30 tests frontend passent**, avec TypeScript et Vite valides. Le serveur a été chargé après autorisation, deux rejeux ne créent aucun doublon et les écritures historiques sont intactes. Les KPI filtrés affichent **130 EUR**, incluant les 100 EUR conservés du séjour partiellement remboursé. Voir les [preuves et limites](../../docs/payments-sandbox/partial-external-refund-validation.md).

**Mise à jour du 6 octobre :** l'annulation publique durable, les remboursements de séjour intégral et partiel et le retour public après Checkout sont chargés et recettés. Les avoirs de séjour sont également raccordés : le worker a créé trois documents, dont un avoir de 100 EUR sur une facture de 200 EUR. Les mentions de ces défauts dans les constats historiques ci-dessous décrivent l'état avant correction. Preuves et limites actuelles : [annulations publiques](../../docs/payments-sandbox/booking-cancellation-validation.md) et [avoirs de séjour](../../docs/payments-sandbox/booking-credit-notes-validation.md).

**Neuvième tranche, 6 octobre :** remboursement intégral d'une prestation d'un lot confirmé, avoir par part et garde contre un reversement concurrent chargés et recettés. 353 tests passent. Finance a remboursé 35 EUR sur un lot de 90 EUR ; l'autre prestation de 55 EUR reste payée. L'avoir FA2026-00019, les six contre-écritures et la preuve Stripe sont uniques après deux rejeux signés. Voir les [preuves et limites du remboursement de lot](../../docs/payments-sandbox/batch-refund-validation.md). Le rapprochement général des factures historiques, dont la facture sœur de 55 EUR encore émise, reste ouvert.

**Dixième tranche chargée et recettée, 6 octobre :** rapprochement des factures historiques encore émises malgré leur encaissement confirmé. 433 tests passent. Le worker a lié FA2026-00011 au paiement 38 et conservé sa date historique ; Finance affiche désormais Payee et ses KPI sont actualisés. Les 214 écritures comptables sont strictement identiques avant/après, les autres dossiers restent inchangés. Le défaut documentaire de cette facture signalé dans la neuvième tranche est résolu. Les commissions et les dossiers ambigus restent exclus : voir les [contrôles et limites du rapprochement documentaire](../../docs/payments-sandbox/invoice-matching-validation.md).

**Onzième tranche chargée et recettée, 6 octobre :** remboursements déclenchés directement dans Stripe sans métadonnées Baitly. 596 tests passent. Un encaissement de 35 EUR depuis Finance suivi d'un remboursement externe intégral confirme automatiquement la mission 329, six contre-écritures équilibrées et l'avoir FA2026-00021 (-35 EUR), sans doublon après deux rejeux signés. Un remboursement externe de 5 EUR sur la mission 332, encaissée 35 EUR, reste à rapprocher ; aucun avoir ni annulation intégrale n'est fabriqué et une nouvelle demande de remboursement est refusée. La notification est visible, mais son exposition dans « À traiter » et le message de refus trop générique restent à corriger. Les 214 écritures antérieures sont conservées. Le blocage des reversements est couvert automatiquement ; aucun nouveau versement bancaire n'a été recetté dans cette tranche. Voir les [preuves et limites des remboursements externes](../../docs/payments-sandbox/external-refund-validation.md).

Les constats numérotés plus bas décrivent l'état initial. Les corrections locales suivantes sont préparées ; leur présence dans le code ne vaut pas encore validation du parcours Stripe depuis Baitly.

| Contrôle | Correction | Validation |
| --- | --- | --- |
| Confidentialité entre propriétaires | Réservations et demandes de service filtrées dans l'historique et les totaux ; contrôle du payeur avant création et lecture des sessions/transactions, y compris chaque ligne d'un lot | Régression reproduite avant correction ; tests avec deux propriétaires de la même organisation et une organisation étrangère, HQL exécuté sur H2 |
| Statut payé avec preuve | Anciennes confirmations manuelles des reversements propriétaires et dépenses refusées avec HTTP 409 `PAYMENT_EVIDENCE_REQUIRED` ; action « Marquer payé » retirée des dépenses | Services et sélection réelle du handler HTTP testés ; pas de changement de statut ni de notification de réussite |
| Anciens virements manuels | Lancement et relance MANUAL/SEPA_TRANSFER refusés avant réservation de l'émission | Tests de non-mutation et absence d'appel à l'exécuteur |
| Journal historique | L'initialisation crée uniquement les comptes plateforme/séquestre dans la devise de l'organisation ; suppression de la fabrication d'écritures à partir des seuls anciens statuts PAID | Aucune réservation, mission ou demande de service n'est utilisée pour reconstituer un encaissement ; aucune écriture créée par cette initialisation |
| Reprise du checkout | Même contrôle organisation/source/montant/devise pour hébergé et intégré ; relecture du lien ou secret de la session ouverte via StripeGateway, sans nouvel ordre | Cas ouverts, terminés, expirés, mode incompatible, lien absent, devise/montant différents et indisponibilité Stripe couverts |

La reprise accepte les modes Stripe historiques `hosted`/`embedded` et actuels `hosted_page`/`embedded_page`. Le lien hébergé n'existe que pour une session active. [Objet Checkout Session Stripe](https://docs.stripe.com/api/checkout/sessions/object).

**Limites conservées :** le faux statut REFUNDED anticipé de l'annulation publique reste à traiter avec une reprise durable ; aucune validation de l'étape 1 complète n'est donc annoncée. Les factures, les remboursements partiels/externes, les litiges et le règlement effectif des dépenses restent ouverts. La seconde tranche ci-dessous raccorde les nouveaux lots ; les anciens lots sans allocations ne sont pas reconstitués automatiquement. Les erreurs de création ambiguës sont bloquées pour ces nouveaux lots ; les autres sources restent à harmoniser.

**Vérification du lot corrigé :** 760 tests backend réussis, 0 échec, 0 erreur, 0 ignoré, sur 42 classes principales et 181 suites JUnit. Le comptage utilise uniquement les rapports produits par cette exécution, sans cumuler les anciens rapports. `mvn package` Java 21 a produit le JAR ; le contrôle TypeScript et le build Vite réussissent également. Les avertissements de découpage de modules et de taille des bundles restent présents dans le build frontend. `git diff --check` ne signale aucune erreur.

**Chargement de la première tranche :** le 5 octobre, après l'accord de continuation, seul `clenzy-server-dev` a été redémarré ; il est revenu sain. La session administrateur Baitly est restée utilisable après rechargement de Finance.

### Seconde tranche : parts des nouveaux paiements groupés

- Source `INTERVENTION_BATCH`, avec parts par mission persistées **avant** l'appel Stripe. La migration Liquibase 0502 ajoute la table, l'unicité lot/mission, les clés étrangères composites qui empêchent les rattachements inter-organisations et la RLS. Aucune ancienne ligne PAID ne fabrique une part.
- Les missions sont verrouillées dans un ordre stable. Une tentative active, ou un échec ambigu de nouveau lot, empêche un autre lot ou un paiement unitaire de reprendre les mêmes missions.
- Le Checkout utilise la référence durable de transaction comme clé d'idempotence Stripe. La référence de session et l'état PROCESSING des missions sont enregistrés atomiquement ; aucun `saveAll` détaché ne peut réécrire un webhook rapide.
- Webhook signé et retour authentifié partagent une relecture canonique Stripe : session, mode paiement, montant, devise, organisation, référence et membres du lot doivent correspondre.
- La confirmation verrouille la transaction, valide toutes les parts et toutes les missions, puis écrit le statut, les parts confirmées et le grand livre dans la même transaction. Le journal utilise **le montant figé de chaque part**, pas une estimation relue après paiement.
- Un rejeu Kafka ne peut pas confirmer une transaction non encaissée. Le rejeu après commit ne double ni les parts ni les écritures.
- L'expiration confirmée d'une session non payée autorise une nouvelle tentative. Une session simplement non payée ou une erreur réseau ne constitue pas cette preuve.
- Les parts confirmées peuvent financer les reversements prestataires, sous les autres conditions existantes (mission terminée, montant exact, EUR, bénéficiaire et compte PSP). Le total du lot n'est jamais attribué à chaque mission.
- Le remboursement générique d'une mission appartenant à ce nouveau lot est refusé, y compris un lot d'une seule mission : il ne doit pas rembourser le mauvais encaissement. Le remboursement par ligne reste à implémenter.

**Recette et limites de cette tranche :** tests des montants et métadonnées, isolation, droits propriétaire, erreurs Stripe, expiration, reprises, allocation incomplète et financement des prestataires. Les vrais repositories JPA/CAS et le ledger sont exercés sur H2 : un échec sur la deuxième ligne annule la première ligne, toutes les écritures et la confirmation de transaction, puis le rejeu réussit une fois. La migration exacte 0502 est exécutée deux fois sur un schéma PostgreSQL isolé ; contraintes et RLS sont contrôlées sous un rôle non privilégié. Les tests ne créent aucun encaissement Stripe.

**Résultat final automatisé :** 913 tests backend réussis, 0 échec, 0 erreur, 0 ignoré, sur 53 classes principales et 218 suites JUnit produites par cette exécution. `mvn package` Java 21 réussit et produit `server/target/clenzy-platform-1.0.0.jar`. Aucun code frontend n'a changé dans cette seconde tranche. Le nouveau JAR a ensuite été chargé et la migration 0502 exécutée sur la base locale le 5 octobre 2026 à 13:53 UTC.

**Recette locale chargée et exécutée :** après le redémarrage utilisateur, 0502 est enregistrée EXECUTED. La configuration de test Baitly a été rechargée avec l'accord explicite de l'utilisateur, uniquement sur le serveur et le frontend. Un premier Checkout affichait « Miftah Al- », identifié par l'utilisateur comme le compte propriétaire. Ce premier lot de 90 € n'a pas été payé ; ses deux dossiers restent en traitement jusqu'au rapprochement de sa session. Aucun statut n'a été réinitialisé arbitrairement.

Le second lot est créé depuis Finance, sélection groupée, sur la plateforme Baitly. Paiement de test **90 € réussi**, retour dans Baitly, deux lignes « Payé » : **Loft Bastille 55 €** (intervention 320) et **Villa Caudéran 35 €** (intervention 304). Transaction locale **38 / TX-f2c7a582-b74** COMPLETED, deux allocations confirmées, écritures équilibrées de 55 € et 35 €. Le webhook reçu et son rejeu signé retournent HTTP 200 ; le rejeu conserve deux allocations et deux paires débit/crédit, sans doublon. Les fonds n'ont pas été transférés aux prestataires lors de cet essai.

### Troisième tranche : dette commune demande de service / intervention

- Une demande déjà payée, partiellement payée, remboursée, ou convertie en intervention ne peut plus créer un autre paiement depuis son ancien parcours. La détection couvre aussi les conversions historiques sans champ convertedInterventionId.
- La création de l'intention relit la demande sous verrou et vérifie le statut, le montant et l'absence de paiement enregistré. Les missions verrouillent d'abord leur demande parent, dans le même ordre que la confirmation et l'acceptation prestataire.
- Une intervention liée à une demande encaissée, en traitement ou portant une tentative durable (y compris un échec ambigu) ne peut pas réclamer cette dette à nouveau. Une ancienne référence de session non rapprochée bloque également ce second parcours.
- Une erreur locale SERVICE_REQUEST conserve sa clé d'idempotence pour rapprochement. La reprise après expiration canonique de cette source reste à terminer ; le nouveau lot INTERVENTION_BATCH conserve son mécanisme d'expiration déjà validé.
- Le retour d'initiation ne réécrit pas en PROCESSING une demande que le webhook rapide a déjà confirmée PAID ; il ne remplace pas la référence d'une autre session.

Les tests JPA réels vérifient le lien historique, une conversion commise après la première lecture, une intention antérieure au marqueur PROCESSING et deux initiations concurrentes : la deuxième attend le commit, puis est refusée. Cette tranche ne modifie pas de migration ni d'écran. Validation finale : **373 tests réussis, 0 échec, 0 erreur, 0 ignoré**, sur 25 classes principales et 65 suites JUnit nouvellement produites ; package Java 21 réussi. Son chargement est distinct du JAR utilisé pour la recette réseau du lot. L'accord de redémarrage du seul serveur local est demandé pour charger ces protections.

### Quatrième tranche : factures et dette d'origine

- Le destinataire est résolu côté serveur : propriétaire pour une commission, demandeur pour une prestation, voyageur pour un séjour. Le nom d'affichage du client ne sert plus d'adresse email.
- Une facture de prestation utilise la même dette et la même clé que le paiement de l'intervention, avec une allocation unique. Une facture de séjour réutilise la source et la clé de la réservation. Une facture de commission dispose d'une source INVOICE dédiée, uniquement pour un contrat OWNER_COLLECTS actif.
- Le TTC et la devise doivent correspondre exactement au montant encore exigible. Les paiements partiels, anciens encaissements, collectes OTA et anciennes sessions non rapprochées ne peuvent pas déclencher une seconde collecte.
- La facture est liée à la tentative avant l'appel Stripe. Une erreur réseau conserve la tentative ; une expiration canonique non payée peut libérer les liens. Une session existante peut être reprise sans changer le statut payé.
- La confirmation vérifie la session canonique Stripe, le montant, la devise, la transaction, l'organisation et la facture. Le webhook et le consumer raccordent la facture après sa dette. Une commission crée une seule paire équilibrée dans le journal ; une facture de séjour ou de mission ne recrée pas les écritures de sa dette.
- Une ancienne tentative INVOICE bloque aussi le bouton du séjour ou de la prestation correspondante. Une facture liée à une tentative PSP ne peut pas être annulée par l'ancien bouton d'avoir sans rapprochement préalable.
- L'envoi du lien de réservation ne fusionne plus un objet détaché après l'appel email : une mise à jour limitée aux champs de suivi évite d'écraser un webhook rapide.
- Dans la liste des factures et la modale de l'assistant, « Payer » ouvre le Checkout HTTPS. Aucun statut PAID optimiste n'est écrit ; les erreurs du serveur restent visibles.

**Validation automatisée :** 428 tests backend réussis, aucun échec, erreur ou test ignoré, sur 25 classes principales / 73 suites JUnit produites par le build final. Parmi eux, transactions JPA/H2 réelles avec CAS, journal, rejeu, panne du journal et annulation atomique, expiration et concurrence entre les boutons facture/réservation. Les quatre événements Checkout sont testés avec signatures ; la relecture réseau Stripe est simulée. 6 tests frontend passent ; TypeScript et build Vite réussissent (avertissements existants de CSS, imports mixtes et taille de bundles). Le JAR Java 21 est construit. Aucune migration ajoutée.

**Recette depuis Baitly validée après redémarrage :** facture fictive TEST-FACTURE-20261005, 45 EUR, intervention 414. Transaction 40 COMPLETED, facture et mission PAID, allocation unique confirmée ; une paire d'encaissement de 45 EUR et deux paires de répartition de 44,55 EUR au total par sens. Refus anti-double paiement vérifié sur une facture de mission déjà encaissée. Cette recette valide le paiement d'une facture de prestation, pas la génération du document, une commission ni une facture de séjour. La tentative de commission 39, créée avant rétablissement de la configuration Baitly, reste impayée sur le compte propriétaire ; rapprochement requis, comme le lot 37. Détails dans le rapport de recette.

**Limites restant ouvertes :** rapprochement automatique des factures déjà émises contre leurs encaissements historiques, acomptes et factures à solde partiel, avoirs/remboursements (y compris par ligne d'un lot), remboursements externes, litiges et décaissements des dépenses. Les refus de rapprochement protègent ces cas, ils ne constituent pas leur implémentation complète. Le premier lot non payé sur le compte propriétaire doit toujours être vérifié sur ce compte.


## Le circuit attendu

1. Identifier qui encaisse : OTA, plateforme Baitly ou bénéficiaire hors plateforme.
2. Calculer côté serveur le montant, la devise, les acomptes et le reste dû.
3. Créer ou reprendre une tentative de paiement rattachée à la dette concernée.
4. Confirmer le résultat par le PSP, puis enregistrer la transaction, sa répartition et les documents.
5. Autoriser un reversement seulement sur des fonds justifiés, vers le bénéficiaire vérifié.
6. Distinguer l'approbation, le transfert au compte PSP et le versement bancaire.
7. Répercuter remboursements, litiges et échecs tardifs sur chaque étape précédente.

Pour Channex, `payment_collect=ota` indique que le voyageur a payé l'OTA ; ce n'est pas une preuve de crédit sur le compte bancaire du gestionnaire. L'information de collecte est correctement séparée du financement des reversements Baitly. [Documentation Channex](https://docs.channex.io/api-v.1-documentation/bookings-collection).

## État des raccordements

| Étape | État constaté | Limite restante |
| --- | --- | --- |
| Import des paiements OTA | Collecteur, statut inconnu et provenance Channex distingués ; OTA exclues du financement plateforme | Le crédit bancaire provenant de l'OTA n'est pas rapproché par cette information de réservation |
| Onboarding bénéficiaire | Parcours personnel et organisation, reprise, retour, capacités et révocation raccordés | Propriétaire validé dans la recette locale ; prestataire et société à exercer de bout en bout |
| Encaissement unitaire intervention | Montant serveur, session intégrée/hébergée, webhook, facture et journal présents | Réussite, refus et 3DS déjà observés dans le sandbox ; cas composites à terminer |
| Encaissement réservation et moteur public | Checkout, acompte/solde, confirmation et caution présents | La recette PMS prouve un encaissement simple ; pas toutes les combinaisons acompte, crédit, annulation et reversement |
| Demande de service et marketplace | Encaissement et conversion en mission raccordés ; bénéficiaire individuel ou société explicite | Pas de recette complète pour chaque métier ; preuve photo imposée à tous les métiers |
| Paiement groupé | Sélection, devises distinctes, montant recalculé et session du lot présents | Confirmation du nouveau lot incohérente, puis absence d'allocation financière par mission |
| Paiement de facture | Endpoint et lien de paiement présents | Email transmis incorrectement et confirmation métier manquante |
| Reversement propriétaire | Preuves d'encaissement, période, devise, calcul contractuel, unicité, journal et anti-double émission présents | Le transfert PMS de 100 € n'a pas abouti lors de la recette faute de solde disponible |
| Reversement prestataire | Ménage et autres catégories, commissions, bénéficiaire explicite, compte société, journal commun | Lot non reconnu comme financement ; recette PMS jusqu'au compte bancaire incomplète |
| Suivi bancaire | Relecture canonique Stripe, journal des événements, erreurs tardives, rapprochement et reprise bornée présents | Recette réseau bancaire automatique et rejet tardif non terminés ; reprise automatique non validée en exploitation |
| Remboursement | Remboursement unitaire complet d'intervention éprouvé ; dossier d'annulation de devis avec reprise durable présent | Réservations, partiels, opérations externes et récupération des sommes déjà transférées à compléter |
| Dépenses et réassorts | Dépenses approuvées déduites du reversement propriétaire, justificatifs consultables | Déduire une dépense ne paie pas son fournisseur ; une action déclarative subsiste |

Les preuves de recette sont dans [le rapport sandbox](SANDBOX-REPORT-2026-10-05.md). Un transfert et un versement bancaire simulés par le script Stripe ne valent pas une recette du même parcours depuis Baitly.

## Corrections prioritaires

### 1 Filtrer les données du propriétaire dans une même organisation

**Priorité haute, confidentialité.** `PaymentQueryService.getPaymentHistory` restreint les interventions et les demandes de service du HOST, mais charge les réservations de toute l'organisation. Le résumé fait de même. Les endpoints sont accessibles aux HOST. Un propriétaire peut donc recevoir des lignes et des montants d'autres propriétaires de la même organisation. Le filtre administrateur `hostId` n'est pas appliqué aux réservations non plus.

Preuves : [PaymentQueryService](../../server/src/main/java/com/clenzy/service/PaymentQueryService.java), lignes 171–216 et 243–290 ; [ReservationRepository](../../server/src/main/java/com/clenzy/repository/ReservationRepository.java), lignes 595–610 ; [PaymentController](../../server/src/main/java/com/clenzy/controller/PaymentController.java), lignes 184–236.

À faire : appliquer l'ownership à toutes les branches de lecture et de statut, puis vérifier les actions de création de paiement, dont le contrôle actuel est principalement organisationnel. Tester deux propriétaires d'une même organisation et une organisation étrangère. Aucune consultation de données étrangères n'a été tentée pendant cet audit.

### 2 Terminer le paiement groupé jusqu'aux reversements

**Priorité haute, circuit interrompu.** Le nouveau `/create-batch-session`, utilisé par Finance et le planning, crée une transaction `INTERVENTION`, des métadonnées `interventionIds` et affecte la même session à plusieurs missions. Le webhook ne reconnaît comme lot historique que `type=grouped_deferred` avec `intervention_ids`, ou les sources `DEFERRED_INTERVENTIONS_*`. Le nouveau lot tombe dans la branche unitaire qui recherche une seule intervention par session. Avec plusieurs missions, cette requête `Optional` peut échouer pour résultat non unique : l'encaissement Stripe peut réussir sans que Baitly confirme correctement toutes les lignes.

Même après réparation de cette confirmation, `ProviderPayoutPolicy` refuse explicitement un encaissement partagé sans part individuelle prouvée. Ce refus est utile et doit rester jusqu'à la création d'allocations fiables.

Preuves : [InterventionPaymentService](../../server/src/main/java/com/clenzy/service/InterventionPaymentService.java), lignes 206–235 ; [StripeWebhookController](../../server/src/main/java/com/clenzy/controller/StripeWebhookController.java), lignes 288–357 ; [InterventionRepository](../../server/src/main/java/com/clenzy/repository/InterventionRepository.java), lignes 339–347 ; [ProviderPayoutPolicy](../../server/src/main/java/com/clenzy/service/payout/ProviderPayoutPolicy.java), lignes 28–55.

À faire : modèle commun de lot et de lignes avec montant, devise, mission et part remboursée ; confirmation idempotente de toutes les lignes ; financement des versements par ces allocations. Test indispensable : un paiement pour deux missions de deux prestataires, deux reversements correctement calculés, puis remboursement d'une seule ligne.

### 3 Raccorder réellement les factures au paiement

**Priorité haute, circuit interrompu.** `InvoicePaymentService.payInvoice` transmet `buyerName` dans le champ `customerEmail`, ensuite passé à Stripe. La transaction utilise `sourceType=INVOICE`, absent du dispatch de confirmation ; le webhook retombe dans la recherche d'une intervention. Le handler `invoice.paid` existant concerne les crédits d'abonnement Stripe, pas cette facture PMS. `InvoicePaymentService.markAsPaid` existe mais n'est pas raccordé à cette confirmation.

Preuves : [InvoicePaymentService](../../server/src/main/java/com/clenzy/service/InvoicePaymentService.java), lignes 62–98 ; [StripePaymentProvider](../../server/src/main/java/com/clenzy/payment/provider/StripePaymentProvider.java), lignes 119–120 ; [ConsumerReconciledSourceTypes](../../server/src/main/java/com/clenzy/service/ConsumerReconciledSourceTypes.java), lignes 29–38 ; [PaymentEventConsumer](../../server/src/main/java/com/clenzy/service/PaymentEventConsumer.java), lignes 189–217.

À faire : destinataire résolu côté serveur, confirmation `INVOICE` dédiée, solde de facture, journal et lien à la réservation/prestation. Une facture d'une prestation déjà encaissée doit être rapprochée de cet encaissement, jamais facturée une seconde fois. Tester aussi les factures de commission quand l'OTA verse directement au propriétaire.

### 4 Unifier les remboursements et leurs conséquences financières

**Priorité haute, état financier incorrect possible.**

- L'annulation publique d'un séjour écrit `REFUNDED` avant l'appel Stripe après commit. Une erreur laisse cet état en place avec un log. Le helper de remboursement partiel ne vérifie pas le statut final du remboursement.
- Le remboursement de réservation via `ReservationRefundService` ne crée pas lui-même de transaction de remboursement ni de contre-écriture. Une demande réussie chez Stripe peut donc ne pas réduire les preuves de financement locales.
- Les événements `charge.refunded`, `refund.*` et `transfer.reversed` n'ont pas de traitement dédié dans le contrôleur Stripe audité. Un remboursement lancé directement dans Stripe n'est pas globalement rapproché. Le worker des annulations de devis effectue bien une relecture, mais uniquement pour ses dossiers.
- La réconciliation générique des interventions ne traite que le remboursement intégral. Le règlement du dossier d'annulation reste en revue pour un paiement partagé ou partiellement remboursé.
- Aucun raccordement aux reprises de transferts Connect n'a été trouvé dans le circuit de remboursement de l'application. La contre-passation du journal ne récupère pas l'argent déjà envoyé au bénéficiaire.

Preuves : [PublicCancellationService](../../server/src/main/java/com/clenzy/booking/service/PublicCancellationService.java), lignes 99–120 ; [ReservationRefundService](../../server/src/main/java/com/clenzy/service/ReservationRefundService.java), lignes 83–110 ; [StripeRefundService](../../server/src/main/java/com/clenzy/service/StripeRefundService.java), lignes 117–129 ; [InterventionRefundReconciliationService](../../server/src/main/java/com/clenzy/service/InterventionRefundReconciliationService.java), ligne 50 ; [MissionFinancialSettlement](../../server/src/main/java/com/clenzy/service/MissionFinancialSettlement.java), lignes 23–36.

À faire : un dossier durable par remboursement, états demandé/en cours/confirmé/échoué, montant restant remboursable, allocation par paiement, contre-écritures et avoirs liés, puis compensation ou reprise des transferts concernés. Stripe précise qu'un remboursement de charge séparée n'annule pas ses transferts associés. [Documentation Stripe](https://docs.stripe.com/connect/separate-charges-and-transfers?locale=es-ES).

### 5 Relier les litiges à l'encaissement canonique

**Priorité haute, incident pouvant manquer.** Les webhooks de litige existent, mais `PaymentEventActionRecorder` cherche `chargeId` directement dans `PaymentTransaction.providerTxId`. Les Checkouts y stockent un identifiant de session `cs_...`, pas celui de la charge `ch_...`. Pour ces paiements, la résolution d'organisation peut échouer et abandonner l'alerte. Les vérifications de financement examinées ne consultent pas le registre des litiges.

Preuves : [PaymentEventActionRecorder](../../server/src/main/java/com/clenzy/service/dashboard/PaymentEventActionRecorder.java), lignes 64–70, 118–121 et 179–183 ; [PaymentPersistence](../../server/src/main/java/com/clenzy/service/PaymentPersistence.java), ligne 119 ; [ReservationPayoutFunding](../../server/src/main/java/com/clenzy/service/payout/ReservationPayoutFunding.java), lignes 23–54.

À faire : conserver la chaîne session → PaymentIntent → charge → transaction métier ; mettre en réserve les montants contestés avant versement ; répercuter une issue gagnée ou perdue dans le journal et les sommes dues.

### 6 Supprimer les confirmations déclaratives du parcours PSP

**Priorité haute, cohérence du statut payé.** L'API historique propriétaire `/accounting/payouts/{id}/pay` accepte encore une référence textuelle puis écrit `PAID`. Son bouton a bien été retiré du parcours propriétaire actuel, mais l'API reste disponible. Dans Dépenses, l'action « Marquer payé » est toujours branchée sur une méthode qui écrit `PAID`, avec une référence facultative et sans émission PSP.

Les dépenses déduites du reversement propriétaire deviennent `INCLUDED`. Cette retenue ne règle pas automatiquement le fournisseur ou le prestataire qui a avancé l'achat.

Preuves : [AccountingService](../../server/src/main/java/com/clenzy/service/AccountingService.java), lignes 154–200 et 295–308 ; [ProviderExpenseService](../../server/src/main/java/com/clenzy/service/ProviderExpenseService.java), lignes 181–189 ; [AccountingPage](../../client/src/modules/accounting/AccountingPage.tsx), lignes 534–540 et 810–818.

À faire : réserver le statut confirmé à une preuve PSP ou à un rapprochement externe documenté, clairement distinct d'une émission. Raccorder le règlement/remboursement des dépenses à leur bénéficiaire et empêcher qu'une même dépense soit réglée à la fois comme prestation et comme remboursement.

### 7 Fiabiliser la reprise des sessions de paiement

**Priorité haute, reprise incomplète.** Pour un paiement hébergé déjà existant, `PaymentOrchestrationService` renvoie une réussite avec l'identifiant PSP mais sans URL. La reprise intégrée relit bien le secret chez Stripe ; la reprise hébergée n'a pas l'équivalent. La clé du lot étant stable, rouvrir le même lot peut produire « Le PSP n'a pas fourni de lien de paiement sécurisé ».

Preuves : [PaymentOrchestrationService](../../server/src/main/java/com/clenzy/service/PaymentOrchestrationService.java), lignes 85–112 ; [batchPayments](../../client/src/modules/payments/batchPayments.ts), ligne 55.

À faire : reprendre l'URL de la session encore ouverte ; traiter explicitement expiration, paiement terminé et résultat réseau incertain. Ne pas libérer une tentative ambiguë avant relecture canonique et ne jamais fabriquer une nouvelle émission pour résoudre une simple erreur de retour.

### 8 Aligner les écritures et les totaux sur l'argent réellement encaissé

**À terminer avant validation financière complète.**

- L'API historique `/wallets/initialize` reconstitue des écritures depuis le seul statut `PAID`, en EUR. L'écran du journal ne l'appelle plus automatiquement, mais l'API peut encore transformer d'anciens statuts fictifs ou des paiements OTA en écritures plateforme.
- Les confirmations d'intervention enregistrent `estimatedCost`, alors que l'exigible peut venir du devis, du coût réel et d'un acompte. La confirmation groupée historique utilise aussi la devise de configuration. Il faut un montant encaissé figé et une allocation explicite pour ces variantes.
- L'ancien `/payments/summary` additionne encore plusieurs devises pour certains totaux. Les nouveaux KPI Finance séparent déjà les devises ; ce n'est donc pas un défaut identique de tous les KPI.
- Les reversements prestataires sont volontairement limités à EUR. Les pays et rails non Stripe restent hors de la recette France.
- Le financement propriétaire exige une égalité avec le prix total du séjour : crédit fidélité, remboursement partiel ou ajustement doivent avoir une règle explicite, sans contourner le contrôle actuel.

Preuves : [WalletService](../../server/src/main/java/com/clenzy/service/WalletService.java), lignes 114–170 ; [StripePaymentConfirmationService](../../server/src/main/java/com/clenzy/service/StripePaymentConfirmationService.java), lignes 135–140 et 403–414 ; [PaymentQueryService](../../server/src/main/java/com/clenzy/service/PaymentQueryService.java), lignes 243–290 ; [ProviderPayoutPolicy](../../server/src/main/java/com/clenzy/service/payout/ProviderPayoutPolicy.java), ligne 24 ; [ReservationPayoutFunding](../../server/src/main/java/com/clenzy/service/payout/ReservationPayoutFunding.java), lignes 49–54.

À faire : journal alimenté par des faits de paiement, références uniques par domaine, devises natives conservées, règles de commission/dépense/taxe documentées et rapprochement global au solde PSP. Une écriture de répartition interne ne doit jamais être présentée comme un virement effectué.

## Vérifications réalisées pendant cette revue

- **546 tests backend réussis, 0 échec, 0 erreur, 0 ignoré**, sur **39 classes de test principales** et 98 suites JUnit incluant les classes imbriquées.
- Première passe : 455 tests sur orchestration, confirmations, OTA, refunds, journal, financement, bénéficiaires et reversements. Complément : 91 tests sur factures, checkout public, acompte/solde, caution, annulation publique et comptabilité.
- Java 21. La première tentative a été bloquée par l'instrumentation Mockito dans le sandbox macOS ; la relance locale autorisée a réussi. Ce blocage n'était pas un échec métier.
- Pas de nouveau test réseau Stripe, de recette bancaire, de migration ni de redémarrage Docker dans cet audit.
- Ces tests existants ne prouvent pas les chaînes manquantes : plusieurs contrôlent une méthode avec des dépendances simulées, sans parcourir création du paiement → webhook → répartition → transfert.

Le dossier d'annulation de devis et son worker ont été relus, mais leur recette PostgreSQL spécifique n'a pas été relancée dans ce lot. Les résultats réseau antérieurs restent ceux du rapport sandbox, pas de nouvelles validations.

## Ordre d'implémentation proposé

1. **Droits et vérité des statuts** : filtrage propriétaire, retrait/encadrement des déclarations manuelles, fin du faux `REFUNDED` anticipé et de l'initialisation historique sans preuve.
2. **Encaissements composites** : lot canonique, allocations par mission, confirmation des factures, reprise des sessions et prévention du double règlement facture/prestation.
3. **Remboursements et litiges** : confirmations asynchrones/externes, partiels, avoirs, réserve de fonds, compensation et reprises de transferts.
4. **Décaissements complets** : financement des lots, dépenses et avances, preuves de réalisation adaptées au métier, montants et devises cohérents.
5. **Recette de bout en bout et exploitation** : parcours propriétaire, prestataire indépendant et société marketplace, émission réussie depuis Baitly, rapprochement bancaire automatique et rejet tardif ; tester les interruptions, doublons et reprises. Publier et exécuter la CI préparée, puis préparer la configuration de production séparément.

Critère de fin : chaque somme affichée comme encaissée, remboursée ou versée doit être explicable par une preuve, une allocation et un état confirmé, sans doublon et avec un bénéficiaire autorisé. Les recettes doivent partir de Baitly et revenir dans Baitly, y compris pour les cas d'échec.

## Remboursements unitaires : reprise durable validée dans le sandbox

Cette tranche concerne un remboursement intégral d'une intervention encaissée seule via Stripe. Elle ne couvre pas les lignes d'un lot, les remboursements de séjour ou les avoirs.

- Un verrou sur l'encaissement réserve une décision persistante avant l'appel réseau. Deux clics concurrents retrouvent le même dossier et la même clé Stripe ; un succès déjà confirmé ne provoque aucun appel de remboursement supplémentaire.
- Avant émission, la mission doit correspondre exactement au paiement : organisation, montant intégral, devise, session courante, absence de partage/allocation et de dossier d'annulation dédié.
- La session et le remboursement sont relus chez Stripe ; montant, devise, PaymentIntent et métadonnées doivent correspondre au dossier. La référence du remboursement est conservée dès qu'elle est connue.
- Un timeout ou un statut pending conserve PROCESSING. La recherche par métadonnées permet de récupérer une réponse perdue ; aucune nouvelle émission automatique n'est autorisée au-delà de 23 h sans preuve retrouvée.
- Les événements signés refund.created, refund.updated et refund.failed déclenchent une relecture canonique. Les événements d'un compte connecté ne peuvent pas confirmer un remboursement de la plateforme.
- Un worker reprend les dossiers Stripe en attente sans navigateur. Les autres PSP conservent leur appel existant mais une ancienne tentative incertaine ne peut pas être réémise automatiquement.
- Seul un remboursement confirmé publie PAYMENT_REFUNDED, atomiquement avec sa transaction. Le consumer conserve le rapprochement métier et les contre-écritures existants. Une erreur d'outbox annule la confirmation locale et permet une reprise.
- L'API renvoie 202 pendant la vérification ; Baitly conserve une information explicite et désactive la nouvelle soumission. Aucun état Remboursé optimiste n'est affiché.

**Validation :** 410 tests backend réussis, zéro échec/erreur/test ignoré, sur 16 classes principales et 61 suites JUnit ; 8 tests frontend sur trois fichiers, TypeScript et build Vite réussis. Les tests couvrent notamment la concurrence JPA/H2 réelle, le rollback d'outbox, les reprises réseau simulées, les signatures webhook, l'isolation et les cas pending. Le contrôle SQL de partage est aussi exécuté en lecture seule sur le PostgreSQL local. Aucune migration ajoutée. Ces tests automatisés sont complétés par la recette du 5 octobre ci-dessous.

**Chargement vérifié :** le redémarrage utilisateur a chargé un JAR recompilé, SHA-256 369adaf9d794d1e8af777991870c8c5a46883b46a56be125e7bd6f56677f68d2. Toutes ses classes applicatives sont identiques à celles de l'artefact validé 0e7da4136990c88018d65d1c916019355cc7982d39924d6fe42211521a407ff3. Le compose de base avait rétabli d'autres paramètres Stripe : le serveur et le frontend ont été rechargés avec le fichier privé .env.baitly-stripe.local et la surcharge scripts/payments/docker-compose.stripe-local.yml, conformément à l'autorisation explicite déjà donnée. La clé de test et le secret webhook correspondent à cette configuration. Les autres conteneurs n'ont pas été redémarrés. Conserver cette surcharge lors des prochains lancements.

**Recette depuis Finance → Paiements :** remboursement fictif de 45 EUR, intervention 364, Cottage des Tanneurs, demandé une seule fois par l'administrateur. Transaction d'origine 33 / TX-6ee62416-9c9. Nouveau dossier 41 / REF-7d0f2db9-41c6-4478-abdf-7e83c3f85602, état COMPLETED, remboursement Stripe re_3UN5OaQxlvbxDIrY0QZgkLOs relu en succeeded. L'intervention passe REFUNDED ; Baitly affiche Remboursé et retire l'action Rembourser.

Les événements refund.created et refund.updated sont reçus avec HTTP 200. Deux rejeux HTTP supplémentaires du véritable événement sandbox evt_3UN5OaQxlvbxDIrY0dHdSTfW, avec une signature locale fraîche, renvoient aussi 200. Après rejeu : un seul encaissement, un seul remboursement, un seul ensemble de trois paires de contre-écritures. Sous REFUND-INTERVENTION-364, trois débits et trois crédits totalisent chacun 89,66 EUR : annulation de la paire d'encaissement de 45 EUR et des deux paires de répartition de 44,66 EUR. Ce total comptable cumule les étapes ; le montant rendu au payeur est bien 45 EUR.

**Décalage UI corrigé après la recette :** la réponse Stripe pouvait précéder le consumer du journal ; un rechargement immédiat conservait alors Payé. Un suivi en lecture seule relit maintenant les interventions concernées jusqu'à REFUNDED, puis actualise l'historique filtré. Il suit aussi les réponses PROCESSING, empêche une nouvelle soumission de la même ligne, continue après fermeture du dialogue et ignore les réponses après démontage. Aucun statut remboursé n'est inventé côté client. Les 12 tests ciblés frontend de quatre fichiers passent, ainsi que TypeScript et le build Vite (avertissements de bundle préexistants). Finance recharge correctement dans le navigateur. Le cas différé est reproduit dans les tests ; aucun deuxième remboursement sandbox n'a été créé pour ce contrôle d'interface.

**Écart documentaire constaté avant la sixième tranche :** la facture 9 / FA2026-00007 restait PAID, sans avoir automatiquement rattaché. Le statut payé de la facture ne doit pas être remplacé artificiellement pour compenser ce manque. Le raccordement des avoirs doit conserver un lien durable facture d'origine / remboursement, reprendre les montants HT, taxes et TTC d'origine, assurer l'unicité lors des rejeux et traiter les factures historiques sans paymentTransactionId. Le raccordement est validé dans la sixième tranche ci-dessous.

**À poursuivre :** reprise durable des annulations publiques (le statut anticipé REFUNDED reste un défaut ouvert), remboursements partiels et par allocation, avoirs liés, remboursements externes sans métadonnées Baitly et compensation des transferts déjà émis. Un rejet bancaire tardif après un remboursement déjà confirmé demande encore ses contre-écritures dédiées : le webhook est alors refusé pour reprise, sans modifier silencieusement le journal.

## Avoirs liés aux remboursements : validation locale effectuée

Périmètre : remboursement Stripe intégral d’une intervention encaissée seule, confirmé par le parcours géré Baitly. Après le rapprochement financier, un traitement distinct crée un avoir numéroté et le lie durablement à la facture et à la transaction de remboursement. La facture payée d’origine est conservée. Les lignes HT/TVA/TTC et les taux historiques sont inversés exactement, sans nouveau calcul fiscal ni mouvement d’argent.

- Migration Liquibase 0503 : liens facture d’origine / remboursement, contraintes inter-organisations, unicité par remboursement et index de recherche. Les anciennes factures restent inchangées.
- Reprise automatique des documents manquants et des factures émises tardivement. Une erreur documentaire ne réémet pas le remboursement et ne revient pas sur son rapprochement financier déjà confirmé.
- Une facture historique sans transaction liée est acceptée seulement si l’unique encaissement confirmé et l’intervention correspondent intégralement. Les anciens avoirs sans lien, montants incohérents et doubles factures restent à rapprocher.
- Finance affiche les liens de téléchargement entre facture et avoir. Le PDF porte le titre AVOIR et les références d’origine. Le téléchargement binaire est corrigé : les octets PDF ne sont plus convertis en texte ; les échecs sont visibles.

**Validation automatisée finale :** 400 tests backend réussis, zéro échec/erreur/test ignoré. Transactions JPA/H2 réelles : concurrence, rejeu, rollback du document et de son numéro, taxes multiples et contrôles d’identité. La migration exacte 0503 est exécutée deux fois sur PostgreSQL isolé ; contraintes et requête de reprise sont exercées. 15 tests frontend passent, dont conservation des octets PDF, renouvellement de session et refus d’accès. TypeScript et Vite réussissent (avertissements de bundles préexistants).

**Artefact validé :** `/private/tmp/baitly-credit-note-build-oqmwlqcj/target/baitly-credit-note-validation.jar`, SHA-256 `69e757b71f66d7e19506d7e796d2e01dc16bf58f3f82140c0282fdb19f6e0bc5`. Compilation séparée du JAR monté par le serveur actif.

**Recette locale après le redémarrage utilisateur :** migration 0503 exécutée le 5 octobre 2026 à 21:19:53 UTC. Le worker a créé automatiquement l’avoir 15 / FA2026-00012, lié à la facture 9 / FA2026-00007 et au remboursement 41 déjà confirmé. Montants exacts : -37,50 EUR HT, -7,50 EUR de TVA, -45,00 EUR TTC. La facture d’origine conserve PAID et ses montants positifs. Aucun second remboursement ni modification manuelle des données n’a été nécessaire.

**Contrôle depuis Finance → Factures :** l’avoir apparaît avec son état et ses montants ; son détail présente la facture d’origine. Le détail de la facture présente en retour le lien de téléchargement de l’avoir. Le téléchargement du PDF de l’avoir, celui déclenché depuis la facture d’origine et le téléchargement de la facture d’origine depuis l’avoir ont abouti sans erreur visible. Le PDF généré a été extrait et rendu pour inspection : titre AVOIR, lignes et totaux négatifs corrects, références de la facture et du remboursement présentes, une page lisible sans débordement. Après plusieurs passages du worker et rechargement du serveur : un seul avoir pour le remboursement 41 ; celui-ci reste COMPLETED et le journal garde trois débits et trois crédits de 89,66 EUR par sens. Ce total comptable ne change pas le remboursement de 45 EUR.

**Chargement et configuration :** le JAR reconstruit par l’utilisateur, SHA-256 b05ad68812471006d5b285665a518e2ca698c4c9e15f5c338106f6d3d8189494, contient les mêmes 4 247 classes applicatives et la même migration 0503 que l’artefact validé. Le lancement avec le seul compose de base avait de nouveau remplacé les paramètres Stripe locaux. Le serveur seul a ensuite été recréé avec le JAR validé 69e757b71f66d7e19506d7e796d2e01dc16bf58f3f82140c0282fdb19f6e0bc5, le fichier privé .env.baitly-stripe.local et la surcharge scripts/payments/docker-compose.stripe-local.yml, selon l’autorisation explicite déjà donnée. Les quatre paramètres Stripe concordent ; les clés sont en mode test. Le serveur est healthy et /actuator/health répond HTTP 200 / UP. Le frontend utilisait déjà la bonne clé et n’a pas été redémarré. Aucun appel de paiement ou de remboursement n’a été émis avec la configuration divergente pendant ce contrôle.

Les avoirs partiels, par allocation de lot, de séjour, les remboursements externes et les compensations de transferts restent hors de cette tranche.
