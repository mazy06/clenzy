# Surveillance bancaire du sandbox Baitly

Recette locale du 6 octobre 2026. Aucun virement réel, aucune modification du calendrier de versement des bénéficiaires.

## Activation et résultats

Le même conteneur `clenzy-server-dev` a été redémarré avec un fichier local `/app/config/application.properties` contenant uniquement `baitly.payout-monitoring.enabled=true`. Le JAR testé et les quatre variables privées Stripe sont conservés. La sauvegarde du JAR est dans `/private/tmp/baitly-bank-monitoring-haw_pfcw/server.jar`. Cette configuration appartient au conteneur de recette ; elle ne constitue pas une configuration de production et disparaîtrait lors d'une recréation non préparée.

Le serveur est reparti le 6 octobre à 13:58:13 UTC. Le rattrapage a interrogé les deux comptes présents dans le journal :

| Compte de test | Calendrier Stripe observé | Solde disponible | Rattrapage terminé | Erreurs |
| --- | --- | --- | --- | --- |
| Propriétaire | Manuel | 75 EUR | 13:58:24 UTC | 0 |
| Jean Martin | Quotidien | 5 EUR | 13:58:24 UTC | 0 |

Aucun payout bancaire n'existe encore sur ces deux comptes. Le journal des observations bancaires reste donc vide. Le suivi Finance affiche « Rattrapage automatique activé » et « Surveillance en lecture seule ». Le détail de la dépense de 5 EUR conserve correctement « La réception en banque n'est pas confirmée ».

L'ancienne mission 89 à rapprocher reste visible ; son historique ambigu n'est pas effacé par la surveillance.

## Protection du rechargement local

Le script `stripe_sandbox_local.py` refusait les changements d'image, mais pouvait perdre un JAR installé dans le conteneur lors d'une recréation Compose. Il vérifie désormais les changements de `/app/app.jar` et `/app/config` avant toute recréation. Un JAR ou une configuration locale modifiée exige une procédure qui les conserve. Les contrôles en lecture seule et les rechargements sans changement restent possibles. Dix tests du script passent, sans appels Docker réels dans les tests.

## Événement bancaire réel du sandbox, 6 octobre à 16:00 UTC

Une simulation de payout manuel de **1 EUR**, `po_1UNanTQraKTYknLtdUXylVph`, a été émise sur le compte propriétaire déjà raccordé. Le script vérifie le compte plateforme, la clé de test et `livemode=false` avant tout POST ; il ne modifie ni les coordonnées bancaires ni le calendrier des versements.

Stripe confirme `paid`, `automatic=false` et `reconciliation_status=not_applicable`. Les quatre événements distincts reçus par le relais Connect sont enregistrés avec l'état canonique PAID, y compris `payout.created` arrivé après `payout.paid`. Leurs sources restent vides : aucun dossier propriétaire n'est déclaré reçu en banque sur cette seule preuve.

L'événement authentique `evt_1UNanUQraKTYknLt4jWz13Ew`, récupéré chez Stripe sous le compte connecté et rejoué sans modifier son contenu, reçoit deux réponses HTTP 200 supplémentaires. Les transferts propriétaires 15 et 16 conservent TRANSFERRED, 50 EUR et 25 EUR ; aucune modification SQL des états n'a été effectuée.

## Limites

Cette recette valide maintenant l'activation, les événements bancaires du sandbox reçus hors ordre et leur rejeu. Elle ne prouve ni un crédit bancaire réel, ni un rapprochement de payout automatique, ni un rejet tardif. Stripe ne fournit pas le rapprochement automatique des transactions individuelles pour un payout manuel ; la présence d'un tel payout ne suffit donc pas à déclarer une ligne Baitly reçue en banque. Le calendrier propriétaire n'a pas été modifié. Les payouts de test simulent les mouvements sans traitement par la banque, comme décrit dans les [tests Connect](https://docs.stripe.com/connect/testing?accounts-namespace=v1).

Référence : [rapprochement des versements Stripe](https://docs.stripe.com/payouts/reconciliation).
