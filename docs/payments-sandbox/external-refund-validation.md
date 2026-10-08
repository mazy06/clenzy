# Baitly : remboursements déclenchés directement dans Stripe

État au 6 octobre 2026 : JAR chargé avec l'autorisation explicite de l'utilisateur, 596 tests validés et deux scénarios recettés sur le sandbox Stripe Baitly. Les encaissements partent de Finance ; les remboursements sont ensuite créés directement dans Stripe test, sans métadonnées de décision Baitly. Aucun argent réel ni environnement de production n'est concerné.

## Périmètre

Les événements signés `refund.created`, `refund.updated` et `refund.failed` de la plateforme déclenchent maintenant une recherche même sans métadonnées de remboursement Baitly. Le service relit le remboursement, retrouve son encaissement par le PaymentIntent et la session Checkout puis valide l'identité, l'organisation, la source, la devise EUR et les montants. L'organisation vient de la transaction locale. Les remboursements portant les marqueurs d'une décision gérée restent dans leur circuit existant ; les événements de comptes connectés sont exclus.

Une preuve durable `EXT-re_…` conserve la référence Stripe et la source d'origine. Tant que le rapprochement local n'est pas confirmé, elle reste PROCESSING avec `reviewRequired=true` et alimente un incident « Remboursement Stripe à rapprocher ». Les règles de financement existantes refusent alors les reversements concernés, y compris les autres prestations d'un lot non réparti. Un remboursement Stripe failed ou canceled sans effets comptables locaux devient FAILED et ne constitue plus une somme remboursée.

Le rapprochement automatique concerne uniquement le remboursement intégral d'une intervention encaissée seule, en EUR. Les contrôles vérifient la session canonique payée, l'unique remboursement actif du PaymentIntent, la charge, la mission PAID, son montant, l'absence d'allocation ou de reversement, les autres tentatives et les paires comptables d'origine. Le statut, les contre-écritures et l'événement interne sont confirmés dans une même transaction SQL. Une erreur annule ces effets et laisse la preuve disponible pour reprise. Ce service n'émet jamais de remboursement chez Stripe.

Un worker paginé reprend les preuves déjà observées. Les doublons du webhook réutilisent le même dossier. Les avoirs d'intervention peuvent ensuite être créés par le worker documentaire existant, seulement après confirmation financière et en présence d'une facture payée cohérente. Un rejet tardif conserve les états et écritures déjà confirmés, signale le dossier et suspend l'émission d'un nouvel avoir ; il ne supprime pas un document déjà émis.

Référence : [remboursements Stripe et événements associés](https://docs.stripe.com/refunds), consultée via le CLI officiel le 6 octobre 2026.

## Validation automatisée

Les tests ciblent la relecture canonique, les métadonnées incohérentes, l'isolation des organisations, les statuts différés, les doubles livraisons et les erreurs réseau. La persistance JPA réelle couvre les contre-écritures, le rollback, la concurrence et les refus des montants partiels, lots, séjours, demandes de service, financements ambigus ou missions déjà reversées. Les tests PostgreSQL exécutent la requête de reprise et la sélection documentaire réelles. La sélection inclut les suites de régression des paiements, annulations, remboursements gérés, lots, factures, avoirs, webhooks et règles de financement des reversements.

Compilation isolée de `server/target`, avec Java 21 et un PostgreSQL 15 temporaire. Aucun conteneur Docker n'est redémarré par les tests. Aucun changement frontend ou migration ajouté.

**596 tests réussis, zéro échec, erreur ou test ignoré.** Package Maven réussi. Rapports : `/private/tmp/baitly-external-refund-ywhdnqm2/surefire-reports`.

JAR : `/private/tmp/baitly-external-refund-runtime.jar`. SHA-256 : `41b31be134a89ee3212e77aa9c9a54047b7f6a3c4aa40db665f02f6a58f6fe5f`.

Comparaison au JAR précédent : six classes ajoutées (quatre types et deux records), quatre fichiers de classes modifiés dans StripeGateway, ManagedRefundReconciliation et RefundCreditNoteService. Aucune autre classe, ressource ou migration ne change.

## Chargement local autorisé

Le contrôle en lecture seule retrouve 38 transactions de paiement, 21 factures et 214 écritures de journal. Empreinte intégrale du journal : `29cb7f73bf2ac557bebdd1b32da5d8d5`. FA2026-00011 reste payée à 55 EUR, liée au paiement 38 avec sa date historique ; le remboursement de 35 EUR et FA2026-00019 sont inchangés.

Le JAR précédent, consacré au rapprochement documentaire, portait le SHA-256 `8f15d7f7f58944d84263cb6b76905f8b3fedfb50772b8439a30d26d48f1d955b`. L'installation a vérifié cette empreinte, sauvegardé le JAR et conservé exactement la configuration privée du sandbox Baitly.

Commande exécutée après l'accord « Oui, charge le JAR et valide dans le sandbox » :

```sh
rtk proxy python3 /private/tmp/baitly-install-external-refund.py --apply
```

Seul `clenzy-server-dev` a été arrêté puis redémarré, dans le même conteneur et avec les mêmes variables d'environnement. Le frontend est resté actif. L'empreinte du JAR relu dans le conteneur correspond à l'artefact testé ci-dessus ; la configuration Stripe privée est inchangée, sans exposition des secrets. Le serveur répond UP, avec PostgreSQL, Redis, Kafka et mail disponibles et le verrou Liquibase relâché. Aucune migration supplémentaire.

Sauvegarde de l'installation : `/private/tmp/baitly-before-external-refund-sx28usd0/server.jar`. Le précontrôle avait également créé `/private/tmp/baitly-before-external-refund-zg2h6mxb/server.jar`.

## Recette réseau et interface effectuée

### Remboursement externe intégral : 35 EUR

Depuis Finance, la mission 329, « Ménage de départ » au Studio Jemmapes, a été réglée avec une carte fictive dans le Checkout intégré affichant le mode test Baitly. La transaction 49 devient COMPLETED pour 35 EUR, la mission PAID et la facture 23 / FA2026-00020 PAID, avec 29,17 EUR HT et 5,83 EUR de TVA. Le journal d'origine contient une paire d'encaissement et deux paires de répartition.

Le script privé de recette vérifie le compte plateforme, le mode test, la session payée, ses métadonnées, le PaymentIntent et l'absence d'autre remboursement avant d'émettre un remboursement de 35 EUR sans métadonnées Baitly. Le webhook reçu naturellement produit :

- transaction 50, `EXT-re_3UNNmrQxlvbxDIrY0xipmM30`, COMPLETED, `externalRefundConfirmed=true`, `reviewRequired=false` ;
- mission 329 REFUNDED, visible « Remboursé » dans Finance, sans nouvelle action de paiement ou remboursement ;
- six contre-écritures `REFUND-INTERVENTION-329`, équilibrées à 69,65 EUR par sens : elles annulent l'encaissement de 35 EUR et la répartition de 34,65 EUR ; le montant remboursé au payeur reste 35 EUR ;
- avoir 24 / FA2026-00021 de -35 EUR, lié à la facture 23 et au remboursement 50, reprenant exactement -29,17 EUR HT et -5,83 EUR de TVA ;
- incident 1040 refermé automatiquement.

La session est `cs_test_a10M4juh3tFRcdJKELKplLTAaC4NvZPXypwXI2DpXxRBhMihVmX3dSWdwF`, le PaymentIntent `pi_3UNNmrQxlvbxDIrY08DVZ63q`. Deux rejeux locaux signés du véritable événement Stripe `evt_3UNNmrQxlvbxDIrY0YakFXQm` répondent HTTP 200 et conservent un seul remboursement, un seul avoir et les six contre-écritures. Les vues Factures et Détail affichent l'avoir et ses liens ; la facture d'origine reste payée. Le PDF n'a pas été retéléchargé dans cette tranche.

### Remboursement externe partiel : 5 EUR sur 35 EUR

Un second paiement fictif part de Finance pour la mission 332, « Ménage de départ » au Studio Jemmapes, prévu le 19 octobre. La transaction 51 devient COMPLETED pour 35 EUR ; la facture 25 / FA2026-00022 et la mission sont PAID. Le remboursement direct Stripe de 5 EUR, sans métadonnées Baitly, est confirmé par Stripe mais reste volontairement à rapprocher dans Baitly :

- transaction 52, `EXT-re_3UNNxGQxlvbxDIrY0Hb452gk`, PROCESSING, `stripeStatus=succeeded`, `reviewRequired=true` ;
- aucun statut REFUNDED intégral attribué à la mission, aucun avoir et aucune contre-écriture intégrale créés ;
- incident 1042 OPEN, « Remboursement Stripe à rapprocher », montant 5 EUR ;
- notification visible dans Baitly avec la référence Stripe et l'instruction de vérifier la répartition et les reversements.

La session est `cs_test_a18vZgYa5DzeSdMRg7ykDoAdaYAMZDySvRgYm2ILOzUQr6i2BckvP8GWyG`, le PaymentIntent `pi_3UNNxGQxlvbxDIrY0GVYoK2V`. Une tentative de remboursement intégral supplémentaire depuis Finance est refusée par le serveur ; la relecture Stripe retrouve toujours uniquement les 5 EUR déjà remboursés. La preuve et l'incident restent uniques après reprise du worker.

Deux limites d'interface sont constatées : Finance conserve « Payé » et le bouton Rembourser sur ce dossier partiel ; le refus affiche seulement « Erreur lors du remboursement ». La notification existe, mais la rubrique correspondante n'apparaît pas dans le widget « À traiter » de cette recette, même après rechargement. Le rapprochement partiel et son exposition dans Finance / le dashboard restent donc à terminer. Aucune résolution manuelle de l'incident n'a été effectuée.

Le blocage des reversements par les preuves non rapprochées est couvert par les tests automatisés des règles de financement. Aucune tentative de reversement n'a été exécutée depuis l'interface sur ce scénario : ne pas la présenter comme une recette bancaire complète.

### Conservation des données

Le contrôle final en lecture seule retrouve 42 transactions de paiement, 24 factures et 232 écritures : les deux encaissements, les deux preuves de remboursement, les deux factures et l'avoir expliquent ces ajouts. Les 214 écritures antérieures sont strictement identiques, empreinte `29cb7f73bf2ac557bebdd1b32da5d8d5`. Le contrôle vérifie également les états des quatre transactions, des deux missions, des trois documents et des deux incidents. Aucun SQL de modification n'a été utilisé pour fabriquer ces résultats.

Les scripts et reçus locaux sont conservés dans `/private/tmp` : `baitly-external-refund-sandbox.py`, `baitly-external-partial-sandbox.py`, `baitly-replay-external-refund.py`, `baitly-external-refund-runtime-check.py` et les reçus des missions 329 / 332. Les commandes d'émission de recette ne doivent pas être rejouées comme une opération métier réelle.

## Limites explicites

- Les remboursements externes partiels, de lots, de séjours, de commissions et de demandes de service sont conservés pour rapprochement, sans reconstruction automatique de leur répartition.
- Un reversement déjà émis ou un rejet bancaire tardif demande encore une compensation dédiée. Le service n'annule aucun transfert Connect.
- Le worker reprend les preuves reçues ; il ne découvre pas les événements historiques jamais livrés au webhook.
- L'avoir automatique exige une facture déjà PAID. Une facture encore émise au moment du remboursement peut demander un rapprochement documentaire distinct.
- Les charges directes d'un compte connecté, autres PSP, devises et paiements anciens sans métadonnées Checkout cohérentes ne sont pas importés automatiquement.
- Cette validation locale ne certifie ni la production ni l'ensemble du circuit financier. Le remplacement du JAR ne survit pas à une recréation depuis une ancienne image ; reconstruire les sources pour pérenniser le correctif.
