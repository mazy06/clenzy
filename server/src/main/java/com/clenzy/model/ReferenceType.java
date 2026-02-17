package com.clenzy.model;

/**
 * Type de reference pour la generation de documents.
 * Indique l'entite source utilisee pour resoudre les tags.
 */
public enum ReferenceType {
    INTERVENTION("Intervention"),
    SERVICE_REQUEST("Demande de service"),
    PROPERTY("Bien immobilier"),
    USER("Utilisateur");

    private final String label;

    ReferenceType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
