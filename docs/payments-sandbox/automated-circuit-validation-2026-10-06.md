# Circuit financier : validation isolée du 6 octobre 2026

## Résultat et portée

La recette partagée Baitly/Stripe est différée à la fin des travaux, conformément à la demande utilisateur.
Cette tranche ne redémarre pas Baitly et ne crée aucun encaissement, remboursement ou transfert Stripe.
Les tests PostgreSQL créent et suppriment leurs propres schémas sur l'instance isolée de recette.

| Vérification exécutée | Résultat |
| --- | --- |
| Lanceur backend, sélection financière élargie | **1 896 tests, 285 suites JUnit, 119 classes principales ; zéro échec, erreur ou test ignoré** |
| Lanceur frontend | **75 tests, zéro échec, erreur ou test ignoré** |
| Typage application et nouveaux tests d'intégration | Réussi |
| Scripts et garde-fous Python | **36 tests réussis** |
| Syntaxe du workflow | YAML analysé ; trois jobs présents |
| Contrôle des espaces Git | Réussi |

Rapports locaux frais : `tmp/baitly-financial-backend-recipe-03/summary.json` et
`tmp/baitly-finance-http-recipe-04/summary.json`. Les sorties précédentes en échec sont conservées
pour le diagnostic et ne sont pas utilisées comme preuve de réussite. La CI est configurée mais
n'a pas été exécutée sur GitHub pendant cette tranche.

## Corrections livrées dans le code

- **Remboursement externe après transfert** : une prestation individuelle Stripe EUR peut être
  rapprochée après un transfert déjà confirmé. La récupération utilise le net et la commission
  historiques. Les cas partiel et intégral, le rejeu et la conservation du transfert original sont
  testés avec la vraie persistance. Une récupération est réservée, sans émettre un second remboursement client.
- **Échec tardif d'un remboursement** : un historique conservé comme terminé mais marqué à revoir
  n'autorise plus une nouvelle récupération ni un remboursement suivant. La preuve historique reste intacte.
- **Commission OTA** : l'import et le modèle contractuel ne marquent plus une facture payée.
  La facture reste émise, y compris en attente d'une retenue sur reversement. Le verrou PostgreSQL
  empêche deux imports concurrents de produire deux factures. Aucune correction historique en masse.
- **Événements d'encaissement** : le consumer exige un Checkout réellement terminé dans la base.
  Un événement nommé PAYMENT_COMPLETED ne peut pas confirmer une tentative échouée ou un transfert sortant.
- **Séjour et solde orchestrés** : relecture sous verrou de la réservation et du paiement, contrôle
  de l'organisation, de la source, de la devise, du montant et de la session. Les réservations
  annulées/remboursées sont refusées ; un solde doit correspondre à un acompte cohérent. Les montants
  payé et dû sont maintenant persistés lors de la confirmation complète. Les doubles livraisons
  concurrentes confirment une seule fois, sans remettre un séjour remboursé à payé.
- **Alertes après transfert** : un litige ou une récupération non confirmée reste visible même
  après un versement bancaire confirmé. Le lien à la source utilise la mission, l'allocation ou
  les paiements du reversement propriétaire ; jamais une ressemblance de montant. Les organisations
  étrangères sont exclues. Une alerte bancaire indépendante subsiste après résolution du litige.
- **Interactions Finance** : refus métier HTTP JSON/texte visible ; ancienne éligibilité désactivée
  après échec de relecture ; confirmation de rapprochement protégée contre le double clic et
  consentement invalidé après changement de référence ou conflit serveur.

## Tests d'intégration ajoutés

Les deux suites frontend utilisent les vrais composants, React Query, les modules API et `apiClient`
avec un serveur HTTP local éphémère. Elles vérifient la confirmation explicite, les requêtes émises,
les erreurs, le double clic et le rechargement. L'identité et les endpoints serveur sont des fixtures.
Ce sont des **tests d'intégration interface/HTTP sous DOM simulé**, pas des E2E navigateur contre le PMS.

Les nouvelles suites PostgreSQL utilisent de vraies transactions et de vrais verrous pour les
imports OTA et les paiements de séjour. Les entités utiles et le CAS sont persistés ; certaines
associations non concernées, les adaptateurs de repository et les effets externes sont simulés.
Les suites Liquibase séparées appliquent les migrations financières sélectionnées sur un schéma
préalable explicite et testent les contraintes/RLS ; elles ne prétendent pas démarrer tout le PMS.

Le [lanceur commun](../../scripts/payments/automated-financial-recipe.md) refuse les suites absentes,
les rapports périmés et les tests ignorés. Il est partagé avec le workflow de CI.

## Limites toujours ouvertes

La réussite de cette sélection ne signifie pas que tous les parcours possibles sont pris en charge :

1. Cette tranche initiale excluait les remboursements externes multiples. Le [complément suivant](external-refund-series-validation.md)
   couvre maintenant leurs séries pour l'intervention individuelle. Les remboursements externes
   d'un lot ou d'un séjour restent à rapprocher lorsque l'allocation ne peut pas être prouvée.
2. L'information « payé à l'OTA » n'est toujours pas une preuve bancaire. Le rapprochement d'un
   versement OTA exige une source bancaire/documentaire et un destinataire explicites ; aucune
   disponibilité Stripe ni paiement de commission n'est déduit automatiquement de l'import.
3. Les dépenses retenues paient le prestataire enregistré. Le [complément société](expense-company-validation.md)
   ajoute maintenant une désignation explicite et immuable, sans repli personnel. La recette Stripe
   société et les achats directs aux fournisseurs sans bénéficiaire Baitly restent à traiter.
4. Un litige sur des fonds déjà transférés déclenche une alerte et bloque les nouveaux financements.
   Cela ne constitue pas une récupération automatique de la somme litigieuse auprès du bénéficiaire.
5. La garde ajoutée aux séjours concerne les flux orchestrés RESERVATION et BOOKING_BALANCE.
   Le parcours historique direct du Booking Engine et ses combinaisons crédit/annulation/acompte
   restent à exercer lors de la campagne finale ; cette tranche ne les certifie pas de bout en bout.
6. Migration 0508, code actuel, contrôles visuels, comptes société, incidents bancaires, GitHub CI
   et livraison restent distincts des tests locaux. Aucun de ces points n'est déclaré validé ici.

Ces limites doivent rester dans l'[audit](../../scripts/payments/AUDIT-CIRCUIT-2026-10-05.md) et
la [campagne finale](final-circuit-recipe-checklist.md), sans transformer un refus prudent en
fonctionnalité complète.
