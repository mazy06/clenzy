package com.clenzy.model;

/**
 * Énumération des rôles utilisateur dans la plateforme Clenzy
 */
public enum UserRole {
    
    /**
     * Hôte Airbnb - Propriétaire de logements
     */
    HOST("Hôte", "Propriétaire de logements Airbnb"),
    
    /**
     * Technicien - Intervient pour la maintenance et réparations
     */
    TECHNICIAN("Technicien", "Intervient pour la maintenance et réparations"),
    
    /**
     * Housekeeper - Effectue le nettoyage des logements
     */
    HOUSEKEEPER("Housekeeper", "Effectue le nettoyage des logements"),
    
    /**
     * Superviseur - Gère une équipe de techniciens/housekeepers
     */
    SUPERVISOR("Superviseur", "Gère une équipe de techniciens/housekeepers"),
    
    /**
     * Administrateur - Accès complet à la plateforme
     */
    ADMIN("Administrateur", "Accès complet à la plateforme"),
    
    /**
     * Manager - Gestion des opérations et des équipes
     */
    MANAGER("Manager", "Gestion des opérations et des équipes");
    
    private final String displayName;
    private final String description;
    
    UserRole(String displayName, String description) {
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
     * Vérifie si le rôle a des permissions d'administration
     */
    public boolean isAdminRole() {
        return this == ADMIN || this == MANAGER;
    }
    
    /**
     * Vérifie si le rôle peut gérer des équipes
     */
    public boolean canManageTeams() {
        return this == ADMIN || this == MANAGER || this == SUPERVISOR;
    }
    
    /**
     * Vérifie si le rôle peut créer des interventions
     */
    public boolean canCreateInterventions() {
        return this == ADMIN || this == MANAGER || this == SUPERVISOR || this == TECHNICIAN;
    }
    
    /**
     * Vérifie si le rôle peut voir les rapports financiers
     */
    public boolean canViewFinancialReports() {
        return this == ADMIN || this == MANAGER;
    }
    
    @Override
    public String toString() {
        return displayName;
    }
}
