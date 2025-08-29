package com.clenzy.model;

public enum ContactStatus {
    OUVERT("Ouvert"),
    EN_COURS("En cours"),
    RESOLU("Résolu"),
    FERME("Fermé");
    
    private final String label;
    
    ContactStatus(String label) {
        this.label = label;
    }
    
    public String getLabel() {
        return label;
    }
}
