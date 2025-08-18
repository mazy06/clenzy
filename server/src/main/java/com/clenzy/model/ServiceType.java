package com.clenzy.model;

/**
 * Énumération des types de services proposés par Clenzy
 */
public enum ServiceType {
    
    /**
     * Nettoyage complet du logement
     */
    CLEANING("Nettoyage", "Nettoyage complet du logement après départ des voyageurs", 2.0),
    
    /**
     * Nettoyage express
     */
    EXPRESS_CLEANING("Nettoyage Express", "Nettoyage rapide entre deux séjours", 1.0),
    
    /**
     * Nettoyage en profondeur
     */
    DEEP_CLEANING("Nettoyage en Profondeur", "Nettoyage approfondi et désinfection", 4.0),
    
    /**
     * Nettoyage des vitres
     */
    WINDOW_CLEANING("Nettoyage des Vitres", "Nettoyage intérieur et extérieur des vitres", 1.5),
    
    /**
     * Nettoyage des sols
     */
    FLOOR_CLEANING("Nettoyage des Sols", "Nettoyage et cirage des sols", 1.0),
    
    /**
     * Nettoyage de la cuisine
     */
    KITCHEN_CLEANING("Nettoyage de la Cuisine", "Nettoyage complet de la cuisine", 1.5),
    
    /**
     * Nettoyage des sanitaires
     */
    BATHROOM_CLEANING("Nettoyage des Sanitaires", "Nettoyage et désinfection des sanitaires", 1.0),
    
    /**
     * Maintenance préventive
     */
    PREVENTIVE_MAINTENANCE("Maintenance Préventive", "Vérification et entretien préventif", 2.0),
    
    /**
     * Réparation d'urgence
     */
    EMERGENCY_REPAIR("Réparation d'Urgence", "Intervention d'urgence pour panne", 3.0),
    
    /**
     * Réparation électrique
     */
    ELECTRICAL_REPAIR("Réparation Électrique", "Réparation des installations électriques", 2.5),
    
    /**
     * Réparation plomberie
     */
    PLUMBING_REPAIR("Réparation Plomberie", "Réparation des installations sanitaires", 2.5),
    
    /**
     * Réparation climatisation
     */
    HVAC_REPAIR("Réparation Climatisation", "Réparation chauffage, ventilation, climatisation", 3.0),
    
    /**
     * Réparation électroménager
     */
    APPLIANCE_REPAIR("Réparation Électroménager", "Réparation des appareils électroménagers", 2.0),
    
    /**
     * Jardinage et entretien extérieur
     */
    GARDENING("Jardinage", "Entretien du jardin et espaces extérieurs", 2.0),
    
    /**
     * Nettoyage extérieur
     */
    EXTERIOR_CLEANING("Nettoyage Extérieur", "Nettoyage des terrasses, balcons, façades", 2.5),
    
    /**
     * Désinsectisation
     */
    PEST_CONTROL("Désinsectisation", "Traitement contre les insectes et nuisibles", 1.5),
    
    /**
     * Désinfection
     */
    DISINFECTION("Désinfection", "Désinfection complète du logement", 2.0),
    
    /**
     * Remise en état
     */
    RESTORATION("Remise en État", "Remise en état complète du logement", 6.0),
    
    /**
     * Autre service
     */
    OTHER("Autre", "Service personnalisé selon vos besoins", 2.0);
    
    private final String displayName;
    private final String description;
    private final double estimatedHours;
    
    ServiceType(String displayName, String description, double estimatedHours) {
        this.displayName = displayName;
        this.description = description;
        this.estimatedHours = estimatedHours;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public String getDescription() {
        return description;
    }
    
    public double getEstimatedHours() {
        return estimatedHours;
    }
    
    /**
     * Vérifie si le service est de type nettoyage
     */
    public boolean isCleaningService() {
        return this == CLEANING || this == EXPRESS_CLEANING || this == DEEP_CLEANING ||
               this == WINDOW_CLEANING || this == FLOOR_CLEANING || this == KITCHEN_CLEANING ||
               this == BATHROOM_CLEANING || this == EXTERIOR_CLEANING || this == DISINFECTION;
    }
    
    /**
     * Vérifie si le service est de type maintenance
     */
    public boolean isMaintenanceService() {
        return this == PREVENTIVE_MAINTENANCE || this == EMERGENCY_REPAIR || this == ELECTRICAL_REPAIR ||
               this == PLUMBING_REPAIR || this == HVAC_REPAIR || this == APPLIANCE_REPAIR;
    }
    
    /**
     * Vérifie si le service nécessite des compétences techniques
     */
    public boolean requiresTechnicalSkills() {
        return this == EMERGENCY_REPAIR || this == ELECTRICAL_REPAIR || this == PLUMBING_REPAIR ||
               this == HVAC_REPAIR || this == APPLIANCE_REPAIR;
    }
    
    /**
     * Vérifie si le service peut être planifié à l'avance
     */
    public boolean isPlannable() {
        return this != EMERGENCY_REPAIR;
    }
    
    /**
     * Vérifie si le service nécessite des produits spécifiques
     */
    public boolean requiresSpecificProducts() {
        return this == DISINFECTION || this == PEST_CONTROL || this == DEEP_CLEANING;
    }
    
    @Override
    public String toString() {
        return displayName;
    }
}
