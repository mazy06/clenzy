package com.clenzy.model;

public enum OrganizationType {
    INDIVIDUAL("Particulier", "Hote individuel"),
    CONCIERGE("Conciergerie", "Service de conciergerie"),
    CLEANING_COMPANY("Societe de menage", "Societe de nettoyage"),
    SYSTEM("Systeme", "Organisation interne de la plateforme");

    private final String displayName;
    private final String description;

    OrganizationType(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
