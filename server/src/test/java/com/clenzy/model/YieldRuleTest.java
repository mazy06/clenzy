package com.clenzy.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class YieldRuleTest {

    // ----------------------------------------------------------------
    // Helper
    // ----------------------------------------------------------------

    private YieldRule rule(String minPrice, String maxPrice) {
        var r = new YieldRule();
        r.setMinPrice(minPrice != null ? new BigDecimal(minPrice) : null);
        r.setMaxPrice(maxPrice != null ? new BigDecimal(maxPrice) : null);
        r.setActive(true);
        return r;
    }

    // ================================================================
    // clampPrice
    // ================================================================

    @Nested
    @DisplayName("clampPrice")
    class ClampPrice {

        @Test
        @DisplayName("within bounds returns original price")
        void clampPrice_withinBounds_returnsOriginal() {
            var r = rule("50.00", "200.00");

            assertThat(r.clampPrice(new BigDecimal("120.00"))).isEqualByComparingTo("120.00");
        }

        @Test
        @DisplayName("below min returns min price")
        void clampPrice_belowMin_returnsMin() {
            var r = rule("50.00", "200.00");

            assertThat(r.clampPrice(new BigDecimal("30.00"))).isEqualByComparingTo("50.00");
        }

        @Test
        @DisplayName("above max returns max price")
        void clampPrice_aboveMax_returnsMax() {
            var r = rule("50.00", "200.00");

            assertThat(r.clampPrice(new BigDecimal("250.00"))).isEqualByComparingTo("200.00");
        }

        @Test
        @DisplayName("null bounds returns original price")
        void clampPrice_nullBounds_returnsOriginal() {
            var r = rule(null, null);

            assertThat(r.clampPrice(new BigDecimal("999.00"))).isEqualByComparingTo("999.00");
        }

        @Test
        @DisplayName("null min with max returns clamped if above max")
        void clampPrice_nullMin_clampsMax() {
            var r = rule(null, "200.00");

            assertThat(r.clampPrice(new BigDecimal("300.00"))).isEqualByComparingTo("200.00");
        }

        @Test
        @DisplayName("null max with min returns clamped if below min")
        void clampPrice_nullMax_clampsMin() {
            var r = rule("50.00", null);

            assertThat(r.clampPrice(new BigDecimal("10.00"))).isEqualByComparingTo("50.00");
        }

        @Test
        @DisplayName("null price returns null")
        void clampPrice_nullPrice_returnsNull() {
            var r = rule("50.00", "200.00");

            assertThat(r.clampPrice(null)).isNull();
        }

        @Test
        @DisplayName("exactly at min returns min")
        void clampPrice_exactlyAtMin_returnsMin() {
            var r = rule("50.00", "200.00");

            assertThat(r.clampPrice(new BigDecimal("50.00"))).isEqualByComparingTo("50.00");
        }

        @Test
        @DisplayName("exactly at max returns max")
        void clampPrice_exactlyAtMax_returnsMax() {
            var r = rule("50.00", "200.00");

            assertThat(r.clampPrice(new BigDecimal("200.00"))).isEqualByComparingTo("200.00");
        }
    }
}
