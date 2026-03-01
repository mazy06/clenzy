package com.clenzy.fiscal;

import java.math.BigDecimal;

/**
 * Element imposable soumis au calcul de taxe.
 *
 * @param amount      Montant HT de l'element
 * @param taxCategory Categorie de taxation (ACCOMMODATION, STANDARD, FOOD, etc.)
 * @param description Description de l'element pour la ligne de facture
 */
public record TaxableItem(
    BigDecimal amount,
    String taxCategory,
    String description
) {
    public TaxableItem {
        if (amount == null) throw new IllegalArgumentException("amount must not be null");
        if (taxCategory == null || taxCategory.isBlank()) throw new IllegalArgumentException("taxCategory must not be blank");
    }
}
