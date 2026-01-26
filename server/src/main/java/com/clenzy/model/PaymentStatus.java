package com.clenzy.model;

public enum PaymentStatus {
    PENDING("En attente de paiement"),
    PROCESSING("Paiement en cours"),
    PAID("Payé"),
    FAILED("Échec du paiement"),
    REFUNDED("Remboursé"),
    CANCELLED("Annulé");
    
    private final String displayName;
    
    PaymentStatus(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public static PaymentStatus fromString(String status) {
        if (status == null) return null;
        
        for (PaymentStatus s : PaymentStatus.values()) {
            if (s.name().equals(status.toUpperCase())) {
                return s;
            }
        }
        throw new IllegalArgumentException("Statut de paiement invalide: " + status);
    }
}
