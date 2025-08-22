package com.clenzy.model;

/**
 * Niveaux de priorité pour les interventions et demandes de service
 */
public enum Priority {
    LOW("Basse"),
    NORMAL("Normale"),
    HIGH("Élevée"),
    CRITICAL("Critique");
    
    private final String displayName;
    
    Priority(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public static Priority fromString(String priority) {
        if (priority == null) return null;
        
        for (Priority p : Priority.values()) {
            if (p.name().equals(priority.toUpperCase())) {
                return p;
            }
        }
        throw new IllegalArgumentException("Priorité invalide: " + priority);
    }
}


