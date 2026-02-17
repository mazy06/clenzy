package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Types de documents generables par le moteur de templates.
 */
public enum DocumentType {
    DEVIS("Devis"),
    FACTURE("Facture"),
    MANDAT_GESTION("Mandat de gestion"),
    AUTORISATION_TRAVAUX("Autorisation de travaux"),
    BON_INTERVENTION("Bon d'intervention"),
    VALIDATION_FIN_MISSION("Validation fin de mission"),
    JUSTIFICATIF_PAIEMENT("Justificatif de paiement"),
    JUSTIFICATIF_REMBOURSEMENT("Justificatif de remboursement");

    private final String label;

    DocumentType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    @JsonValue
    public String toValue() {
        return name();
    }
}
