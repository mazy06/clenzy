package com.clenzy.model;

/**
 * Statut d'un logement
 */
public enum PropertyStatus {
    ACTIVE("Actif"),
    INACTIVE("Inactif"),
    UNDER_MAINTENANCE("En maintenance"),
    ARCHIVED("Archivé");
    
    private final String displayName;
    
    PropertyStatus(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public static PropertyStatus fromString(String status) {
        if (status == null) return null;
        
        for (PropertyStatus s : PropertyStatus.values()) {
            if (s.name().equals(status.toUpperCase())) {
                return s;
            }
        }
        throw new IllegalArgumentException("Statut invalide: " + status);
    }
}


