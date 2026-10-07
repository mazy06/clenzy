/**
 * Reversements Baitly : encaissements prouvés et journal durable des transferts.
 *
 * <p>Le revenu contractuel ne constitue pas une preuve de trésorerie. Un séjour est
 * attribué à la période de son départ, après son départ dans le fuseau du logement,
 * avec un paiement PMS confirmé dont les transactions CHECKOUT couvrent exactement
 * le prix et la devise du séjour. Le booking engine peut fournir un acompte et un
 * solde. Annulation, remboursement, source externe ou montant ambigu imposent un
 * rapprochement. Les fonds collectés par une OTA, un propriétaire ou une conciergerie
 * ne deviennent jamais automatiquement des fonds collectés par la plateforme.</p>
 *
 * <p>Une réservation ne peut financer qu'un reversement : verrou propriétaire dans
 * l'organisation puis contrainte unique en base. Les références d'encaissement sont
 * figées et recontrôlées à l'approbation et avant exécution. Les anciens reversements
 * restent consultables et inchangés ; aucun historique n'est déclaré financé ni
 * réémis automatiquement. Une attribution annulée n'est pas libérée automatiquement
 * tant que l'absence de mouvement d'argent n'est pas rapprochée.</p>
 *
 * <p>Le journal commun fige organisation, bénéficiaire, montant, devise, destination
 * et référence métier avant émission Stripe. Sa contrainte unique arbitre les appels
 * concurrents. Un transfert connu est rejoué localement, sans requête PSP ; un résultat
 * incertain bloque toute nouvelle émission. Les événements sont append-only en base.
 * Les anciens transferts sont conservés comme éléments à rapprocher, sans supposer
 * que le compte destinataire actuel était leur compte d'origine.</p>
 *
 * <p>Les prestations de tous les métiers du catalogue, y compris la marketplace,
 * suivent les mêmes contrôles : mission terminée, encaissement Stripe complet en EUR,
 * preuve de réalisation et compte bénéficiaire prêt. La commission provient de leur
 * catégorie. L'accès au compte d'un prestataire inter-organisations est en lecture seule,
 * lié à une mission achevée et payée ; les écritures restent dans l'organisation du compte.</p>
 *
 * <p>Une organisation prestataire peut recevoir le versement d'une mission réalisée
 * par son équipe. Le staff plateforme désigne explicitement cette organisation depuis
 * la fiche d'intervention ; la décision conserve son auteur et l'affectation d'origine.
 * La sélection et la préparation partagent un verrou en base. Le bénéficiaire, personnel
 * ou organisation, est ensuite immuable dans l'ordre et le journal. Une réaffectation
 * suspend le circuit pour rapprochement. Une équipe personnelle peut désigner son
 * utilisateur unique ; une équipe collective n'entraîne jamais le paiement d'un membre
 * arbitraire. La préparation attend le commit de la fin de mission. Les propositions
 * de relance de la constellation résolvent ce même bénéficiaire et son compte,
 * pour les personnes comme pour les organisations prestataires.</p>
 *
 * <p>Avant une nouvelle émission, le solde Stripe disponible de la plateforme est
 * vérifié dans la devise et la source CARD utilisées par le transfert. Les fonds
 * pending, réservés ou dans une autre devise ne sont pas utilisés. Ce précontrôle
 * ne réserve pas le solde : Stripe reste l'arbitre des dépenses concurrentes.
 * Un refus avant émission laisse une relance possible ; une réponse incertaine
 * après émission impose toujours un rapprochement. Le rejeu d'un transfert connu
 * est purement local, même si le solde disponible est maintenant nul.</p>
 *
 * <p>La réponse Stripe conserve destination_payment et livemode, immuables.
 * Les événements bancaires signés des comptes connectés sont relus sous le bon
 * Stripe-Account, hors transaction, puis enregistrés de façon append-only.
 * Le détail GET /api/accounting/payout-transfers/{id} expose bankPayouts uniquement
 * après rapprochement exact compte/mode/source/montant/devise. Il ne divulgue
 * jamais le montant global du virement ni les autres recettes du compte connecté.
 * La liste vide signifie non rapproché, jamais reçu en banque. PAID correspond à
 * une disponibilité annoncée par Stripe ; la date d'arrivée est estimée, sans
 * constituer une preuve de relevé bancaire. Un FAILED tardif prévaut sur PAID.</p>
 *
 * <p>Déploiement : appliquer 0497 via Liquibase/CI-CD et vérifier que l'endpoint
 * Connect signé reçoit payout.created, payout.updated, payout.paid, payout.failed,
 * payout.canceled et payout.reconciliation_completed. Une erreur de lecture PSP
 * ou de stockage renvoie 500 pour relivraison. Les transactions d'un virement
 * automatique sont paginées (maximum 10 000, au-delà : rapprochement requis),
 * uniquement quand reconciliation_status=completed. Les virements manuels,
 * fractionnés non attribuables, frais ou conversions et les anciens transferts
 * sans preuve ne sont jamais rapprochés par simple proximité de date/montant.
 * Références : https://docs.stripe.com/api/events/types ;
 * https://docs.stripe.com/api/balance_transactions/list ;
 * https://docs.stripe.com/connect/payouts-connected-accounts.</p>
 *
 * <p>Limites : un transfert Connect ne prouve pas sa réception bancaire. Ce journal
 * ne débite pas les anciens wallets, dont les répartitions restent à rapprocher.
 * Restent à raccorder les encaissements de lots sans ventilation, les autres rails
 * de décaissement, les contrats PSP France/Maroc/Arabie saoudite, les récupérations,
 * l'écran de suivi bancaire et la reprise des événements manqués au-delà de la
 * fenêtre de relivraison Stripe.
 * Aucun montant MAD/SAR n'est réinterprété comme EUR. La réconciliation des résultats
 * incertains exige encore une procédure applicative dédiée, sans SQL manuel en production.</p>
 */
package com.clenzy.service.payout;
