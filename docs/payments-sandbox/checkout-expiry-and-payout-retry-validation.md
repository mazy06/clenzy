# Baitly : paiement après expiration et reprise du versement

Recette locale du 6 octobre 2026, organisation de test 2, mission fictive 352 « TEST SANDBOX · Persistance des pièces », Jean Martin. Aucune mutation SQL des états métier.

## Encaissement validé depuis Finance

1. La tentative individuelle de 70 EUR `TX-9c906c67-531` restait en traitement après l'expiration réelle de sa session Stripe.
2. Le correctif relit la session chez Stripe avant de libérer la dette : identité, montant, devise, origine, état expiré, absence d'encaissement et d'intention de paiement.
3. L'événement authentique `evt_1UNZY2QxlvbxDIrYaq3WFL9o`, rejoué sans modifier son contenu, est accepté deux fois sans doublon. La transaction 63 devient FAILED avec preuve `standaloneRetryAllowed`; la mission demeure COMPLETED avec sa date de fin d'origine.
4. Depuis la modale Finance, sélection de cette seule mission et création d'un Checkout hébergé de 70 EUR, puis règlement avec la carte fictive Stripe.
5. Stripe confirme le paiement et Baitly conserve deux tentatives distinctes : 63 FAILED, 64 COMPLETED. La mission 352 est PAID et reste COMPLETED.

Preuves du nouveau paiement :

- Référence Baitly : `TX-a2a84649-532`.
- Session : `cs_test_a18GVvnG5ARtO5FmjlmJtgheuAAS8O7qv2QVwNGDja8yqxjIRLxLvQIz1R`.
- Intention : `pi_3UNa4fQxlvbxDIrY1XJUfnNr`.
- Montant : 70 EUR, `livemode=false`, origine `INTERVENTION_BATCH`, part de la seule mission 352.
- Retour vers Finance effectué. L'encaissement est confirmé, pas un simple changement de statut manuel.

## Défauts découverts et suivis

- Aperçu du versement : la relance chargeait une mission détachée sans sa demande liée. Correction par le lecteur de mission dédié, qui charge les relations avant fermeture de la transaction de lecture. Après chargement, la liste, le détail, le KPI et la confirmation reprennent bien 70 EUR.
- Refus métier : la raison serveur était masquée par un message générique. Les refus attendus renvoient désormais HTTP 409 et l'interface conserve le message de l'API.
- Facture FA2026-00033 : l'ancienne tentative expirée empêchait le rapprochement du nouveau paiement. Le rapprochement accepte maintenant une tentative individuelle dont l'expiration sans encaissement est prouvée. Les tentatives ambiguës restent bloquantes. Le worker a confirmé automatiquement la facture 36 PAID, liée au paiement 64, sans mutation SQL ni deuxième collecte.
- Webhooks : deux relais CLI locaux tournaient simultanément. Le relais compatible livrait bien les confirmations HTTP 200 ; le doublon `--latest` produisait des HTTP 503. Seul ce doublon a été arrêté, sans toucher au compte Stripe ni à sa version globale.

## Relance du versement validée dans Finance

Le 6 octobre, le dossier 7 est relancé depuis le panneau prestataire avec confirmation explicite des 70 EUR. La première émission rencontre un solde disponible insuffisant : Baitly conserve FAILED, expose le refus lisible et ne crée aucun transfert. Le solde de test disponible était de 28,03 EUR, distinct des fonds en attente.

Une alimentation séparée, purement fictive, de 100 EUR via `pm_card_bypassPendingInternational` rend ensuite 126,28 EUR disponibles. Son intention `pi_3UNab7QxlvbxDIrY1Ap1VuSA` n'est liée à aucune dette Baitly et ne constitue pas le règlement de la mission.

La deuxième relance depuis Finance aboutit à un unique transfert `tr_1UNabmQxlvbxDIrYuunyKlsh`, 70 EUR, `livemode=false`, destination Jean Martin `acct_1UNPNvJfs0WxjDsG`. Le dossier 7 devient SENT, le KPI des reversements effectués passe de 30 à 100 EUR. La mission reste COMPLETED, sa date de clôture du 6 octobre à 05:43:46 UTC est conservée. Le transfert Connect reste distinct de la réception bancaire.

Le remboursement partiel révélé par cette recette était encore masqué par la tentative 63 expirée. Les contrôles de capacité, de décision et de création d'avoir ignorent désormais uniquement les tentatives Stripe dont la session expirée correspond à la preuve de non-encaissement enregistrée ; un FAILED ambigu reste bloquant.

## Contrôles automatisés et limites

Le premier correctif chargé passe 1 205 tests serveur et 63 tests interface. La relance et le rapprochement documentaire ont ensuite été validés avec 1 209 tests serveur (170 suites, aucun échec, erreur ou test ignoré), 64 tests interface, TypeScript et Vite. JAR de cette recette : SHA-256 `54ec5694ccb3659d1c58702ea139a21332e76176031c63bc7a5ceb79a31a5ab8`.

La correction complémentaire des remboursements passe **1 216 tests serveur**, toujours sans échec, erreur ni test ignoré. Les 14 tests ciblés d'interface et du calcul des horaires passent, ainsi que TypeScript : Finance utilise désormais le même parseur UTC et la même fin effective que la fiche intervention. Le chargement et la recette de ce dernier correctif sont suivis ci-dessous.

## Deux remboursements partiels après transfert, validés depuis Finance

JAR final installé dans le même conteneur local, configuration Stripe conservée : SHA-256 `3e329340fd0a4c4a5edaf1d1a1cd64035b0b11fa072bdfb0b42bcb93359f409c`. Sauvegarde précédente : `/private/tmp/baitly-before-expired-refund-final-s4z6zosr/server.jar`. Packaging, TypeScript et build Vite passent.

| Action depuis Finance | Remboursement Stripe | Récupération Connect | Avoir |
| --- | --- | --- | --- |
| 5,01 EUR, transaction 65 | `re_3UNa4fQxlvbxDIrY1wW6SBu4` | `trr_1UNaziQxlvbxDIrYato1pCRp`, RECOVERED | FA2026-00034, -5,01 EUR |
| 4,99 EUR, transaction 66 | `re_3UNa4fQxlvbxDIrY1UtAAehE` | `trr_1UNb0iQxlvbxDIrYWFlulthu`, RECOVERED | FA2026-00035, -4,99 EUR |

La seconde modale propose bien le solde **64,99 EUR**, puis Finance affiche **10 EUR remboursés / 60 EUR conservés** et des KPI à 60 EUR. Les deux restitutions sont COMPLETED ; Stripe confirme `amount_reversed=1000` sur le transfert initial de 7000 centimes. Les deux dossiers de récupération sont RECOVERED, chacun avec sa preuve distincte. Chaque remboursement produit six contre-écritures équilibrées à zéro.

La facture initiale reste PAID à 70 EUR ; les deux avoirs uniques lui sont liés et apparaissent avec elle dans l'onglet Documents du dossier. Le transfert initial reste historiquement TRANSFERRED à 70 EUR et la mission opérationnellement COMPLETED. Aucun règlement ni état n'a été réécrit en SQL.

Dans « Suivi & rapprochement », le détail du transfert 352 expose séparément **5,01 EUR Fonds récupérés** et **4,99 EUR Fonds récupérés**, avec leurs références Stripe ; la réception bancaire reste explicitement non confirmée. La relecture finale chez Stripe retourne exactement deux remboursements `succeeded`. La base conserve un seul transfert initial, deux avoirs et les anciens dossiers 5/6 inchangés.

Le Checkout intégré observé était vide dans le navigateur de recette ; le parcours hébergé est validé. La cause du rendu intégré n'est pas encore établie. Les restitutions ci-dessus ont une commission nulle ; la répartition d'une commission non nulle et les incidents après crédit bancaire ne sont pas attestés. Un payout manuel de test distinct valide seulement l'observation bancaire et l'absence d'attribution abusive : [contrôles bancaires](bank-monitoring-validation.md).
