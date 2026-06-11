package com.clenzy.payment;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Contrat de conversion euros → centimes (T-BP-05 / Z3-BUGS-09) :
 * arrondi HALF_UP explicite (jamais de troncature) et echec bruyant en cas
 * d'overflow. Ce contrat est partage par StripeService et StripePaymentProvider.
 */
class StripeAmountsTest {

    @Test
    @DisplayName("montant a 2 decimales exact : conversion directe en centimes")
    void whenAmountHasTwoDecimals_thenConvertsExactly() {
        assertThat(StripeAmounts.toMinorUnits(new BigDecimal("10.00"))).isEqualTo(1000L);
        assertThat(StripeAmounts.toMinorUnits(new BigDecimal("0.01"))).isEqualTo(1L);
        assertThat(StripeAmounts.toMinorUnits(new BigDecimal("129.99"))).isEqualTo(12999L);
    }

    @Test
    @DisplayName("fraction de centime : arrondi HALF_UP au lieu d'une troncature")
    void whenAmountHasSubCentFraction_thenRoundsHalfUp() {
        // L'ancien pattern multiply(100).longValue() tronquait 10.005 → 1000.
        assertThat(StripeAmounts.toMinorUnits(new BigDecimal("10.005"))).isEqualTo(1001L);
        assertThat(StripeAmounts.toMinorUnits(new BigDecimal("10.004"))).isEqualTo(1000L);
        assertThat(StripeAmounts.toMinorUnits(new BigDecimal("0.999"))).isEqualTo(100L);
    }

    @Test
    @DisplayName("overflow long : ArithmeticException au lieu d'un montant corrompu")
    void whenAmountOverflowsLong_thenThrowsArithmeticException() {
        BigDecimal overflow = new BigDecimal(Long.MAX_VALUE);
        assertThatThrownBy(() -> StripeAmounts.toMinorUnits(overflow))
            .isInstanceOf(ArithmeticException.class);
    }

    @Test
    @DisplayName("montant null : NullPointerException explicite")
    void whenAmountIsNull_thenThrowsNullPointerException() {
        assertThatThrownBy(() -> StripeAmounts.toMinorUnits(null))
            .isInstanceOf(NullPointerException.class);
    }
}
