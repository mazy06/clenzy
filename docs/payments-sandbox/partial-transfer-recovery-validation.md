# Baitly : récupérations partielles après transfert

Recette du 6 octobre 2026, sandbox uniquement. Une preuve API n'est pas une recette d'interface ni une preuve de réception bancaire.

## Contrat exercé sur Stripe

L'essai opt-in `BaitlyPartialTransferRecoverySandboxIT` utilise le service de récupération et de vraies réponses Stripe de test. Il n'écrit pas dans la base du PMS.

- Encaissement : 36 EUR, `pi_3UNZ5aQxlvbxDIrY1wUN1LY0`.
- Transfert : 36 EUR vers le compte de test de Jean Martin, `tr_3UNZ5aQxlvbxDIrY1WCjbqiG`.
- Restitutions successives : 5,01 EUR, 10 EUR, puis 20,99 EUR.
- Chaque récupération est appelée deux fois : trois preuves seulement, total exact de 36 EUR, transfert entièrement récupéré à la fin.

| Montant | Remboursement Stripe | Récupération Connect |
| --- | --- | --- |
| 5,01 EUR | `re_3UNZ5aQxlvbxDIrY1UEXTcVH` | `trr_1UNZ5eQxlvbxDIrYXDOH6VKn` |
| 10 EUR | `re_3UNZ5aQxlvbxDIrY1imMXuMS` | `trr_1UNZ5iQxlvbxDIrYfWFq8xIR` |
| 20,99 EUR | `re_3UNZ5aQxlvbxDIrY1xemAOOG` | `trr_1UNZ5lQxlvbxDIrYlemRoknT` |

Le service contrôle le transfert, la destination, la devise, les métadonnées et les restitutions antérieures. Une preuve existante est reprise sans émettre un second mouvement. Une récupération externe inconnue ou une preuve contradictoire bloque la suite.

## Limites

Cette succession partielle est autorisée uniquement lorsque la commission du reversement est nulle. Une commission non nulle exige encore un remboursement complet ou un rapprochement spécifique ; aucun prorata contractuel n'est inventé. Les incidents après sortie des fonds vers une banque et les bénéficiaires société restent à recetter.

Rapport local détaillé : `/private/tmp/baitly-partial-recovery-network.txt`. Cet essai n'atteste ni la production, ni une prestation réelle, ni l'arrivée des fonds sur un compte bancaire.
