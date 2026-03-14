package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Cycle de vie d'une depense prestataire.
 * DRAFT -> APPROVED -> INCLUDED (dans un payout) -> PAID
 */
public enum ExpenseStatus {
    DRAFT,
    APPROVED,
    INCLUDED,
    PAID,
    CANCELLED;

    @JsonValue
    public String toValue() {
        return name();
    }
}
