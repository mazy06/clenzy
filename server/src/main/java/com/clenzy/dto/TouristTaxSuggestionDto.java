package com.clenzy.dto;

import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;

import java.math.BigDecimal;

/**
 * Bareme de taxe de sejour PROPOSE pour un logement (France ou Maroc). Une suggestion,
 * jamais une valeur imposee : l'operateur declare et confirme le montant a la creation du
 * logement. {@code exact = false} signale une fourchette legale (le tarif communal n'est
 * pas connu) ; {@code verified = false} une source qui reste a confirmer aupres de la commune.
 */
public record TouristTaxSuggestionDto(
        String countryCode,
        String communeCode,
        String communeName,
        String category,
        TaxCalculationMode calculationMode,
        BigDecimal ratePerPerson,
        /** Fraction (0.05 = 5 %). */
        BigDecimal percentageRate,
        BigDecimal capPerPersonNight,
        BigDecimal departmentalSurchargePct,
        BigDecimal regionalSurchargePct,
        /** Age en dessous duquel les enfants sont exoneres (France 18, Maroc 12). */
        int childrenExemptUnder,
        BigDecimal minRate,
        BigDecimal maxRate,
        boolean exact,
        boolean verified,
        /** La plateforme qui encaisse collecte-t-elle la taxe dans ce pays ? */
        boolean platformsCollect,
        String currency,
        String sourceLabel,
        String sourceUrl
) {
}
