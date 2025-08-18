package com.clenzy.model;

/**
 * Énumération des statuts utilisateur dans la plateforme Clenzy
 */
public enum UserStatus {
    
    /**
     * Utilisateur actif et pouvant utiliser la plateforme
     */
    ACTIVE("Actif", "Utilisateur actif et pouvant utiliser la plateforme"),
    
    /**
     * Compte en attente de vérification (email, téléphone)
     */
    PENDING_VERIFICATION("En attente de vérification", "Compte en attente de vérification"),
    
    /**
     * Compte suspendu temporairement
     */
    SUSPENDED("Suspendu", "Compte suspendu temporairement"),
    
    /**
     * Compte désactivé par l'utilisateur
     */
    INACTIVE("Inactif", "Compte désactivé par l'utilisateur"),
    
    /**
     * Compte bloqué pour violation des conditions
     */
    BLOCKED("Bloqué", "Compte bloqué pour violation des conditions"),
    
    /**
     * Compte supprimé définitivement
     */
    DELETED("Supprimé", "Compte supprimé définitivement");
    
    private final String displayName;
    private final String description;
    
    UserStatus(String displayName, String description) {
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
     * Vérifie si le statut permet l'accès à la plateforme
     */
    public boolean canAccessPlatform() {
        return this == ACTIVE;
    }
    
    /**
     * Vérifie si le statut nécessite une action de l'utilisateur
     */
    public boolean requiresUserAction() {
        return this == PENDING_VERIFICATION;
    }
    
    /**
     * Vérifie si le statut nécessite une intervention administrative
     */
    public boolean requiresAdminAction() {
        return this == SUSPENDED || this == BLOCKED;
    }
    
    /**
     * Vérifie si le statut est réversible
     */
    public boolean isReversible() {
        return this == SUSPENDED || this == INACTIVE || this == PENDING_VERIFICATION;
    }
    
    /**
     * Vérifie si le statut est définitif
     */
    public boolean isPermanent() {
        return this == DELETED;
    }
    
    @Override
    public String toString() {
        return displayName;
    }
}
