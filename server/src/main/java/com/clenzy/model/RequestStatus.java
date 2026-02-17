package com.clenzy.model;

/**
 * Statut d'une demande de service
 */
public enum RequestStatus {
    PENDING("En attente"),
    APPROVED("Approuvé"),
    DEVIS_ACCEPTED("Devis accepté"),
    IN_PROGRESS("En cours"),
    COMPLETED("Terminé"),
    CANCELLED("Annulé"),
    REJECTED("Rejeté");
    
    private final String displayName;
    
    RequestStatus(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public static RequestStatus fromString(String status) {
        if (status == null) return null;
        
        for (RequestStatus s : RequestStatus.values()) {
            if (s.name().equals(status.toUpperCase())) {
                return s;
            }
        }
        throw new IllegalArgumentException("Statut invalide: " + status);
    }
}


