package com.clenzy.model;

public enum ContactPriority {
    BASSE("Basse"),
    MOYENNE("Moyenne"),
    HAUTE("Haute"),
    URGENTE("Urgente");
    
    private final String label;
    
    ContactPriority(String label) {
        this.label = label;
    }
    
    public String getLabel() {
        return label;
    }
}
