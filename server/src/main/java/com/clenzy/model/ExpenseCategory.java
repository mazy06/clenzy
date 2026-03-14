package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Categories de depenses prestataires.
 */
public enum ExpenseCategory {
    CLEANING("Menage"),
    MAINTENANCE("Maintenance"),
    LAUNDRY("Blanchisserie"),
    SUPPLIES("Fournitures"),
    LANDSCAPING("Exterieur"),
    OTHER("Autre");

    private final String label;

    ExpenseCategory(String label) {
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
