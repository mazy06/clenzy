package com.clenzy.dto;

import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;

import java.math.BigDecimal;

/**
 * Taxe de sejour DECLAREE par l'operateur a la creation d'un logement (France, Maroc).
 *
 * <p>Le referentiel ne fait que suggerer : un tarif communal peut changer, une fourchette
 * legale n'est pas un tarif. Le montant applique est celui que l'operateur saisit et
 * CONFIRME ({@code confirmed}). {@code noTax = true} declare explicitement l'absence de taxe
 * (commune qui ne l'a pas instituee) — jamais un oubli silencieux.</p>
 */
public record TouristTaxDeclarationDto(
        boolean noTax,
        TaxCalculationMode calculationMode,
        BigDecimal ratePerPerson,
        /** Fraction (0.05 = 5 %). */
        BigDecimal percentageRate,
        BigDecimal capPerPersonNight,
        BigDecimal departmentalSurchargePct,
        BigDecimal regionalSurchargePct,
        Integer childrenExemptUnder,
        boolean confirmed
) {
}
