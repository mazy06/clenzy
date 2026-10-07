# Baitly : rapprochement des factures déjà encaissées

État au 6 octobre 2026 : implémentation, 433 tests, chargement autorisé et validation depuis Finance terminés. La facture de 55 EUR est rapprochée automatiquement, sans mouvement financier supplémentaire.

## Problème et correction

Avant correction, la facture FA2026-00011 (55 EUR, intervention 320, Loft Bastille) restait ISSUED alors que sa part du paiement groupé 38 était confirmée. Sans `payment_transaction_id`, le rapprochement existant par transaction ne la retrouvait pas, et la génération automatique ignorait les factures déjà présentes.

Un worker documentaire recherche les factures GUEST encore ISSUED, SENT ou OVERDUE et leur unique encaissement Stripe confirmé. Il couvre un séjour, une intervention seule ou une part de lot. Il relit la session Stripe hors transaction SQL, puis revalide et verrouille le paiement, la dette et la facture avant de la rattacher et de la passer PAID. La date historique du règlement confirmé est conservée. Les factures créées après le webhook peuvent être retrouvées lors d'un passage ultérieur.

Les contrôles portent sur l'organisation, la source, les métadonnées Stripe, la session, la devise EUR, le montant intégral, l'état payé de la dette, les parts du lot et les paires d'encaissement dans le journal. Un autre financement, une tentative incertaine, une autre facture, un avoir ou un montant incohérent empêche le rapprochement automatique. Les réservations encaissées par un OTA sont exclues.

Le worker ne crée aucun encaissement, remboursement, transfert, avoir ou écriture comptable. Il ne modifie ni les lignes ni les taxes de la facture, ni les états financiers du paiement et de ses missions. Un diagnostic `invoiceMatches` est enregistré dans les métadonnées du paiement : MATCHED ou REVIEW_REQUIRED. La pagination par identifiant permet de poursuivre les autres dossiers en présence d'un cas ambigu.

Référence : [confirmation des paiements Checkout](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted), consultée via le CLI officiel le 6 octobre 2026.

## Tests et artefact

**433 tests backend réussis, zéro échec, erreur ou test ignoré.** Package Maven Java 21 réussi, dans un répertoire séparé du serveur actif.

- JPA réel : rattachement d'une facture de lot sans toucher la part remboursée, montants et taxes préservés, relecture idempotente et workers concurrents.
- Refus des états, organisations, devises, sessions, montants, pièces et financements ambigus ; encaissements absents ou paires du journal cassées.
- Revalidation après changement de la dette entre la lecture et l'application ; reprise après échec avec diagnostic durable.
- Paiements individuels de séjour et d'intervention ; pagination ; absence de retraitement des factures déjà payées.
- Stripe simulé : statut, montant, devise, identifiants, source, organisation et composition du lot ; vérification de l'ordre lecture SQL / GET Stripe / application SQL.
- Régression : paiements, lots, remboursements, annulations publiques, avoirs et coordination des factures. Les tests existants de migration des avoirs utilisent un PostgreSQL 15 temporaire isolé.

JAR : `/private/tmp/baitly-invoice-matching-runtime.jar`.

SHA-256 : `8f15d7f7f58944d84263cb6b76905f8b3fedfb50772b8439a30d26d48f1d955b`.

Rapports : `/private/tmp/baitly-invoice-matching-o5gh3x3f/surefire-reports`.

Comparaison à l'artefact actif : cinq classes ajoutées (les deux services et trois records), aucune autre classe, ressource ou migration modifiée. Aucun changement frontend.

## Chargement local et recette validée

Avant chargement, la requête exacte du worker, exécutée en lecture seule sur le PostgreSQL local, retournait uniquement la facture 13, organisation 2. Finance affichait FA2026-00011 à 55 EUR avec l'état Emise. La facture de commission à 341,92 EUR et celle en retard à 90 EUR n'étaient pas candidates.

Configuration Stripe Baitly contrôlée sans afficher ses secrets. Sauvegarde du serveur actif : `/private/tmp/baitly-before-invoice-matching-nm3sg0vp/server.jar` ; SHA-256 `065360c3e05daf2d4df3f96ffed7c6e264a79e81b4cfee58516f8e80c2878adf`.

Commande exécutée après l'accord explicite de l'utilisateur :

```sh
rtk proxy python3 /private/tmp/baitly-install-invoice-matching.py --apply
```

Sauvegarde lors du chargement : `/private/tmp/baitly-before-invoice-matching-i2uygjko/server.jar`. Le JAR installé correspond exactement au SHA-256 testé. L'identité du conteneur et ses variables d'environnement sont conservées ; seul `clenzy-server-dev` a redémarré. Santé HTTP UP, frontend et autres conteneurs inchangés.

Le worker a rapproché la facture le 6 octobre à 01:31:54 UTC, après sa relecture Stripe. Résultats observés dans la base réelle du PMS, sans mutation SQL manuelle :

| Élément | Résultat |
| --- | --- |
| Facture 13 / FA2026-00011 | PAID, transaction 38 liée, mode STRIPE |
| Montants historiques | 45,83 EUR HT, 9,17 EUR TVA, 55 EUR TTC, inchangés |
| Date de règlement | `2026-10-05T14:17:32.877389`, identique à la confirmation de sa part du lot |
| Diagnostic documentaire | `invoiceMatches[13].state=MATCHED` sur le paiement 38 |
| Encaissement 38 | COMPLETED, 90 EUR, inchangé |
| Mission 320 | PAID, 55 EUR, inchangée |
| Mission 304 et remboursement 48 | REFUNDED / COMPLETED, 35 EUR, inchangés |
| Facture 12 et avoir 22 | PAID / CREDIT_NOTE, +35 / -35 EUR ; HT et TVA préservés |
| Factures 1 et 5 | OVERDUE 90 EUR / ISSUED 341,92 EUR, inchangées |
| Nombre de transactions et documents | 38 transactions de paiement et 21 factures, inchangés |
| Journal | 214 écritures ; empreinte complète identique avant/après : `29cb7f73bf2ac557bebdd1b32da5d8d5` |

Finance a été rechargé avec la session administrateur restée active. FA2026-00011 apparaît Payee dans la liste et le détail, avec ses trois montants historiques. Le nombre de factures payées passe de 13 à 14 ; leur total passe de 5 603 EUR à 5 658 EUR. Le KPI des factures à régler passe de 396,92 EUR à 341,92 EUR. Le PDF et le duplicata restent disponibles, aucune action de paiement n'est présentée pour cette facture. Aucune génération de duplicata ni nouveau téléchargement PDF n'a été nécessaire pour cette vérification de statut.

## Limites

Cette tranche ne valide pas la production. Les commissions, autres PSP/devises, financements multiples ou partiels, anciens lots sans allocations et dossiers ambigus restent exclus. Les remboursements effectués hors Baitly, litiges et compensations de transferts demandent leur propre rapprochement. Une session Checkout payée constitue une preuve de l'encaissement initial, pas de l'absence de remboursement externe ultérieur.

Le remplacement local du JAR ne survit pas à une recréation depuis une ancienne image ; reconstruire depuis les sources pour pérenniser le correctif.
