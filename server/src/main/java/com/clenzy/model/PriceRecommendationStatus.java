package com.clenzy.model;

/**
 * Cycle de vie d'une recommandation de prix (CLZ-P0-17).
 *
 * <p>Les transitions {@code PROPOSED → ACCEPTED/REJECTED} se font par UPDATE conditionnel (CAS),
 * jamais par check-then-act (audit #8) : voir
 * {@link com.clenzy.repository.PriceRecommendationRepository#transitionStatus}.</p>
 */
public enum PriceRecommendationStatus {
    /** Proposée par le moteur, en attente de décision. */
    PROPOSED,
    /** Acceptée par le gestionnaire — lisible par le PriceEngine (niveau AI_SUGGESTION). */
    ACCEPTED,
    /** Rejetée par le gestionnaire. */
    REJECTED,
    /** Périmée (la date de séjour est passée sans décision). */
    EXPIRED
}
