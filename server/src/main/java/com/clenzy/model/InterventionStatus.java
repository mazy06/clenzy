package com.clenzy.model;

public enum InterventionStatus {
    PENDING("En attente"),
    IN_PROGRESS("En cours"),
    COMPLETED("Terminé"),
    CANCELLED("Annulé");
    
    private final String displayName;
    
    InterventionStatus(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public static InterventionStatus fromString(String status) {
        if (status == null) return null;
        
        for (InterventionStatus s : InterventionStatus.values()) {
            if (s.name().equals(status.toUpperCase())) {
                return s;
            }
        }
        throw new IllegalArgumentException("Statut invalide: " + status);
    }
}


