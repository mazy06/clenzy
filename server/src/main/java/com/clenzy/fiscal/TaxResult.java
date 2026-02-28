package com.clenzy.fiscal;

import java.math.BigDecimal;

/**
 * Resultat d'un calcul de taxe.
 *
 * @param amountHT    Montant hors taxe
 * @param taxAmount   Montant de la taxe
 * @param amountTTC   Montant toutes taxes comprises (amountHT + taxAmount)
 * @param taxRate     Taux de taxe applique (ex: 0.1000 pour 10%)
 * @param taxName     Nom de la taxe (ex: "TVA hebergement")
 * @param taxCategory Categorie de taxation
 */
public record TaxResult(
    BigDecimal amountHT,
    BigDecimal taxAmount,
    BigDecimal amountTTC,
    BigDecimal taxRate,
    String taxName,
    String taxCategory
) {
    public TaxResult {
        if (amountHT == null) throw new IllegalArgumentException("amountHT must not be null");
        if (taxAmount == null) throw new IllegalArgumentException("taxAmount must not be null");
        if (amountTTC == null) throw new IllegalArgumentException("amountTTC must not be null");
    }
}
