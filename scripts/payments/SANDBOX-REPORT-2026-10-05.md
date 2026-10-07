# Baitly : recette Stripe locale du 5 octobre 2026

**Résultat : onboarding propriétaire, paiements d'intervention et de séjour, remboursement et calcul de reversement validés depuis Baitly dans le sandbox. Le transfert propriétaire est bloqué par le solde Stripe disponible, sans émission. Le parcours de reversement est désormais centré sur les PSP.**

Cette recette utilise uniquement localhost et l'environnement de test Baitly France. Les montants sont fictifs. Aucun paiement réel ni changement de production n'a été effectué. Le serveur et le frontend locaux ont été rechargés avec l'autorisation explicite de l'utilisateur. Les autres modifications déjà présentes dans le dépôt ne sont pas certifiées par cette recette.

## Parcours vérifiés dans Baitly

| Parcours | Résultat observé |
| --- | --- |
| Connexion du propriétaire à Stripe | Compte Standard existant repris sans créer de doublon ; formulaire officiel et retour personnel corrects |
| Inscription incomplète | Aucune fausse activation ; reprise du formulaire du bon bénéficiaire |
| Activation après vérification Stripe | Compte prêt, aucune exigence restante, guide à 8/8 et retour réussi conservé après rechargement |
| Paiement propriétaire de 35 € | Carte refusée correctement signalée, puis paiement avec carte de test 3DS réussi |
| Paiement administrateur de 35 € | Checkout terminé, webhook HTTP 200 et ventilation comptable enregistrée |
| Reprise puis paiement administrateur de 45 € | Même session Checkout reprise, une seule transaction terminée ; événement checkout.session.completed HTTP 200 et trois paires d'écritures équilibrées |
| Facture du paiement de 45 € | FA2026-00007 affichée payée dans Baitly : 37,50 € HT + 7,50 € TVA = 45 € TTC |
| Remboursement administrateur de 35 € | Remboursement Stripe confirmé, endpoint Baitly HTTP 200, trois paires d'écritures annulées ; total remboursé visible dans Baitly |
| Reversement propriétaire historique | Bloqué faute de justificatifs d'encaissement ; aucun transfert créé |
| Versement prestataire de démonstration | Bloqué par PAYMENT_NOT_RECEIVED ; aucun transfert créé |
| Séjour fictif de 100 € encaissé via Baitly | Réservation payée par Checkout officiel, transaction terminée par webhook |
| Premier reversement propriétaire depuis l'interface | Nouveau formulaire propriétaire/période, calcul serveur de 100 €, approbation réussie, financement version 1 |
| Exécution du reversement de 100 € via Stripe Connect | FAILED : solde disponible insuffisant ; aucune référence de transfert créée. Le détail affiche le motif exact |
| Suivi des versements | Journal et alerte de rapprochement affichés ; rattrapage automatique désactivé |

Le paiement propriétaire a d'abord révélé un webhook sans contexte d'organisation ; le retour authentifié permettait de confirmer le paiement, mais ne suffisait pas à valider le webhook. Après correction, le paiement administrateur a confirmé le traitement autonome du webhook et du ledger.

## Correctifs éprouvés

- **Webhooks multi-organisations :** le contexte est résolu depuis les données persistées avant la transaction. Les métadonnées Stripe seules ne peuvent pas choisir une organisation.
- **Remboursements :** une référence Checkout est résolue vers son PaymentIntent. Un remboursement total utilise une clé d'idempotence stable. Seul un succès confirmé autorise la réconciliation ; le statut de la mission et ses écritures sont traités dans la même transaction, avec reprise par événement en cas d'échec.
- **Montant de facture :** le coût TTC de l'intervention est décomposé en HT et TVA au lieu d'ajouter la TVA une seconde fois. Régression reproduite avant correction : 35 € devenaient 42 €. Les tests vérifient maintenant 29,17 € HT + 5,83 € TVA = 35 € TTC. Le nouveau paiement de 45 € confirme aussi la correction dans la base et la liste des factures du PMS.
- **Retour Connect :** l'état en cours de vérification est relu automatiquement après le retour. Une activation Stripe tardive ne demande plus de recommencer inutilement le formulaire.
- **Reprise du Checkout :** les effets React et les réouvertures rapides partagent la création en cours. Un nouvel appel reprend ensuite la session Stripe existante au lieu de renvoyer une référence sans secret. Organisation, source, montant et devise sont contrôlés ; une session payée, expirée ou incompatible est refusée sans recréer de paiement. Les erreurs texte du serveur sont désormais lisibles dans la fenêtre.
- **Persistance de la devise :** les providers reconnaissent désormais une session restaurée par cookie, même sans événement de login. Le cache local ne peut plus écraser l'euro enregistré ; langue et devise sont indépendantes. Les sauvegardes sont séquencées et les anciennes lectures annulées. EUR sauvegardé avec HTTP 200 puis conservé après rechargement dans la sidebar.
- **Préparation d'un premier reversement :** les propriétaires proposés proviennent des logements, même sans historique de reversement. Aucun montant n'est saisi côté client : le serveur sélectionne les séjours admissibles et calcule le net. Une erreur conserve la saisie ; le calcul en cours bloque une seconde soumission.
- **Actions centrées sur les PSP :** retrait des exports SEPA et de « Marquer payé » dans les reversements propriétaires, des formulaires IBAN/débiteur et du choix Open Banking/Wise/manuel dans les réglages actifs. Le bénéficiaire utilise le parcours PSP partagé avec le guide. Les anciennes méthodes restent lisibles mais ne peuvent plus être exécutées depuis ces boutons. Aucun changement automatique des données historiques ni suppression des API historiques.
- **Résultat réel du PSP :** une réponse HTTP 200 avec FAILED/BLOCKED n'affiche plus un succès. PROCESSING reste en attente de confirmation ; un transfert confirmé ne prétend pas prouver le crédit bancaire. Même traitement pour la relance prestataire. Les boutons tiennent compte du financement, du compte bénéficiaire, du rail déjà fixé et du nombre de tentatives.

La recette propriétaire a utilisé un logement fictif séparé, non publié dans le moteur de réservation. Le logement habituel est régi par un contrat actif OWNER_COLLECTS et a été correctement exclu du calcul. Son contrat actif n'a pas été modifié. Le logement de recette n'a aucun contrat actif : le net calculé est donc de 100 € sans commission. Un brouillon DIRECT non signé existe uniquement comme donnée de recette. Les emails de ces opérations sont capturés par Mailpit local.

## Recette réseau Stripe, distincte des parcours UI

| Scénario API sandbox | Résultat |
| --- | --- |
| Encaissement de 100 € | succeeded ; répétition sans nouveau paiement |
| Carte refusée, 10 € | card_declined, aucun encaissement |
| Authentification 3DS, 10 € | requires_action ; intention annulée après le contrôle |
| Empreinte de 20 €, capture de 8 € | Capture partielle, répétition sans seconde capture |
| Empreinte de 10 €, annulation | canceled |
| Remboursement partiel de 10 € | succeeded, répétition sans doublon |
| Bénéficiaire fictif Accounts v2 | Onboarding terminé, transfers actif, payouts autorisés |
| Transfert de 30 € | Destination, devise et charge source vérifiées, répétition sans doublon |
| Annulation partielle de transfert de 5 € | Montant annulé vérifié, répétition sans doublon |
| Versement bancaire manuel de 5 € | paid dans Stripe test, répétition sans doublon |
| Simulation d'un rejet bancaire | Non exécutée : ajout du compte bancaire de test refusé par la clé CLI, 403 oauth_not_supported |

Le bénéficiaire de cette recette API est distinct du propriétaire relié dans Baitly. Le virement manuel de test ne prouve ni une réception bancaire réelle, ni le rapprochement d'un versement automatique regroupant plusieurs transferts.

## Validation automatisée

- **Backend : 1 739 tests réussis, 2 ignorés, zéro échec ou erreur**, sur 124 classes de test. Cette campagne inclut la relecture réseau Java des opérations Stripe via le SDK Baitly. La dernière compilation exécute 54 tests Stripe/orchestration, dont les 16 régressions de reprise du Checkout. Le mode actuel `embedded_page` et l'ancien mode `embedded` sont couverts.
- **Frontend paiement : 131 tests réussis sur 12 fichiers**, couvrant Connect, retour, onboarding, bénéficiaires, paiements et suivi.
- **Frontend devise/authentification : 55 tests réussis sur 9 fichiers**, dont restauration par cookie, euro face à un ancien cache SAR, changement de langue, rechargement, sauvegardes concurrentes et géolocalisation tardive. Vérification TypeScript réussie.
- **Frontend reprise Checkout et erreurs API : 9 tests réussis sur 2 fichiers**, avec StrictMode, fermeture/réouverture rapide et réponse d'une ancienne sélection.
- **Frontend parcours PSP : 48 tests réussis sur 5 fichiers**, couvrant calcul du premier reversement, actions selon l'état/financement, exclusion des anciens rails, activation d'un compte déjà connecté, faux succès HTTP 200, Connect et suivi. Certains tests recoupent la campagne précédente : ne pas additionner ces nombres comme des cas uniques. Vérification TypeScript et contrôle des différences réussis. Réglages et détail vérifiés dans le navigateur ; l'override de viewport du navigateur intégré n'ayant pas changé la largeur effective, les quatre tailles responsives ne sont pas certifiées par cette passe.
- **Cohérence des reversements propriétaires : 18 tests réussis**, actions en icônes, distinction approbation/transfert/banque, refus d'approuver un historique sans justificatifs, limite de relances, montant nul et transfert déjà référencé. TypeScript et compilation frontend réussis. Les historiques gardent leur statut, avec une explication de leur absence de financement ; l'approbation ne lance jamais le transfert. Le suivi PSP n'est plus proposé pour un paiement historique manuel.
- **Python : 22 tests réussis**, sur le précontrôle et les garde-fous de la recette réseau.
- **PostgreSQL jetable :** coordination des paiements, schéma Connect, financement propriétaire et journal des transferts vérifiés avec les migrations Liquibase concernées.
- **Compilation du serveur :** package réussi avec les correctifs chargés sur le serveur local.

Les deux tests backend ignorés préexistaient dans AccountingExportServiceTest et GoCardlessPisClientTest ; ils ne sont pas comptés parmi les réussites. Les autres tests backend utilisent généralement des simulations de PSP. Aucun taux de couverture global n'est revendiqué.

## Configuration et limites restantes

Le SDK stripe-java 33.4.0 et le relais Stripe CLI 1.53.0 --latest utilisent **2026-08-26.dahlia**. Les signatures du relais correspondent au serveur local. La version par défaut du sandbox et la production restent inchangées.

Restent à valider :

1. **Finaliser le transfert propriétaire de 100 € une fois le solde Stripe disponible.** L'encaissement est confirmé, le calcul et l'approbation sont validés ; l'exécution a été refusée avant émission pour solde disponible insuffisant. Les onze fixtures historiques ont ensuite été réinitialisées à la demande de l'utilisateur (voir ci-dessous). Le test n'a ni fabriqué de justificatifs ni rattaché arbitrairement un compte Stripe à un autre bénéficiaire.
2. **Autres profils bénéficiaires.** Le parcours navigateur complet couvre un propriétaire ; les prestataires de plusieurs métiers et une organisation doivent encore être exercés avec leurs propres comptes de test.
3. **Rapprochement bancaire automatique et échec bancaire tardif en réseau.** Leur logique est testée côté backend, mais le scénario sandbox reste incomplet.
4. **Affichage du refus de versement prestataire.** La protection PAYMENT_NOT_RECEIVED fonctionne ; cet état métier remonte encore en HTTP 500 et mérite une réponse API dédiée.
5. **Activation de la plateforme en réel.** Le précontrôle conservateur signale encore PLATFORM_TEST_CHARGES_REQUIRED : la plateforme renvoie charges_enabled=false, payouts_enabled=false et details_submitted=false. Les opérations autorisées par le sandbox ne prouvent pas une activation réelle.
6. **PSP du Maroc et d'Arabie saoudite.** Non validés par cette campagne Stripe.
7. **Historique des interventions annulées.** Certaines lignes de démonstration affichent encore un bouton de paiement alors que leur statut opérationnel est CANCELLED. Le serveur refuse correctement leur encaissement ; le motif est maintenant affiché. La présentation du bouton reste à aligner sur ce statut.

Les références détaillées sont conservées dans les fichiers privés ignorés par Git sous tmp/baitly-stripe-local, notamment recipe-20261005.json, local-integration-20261005.json et extended-tests-summary.json. Les anciens documents émis avant correction de la TVA ne sont pas réécrits par cette recette.

## Réinitialisation des anciennes fixtures propriétaires

Sur demande explicite de l'utilisateur, les onze anciens reversements de l'organisation locale de test ont été sauvegardés puis retirés. La ligne de 912 € déclarée payée a été incluse après confirmation explicite qu'elle était également fictive. Contrôles avant suppression : financement historique uniquement, aucune attribution de réservation, aucune dépense liée, aucune entrée de journal de transfert et aucune référence Stripe. La transaction compare les lignes avec leur sauvegarde sous verrou avant de les retirer.

Le reversement récent de 100 € est conservé, avec son encaissement Stripe de test confirmé et son motif d'échec pour solde indisponible. Le navigateur et la base locale ne montrent plus que cette ligne après réinitialisation. Les anciennes périodes peuvent désormais être recalculées par le parcours normal, mais il manque leurs encaissements PSP : les anciens totaux fictifs ne sont pas transformés en justificatifs. Les deux encaissements de réservation présents restent intacts ; l'un est déjà affecté au reversement conservé, l'autre concerne un contrat exclu du reversement plateforme.

Sauvegarde restaurable privée (permissions 0600, ignorée par Git) : `tmp/baitly-stripe-local/payout-fixtures-before-reset-20261005.json`. Aucun autre environnement modifié et aucun nouveau transfert PSP effectué pendant cette réinitialisation.

Références officielles : [tests de paiement](https://docs.stripe.com/testing), [tests Connect](https://docs.stripe.com/connect/testing), [création Accounts v2](https://docs.stripe.com/connect/marketplace/tasks/create).

## Audit du menu Finances : regroupements proposés

Périmètre : registre `client/src/config/navigationHubs.ts`, onglets de `screenTabs.tsx`, composants de Facturation et Tarification, API et services associés. Il s'agit d'une proposition fondée sur le code actuel ; aucun onglet n'a été supprimé pendant cet audit.

### Les huit onglets de Facturation

| Onglet actuel | Rôle réel | Décision proposée |
| --- | --- | --- |
| Paiements | Historique fusionné des réservations, interventions et demandes de service ; encaissement voyageur et règlement de prestation se côtoient | Conserver, avec deux vues explicites « Voyageurs » et « Prestations ». Séparer le paiement à l'OTA de l'encaissement par Baitly |
| Factures | Documents émis, PDF, avoirs et état de règlement | Conserver : la facture justifie une créance, elle n'est pas une seconde transaction |
| Portefeuille | Soldes calculés depuis le ledger interne et historique d'écritures | Déplacer sous « Rapports & comptabilité », vue « Journal financier ». Ne pas présenter le solde comme la trésorerie Stripe disponible |
| Reversements | Calcul, approbation et lancement des reversements propriétaires | Regrouper sous « Versements », vue « Propriétaires » |
| Versements prestataires | Versements liés aux missions, bénéficiaire individuel ou organisation ; relance des dossiers bloqués/échoués | Regrouper sous « Versements », vue « Prestataires ». Conserver les critères d'éligibilité propres aux missions |
| Suivi des versements | Journal commun propriétaire/prestataire, références PSP, événements, rapprochement et observations bancaires | Intégrer dans « Versements », vue « Suivi & anomalies », avec accès direct depuis chaque dossier |
| Dépenses | Frais fournisseurs, justificatifs, approbation, imputation et déduction des reversements | Conserver. Relier à la prestation ou facture concernée pour éviter une seconde saisie et un double règlement |
| Rapports & Exports | Rapport fiscal et exports FEC/CSV | Conserver, sous « Rapports & comptabilité », avec le journal financier. Les analyses opérationnelles du menu Rapports gardent leur rôle distinct |

Les trois écrans de versements ne sont pas des doublons de données : ils représentent la préparation d'une obligation, l'exécution d'un transfert, puis sa preuve. Le regroupement doit préserver ces étapes. Un paiement de prestation finance une mission ; le versement prestataire distribue les fonds au bénéficiaire. Il ne faut pas fusionner leurs transactions.

### Les sept onglets de Tarification

| Onglet actuel | Rôle réel | Décision proposée |
| --- | --- | --- |
| Abonnement PMS | Prix PMS, synchronisation et suppléments IA/équipe | Distinguer les « Offres Baitly » administrées par la plateforme de « Mon abonnement » pour le client |
| Entretien | Forfaits, coefficients, prestations supplémentaires, majorations et commissions | Regrouper avec Ménage sous « Tarifs des prestations », catégorie Ménage, vue « Offres & commissions » |
| Ménage | Moteur de conseil : minutes par composant, taux horaire, multiplicateurs et fourchette | Même catégorie, vue « Calcul du prix ». Les paramètres diffèrent des forfaits : conserver les deux modèles en explicitant leur priorité |
| Travaux | Catalogue des interventions, prix et commission | Catégorie Travaux de « Tarifs des prestations » |
| Extérieur | Catalogue jardin/piscine, prix et commission | Catégorie Extérieur du même écran |
| Blanchisserie | Articles de linge, prix et commission | Catégorie Blanchisserie du même écran |
| Monitoring | Tarifs des équipements, installation, configuration et support | Regrouper avec les offres Baitly, distinct du suivi opérationnel des capteurs |

Architecture cible : cinq onglets métier dans Facturation (« Paiements », « Factures », « Versements », « Dépenses », « Rapports & comptabilité »), et deux familles de réglages tarifaires (« Offres Baitly » et « Tarifs des prestations »). Les catégories restent accessibles par filtre ou sous-vue ; aucune donnée n'est supprimée.

### Incohérences fonctionnelles à traiter avant la fusion

1. **Déclarations manuelles encore présentes.** Factures propose « Marquer payée » ; `ProviderExpenseService.markAsPaid` change un statut et une référence sans lancer de PSP. Dans un parcours PSP, ces actions doivent devenir une synchronisation depuis une preuve de paiement, ou un rapprochement externe explicite quand ce cas est autorisé. Une icône seule ne résout pas la différence de sens.
2. **Initialisation du portefeuille.** `WalletDashboard` appelle automatiquement `initialize` s'il n'y a pas de wallet. `WalletService.initializeWallets` reconstitue ensuite des écritures depuis les anciens statuts PAID, y compris des réservations, sans vérifier dans ce chemin la preuve PSP ni le collecteur. Il ne faut pas utiliser ce backfill comme preuve de trésorerie, ni le déclencher silencieusement en ouvrant un écran. L'audit n'a pas exécuté cette initialisation.
3. **Devise des anciens totaux.** Plusieurs résumés agrègent des montants et les affichent comme EUR. Les nouveaux totaux OTA/à vérifier et les récapitulatifs groupés séparent les devises ; le reste du reporting nécessite le même traitement ou une conversion explicite, datée et justifiée.
4. **Navigation et droits.** L'onglet Paiements est visible à davantage de rôles que les actions financières. Le regroupement doit préserver les permissions, les liens `?tab=…` existants et le cloisonnement organisationnel ; aucun simple changement de libellé ne doit élargir les droits.

Ordre recommandé : corriger les sources de vérité et les actions manuelles, réunir les vues de versements, déplacer le journal, puis réorganiser la tarification. Garder des redirections pour tous les anciens liens et tester chaque rôle avant de retirer les entrées de navigation historiques.

## Paiements OTA et actions groupées préparés après l'audit

- Import Channex : `payment_collect=ota` confirme le paiement auprès de l'OTA ; `property` identifie l'encaissement par l'hébergeur ; valeur absente/inconnue = paiement à vérifier. Les remboursements/annulations et les encaissements locaux confirmés sont conservés. Les dossiers anciens ne reçoivent aucune preuve inventée.
- Historique : aucun statut PAID ne doit être fabriqué depuis le seul nom du canal ou depuis le statut opérationnel d'une mission. Les erreurs API sont affichées. Les nouveaux totaux externes sont séparés par devise.
- Actions par icônes : choisir plusieurs lignes ou tous les dossiers éligibles, relire le récapitulatif et confirmer. Les prestations préparent des sessions PSP ; une session prête n'est pas un paiement effectué. Les acomptes confirmés sont déduits du montant proposé.
- Reversements : approbation groupée distincte du lancement, relecture de chaque dossier, exclusion des dossiers déjà transférés ou devenus inéligibles, résultat individuel et poursuite après un refus. Les relances prestataires concernent les dossiers FAILED/BLOCKED sans référence de transfert.
- Les lots de prestations sont séparés par devise et bornés pour respecter la taille des métadonnées et de la clé d'idempotence du PSP. Une demande de service conserve son propre Checkout.

Ces modifications nécessitent le chargement du nouveau JAR par `clenzy-server-dev`, avec la migration Liquibase 0501. Le frontend les reçoit via le serveur de développement. Au moment de l'inspection navigateur, le backend actif était encore l'ancienne version : l'ouverture du récapitulatif était vérifiée, mais pas une exécution groupée réelle depuis ce backend. Aucun paiement supplémentaire n'a été lancé pendant l'audit.

Validation de cette passe : 101 tests ciblés OTA/financement/migration réussis, puis 70 tests finaux des requêtes et endpoints de paiement après l'ajout du solde net d'acompte (campagnes partiellement communes, à ne pas additionner). La migration 0501 a été appliquée deux fois via Liquibase sur PostgreSQL temporaire : un seul changeset enregistré, statuts historiques conservés, aucune preuve fabriquée. Les 9 tests d'actions groupées et 18 tests de l'écran de reversements passent. TypeScript, compilation frontend et création du JAR réussis. La base temporaire a été arrêtée après les tests. Aucun contrôle aux quatre largeurs responsives ni paiement groupé réseau n'est certifié par ces tests unitaires.

## Fiche de paiement et adaptation à la hauteur de l’écran

- Contrôles du paiement groupé harmonisés avec le bleu Baitly : sélection, cases à cocher, focus et bouton de préparation. Le lancement exige toujours une action explicite.
- Fiche intervention : logement et intervenant, montant net d’acompte et action PSP, photos avant/après, durées, adresse et carte, devis/factures accessibles directement, dépenses rattachées à la mission avec les visuels du catalogue.
- Les documents et dépenses sont rapprochés par identifiant d’intervention ; les données d’une autre mission et les dépenses annulées sont exclues. Une erreur de chargement reste distincte d’une liste vide.
- Limite du modèle existant : le stock conserve la quantité actuelle et sa dernière date de réassort, sans journal de quantités livrées par intervention. La fiche montre les dépenses documentées ; elle n’invente pas de réassort historique et ne les ajoute pas une seconde fois au montant à régler.
- Liste et détail occupent la hauteur disponible. La taille de page de la liste s’ajuste aux lignes réellement disponibles ; les onglets Aperçu, Photos, Documents et Réassorts répartissent les éléments du détail en pages selon leur hauteur mesurée. La sélection reste liée aux données courantes, même hors de la page visible après redimensionnement.
- Bande du montant compacte, statut adjacent, action Payer à côté du tarif pour les dossiers éligibles. La référence « Dossier #… » est retirée et les actions secondaires sont placées à droite du titre.

Vérification navigateur sur localhost : panneaux et conteneur de page sans dépassement vertical/horizontal aux formats 375 × 812, 768 × 1024, 1024 × 768 et 1440 × 900. Navigation de détail et retour à la liste mobile vérifiés. Ouverture du PDF de facture FA2026-00005 vérifiée. Taille du navigateur restaurée après contrôle. Aucun paiement ni remboursement lancé pour cette passe de présentation.

Validation automatisée : TypeScript réussi et 16 tests ciblés réussis (montants, sélection, contrôles groupés, autorisation de paiement, rapprochement des pièces et pagination adaptative). Ces tests ne constituent pas une validation réseau d’un nouveau règlement PSP.

## Revue complémentaire du circuit financier

L'[audit du circuit du 5 octobre](AUDIT-CIRCUIT-2026-10-05.md) complète les preuves de recette précédentes. **546 tests ciblés passent**, mais la revue de code identifie des raccordements incomplets : filtrage propriétaire des réservations, confirmation/allocation des lots, paiement de facture, remboursements et litiges, confirmations manuelles et rapprochement des écritures. Les essais historiques restent valables dans leur périmètre ; ils ne constituent pas une validation du circuit complet.

## Recette réelle du nouveau lot depuis Finance, après 0502

Le 5 octobre 2026, migration 0502 constatée EXECUTED à 13:53 UTC. Le serveur et le frontend ont été recréés avec la configuration locale Stripe de test Baitly, après accord explicite. Compte plateforme vérifié : acct_1U6AEiQxlvbxDIrY. Le compte « Miftah Al- » est identifié par l'utilisateur comme celui du propriétaire ; il n'est pas utilisé pour cet encaissement plateforme.

Parcours exécuté : Finance → Paiements → sélection groupée → deux interventions → Checkout hébergé « environnement de test Baitly » → carte de test Stripe → retour Finance. Aucun moyen de paiement réel utilisé ni sauvegardé.

| Preuve | Résultat |
| --- | --- |
| Paiement | 90,00 EUR, source INTERVENTION_BATCH, transaction 38 / TX-f2c7a582-b74 COMPLETED |
| Intervention 320, Loft Bastille | 55,00 EUR, PAID, allocation confirmée |
| Intervention 304, Villa Caudéran | 35,00 EUR, PAID, allocation confirmée |
| Journal | Deux paires débit/crédit, 90 EUR de chaque côté |
| Webhook initial | checkout.session.completed reçu, HTTP 200 |
| Rejeu du même événement canonique signé | HTTP 200, toujours deux allocations et quatre écritures |
| Interface | Filtre Payé : les deux missions et leurs montants sont visibles ; détail Loft Bastille consulté |

Références de test : session cs_test_a1fbKOBJMGToErXSzSux2c9EML1RzKlEIaUaWHX4bHLDU65APeqJdKvUXb ; événement evt_1UNChnQxlvbxDIrYRWMyJ2uf. La lecture Stripe et le rejeu n'ont affiché aucun secret.

Limites : aucun reversement prestataire ni remboursement d'une part n'a été exécuté dans cette recette. Les factures au montant réellement encaissé restent à raccorder. Le premier Checkout de 90 EUR créé avant rechargement de la configuration, sur le compte propriétaire, n'a pas été payé : session cs_test_a14yyefuz4PbCJdghr5VjtH8MCYZVehVKHrfjJgxGArIZbRm1mOnhUsC4H. Ses dossiers Maison Plumereau et Duplex Hivernage restent en traitement jusqu'à preuve d'expiration ou rapprochement ; ils n'ont pas été remis artificiellement à un autre statut.

## Factures : recette de prestation validée depuis Baitly

- Le destinataire est résolu côté serveur : propriétaire pour une commission, demandeur pour une prestation, voyageur pour un séjour. Le nom d'affichage du client ne sert plus d'adresse email.
- Une facture de prestation utilise la même dette et la même clé que le paiement de l'intervention, avec une allocation unique. Une facture de séjour réutilise la source et la clé de la réservation. Une facture de commission dispose d'une source INVOICE dédiée, uniquement pour un contrat OWNER_COLLECTS actif.
- Le TTC et la devise doivent correspondre exactement au montant encore exigible. Les paiements partiels, anciens encaissements, collectes OTA et anciennes sessions non rapprochées ne peuvent pas déclencher une seconde collecte.
- La facture est liée à la tentative avant l'appel Stripe. Une erreur réseau conserve la tentative ; une expiration canonique non payée peut libérer les liens. Une session existante peut être reprise sans changer le statut payé.
- La confirmation vérifie la session canonique Stripe, le montant, la devise, la transaction, l'organisation et la facture. Le webhook et le consumer raccordent la facture après sa dette. Une commission crée une seule paire équilibrée dans le journal ; une facture de séjour ou de mission ne recrée pas les écritures de sa dette.
- Une ancienne tentative INVOICE bloque aussi le bouton du séjour ou de la prestation correspondante. Une facture liée à une tentative PSP ne peut pas être annulée par l'ancien bouton d'avoir sans rapprochement préalable.
- L'envoi du lien de réservation ne fusionne plus un objet détaché après l'appel email : une mise à jour limitée aux champs de suivi évite d'écraser un webhook rapide.
- Dans la liste des factures et la modale de l'assistant, « Payer » ouvre le Checkout HTTPS. Aucun statut PAID optimiste n'est écrit ; les erreurs du serveur restent visibles.

**Validation automatisée :** 428 tests backend réussis, aucun échec, erreur ou test ignoré, sur 25 classes principales / 73 suites JUnit produites par le build final. Parmi eux, transactions JPA/H2 réelles avec CAS, journal, rejeu, panne du journal et annulation atomique, expiration et concurrence entre les boutons facture/réservation. Les quatre événements Checkout sont testés avec signatures ; la relecture réseau Stripe est simulée. 6 tests frontend passent ; TypeScript et build Vite réussissent (avertissements existants de CSS, imports mixtes et taille de bundles). Le JAR Java 21 est construit. Aucune migration ajoutée.

**Recette depuis Baitly effectuée après redémarrage :** Finance fonctionne de nouveau. Le refus sur FA2026-00010 (35 €, intervention déjà encaissée par lot) reste visible et empêche une seconde collecte.

Une facture de recette explicitement fictive TEST-FACTURE-20261005 (id 14) a été préparée localement pour l'intervention 414, Ménage de départ, Duplex Hivernage : 37,50 € HT + 7,50 € TVA = 45 € TTC. Ce montage ne valide pas le parcours de création d'une facture. Depuis Finance → Factures → Payer, Checkout affiche bien « environnement de test Baitly ». Paiement par carte Stripe fictive, retour Baitly puis facture affichée Payée. Aucune donnée historique n'a été réinitialisée.

| Preuve | Résultat |
| --- | --- |
| Facture 14 | PAID, liée à la transaction 40 |
| Transaction 40 / TX-c9183b72-f68 | COMPLETED, 45 EUR, plateforme Baitly acct_1U6AEiQxlvbxDIrY |
| Intervention 414 | PAID, allocation unique de 45 EUR confirmée |
| Journal d'encaissement | Une paire de 45 EUR, référence TX-c9183b72-f68:414 |
| Journal de répartition | Deux paires, total 44,55 EUR par sens ; aucune écriture créée une seconde fois pour la facture |
| Interface | État Payée et retrait du bouton Payer |

La recette vérifie l'état final et le journal, sans certifier ici un rejeu réseau du nouveau webhook. La confirmation signée et son rejeu restent couverts par les tests automatisés ; le lot précédent de 90 € dispose de sa propre preuve de rejeu réseau.

**Configuration locale :** le redémarrage avait repris le compose de base et donc le compte propriétaire « Miftah Al- ». Une tentative de commission FA2026-00004 de 341,92 EUR (transaction 39 / TX-42f06568-a20) y a été créée mais laissée impayée dès identification du compte. Les deux conteneurs autorisés ont ensuite été rechargés avec .env.baitly-stripe.local et la surcharge Stripe. La session de commission et le premier lot 37 restent à expirer/rapprocher sur le compte propriétaire ; aucune preuve ni libération artificielle n'a été créée. Ne pas compter ces tentatives comme encaissées.

**Limites restant ouvertes :** rapprochement automatique des factures déjà émises contre leurs encaissements historiques, acomptes et factures à solde partiel, avoirs/remboursements (y compris par ligne d'un lot), remboursements externes, litiges et décaissements des dépenses. Les refus de rapprochement protègent ces cas, ils ne constituent pas leur implémentation complète. Le premier lot non payé sur le compte propriétaire doit toujours être vérifié sur ce compte.


JAR de la tranche factures, chargé pour cette recette : SHA-256 `3c9b79bacc4871d96976cb94a82235cf8dce668c4e381da9fe677a7bf3c51156`. Ne pas confondre ces tests simulés avec le lot de 90 € réellement exercé plus haut.

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
