package com.clenzy.fiscal;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class MoneyUtilsTest {

    @Nested
    class Round {
        @Test
        void shouldRoundToTwoDecimals() {
            assertThat(MoneyUtils.round(new BigDecimal("10.555"))).isEqualByComparingTo("10.56");
            assertThat(MoneyUtils.round(new BigDecimal("10.554"))).isEqualByComparingTo("10.55");
        }

        @Test
        void shouldHandleNull() {
            assertThat(MoneyUtils.round(null)).isEqualByComparingTo("0.00");
        }

        @Test
        void shouldHandleZero() {
            assertThat(MoneyUtils.round(BigDecimal.ZERO)).isEqualByComparingTo("0.00");
        }

        @Test
        void shouldHandleWholeNumbers() {
            assertThat(MoneyUtils.round(new BigDecimal("100"))).isEqualByComparingTo("100.00");
        }
    }

    @Nested
    class CalculateTaxAmount {
        @Test
        void shouldCalculate20PercentTax() {
            BigDecimal result = MoneyUtils.calculateTaxAmount(new BigDecimal("100.00"), new BigDecimal("0.20"));
            assertThat(result).isEqualByComparingTo("20.00");
        }

        @Test
        void shouldCalculate10PercentTax() {
            BigDecimal result = MoneyUtils.calculateTaxAmount(new BigDecimal("150.00"), new BigDecimal("0.10"));
            assertThat(result).isEqualByComparingTo("15.00");
        }

        @Test
        void shouldRoundTaxAmount() {
            BigDecimal result = MoneyUtils.calculateTaxAmount(new BigDecimal("33.33"), new BigDecimal("0.20"));
            assertThat(result).isEqualByComparingTo("6.67");
        }

        @Test
        void shouldReturnZeroForZeroRate() {
            BigDecimal result = MoneyUtils.calculateTaxAmount(new BigDecimal("100.00"), BigDecimal.ZERO);
            assertThat(result).isEqualByComparingTo("0.00");
        }
    }

    @Nested
    class CalculateTTC {
        @Test
        void shouldAddTaxToHT() {
            BigDecimal result = MoneyUtils.calculateTTC(new BigDecimal("100.00"), new BigDecimal("0.20"));
            assertThat(result).isEqualByComparingTo("120.00");
        }

        @Test
        void shouldHandleFranceAccommodationRate() {
            BigDecimal result = MoneyUtils.calculateTTC(new BigDecimal("200.00"), new BigDecimal("0.10"));
            assertThat(result).isEqualByComparingTo("220.00");
        }
    }

    @Nested
    class CalculateHT {
        @Test
        void shouldExtractHTFrom20Percent() {
            BigDecimal result = MoneyUtils.calculateHT(new BigDecimal("120.00"), new BigDecimal("0.20"));
            assertThat(result).isEqualByComparingTo("100.00");
        }

        @Test
        void shouldExtractHTFrom10Percent() {
            BigDecimal result = MoneyUtils.calculateHT(new BigDecimal("110.00"), new BigDecimal("0.10"));
            assertThat(result).isEqualByComparingTo("100.00");
        }
    }
}
