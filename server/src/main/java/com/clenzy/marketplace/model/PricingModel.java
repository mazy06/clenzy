package com.clenzy.marketplace.model;

/**
 * Modele de prix d'une prestation.
 *
 * <p>{@link #ON_QUOTE} laisse le montant vide a dessein : tout ne se tarife pas
 * d'avance, et forcer un chiffre afficherait un prix faux plutot qu'absent.</p>
 */
public enum PricingModel {
    /** Taux horaire. */
    HOURLY,
    /** Forfait pour la prestation entiere. */
    FLAT,
    /** Prix a l'unite (piece, kilo de linge, trajet...) — voir {@code unitLabel}. */
    PER_UNIT,
    /** Prix au metre carre. */
    PER_SQM,
    /** Sur devis : aucun montant affiche. */
    ON_QUOTE;

    /** true si ce modele attend un montant. */
    public boolean requiresAmount() {
        return this != ON_QUOTE;
    }
}
