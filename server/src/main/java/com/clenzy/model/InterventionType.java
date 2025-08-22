package com.clenzy.model;

/**
 * Types d'intervention disponibles dans le système
 * Cette énumération doit être synchronisée avec le frontend TypeScript
 */
public enum InterventionType {
    // Nettoyage
    CLEANING("Nettoyage"),
    EXPRESS_CLEANING("Nettoyage Express"),
    DEEP_CLEANING("Nettoyage en Profondeur"),
    WINDOW_CLEANING("Nettoyage des Vitres"),
    FLOOR_CLEANING("Nettoyage des Sols"),
    KITCHEN_CLEANING("Nettoyage de la Cuisine"),
    BATHROOM_CLEANING("Nettoyage des Sanitaires"),
    
    // Maintenance et réparation
    PREVENTIVE_MAINTENANCE("Maintenance Préventive"),
    EMERGENCY_REPAIR("Réparation d'Urgence"),
    ELECTRICAL_REPAIR("Réparation Électrique"),
    PLUMBING_REPAIR("Réparation Plomberie"),
    HVAC_REPAIR("Réparation Climatisation"),
    APPLIANCE_REPAIR("Réparation Électroménager"),
    
    // Services spécialisés
    GARDENING("Jardinage"),
    EXTERIOR_CLEANING("Nettoyage Extérieur"),
    PEST_CONTROL("Désinsectisation"),
    DISINFECTION("Désinfection"),
    RESTORATION("Remise en État"),
    
    // Autre
    OTHER("Autre");

    private final String displayName;

    InterventionType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    /**
     * Obtenir le type d'intervention à partir de sa valeur string
     */
    public static InterventionType fromString(String value) {
        if (value == null) {
            return null;
        }
        
        try {
            return InterventionType.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            // Si la valeur n'existe pas, retourner OTHER par défaut
            return OTHER;
        }
    }

    /**
     * Vérifier si c'est un type de nettoyage
     */
    public boolean isCleaning() {
        return this == CLEANING || 
               this == EXPRESS_CLEANING || 
               this == DEEP_CLEANING || 
               this == WINDOW_CLEANING || 
               this == FLOOR_CLEANING || 
               this == KITCHEN_CLEANING || 
               this == BATHROOM_CLEANING;
    }

    /**
     * Vérifier si c'est un type de maintenance
     */
    public boolean isMaintenance() {
        return this == PREVENTIVE_MAINTENANCE || 
               this == EMERGENCY_REPAIR || 
               this == ELECTRICAL_REPAIR || 
               this == PLUMBING_REPAIR || 
               this == HVAC_REPAIR || 
               this == APPLIANCE_REPAIR;
    }

    /**
     * Vérifier si c'est un type spécialisé
     */
    public boolean isSpecialized() {
        return this == GARDENING || 
               this == EXTERIOR_CLEANING || 
               this == PEST_CONTROL || 
               this == DISINFECTION || 
               this == RESTORATION;
    }

    /**
     * Obtenir la catégorie du type d'intervention
     */
    public String getCategory() {
        if (isCleaning()) {
            return "cleaning";
        } else if (isMaintenance()) {
            return "maintenance";
        } else if (isSpecialized()) {
            return "specialized";
        } else {
            return "other";
        }
    }

    @Override
    public String toString() {
        return this.name();
    }
}


