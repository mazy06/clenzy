package com.clenzy.model;

/**
 * Statuts possibles pour une inscription en attente.
 */
public enum PendingInscriptionStatus {

    /**
     * En attente du paiement Stripe
     */
    PENDING_PAYMENT("En attente de paiement"),

    /**
     * Paiement confirme, activation du compte en cours
     */
    PAYMENT_CONFIRMED("Paiement confirme"),

    /**
     * Inscription finalisee (user cree dans Keycloak + DB)
     */
    COMPLETED("Terminee"),

    /**
     * Paiement echoue
     */
    PAYMENT_FAILED("Paiement echoue"),

    /**
     * Inscription expiree (non payee dans le delai)
     */
    EXPIRED("Expiree");

    private final String displayName;

    PendingInscriptionStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    @Override
    public String toString() {
        return displayName;
    }
}
