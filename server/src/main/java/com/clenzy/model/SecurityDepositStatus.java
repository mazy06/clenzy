package com.clenzy.model;

/**
 * Cycle de vie d'une caution / dépôt de garantie (Phase 4 différenciation).
 *
 * <p>Transitions par UPDATE conditionnel (CAS, audit #8), jamais check-then-act :
 * <pre>
 *   PENDING ──► HELD ──► RELEASED            (rendue, aucun dommage)
 *      │         └────► CAPTURED             (encaissée pour dommages, partielle ou totale)
 *      └────► FAILED                         (pré-autorisation échouée)
 * </pre>
 * Le hold / capture / release réel côté Stripe (pré-autorisation manuelle) est l'effet externe
 * différé (HP) ; cette machine à états en est le journal autoritatif.</p>
 */
public enum SecurityDepositStatus {
    /** Créée, pré-autorisation pas encore placée. */
    PENDING,
    /** Pré-autorisation placée — fonds bloqués chez le PSP. */
    HELD,
    /** Hold relâché, caution rendue au voyageur. */
    RELEASED,
    /** Tout ou partie encaissé pour dommages. */
    CAPTURED,
    /** Pré-autorisation échouée (carte refusée, expirée…). */
    FAILED
}
