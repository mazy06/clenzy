# Baitly : recette des litiges Stripe, 6 octobre 2026

Recette locale exclusivement sur le sandbox Baitly `acct_1U6AEiQxlvbxDIrY`. Aucun mouvement réel. Le JAR installé est `2d10e2bf21818926becaf61c709ac62aca86f8baf82eb3357270ce7b43d0fc0c`, avec migration Liquibase 0506 appliquée. L'API répond 200 après installation ; la configuration privée Stripe est conservée.

## Preuves exercées depuis Finance

Deux encaissements de test de 45 EUR ont été initiés depuis Baitly avec la carte de simulation de litige Stripe. L'issue a été simulée avec les preuves officielles `winning_evidence` et `losing_evidence`.

| Mission | Paiement | Litige | Résultat vérifié |
| --- | --- | --- | --- |
| 334, Studio Jemmapes | 53, `pi_3UNSQBQxlvbxDIrY0V3IIaDe` | `du_1UNSQDQxlvbxDIrYGHsjiJIc` | WON ; débit de 45 EUR puis restitution de 45 EUR ; réserve locale libérée |
| 404, Appartement Gambetta | 54, `pi_3UNSVzQxlvbxDIrY1S3tWDBk` | `du_1UNSW2QxlvbxDIrYKXJQYHaI` | LOST ; réserve locale de 45 EUR conservée ; message visible dans Finance et action de remboursement absente |

Les frais de 20 EUR observés sur chaque débit sont journalisés séparément. La restitution observée du dossier gagné porte uniquement sur les 45 EUR de principal ; aucune restitution de frais n'est inventée.

Après victoire, Finance a permis le remboursement de 45 EUR de la mission 334 : transaction 55, `re_3UNSQBQxlvbxDIrY0w5Lj2sC`, relue `succeeded` chez Stripe. L'avoir 29 / FA2026-00026 de -45 EUR est lié à ce remboursement et à la facture 27 / FA2026-00024, qui conserve PAID. La ligne disparaît du filtre Payé après confirmation et actualisation.

Deux rejeux locaux signés d'un instantané canonique compatible avec la version du SDK ont été effectués pour chaque litige, tous HTTP 200. Il ne s'agit pas du rejeu octet pour octet des anciens événements archivés : leur version API était différente. Aucun doublon de mouvement ni réouverture de litige n'a été constaté.

## Corrections vérifiées

- Le webhook ne fait foi que pour l'identifiant ; la chaîne session, paiement, charge et litige est relue dans Stripe et rapprochée du paiement local. Les événements de comptes connectés ne peuvent pas modifier les litiges de la plateforme.
- Réserve persistante et journal PSP immuable, avec isolation d'organisation, montant/devise exacts, contraintes de rattachement et RLS.
- Un litige gagné ne libère les fonds qu'avec un crédit et un solde principal nul. Une issue gagnée sans mouvement n'invente pas une restitution.
- Stripe conserve `charge.disputed=true` après une victoire. Une nouvelle restitution vérifie donc l'issue, le droit `is_charge_refundable` et les mouvements, avant toute émission. Un litige tardif n'empêche pas de rapprocher une restitution déjà prouvée.
- Finance relit les paiements visibles après retour au premier plan et périodiquement, sans interrompre une confirmation en cours. L'action sélectionnée ne reste plus périmée après un événement bancaire.

Validation automatisée : 244 tests dans les suites de preuve/persistance/rapprochement/migration des litiges, politique de versement, financement des séjours, remboursement Stripe, remboursement de lot, requêtes Finance et webhooks, tous réussis ; les suites complémentaires de solde et d'isolation sont consignées dans les rapports Maven. 13 tests interface réussis et contrôle TypeScript sans erreur. La migration exacte est également exercée sur PostgreSQL isolé.

## Limites restant ouvertes

Les gardes de reversement sont testées automatiquement ; aucun transfert bancaire sur ces deux missions encore en attente n'a été lancé. La collecte des litiges manqués avant tout webhook, les incidents après versement bancaire effectif et les recettes propriétaires font partie des étapes suivantes. Ce document ne certifie ni la production ni le circuit financier complet.

Sources : [scénarios de test Stripe](https://docs.stripe.com/testing), [objet Dispute](https://docs.stripe.com/api/disputes/object), [événements Stripe](https://docs.stripe.com/api/events/types).
