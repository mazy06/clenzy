package com.clenzy.model;

public enum TeamRole {
    TECHNICIAN("Technicien"),
    HOUSEKEEPER("Agent de ménage"),
    SUPERVISOR("Superviseur"),
    LAUNDRY("Blanchisserie"),
    EXTERIOR_TECH("Tech. Extérieur"),
    LEADER("Chef d'équipe");
    
    private final String label;
    
    TeamRole(String label) {
        this.label = label;
    }
    
    public String getLabel() {
        return label;
    }
}
