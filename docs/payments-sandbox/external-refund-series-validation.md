# Remboursements externes successifs et solde prestataire

## Portée du correctif du 6 octobre 2026

Le rapprochement ne s'arrête plus au premier remboursement effectué directement dans Stripe
pour une intervention individuelle encaissée en EUR. Les écritures, les avoirs et les récupérations
prestataire utilisent un cumul stable. Aucun de ces traitements ne crée de remboursement Stripe.

La recette partagée Baitly/Stripe reste différée à la campagne finale. Le serveur local n'est pas
rechargé par cette tranche et aucune opération financière réseau n'est exécutée.

## Preuves et transitions

1. Relire la session Checkout, la liste complète des remboursements actifs et la charge Stripe.
   Les identités, la devise et les montants doivent correspondre au paiement Baitly ; la somme des
   remboursements doit correspondre exactement au montant remboursé de la charge et rester dans
   le budget encaissé. Un remboursement encore en attente empêche la finalisation du rapprochement.
2. Conserver les observations externes et traiter les dossiers dans l'ordre de leur identifiant local.
   Cet ordre reste stable même si les événements Stripe arrivent dans le désordre. Les observations
   suivantes restent bloquantes pour de nouvelles sorties d'argent.
3. Verrouiller l'encaissement et l'intervention, vérifier les restitutions précédentes et comptabiliser
   seulement la différence des proratas cumulés. Statut, contre-écritures et événement outbox sont
   dans la même transaction : un échec ne laisse aucun événement de succès en base.
4. Lorsque le prestataire a déjà reçu son transfert, réserver seulement la part du net historique.
   La restitution suivante attend la confirmation de la récupération précédente ; le worker peut
   reprendre ce dossier sans nouvelle restitution au client. Le transfert historique reste intact.
5. Créer un avoir distinct par restitution, après ses contre-écritures. Les lignes TTC et les taxes
   cumulées annulent exactement les lignes d'origine au remboursement intégral.
6. Un refus Stripe confirmé avant comptabilisation ne consomme pas le budget. En revanche, un échec
   tardif après comptabilisation conserve l'historique et impose un rapprochement. Un simple rejeu
   « succeeded » ne clôt pas l'incident avant la vérification de la charge complète.
7. Le reversement du solde reste interdit si un remboursement, même cumulatif, est marqué à revoir,
   non confirmé ou en échec tardif. Le circuit d'émission des remboursements gérés refuse toute
   preuve externe, même si elle porte des métadonnées cumulatives.

## Contrôles automatisés

La suite de persistance externe utilise PostgreSQL lorsque `baitly.test.jdbc` est fourni par le
lanceur de recette, avec un schéma jetable propre. Les entités de paiement, les écritures, les
récupérations, les factures/lignes/numéros et l'outbox sont réelles. La mission est un mapping réduit
aux champs concernés. La vérification des dossiers d'annulation est couverte par les suites
PostgreSQL séparées ; le relais Kafka et le réseau Stripe ne sont pas démarrés.

Les tests couvrent notamment trois restitutions de 5,01 EUR, 4,99 EUR puis 35 EUR sur 45 EUR ;
un transfert prestataire de 40 EUR et 5 EUR de commission ; les notifications désordonnées ; deux
finalisations concurrentes ; les rejeux ; les factures à deux taux de taxe ; les preuves manquantes
ou contradictoires ; les frontières d'organisation ; le rollback du journal et de l'outbox.

| Vérification | Résultat |
| --- | --- |
| Sélection financière backend finale | 1 927 tests, 285 suites JUnit ; zéro échec, erreur ou test ignoré |
| Sélection frontend Finance | 75 tests ; zéro échec, erreur ou test ignoré |
| Typage application et intégrations frontend | Réussi |
| Intégration PostgreSQL externe + solde, dernier ajout inclus | 49 tests ; zéro échec, erreur ou test ignoré |

Rapport backend final : `tmp/baitly-financial-recipe-external-series-02/summary.json`.
Le rapport `tmp/baitly-financial-recipe-external-series-01/summary.json` conserve les 75 tests frontend
et leurs contrôles de typage, avec une première version backend à 1 920 tests. Le frontend n'a pas
été modifié ensuite. Les suites et leur contenu sont contrôlés par le lanceur partagé local/CI.
La dernière intégration ajoute un scénario à la sélection globale : 45 EUR encaissés, 10 EUR
remboursés et 35 EUR éligibles seulement après rapprochement de toute la série ; une revue tardive
bloque de nouveau le solde. Son rapport frais est
`tmp/baitly-external-remainder-integration-reports/TEST-com.clenzy.service.BaitlyExternalRefundStoreTest.xml`.
Les 49 tests recouvrent cette classe de la sélection globale et ne s'ajoutent pas tous au total 1 927.

## Limites conservées

- L'allocation d'un remboursement externe d'un lot ou d'un séjour n'est pas déduite de son montant.
  Ces dossiers restent à rapprocher. Une décision gérée inconnue ne devient pas une preuve externe.
- Une récupération Stripe peut échouer faute de solde disponible chez le bénéficiaire ; les tests
  de persistance ne prouvent pas sa réussite réseau ni une réception bancaire.
- Une ancienne série dont les écritures cumulées ne correspondent pas au prorata attendu reste
  à rapprocher. Les écritures historiques ne sont pas réécrites.
- Le rapprochement des versements OTA et le modèle explicite des dépenses société/fournisseur
  restent des points de code distincts, suivis dans l'audit général.

Référence consultée : [remboursements Stripe](https://docs.stripe.com/refunds).
