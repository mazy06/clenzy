# Réservations : événements tardifs et confirmation concurrente

## Défaut reproduit et correction

Le chemin historique `markReservationPaymentFailed` réécrivait `FAILED` sans relire le statut
sous verrou. Une notification asynchrone tardive pouvait donc dégrader un séjour payé, un acompte,
un remboursement ou une annulation. La confirmation directe partageait un CAS mais ne vérifiait
pas systématiquement l'annulation du séjour avant ses effets financiers.

Le test PostgreSQL ajouté avant correction reproduit **11 échecs** sur 31 cas, dans
`tmp/baitly-reservation-order-red`. Aucun appel Stripe n'est nécessaire pour reproduire le défaut.

Succès et échec partagent désormais le verrou de la réservation et rechargent son état. La session
doit encore correspondre après cette relecture. Seuls `PENDING` et `PROCESSING` peuvent devenir
`FAILED`. Une confirmation directe sur un séjour annulé ou un état financier incompatible demande
un rapprochement, sans nouveau journal ni document. La preuve orchestrée vérifie aussi la date
d'annulation, en complément du statut textuel.

## Tests ciblés réussis

`tmp/baitly-reservation-order-green-01` : **137 tests**, zéro échec, erreur ou test ignoré.

- Statuts et montants préservés après échec tardif : payé, acompte, remboursement partiel/intégral,
  annulation, paiement non requis et échec déjà enregistré.
- Course déterministe PostgreSQL : l'échec charge une ancienne copie, le succès est commité, puis
  l'échec reprend. La relecture conserve le paiement et ses montants ; une seule confirmation.
- Ancienne session remplacée après la lecture initiale : aucune dégradation de la nouvelle session.
- Séjour annulé par statut ou date, remboursé ou non payable : aucun effet de confirmation.
- Contrôles existants : paiement intégral, acompte/solde orchestré, idempotence et effets documentaires.

Le PostgreSQL est jetable ; repositories de recherche et effets externes sont adaptés/simulés.
Les entités, transactions, verrous, CAS et sauvegardes sont réels. Le schéma de ce test est une
projection Hibernate dédiée ; ce correctif n'ajoute pas de migration.

## Non-régression finale de cette tranche

- `tmp/baitly-financial-recipe-reservation-order-final/summary.json` : **1 970 tests serveur**,
  zéro échec, erreur ou test ignoré, incluant dépenses société, remboursements externes et protections des séjours.
- `tmp/baitly-financial-recipe-expense-company-01/summary.json` : **77 tests interface** et les
  deux contrôles TypeScript réussis ; aucun changement d'interface après cette exécution.
- **36 tests Python** du lanceur et de ses garde-fous réussis ; `git diff --check` sans erreur.

Les nombres des passes ciblées ne s'ajoutent pas à ceux de la suite globale : ils se recouvrent.

## Portée et suite

Ce correctif ne certifie pas toutes les variantes du checkout direct, notamment les anciens
acomptes, la consommation de crédit fidélité et leur annulation. Le rapprochement orchestré exige
encore une preuve monétaire égale au montant attendu ; un crédit fidélité ne doit jamais être
transformé en argent disponible chez Stripe. Ces variantes doivent rester dans la campagne de
validation et être raccordées avant toute déclaration de circuit complet.

Le code n'est pas chargé dans le PMS partagé. La recette navigateur Baitly/Stripe est reportée
à la campagne finale demandée par l'utilisateur.
