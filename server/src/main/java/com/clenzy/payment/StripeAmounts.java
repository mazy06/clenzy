package com.clenzy.payment;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Conversion des montants vers les plus petites unites Stripe (T-BP-05 / Z3-BUGS-09).
 *
 * <p>Point unique de conversion euros (ou devise 2 decimales) → centimes :
 * arrondi explicite {@link RoundingMode#HALF_UP} (au lieu d'une troncature
 * silencieuse via {@code longValue()}) et {@code longValueExact()} qui echoue
 * bruyamment en cas d'overflow plutot que de corrompre le montant.</p>
 *
 * <p>Toutes les devises facturees par Clenzy via Stripe (EUR, USD, GBP, MAD,
 * SAR...) sont des devises a 2 decimales. Les devises sans decimales (JPY...)
 * ne sont pas supportees par ce helper.</p>
 */
public final class StripeAmounts {

    /** Sous-unites par unite majeure pour une devise a 2 decimales (1 EUR = 100 cts). */
    public static final BigDecimal MINOR_UNITS_PER_MAJOR_UNIT = BigDecimal.valueOf(100);

    private StripeAmounts() {
        // Utility class
    }

    /**
     * Convertit un montant en unites majeures (euros) vers les plus petites
     * unites Stripe (centimes), avec arrondi HALF_UP au centime.
     *
     * @throws ArithmeticException si le resultat depasse la capacite d'un long
     * @throws NullPointerException si {@code amount} est null
     */
    public static long toMinorUnits(BigDecimal amount) {
        return amount.multiply(MINOR_UNITS_PER_MAJOR_UNIT)
            .setScale(0, RoundingMode.HALF_UP)
            .longValueExact();
    }
}
