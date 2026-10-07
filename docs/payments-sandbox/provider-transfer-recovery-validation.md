# Récupération du transfert après remboursement

Validation locale du 6 octobre 2026, uniquement dans le sandbox Stripe Baitly. Le parcours depuis Finance n'est pas encore clôturé pour ce cas.

## Ce qui est chargé

La décision de remboursement intégral d'une prestation réserve atomiquement une récupération du transfert prestataire confirmé. Le client est remboursé en premier. Le worker n'émet la récupération qu'après confirmation du remboursement ; un refus annule la récupération avant émission.

Le montant récupéré est le net du transfert initial, sans reprendre la commission. Une réponse perdue retrouve la même récupération par ses métadonnées ; passé le délai d'idempotence, une preuve absente interdit une nouvelle émission. Un échec laisse une dette visible, sans changer le remboursement confirmé ni réécrire le transfert initial.

Finance et le compte bénéficiaire disposent d'une section dédiée aux récupérations. Les références Stripe internes ne sont exposées qu'au suivi administrateur. Le transfert initial et la réception bancaire restent deux faits distincts.

## Contrôles réalisés

- 349 tests métier passent ; les deux tests PostgreSQL initialement empêchés par l'accès réseau ont ensuite été exécutés avec succès.
- Migration 0505 exécutée deux fois dans PostgreSQL isolé : unicité, clés étrangères entre organisations, RLS, instruction et preuves immuables.
- Un test réseau supplémentaire exécute le véritable service de récupération avec Stripe : 35 EUR encaissés puis remboursés, transfert de 30 EUR entièrement récupéré, un seul effet après deux appels.
- 22 tests interface du suivi administrateur/bénéficiaire et TypeScript passent.
- JAR chargé dans `clenzy-server-dev`, configuration Stripe conservée, API saine, migration 0505 appliquée et Finance rechargé avec la session administrateur.
- Aucune écriture métier PMS créée par l'essai réseau. Le transfert existant de la mission 332 reste inchangé ; la mission 352 reste sans nouveau règlement.

Preuves du test réseau :

| Objet | Référence |
| --- | --- |
| Encaissement | `pi_3UNRt1QxlvbxDIrY1prdG2Jg` |
| Transfert | `tr_3UNRt1QxlvbxDIrY1pVmFYfZ` |
| Remboursement | `re_3UNRt1QxlvbxDIrY12OIsGiM` |
| Récupération | `trr_1UNRt6QxlvbxDIrY5o7g7RTt` |

JAR : `764c3f9ec16e104ab7a46b5b413ae6838747b7160766d1a05dfdc40639cb3962`. Sauvegarde locale : `/private/tmp/baitly-before-transfer-recovery-70mwvnz9/server.jar`.

## Contrôles restant ouverts

- Déclenchement complet depuis Finance sur une prestation intégralement encaissée et déjà transférée. Le seul transfert actuel du PMS concerne une prestation déjà partiellement remboursée : il exige le circuit de remboursement du reste, encore à étendre.
- Remboursements partiels successifs après transfert et récupération proportionnelle ; remboursement externe découvert après transfert.
- Réconciliation des récupérations faites directement dans Stripe sans décision Baitly.
- Récupération après versement bancaire réel, indisponibilité du solde prestataire et dette persistante jusqu'au recouvrement.
- Récupération des transferts propriétaires et répartition d'un litige perdu.

Ce résultat ne certifie ni ces variantes ni un versement bancaire en production.
