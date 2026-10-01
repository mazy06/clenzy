package com.clenzy.model;

/**
 * Cycle de vie d'une caution / dépôt de garantie (Phase 4 différenciation).
 *
 * <p>Transitions par UPDATE conditionnel (CAS, audit #8), jamais check-then-act :
 * <pre>
 *   PENDING ──► HELD ──► RELEASED            (rendue, aucun dommage — ou hold échu après la fenêtre)
 *      │         │ ├──► CAPTURED             (encaissée pour dommages, partielle ou totale)
 *      │         │ └──► EXPIRED              (hold échu chez Stripe PENDANT la fenêtre de réclamation)
 *      │         └─ renouvellement ─► HELD   (nouveau PaymentIntent, externalRef/holdExpiresAt mis à jour)
 *      └────► FAILED ──► HELD                (nouvelle tentative depuis le PMS)
 * </pre>
 * Le hold est posé le jour de l'arrivée ({@link com.clenzy.service.SecurityDepositHoldPolicy}),
 * pas à la réservation : une autorisation carte en ligne n'est valable que 4 j 18 h à 7 j.
 * Cette machine à états est le journal autoritatif de l'effet Stripe.</p>
 */
public enum SecurityDepositStatus {
    /** Créée, carte enregistrée : pré-autorisation pas encore placée (attend le jour de l'arrivée). */
    PENDING,
    /** Pré-autorisation placée — fonds bloqués chez le PSP jusqu'à {@code holdExpiresAt}. */
    HELD,
    /** Hold relâché, caution rendue au voyageur. */
    RELEASED,
    /** Tout ou partie encaissé pour dommages. */
    CAPTURED,
    /** Pré-autorisation refusée (carte refusée, authentification requise…) — voir {@code holdError}. */
    FAILED,
    /** Hold échu chez Stripe avant la fin de la fenêtre de réclamation : plus aucune garantie. */
    EXPIRED
}
