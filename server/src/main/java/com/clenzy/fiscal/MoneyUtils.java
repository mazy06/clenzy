package com.clenzy.fiscal;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Utilitaires pour les calculs monetaires.
 * Centralise la politique d'arrondi pour toutes les devises supportees.
 *
 * Toutes les devises cibles (EUR, MAD, SAR) utilisent 2 decimales.
 */
public final class MoneyUtils {

    private static final int CURRENCY_SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    private MoneyUtils() {} // Utility class

    /**
     * Arrondit un montant a 2 decimales avec HALF_UP.
     */
    public static BigDecimal round(BigDecimal amount) {
        if (amount == null) return BigDecimal.ZERO;
        return amount.setScale(CURRENCY_SCALE, ROUNDING_MODE);
    }

    /**
     * Calcule le montant TTC a partir du HT et du taux de taxe.
     * TTC = HT + (HT * taux)
     */
    public static BigDecimal calculateTTC(BigDecimal amountHT, BigDecimal taxRate) {
        BigDecimal taxAmount = round(amountHT.multiply(taxRate));
        return round(amountHT.add(taxAmount));
    }

    /**
     * Calcule le montant de taxe a partir du HT et du taux.
     */
    public static BigDecimal calculateTaxAmount(BigDecimal amountHT, BigDecimal taxRate) {
        return round(amountHT.multiply(taxRate));
    }

    /**
     * Calcule le montant HT a partir du TTC et du taux de taxe.
     * HT = TTC / (1 + taux)
     */
    public static BigDecimal calculateHT(BigDecimal amountTTC, BigDecimal taxRate) {
        BigDecimal divisor = BigDecimal.ONE.add(taxRate);
        return round(amountTTC.divide(divisor, CURRENCY_SCALE + 4, ROUNDING_MODE));
    }
}
