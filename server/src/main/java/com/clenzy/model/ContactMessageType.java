package com.clenzy.model;

public enum ContactMessageType {
    QUESTION_FACTURATION("Question facturation"),
    DEMANDE_ADMINISTRATIVE("Demande administrative"),
    CLARIFICATION_CONTRAT("Clarification contrat"),
    QUESTION_PORTEFEUILLE("Question portefeuille"),
    SUGGESTION("Suggestion"),
    PROBLEME_COMMUNICATION("Problème de communication"),
    DEMANDE_RENDEZ_VOUS("Demande de rendez-vous"),
    REMARQUE_FEEDBACK("Remarque/Feedback"),
    QUESTION_GENERALE("Question générale");
    
    private final String label;
    
    ContactMessageType(String label) {
        this.label = label;
    }
    
    public String getLabel() {
        return label;
    }
}
