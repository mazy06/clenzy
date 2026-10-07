# Attribution bancaire après remboursement

Recette locale du 6 octobre 2026. Aucun paiement réel ni changement du calendrier bancaire des bénéficiaires.

## Défaut reproduit

Le rapprochement retenait chaque crédit `py_` positif sans contrôler les débits du même payout ni comparer la somme des mouvements au montant canonique du payout. Un crédit de 80 EUR suivi d'une récupération de 10 EUR pouvait ainsi être présenté comme reçu intégralement en banque alors que le versement ne portait que sur 70 EUR.

Deux tests ont reproduit le défaut avant correction : débit de remboursement en seconde page et total de crédits différent du montant bancaire. Le handler persistait à tort la source de 80 EUR dans les deux cas.

## Règle appliquée

- Lecture de toutes les pages, sous le compte connecté, hors transaction SQL.
- Montant, net et devise obligatoires sur chaque mouvement ; aucun doublon de transaction ou de source de crédit.
- Le débit du payout lui-même est exclu de son financement uniquement si son type, son identifiant, sa devise et son montant correspondent exactement au payout canonique.
- Le total net des autres mouvements doit égaler le montant du payout.
- Un autre débit ou une conversion empêche l'attribution automatique aux transferts individuels : le payout reste observé, mais ne certifie aucun montant brut reçu en banque.
- Les crédits avec frais propres ne prouvent pas le brut d'un transfert ; les autres crédits exacts restent attribuables dans un lot positif entièrement rapproché.

Cette restriction ne reconstitue pas arbitrairement l'affectation d'un remboursement, de frais ou d'une reprise entre plusieurs bénéficiaires. Les transferts et les récupérations restent distincts dans l'historique. Les événements d'échec tardif conservent leur priorité sur les anciennes observations de succès.

## Environnement observé

Le compte propriétaire reste en versement manuel avec 74 EUR disponibles et un payout manuel de test de 1 EUR. Le compte personnel de Jean Martin est en calendrier quotidien, avec 65 EUR disponibles et aucun payout bancaire automatique encore produit. Deux comptes personnels sont raccordés ; aucun compte d'organisation ne l'est. Ces lectures ne valent pas une recette de bénéficiaire société ni une réception bancaire réelle.

## Refus métier de remboursement

Le contrôleur des remboursements successifs renvoyait une erreur 500 pour un refus métier connu. Un test HTTP a reproduit ce défaut avant correction. Les gardes de récupération utilisent désormais `PaymentValidationException` ; le parcours `refund-installment` répond HTTP 400 avec le code `REFUND_NOT_READY` et son explication, avant toute émission Stripe. La règle de commission partielle non rapprochée reste en place. Les refus des rôles propriétaire et prestataire restent HTTP 403 via la sécurité de méthode.

## Validation automatisée et livraison

**165 tests / 15 suites, zéro échec, erreur ou test ignoré** le 6 octobre 2026. La suite couvre le handler bancaire, le gateway, les webhooks signés jusqu'à PostgreSQL/RLS, les reprises, les bénéficiaires personnels et sociétés, les récupérations et les remboursements unitaires/de lots. Les 24 tests du handler bancaire font partie de ce total, pas un total supplémentaire.

La fixture des webhooks signés indique désormais son montant canonique réel : 80 EUR pour le payout personnel, 160 EUR pour les deux crédits de 80 EUR du payout société. La pagination interrompue, le rejeu et l'échec tardif restent couverts. Les appels Stripe y sont simulés ; ces tests ne constituent pas une nouvelle recette réseau.

Journal d'exécution : `/private/tmp/baitly-bank-net-and-refund-final.log`. `git diff --check` valide. Aucun changement frontend ou migration nouvelle. Le serveur local n'a pas été rechargé pour cette tranche : à la demande de l'utilisateur, son chargement et la recette complète sont reportés à la [campagne finale](final-circuit-recipe-checklist.md).

Référence : [rapprochement des versements Stripe](https://docs.stripe.com/payouts/reconciliation), qui distingue le montant du payout et les mouvements positifs ou négatifs le composant. Un payout manuel n'expose pas cette affectation automatique.
