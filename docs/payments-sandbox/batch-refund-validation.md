# Baitly : remboursement d'une prestation dans un paiement groupé

État au 6 octobre 2026 : implémentation, recette automatique et validation depuis Finance terminées. Le JAR testé est chargé dans `clenzy-server-dev` avec la configuration sandbox Baitly conservée.

## Comportement et périmètre

Finance peut rembourser intégralement une prestation appartenant à un lot Stripe EUR confirmé. La décision porte sur sa part figée, jamais sur le montant total du lot. Chaque part conserve une seule décision durable, même après plusieurs clics, une réponse perdue ou un rejeu de webhook. Une réponse Stripe en attente conserve PROCESSING ; seule la relecture canonique réussie déclenche le rapprochement.

Avant émission, le serveur valide le lot complet, la mission, sa session et son montant, les écritures d'encaissement et de répartition, l'organisation et l'absence de reversement prestataire. Un dossier d'annulation ou un financement ambigu reste bloqué. L'ordre de verrouillage du paiement, de la demande et de la mission évite de créer simultanément un reversement et un remboursement. Un reversement existant n'est pas annulé automatiquement.

Les remboursements Stripe du paiement sont relus avec pagination. Tous doivent correspondre aux décisions Baitly connues, avec les bons montants, devises et références. Une opération externe ambiguë bloque l'émission plutôt que de reconstituer une décision.

Après confirmation, seule la mission choisie devient REFUNDED ; son éventuelle demande de service suit le même état. Le journal inverse uniquement ses écritures PAYMENT et SPLIT. Le paiement d'origine reste COMPLETED pour son montant encaissé ; les remboursements sont des transactions distinctes. Les autres parts et leurs écritures restent intactes.

L'avoir inverse la facture entière de cette prestation, avec ses lignes et taxes historiques. Une facture encore émise peut être rattachée à sa part confirmée si sa dette, sa devise, son montant et son unique financement concordent. Elle reste ensuite PAID, avec un avoir distinct. Le rejeu d'un lot peut relire ces factures par part, sans imposer à chacune le total du lot ni repayer une prestation remboursée.

Référence : [remboursements Stripe](https://docs.stripe.com/refunds), consultée via le CLI officiel le 6 octobre 2026.

## Validation automatique

**353 tests réussis, aucun échec, erreur ou test ignoré**, sur 37 suites JUnit. Package Maven Java 21 réussi. Aucun changement frontend ni nouvelle migration.

- JPA réel : concurrence entre deux demandes, réserve unique par part, rollback, isolation d'organisation, sommes du lot, écritures équilibrées et absence de doublon.
- Stripe simulé : remboursement d'une part, autre part déjà remboursée, reprise après réponse perdue, pending, failed/canceled, montant ou organisation incorrects, remboursement externe, doublons et dépassement du montant encaissé.
- Refus avant émission lorsqu'un reversement existe, qu'un encaissement manque au journal ou que ses paires sont incohérentes.
- Avoirs : facture d'une part, facture émise tardive, copie exacte des taxes, refus des liens ambigus ; régression des avoirs de séjour et d'intervention.
- Rejeu d'un paiement groupé avec deux factures de montants différents et une prestation déjà remboursée.
- PostgreSQL 15 jetable : migration 0503 existante et requête du worker documentaire, incluant les factures de part encore émises. Aucun test ne modifie la base du PMS.

## Artefact et chargement local

- JAR : `/private/tmp/baitly-batch-refund-runtime.jar`
- SHA-256 : `065360c3e05daf2d4df3f96ffed7c6e264a79e81b4cfee58516f8e80c2878adf`
- Rapports : `/private/tmp/baitly-batch-refund-suaerwh0/surefire-reports`
- Sauvegarde avant autorisation : `/private/tmp/baitly-before-batch-refund-4jprbl15/server.jar`
- Sauvegarde lors de l'installation : `/private/tmp/baitly-before-batch-refund-_ucqg5n_/server.jar`
- Comparaison au JAR actif : 12 entrées applicatives ajoutées ou modifiées, ressources et migrations identiques.

L'utilisateur a autorisé la commande préparée, qui conserve le conteneur et sa configuration Stripe :

```sh
rtk proxy python3 /private/tmp/baitly-install-batch-refund.py --apply
```

L'installation autorisée a conservé l'identité du conteneur et toutes ses variables de configuration. Le serveur est revenu UP sur `/actuator/health`. Le frontend et les autres conteneurs n'ont pas été redémarrés.

## Recette locale validée

Le lot de test confirmé comporte les interventions 304 (35 EUR, Villa Caudéran) et 320 (55 EUR, Loft Bastille), pour 90 EUR au total. Leurs factures FA2026-00010 et FA2026-00011 étaient encore ISSUED sans transaction liée avant ce test. Aucun reversement prestataire n'était enregistré pour ces deux missions.

Le Checkout `cs_test_a1fbKOBJMGToErXSzSux2c9EML1RzKlEIaUaWHX4bHLDU65APeqJdKvUXb` a été relu depuis le compte Baitly : `livemode=false`, `paid`, 9000 centimes EUR, source INTERVENTION_BATCH et organisation 2. Depuis Finance, le filtre Payé puis Villa Caudéran a retrouvé la prestation de 35 EUR. Le bouton Rembourser a ouvert la confirmation sur ce montant ; sa validation a exécuté le remboursement.

| Élément | Résultat observé |
| --- | --- |
| Encaissement 38, `TX-f2c7a582-b74` | COMPLETED, 90 EUR, inchangé |
| Remboursement 48, `REF-eaf78fdf-987c-4933-8802-8acac9df742d` | COMPLETED, 35 EUR, aucun message d'erreur |
| Preuve Stripe `re_3UNChmQxlvbxDIrY1ZripSh0` | succeeded, 3500 centimes EUR, PaymentIntent du lot |
| Mission 304 | REFUNDED ; Finance affiche Remboursé et retire le bouton de remboursement |
| Mission 320 | PAID, 55 EUR ; aucun remboursement créé pour elle |
| Facture 12, FA2026-00010 | PAID, 35 EUR, rattachée au paiement 38 par sa part confirmée |
| Avoir 22, FA2026-00019 | -29,17 EUR HT, -5,83 EUR TVA, -35 EUR TTC ; liens vers facture 12 et remboursement 48 |

Le journal contient trois paires REFUND : l'encaissement de 35 EUR et les deux répartitions totalisant 34,68 EUR. Les débits et crédits atteignent chacun 69,68 EUR, avec un solde nul ; ce total comptable n'est pas le montant remboursé au client. Les écritures d'origine et celles de la mission de 55 EUR restent intactes.

L'événement canonique `evt_3UNChmQxlvbxDIrY1r8AviSU` (`refund.created`, version `2026-07-29.dahlia`, mode test) a été relu chez Stripe, puis son corps inchangé rejoué deux fois avec la signature locale attendue : deux réponses HTTP 200. Après reprise, Stripe retourne toujours un seul remboursement de 35 EUR ; Baitly conserve un avoir unique et six écritures REFUND équilibrées. Aucun nouveau remboursement ni avoir n'est produit par les rejeux.

Finance a été rechargé : l'avoir FA2026-00019 est visible avec ses HT, TVA et TTC, le téléchargement PDF et le lien vers sa facture d'origine. La session administrateur est restée valide. Le PDF n'a pas été rendu à nouveau dans cette tranche ; sa génération et son rendu étaient validés dans la tranche précédente.

La facture FA2026-00011 de la prestation sœur reste ISSUED comme avant le test : le rapprochement général des factures historiques non remboursées est une limite distincte, non résolue par ce traitement documentaire ciblé. La mission correspondante reste bien PAID. Aucun statut financier n'a été forcé par SQL et aucun paiement réel n'a été exécuté.

## Limites

Pas de remboursement libre d'une fraction de prestation, d'anciens lots sans allocations, de plusieurs financements pour une même dette, d'autres PSP/devises ni de compensation automatique des transferts déjà émis. Les remboursements externes, litiges, échecs tardifs et factures historiques ambiguës demandent un rapprochement dédié. Le remplacement local du JAR disparaît si le conteneur est recréé depuis une ancienne image : reconstruire depuis les sources pour pérenniser le correctif.
