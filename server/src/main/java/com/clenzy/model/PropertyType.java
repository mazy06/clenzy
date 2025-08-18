package com.clenzy.model;

/**
 * Énumération des types de logements dans la plateforme Clenzy
 */
public enum PropertyType {
    
    /**
     * Appartement
     */
    APARTMENT("Appartement", "Appartement en immeuble ou résidence"),
    
    /**
     * Maison individuelle
     */
    HOUSE("Maison", "Maison individuelle avec jardin"),
    
    /**
     * Studio
     */
    STUDIO("Studio", "Studio ou studio mezzanine"),
    
    /**
     * Villa
     */
    VILLA("Villa", "Villa avec piscine et jardin"),
    
    /**
     * Loft
     */
    LOFT("Loft", "Loft ou espace ouvert"),
    
    /**
     * Chambre d'hôte
     */
    GUEST_ROOM("Chambre d'hôte", "Chambre dans une maison d'hôte"),
    
    /**
     * Gîte rural
     */
    COTTAGE("Gîte rural", "Gîte ou maison de campagne"),
    
    /**
     * Chalet
     */
    CHALET("Chalet", "Chalet de montagne"),
    
    /**
     * Bateau
     */
    BOAT("Bateau", "Bateau aménagé ou péniche"),
    
    /**
     * Autre
     */
    OTHER("Autre", "Autre type de logement");
    
    private final String displayName;
    private final String description;
    
    PropertyType(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public String getDescription() {
        return description;
    }
    
    /**
     * Vérifie si le type nécessite un nettoyage extérieur
     */
    public boolean requiresExteriorCleaning() {
        return this == HOUSE || this == VILLA || this == COTTAGE || this == CHALET;
    }
    
    /**
     * Vérifie si le type nécessite une maintenance spécifique
     */
    public boolean requiresSpecificMaintenance() {
        return this == BOAT || this == CHALET;
    }
    
    /**
     * Vérifie si le type est adapté aux familles
     */
    public boolean isFamilyFriendly() {
        return this == HOUSE || this == VILLA || this == COTTAGE || this == CHALET;
    }
    
    /**
     * Vérifie si le type est urbain
     */
    public boolean isUrban() {
        return this == APARTMENT || this == STUDIO || this == LOFT;
    }
    
    @Override
    public String toString() {
        return displayName;
    }
}
