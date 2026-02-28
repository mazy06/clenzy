package com.clenzy.fiscal;

import java.math.BigDecimal;

/**
 * Donnees d'entree pour le calcul de la taxe de sejour / municipality fee.
 *
 * @param nightlyRate    Tarif par nuit (pour les taxes en pourcentage)
 * @param guests         Nombre d'adultes
 * @param nights         Nombre de nuitees
 * @param childrenUnder  Age en dessous duquel les enfants sont exoneres
 * @param ratePerPerson  Taux par personne par nuit (France: fixe par commune)
 * @param percentageRate Taux en pourcentage du tarif (Saudi: ~5%)
 */
public record TouristTaxInput(
    BigDecimal nightlyRate,
    int guests,
    int nights,
    int childrenUnder,
    BigDecimal ratePerPerson,
    BigDecimal percentageRate
) {
    public TouristTaxInput {
        if (guests < 0) throw new IllegalArgumentException("guests must be >= 0");
        if (nights < 0) throw new IllegalArgumentException("nights must be >= 0");
    }

    /**
     * Constructeur simplifie pour les cas avec taux par personne (France).
     */
    public static TouristTaxInput perPerson(BigDecimal nightlyRate, int guests, int nights,
                                             int childrenUnder, BigDecimal ratePerPerson) {
        return new TouristTaxInput(nightlyRate, guests, nights, childrenUnder, ratePerPerson, BigDecimal.ZERO);
    }

    /**
     * Constructeur simplifie pour les cas avec pourcentage (Saudi Arabia).
     */
    public static TouristTaxInput percentage(BigDecimal nightlyRate, int guests, int nights,
                                              BigDecimal percentageRate) {
        return new TouristTaxInput(nightlyRate, guests, nights, 0, BigDecimal.ZERO, percentageRate);
    }
}
