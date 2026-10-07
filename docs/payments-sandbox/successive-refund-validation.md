# Baitly : remboursements successifs et récupération du solde

Tranche locale du 6 octobre 2026, Stripe sandbox uniquement. JAR chargé : `4e90f5a692edaa7c9127aa7f6a688035b6de814e2f90d10a81a0109be140a58d`. La configuration Baitly est conservée et l'API répond HTTP 200.

## Périmètre chargé

Une prestation encaissée seule peut recevoir plusieurs restitutions choisies dans Finance. Chaque intention possède un UUID et une décision persistée ; une tentative ambiguë réserve son montant et empêche une autre demande. Le serveur verrouille l'encaissement et la mission, vérifie l'organisation, le montant, la devise, les restitutions antérieures et l'absence de litige. Il relit les preuves Stripe avant émission et refuse les preuves externes inconnues.

Le montant proposé est le solde restant, avec saisie possible d'un montant inférieur. Le suivi de la demande attend sa propre contre-écriture ; un ancien statut Partiellement remboursé ne vaut pas confirmation de la nouvelle restitution. Les répartitions en centimes sont monotones, les avoirs se rattachent séparément à la facture d'origine, et le financement du prestataire déduit chaque restitution confirmée et rapprochée.

## Recette Finance du dossier 332

Situation initiale : encaissement 51 de 35 EUR, remboursement externe 52 de 5 EUR, avoir FA2026-00023 de -5 EUR. Le solde de 30 EUR avait déjà été transféré à Jean Martin par `tr_1UNQQJQxlvbxDIrYbI1qzOdw`.

Depuis Finance, le dialogue propose exactement 30 EUR. Confirmation unique : transaction 56 / `REF-d3a1f8bd-3b90-47bd-b43f-f8726d584d02`, preuve Stripe `re_3UNNxGQxlvbxDIrY0vor9X3I` relue `succeeded`, montant 3 000 centimes EUR. La mission passe REFUNDED et disparaît du filtre Partiellement remboursé après rapprochement.

L'avoir 30 / FA2026-00027 porte -30 EUR TTC, -5 EUR de TVA, -25 EUR HT. Avec l'avoir précédent, le cumul est exactement -35 EUR TTC, -5,83 EUR de TVA et -29,17 EUR HT ; la facture d'origine reste PAID. Le nouveau journal contient trois paires équilibrées de contre-écritures, 59,70 EUR par sens. Ce total cumule encaissement et répartition ; le remboursement client de cette demande est bien de 30 EUR.

La récupération 1, rattachée au transfert 2 et au remboursement 56, passe RECOVERED : `trr_1UNTB6QxlvbxDIrYYSPvgVNK`. Stripe confirme `livemode=false`, un seul reversal, `amount_reversed=3000`, `reversed=true`, destination initiale Jean Martin `acct_1UNPNvJfs0WxjDsG`. Dans Versements > Suivi & rapprochement, le détail affiche « Fonds récupérés », 30 EUR et cette référence. Le transfert initial demeure dans l'historique. Aucun versement bancaire n'est inventé.

## Contrôles automatisés et limites

238 tests serveur réussis, dont persistance concurrente réelle, rollback, budget et isolation, preuve PSP, avoirs multi-taxes, journal et récupération. 15 tests interface réussis, contrôle TypeScript sans erreur. Les tests de répartition parcourent chaque centime de 100 jeux déterministes et vérifient la conservation ainsi que la monotonie de chaque ligne.

La restitution partielle d'une part de lot, les acomptes/solde de plusieurs encaissements, les nouvelles restitutions externes après une série et une récupération partielle après transfert restent à compléter. Après transfert, cette tranche autorise seulement la restitution intégrale du solde rapproché ; elle refuse les récupérations partielles ou les émissions incertaines. Les anciens avoirs dont la répartition diffère doivent être rapprochés, sans inventer une correction fiscale. Ce document ne certifie pas le circuit complet ni la production.
