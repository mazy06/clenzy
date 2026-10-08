# Contrôles financiers et reprise des litiges

Validation locale du 6 octobre 2026. Les correctifs ci-dessous sont chargés dans Baitly avec la configuration Stripe sandbox dédiée. **Ils ne clôturent pas le circuit complet** : les points restants sont indiqués dans le [suivi principal](../../scripts/payments/AUDIT-CIRCUIT-2026-10-05.md).

## Correctifs chargés

- **Reversements propriétaires** : juste avant la réservation d'une instruction de transfert, relecture sous verrou du dossier, des séjours, des logements, du bénéficiaire et de son compte Connect. Le montant, la devise, les encaissements et les attributions doivent toujours correspondre. Un remboursement en cours ou ambigu bloque le financement. Le remboursement partiel confirmé dispose désormais d'un calcul sur le solde et de contrôles documentaires : voir la [recette propriétaire](owner-residual-payout-validation.md). Le parcours gestionnaire ne peut plus rembourser un séjour déjà attribué à un reversement. Une instruction déjà transférée conserve sa preuve lors d'un rejeu.
- **Litiges manqués** : un worker parcourt les litiges Stripe par pages de 25 et relit leur état canonique, même en l'absence de webhook local. Il revient au début après un parcours complet ; une interruption reprend également au début. Les preuves financières persistées rendent les relectures idempotentes. Un dossier en erreur ne bloque pas le contrôle des suivants. Le worker ne soumet aucune réponse au litige et ne crée aucune transaction Stripe.
- **Remboursements successifs** : un événement tardif concernant une restitution déjà confirmée relit sa référence Stripe. Il ne tente pas de la réémettre et ne la confond pas avec la restitution suivante encore en cours.
- **Dépenses prestataires** : la liste, le détail et le justificatif sont limités au prestataire concerné, au propriétaire du logement ou à l'administration. Les écritures exigent un rôle administrateur. Le logement, la mission et le prestataire doivent avoir un rattachement cohérent ; un prestataire marketplace affecté à la mission reste accepté. Montant positif au centime et taux fiscal valide sont exigés. L'ancien bouton de confirmation manuelle ne constitue toujours pas un règlement PSP.
- **Formulaire de remboursement** : le serveur indique si l'encaissement autorise la saisie d'un montant partiel. Les prestations payées seules via Stripe conservent cette possibilité. Les allocations confirmées permettent maintenant les restitutions partielles successives, avec un budget par prestation. Les historiques non éligibles restent protégés. Voir la [recette des remboursements de lot](batch-partial-refund-validation.md). Le serveur revalide les conditions lors de l'émission.

## Validation automatisée

La recette définie dans [ci-payout-recipe.yml](../../.github/workflows/ci-payout-recipe.yml) a été exécutée localement contre une base PostgreSQL isolée : **625 tests serveur**, sur 50 classes principales et 67 suites JUnit, zéro échec, erreur ou test ignoré. Les rapports de cette seule exécution ont été comptés, produits entre 10:37:33 et 10:38:05, heure de Paris. Les exécutions ciblées antérieures ne s'ajoutent pas à ce total.

Elle couvre notamment les verrous et courses concurrentes, l'isolation des organisations et propriétaires, les signatures webhook, les allocations de lots, les remboursements successifs, les avoirs, les litiges, les récupérations de transferts et les migrations financières PostgreSQL. Les schémas de test sont distincts de la base métier locale.

**17 tests d'interface** passent sur le remboursement et le détail du paiement, ainsi que TypeScript. Les **29 tests Python** des scripts sandbox passent également. Le contrôle de diff ne signale pas d'erreur d'espacement.

La CI inclut désormais ces contrôles serveur et les interactions de remboursement. Elle refuse une recette avec des tests ignorés et exige la présence des huit recettes PostgreSQL attendues. Le workflow est préparé dans le dépôt local ; aucune exécution GitHub ni publication en production n'est revendiquée.

## Chargement local

Seul `clenzy-server-dev` a été rechargé, selon l'autorisation générale de l'utilisateur, avec sauvegarde du JAR précédent. Le même conteneur et ses variables d'environnement ont été conservés. Le frontend n'a pas été redémarré.

- JAR : `/private/tmp/baitly-finance-followup-runtime.jar`.
- SHA-256 : `c6c7ee8cfdeeb59801c2b54b67c40e294062903f15b21a65414e181942c8093c`.
- Sauvegarde : `/private/tmp/baitly-before-finance-followup-x73apidk/server.jar`.
- Démarrage Spring confirmé à 08:36:36 UTC ; contrôle HTTP `/actuator/health` : `UP`, base et Liquibase sains.
- Aucune nouvelle migration dans cette tranche. La requête d'éligibilité des remboursements est également exécutée en lecture seule sur le PostgreSQL Baitly local.

Les transactions 51 à 56 conservent leurs montants et états : la mission 332 reste encaissée 35 EUR et remboursée par 5 EUR puis 30 EUR ; le litige perdu de la mission 404 conserve ses 45 EUR bloqués. Leurs [preuves de recette](successive-refund-validation.md) restent distinctes des tests automatisés.

Le premier passage autonome du worker est confirmé par son verrou ShedLock, du 08:41:36 au 08:41:38 UTC. Aucune erreur du worker n'apparaît depuis le démarrage. Les deux litiges existants et leurs trois mouvements sont conservés sans doublon. La découverte d'un nouveau litige dont le webhook aurait été perdu est couverte par les tests automatisés ; aucun nouveau litige Stripe n'a été provoqué pour cette vérification locale.

## Limites et suite

La première tentative UI a été interrompue par une indisponibilité de la revue automatique du navigateur. La reprise a ensuite permis de vérifier dans Finance la prestation 414 : sa part de lot de 45 EUR présente bien un montant intégral en lecture seule. Le formulaire a été fermé sans émission de remboursement.

Le solde propriétaire après remboursement est maintenant raccordé et recetté depuis Finance : 100 EUR encaissés, 50 EUR remboursés, 50 EUR transférés au compte Connect. Commission TTC et documents sont couverts par les tests ; le cas UI utilise une commission nulle. [Preuves et limites](owner-residual-payout-validation.md).

Le remboursement partiel par part de lot est désormais recetté dans Finance (5,01 EUR puis 4,99 EUR sur 55 EUR), avec deux avoirs et sans altération de la part voisine.

Le règlement PSP d'une dépense retenue à un prestataire individuel est désormais recetté : 30 EUR encaissés, 25 EUR au propriétaire et 5 EUR à Jean Martin, deux preuves Stripe distinctes. Voir la [recette dépenses et réassorts](expense-payout-validation.md).

Restent à terminer : réception externe des fonds OTA et commissions, recettes société et achats fournisseurs directs, incidents bancaires, rapprochement des historiques ambigus et livraison CI/CD.

Le rattrapage des litiges relit l'ensemble de l'historique, une page toutes les cinq minutes. Une très grande profondeur d'historique ou des redémarrages fréquents peuvent retarder la revue des pages anciennes ; le curseur n'est pas encore persistant.
