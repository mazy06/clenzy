package com.clenzy.model;

/**
 * Cycle de vie d'une caution / dépôt de garantie (Phase 4 différenciation).
 *
 * <p>Transitions par UPDATE conditionnel (CAS, audit #8), jamais check-then-act :
 * <pre>
 *   PENDING ──► HELD ──► RELEASING ──► RELEASED (ménage validé sans anomalie, annulation confirmée par Stripe)
 *      │         │ ├──► CAPTURING ──► CAPTURED (capture manuelle confirmée par Stripe)
 *      │         │ └──► EXPIRED              (autorisation échue avant validation du logement)
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
    /** Libération réclamée durablement, référence du hold figée jusqu'au résultat Stripe. */
    RELEASING,
    /** Capture manuelle réclamée durablement ; jamais libérée automatiquement. */
    CAPTURING,
    /** Hold relâché, caution rendue au voyageur. */
    RELEASED,
    /** Tout ou partie encaissé pour dommages. */
    CAPTURED,
    /** Pré-autorisation refusée (carte refusée, authentification requise…) — voir {@code holdError}. */
    FAILED,
    /** Hold échu chez Stripe avant validation du logement : plus aucune garantie. */
    EXPIRED
}
