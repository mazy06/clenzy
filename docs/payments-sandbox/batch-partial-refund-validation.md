# Remboursements partiels d'une prestation payée dans un lot

Travail local Baitly du 6 octobre 2026. Les validations automatisées et la recette Stripe ci-dessous sont distinctes ; aucun paiement réel n'est concerné.

## Contrat financier

- Chaque prestation conserve son montant encaissé dans l'allocation du lot. Un remboursement utilise ce budget, jamais le montant total du Checkout.
- Une demande possède un UUID persistant. Son rejeu avec le même montant retourne la même décision ; un autre montant avec cet identifiant est refusé.
- Le verrou du lot sérialise les décisions. Une nouvelle restitution sur la même prestation attend la confirmation de la précédente. Une erreur ou un timeout ne libère pas arbitrairement le budget.
- Stripe reçoit le manifeste complet des décisions du lot. Un remboursement externe non attribué bloque une nouvelle émission ; un webhook tardif d'une restitution déjà confirmée ne la réémet pas.
- Les contre-écritures ciblent la référence propre à la prestation. Les proratas cumulés absorbent les arrondis au centime sans modifier les autres prestations.
- Chaque remboursement confirmé produit son avoir contre la facture de la prestation, avec ventilation fiscale cumulative. La facture initiale conserve son montant.
- Le solde à reverser exige une preuve Stripe, un état métier et des écritures comptables concordants. Une mission non terminée demeure non éligible au reversement.
- Une restitution partielle après transfert déjà exécuté reste bloquée : la reprise partielle d'un transfert est un point distinct et n'est pas implicitement activée ici.

## Validation automatisée

Les tests ciblés couvrent les restitutions successives, le dépassement du budget de la part, la concurrence sur un même UUID, le rejeu, la conservation du montant de la prestation voisine, les contre-écritures, l'avoir et ses centimes de TVA, ainsi que le blocage du solde tant que le rapprochement n'est pas terminé.

La suite financière étendue passe sur PostgreSQL isolé : **978 tests**, **140 suites JUnit**, sans échec, erreur ni test ignoré. Le total porte uniquement sur les rapports produits lors de cette exécution. Les **13 tests de l'interface de remboursement** et TypeScript passent également.

La non-régression conserve la compatibilité des anciennes restitutions partielles : le cumul est calculé à partir des montants et de `refundBefore`, sans rendre obligatoire la métadonnée descriptive `refundAfter` dans l'historique.

## Recette depuis Baitly

Recette effectuée depuis Finance sur la mission fictive **320**, part de **55 EUR** du lot **38 / TX-f2c7a582-b74**, encaissé **90 EUR**. L'autre part, mission **304**, conserve son remboursement antérieur de **35 EUR** et son avoir, sans nouvelle émission.

1. Le formulaire présente un montant modifiable et un plafond initial de 55 EUR.
2. Une restitution de **5,01 EUR** est confirmée : transaction **60**, `re_3UNChmQxlvbxDIrY1VgzLlrV`, Stripe `succeeded` / 501 centimes EUR. Baitly affiche 5,01 EUR remboursés et 49,99 EUR conservés.
3. Une seconde restitution de **4,99 EUR** est confirmée : transaction **61**, `re_3UNChmQxlvbxDIrY1EKEndyZ`, Stripe `succeeded` / 499 centimes EUR.
4. Baitly affiche **10 EUR remboursés**, **45 EUR conservés**, statut **Partiellement remboursé**. Les KPI diminuent du montant restitué.
5. L'onglet Documents présente la facture initiale **FA2026-00011** de 55 EUR et les avoirs **FA2026-00030** de −5,01 EUR et **FA2026-00031** de −4,99 EUR. Les liens et montants sont vérifiés ; les PDF n'ont pas été rendus à nouveau dans cette tranche.

Les écritures sont équilibrées : trois débits et trois crédits de 9,97 EUR par sens pour la première restitution, puis 9,93 EUR par sens pour la seconde. Ces totaux incluent l'encaissement et sa répartition ; ils ne constituent pas le montant remboursé au payeur. Aucun doublon de remboursement ou d'avoir n'est constaté.

Le Checkout original est `complete`, `paid`, 9 000 centimes EUR et `livemode=false`, PaymentIntent `pi_3UNChmQxlvbxDIrY19otrdbH`. La mission 320 reste en attente, prévue le 2 novembre : aucun reversement n'a été émis pour cette mission. Le financement du solde après rapprochement est couvert par les tests transactionnels ; le transfert de ce solde depuis l'interface reste à exercer après réalisation de la mission de test.

## Chargement local

JAR testé : `/private/tmp/baitly-batch-partial-runtime.jar`, SHA-256 `534669f0a2a7d61183cc875d7114f2ed67a2ea0a9d05b90d0a0fd41ecfb5740f`. Seul `clenzy-server-dev` a été rechargé selon l'autorisation générale, avec sauvegarde `/private/tmp/baitly-before-batch-partial-wf0ggqzx/server.jar`. Le même conteneur et sa configuration Stripe Baitly sont conservés. Santé HTTP 200 / UP, Liquibase sans verrou. Aucun changeset ajouté et aucune écriture SQL de statut financier.
