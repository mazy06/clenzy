# Recette finale du circuit financier Baitly

## Ordre demandé

Le 6 octobre 2026, l'utilisateur demande de terminer les travaux de code avant d'effectuer la recette sandbox complète. Les tests unitaires, d'intégration et PostgreSQL isolés continuent pendant l'implémentation. Les nouvelles opérations de recette sur le sandbox partagé sont reportées à cette campagne finale.

Les validations précédentes restent des preuves historiques, pas une certification de la dernière version. La production et les paiements réels sont exclus.

## Préparation de la campagne

- [ ] Clôturer ou expliciter chaque limite de code dans l'audit financier.
- [ ] Exécuter les suites financières serveur, interface et migrations isolées ; construire le livrable exact.
- [ ] Utiliser le [lanceur partagé local/CI](../../scripts/payments/automated-financial-recipe.md) avec un nouveau dossier de rapports ; vérifier zéro test ignoré et conserver le manifeste exact. Les tests interface/HTTP isolés ne remplacent pas les parcours navigateur ci-dessous.
- [ ] Sauvegarder le JAR local, charger ce livrable en conservant la configuration Stripe Baitly, vérifier la santé et les sessions.
- [ ] Vérifier le compte plateforme, le mode test, la version des webhooks et l'unicité du relais local.
- [ ] Préparer les bénéficiaires personnels et société et les fixtures clairement marquées TEST SANDBOX ; aucune signature ni configuration légale fictive.
- [ ] Photographier l'état initial des transactions, transferts, factures, avoirs et écritures historiques par lectures seules.

## Parcours à valider depuis Baitly

- [ ] Encaissement de séjour simple, acompte puis solde, annulation et retour public.
- [ ] Crédit fidélité et checkout direct : paiement PSP réduit, consommation du crédit confirmée une seule fois, insuffisance concurrente, restitution après annulation et financement limité à l'argent réellement encaissé. Le consumer RESERVATION et le financement cash sont désormais raccordés et testés en isolation : [preuves et limites](loyalty-credit-validation.md). Remise offerte EARN/GRANT et avoirs cash sont implémentés ; les crédits achetés restent hors périmètre ; ne pas considérer la déduction affichée au checkout comme une preuve de consommation du crédit.
- [ ] Fidélité et parrainage : gains seulement après séjour payé et terminé, refus après annulation entre scan et exécution, création du code sans restauration d’un ancien solde ; vérifier séparément la reprise de points déjà gagnés lors d’un remboursement ultérieur.
- [ ] Réservation : montants payé/dû persistés ; événement avant encaissement ignoré ; double livraison sans double confirmation ; organisation/devise/montant incohérents refusés ; ancien solde refusé après annulation, remboursement ou modification du prix.
- [ ] Notification d'échec de séjour après encaissement/acompte/remboursement : statut et montants conservés. Succès concurrent ou remplacement de session après la première lecture : relecture sous verrou, aucun écrasement par l'ancien événement. Confirmation directe d'un séjour annulé : rapprochement requis, aucune nouvelle écriture.
- [ ] Encaissement d'intervention, de demande marketplace et de facture ; reprise/expiration, refus, authentification forte et absence de double paiement.
- [ ] Paiement groupé de plusieurs prestations et bénéficiaires ; allocation exacte, droits et devise par ligne.
- [ ] Reversement propriétaire avec commission non nulle, retenues de dépenses et documents liés.
- [ ] Reversements de prestataires individuels et sociétés ; catégories autres que ménage, relance sûre et bénéficiaire immuable.
- [ ] Dépenses et réassorts : bénéficiaire, justificatif, montant et absence de double règlement.
- [ ] Migration 0511 et achats fournisseurs : joindre une facture, choisir explicitement l'un des deux parcours, vérifier le verrouillage du choix et les doublons avec l'ancien écran de dépenses. [Code et tests](ota-supplier-reservation-validation.md).
- [ ] Invitation fournisseur existant et nouveau : expiration/renouvellement, email vérifié correspondant, activation Keycloak sans abonnement, acceptation explicite, espace personnel et profil rechargé. Aucun accès à l'organisation cliente ; tester un fournisseur initialement sans organisation.
- [ ] Fournisseur invité : connexion du compte de versement, préparation unique de la dépense, approbation/retenue financée, transfert nominatif et réception bancaire. Un compte non prêt bloque le paiement ; inviter ou accepter ne paie pas.
- [ ] Fournisseur externe : site HTTPS, paiement réalisé hors Baitly, pièce distincte de la facture et TTC exact. Rejeu sans doublon, téléchargement protégé, aucune proposition ultérieure de paiement PSP pour cette facture. Ce parcours reste documentaire, sans retenue propriétaire automatique.
- [ ] Migration 0509 et dépenses société : choix explicite sans transfert, confirmation distincte nommant la société, aucun repli vers le représentant personnel ; compte non prêt ou rattachement modifié bloquants. Deux opérateurs concurrents ne peuvent ni changer le bénéficiaire après réservation du transfert ni émettre deux fois. [Tests isolés](expense-company-validation.md).
- [ ] Remboursements intégraux, partiels, successifs, externes et de lots ; avoirs et contre-écritures exacts.
- [ ] Remboursements externes successifs d'une intervention déjà transférée : somme de la charge et toutes les restitutions vérifiées, ordre local stable malgré les webhooks désordonnés, avoir distinct et part prestataire calculée sur le net et la commission historiques. Reprise après attente de la récupération précédente, sans nouvelle restitution client.
- [ ] Preuve externe de lot affectée à une prestation depuis Finance : motif et auteur conservés, deux affectations concurrentes incompatibles refusées, relecture Stripe avant comptabilisation. Série de 5,01 EUR puis 29,99 EUR sur une part de 35 EUR d'un lot de 80 EUR, autre part de 45 EUR inchangée, avoirs exacts. Affectation seule sans mouvement ; reprise après incident sans doublon ; restitution demandée ensuite depuis Baitly sans réémettre la preuve externe. Répartir aussi une preuve de 50 EUR entre deux prestations (20 et 30 EUR), puis vérifier les deux avoirs, les soldes et une seule référence Stripe. Répartir les preuves dans un ordre inverse à leur observation et vérifier la reprise dans le bon ordre.
- [ ] Remboursements externes de séjour PMS EUR sans crédit ni reversement engagé : 5,01 EUR puis 4,99 EUR puis solde, relecture de toutes les restitutions, contre-écritures, avoirs, statut et financement résiduel exacts. Rejeu et interruption sans doublon. Tester ensuite le séjour déjà reversé : base nette figée, instruction de récupération distincte, avoir de commission et maintien du transfert historique. Tester le crédit offert consommé et les récompenses déjà dépensées : restitution des points, reprise des gains et aucun cash inventé. [Compléments implémentés](refund-completion-validation.md).
- [ ] Refus externe avant comptabilisation : historique conservé, aucun avoir/événement de succès, budget non consommé. Incident après comptabilisation : un rejeu ou une erreur réseau ne clôt pas l'incident avant vérification complète ; versement du solde toujours bloqué.
- [ ] Notification tardive d'échec d'un remboursement : historique conservé, incident visible, aucune nouvelle récupération du bénéficiaire ni nouveau remboursement avant résolution.
- [ ] Remboursement après reversement, avec et sans commission ; récupération, échec, reprise et maintien du solde réellement conservé.
- [ ] Commission prestataire : base du transfert historique conservée, remboursement de 5,01 EUR puis 4,99 EUR sur 35 EUR (30 EUR transférés, 5 EUR de commission) ; récupérations de 4,29 EUR puis 4,28 EUR, parts de commission de 0,72 EUR puis 0,71 EUR ; restitution finale des 25 EUR restants avec récupération des 21,43 EUR de net restants.
- [ ] Cas au centime couvert uniquement par la commission : remboursement client confirmé, état « Aucune récupération nécessaire », aucun appel de reprise Stripe à zéro ni référence de récupération inventée ; reprise de la série et total final exact.
- [ ] Migrations 0512 à 0515 : affectations immuables et isolées, net par séjour figé, écritures de fidélité liées à leur source et avoirs de commission séparés. Vérifier chargement, rejeux et parcours multi-séjours.
- [ ] Migration 0508 et restitution avec commission dans Finance : ventilation visible, preuve du transfert initial conservée, bénéficiaire limité à sa propre part ; recharge et rejeux sans doublons.
- [ ] Versement bancaire automatique : rapprochement du montant net, frais/reprises non attribuables, événement tardif, échec et rattrapage sans webhook.
- [ ] Litiges gagnés/perdus après encaissement et après transfert, blocages de financement et rattrapage.
- [ ] Après un versement bancaire confirmé, litige de la source et récupération non aboutie restent visibles dans Finance. Résoudre le litige ne masque pas une absence de preuve bancaire distincte. Aucun prélèvement automatique du bénéficiaire pour un litige n'est présumé.
- [ ] OTA : paiement voyageur, collecteur et réception des fonds distincts ; aucune disponibilité Stripe présumée et commission documentée.
- [ ] Migration 0510 : rapprochement documentaire d'un versement OTA avec relevé et justificatif bancaire distincts, ventilation de plusieurs séjours, frais/remboursements/net exacts, propriétaire ou gestionnaire explicitement désigné. Des propriétaires différents interdisent la réception sur le compte d'un seul propriétaire.
- [ ] OTA : montant cumulé plafonné, même référence bancaire concurrente refusée, correction motivée conservant l'historique puis nouveau rapprochement. Le rapprochement documentaire ne paie pas automatiquement une commission et ne crée aucun fonds disponible chez Stripe.
- [ ] Deux imports OTA simultanés : une seule facture de commission ; statut émis tant qu'aucun règlement/retenue prouvé n'existe. Ne pas convertir les anciennes factures en masse sans preuve.
- [ ] Rejeux, événements désordonnés, interruptions et concurrence : aucune double émission, aucun doublon de facture/avoir ou journal.
- [ ] Cloisonnement entre organisations et bénéficiaires, écran Finance et compte bénéficiaire, affichage mobile et erreurs compréhensibles.
- [ ] Dépense : confirmation explicite, une seule émission au double clic, refus métier visible, ancienne éligibilité désactivée si sa relecture échoue, statut conservé après recharge.
- [ ] Rapprochement : changement de référence invalide la vérification et le consentement ; double clic confirme une seule fois ; HTTP 409 redemande une vérification sans envoyer de transfert.

## Conditions de clôture

Pour chaque scénario, conserver les références Baitly/Stripe, les montants avant/après, les états et les limites. Ne jamais remplacer un parcours incomplet par une modification SQL des données métier. Une simple réponse HTTP 200 ou un retour de Checkout ne prouve pas un encaissement, un rapprochement comptable ou une réception bancaire. Les scénarios indisponibles dans le sandbox doivent rester explicitement non validés.
