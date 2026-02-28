package com.clenzy.fiscal;

import java.math.BigDecimal;

/**
 * Resultat du calcul de la taxe de sejour / municipality fee.
 *
 * @param amount           Montant total de la taxe de sejour
 * @param description      Description lisible (ex: "Taxe de sejour: 2 pers x 3 nuits x 1.50 EUR")
 * @param perPersonPerNight Montant par personne par nuit (si applicable)
 */
public record TouristTaxResult(
    BigDecimal amount,
    String description,
    BigDecimal perPersonPerNight
) {
    public static TouristTaxResult zero() {
        return new TouristTaxResult(BigDecimal.ZERO, "Non applicable", BigDecimal.ZERO);
    }
}
