package com.clenzy.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class OccupancyPricingTest {

    // ----------------------------------------------------------------
    // Helper
    // ----------------------------------------------------------------

    private OccupancyPricing pricing(int baseOccupancy, int maxOccupancy, String extraGuestFee) {
        var p = new OccupancyPricing();
        p.setBaseOccupancy(baseOccupancy);
        p.setMaxOccupancy(maxOccupancy);
        p.setExtraGuestFee(new BigDecimal(extraGuestFee));
        p.setActive(true);
        return p;
    }

    // ================================================================
    // calculateAdjustment(int guests)
    // ================================================================

    @Nested
    @DisplayName("calculateAdjustment (guests only)")
    class CalculateAdjustmentGuests {

        @Test
        @DisplayName("within base occupancy returns zero")
        void calculateAdjustment_withinBaseOccupancy_returnsZero() {
            var p = pricing(2, 6, "25.00");

            assertThat(p.calculateAdjustment(1)).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("at base occupancy returns zero")
        void calculateAdjustment_atBaseOccupancy_returnsZero() {
            var p = pricing(2, 6, "25.00");

            assertThat(p.calculateAdjustment(2)).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("one extra guest returns one fee")
        void calculateAdjustment_oneExtraGuest_returnsOneFee() {
            var p = pricing(2, 6, "25.00");

            // 3 guests, base = 2 -> 1 extra * 25 = 25
            assertThat(p.calculateAdjustment(3)).isEqualByComparingTo("25.00");
        }

        @Test
        @DisplayName("multiple extra guests returns multiple fees")
        void calculateAdjustment_multipleExtraGuests_returnsMultipleFees() {
            var p = pricing(2, 6, "25.00");

            // 5 guests, base = 2 -> 3 extra * 25 = 75
            assertThat(p.calculateAdjustment(5)).isEqualByComparingTo("75.00");
        }

        @Test
        @DisplayName("above max occupancy caps at max")
        void calculateAdjustment_aboveMaxOccupancy_capsAtMax() {
            var p = pricing(2, 6, "25.00");

            // 10 guests, capped to max 6, base 2 -> 4 extra * 25 = 100
            assertThat(p.calculateAdjustment(10)).isEqualByComparingTo("100.00");
        }

        @Test
        @DisplayName("inactive pricing returns zero")
        void calculateAdjustment_inactive_returnsZero() {
            var p = pricing(2, 6, "25.00");
            p.setActive(false);

            assertThat(p.calculateAdjustment(5)).isEqualByComparingTo("0");
        }
    }

    // ================================================================
    // calculateAdjustment(int adults, int children)
    // ================================================================

    @Nested
    @DisplayName("calculateAdjustment (adults + children)")
    class CalculateAdjustmentAdultsChildren {

        @Test
        @DisplayName("total within base occupancy returns zero")
        void calculateAdjustment_totalWithinBase_returnsZero() {
            var p = pricing(4, 8, "30.00");

            assertThat(p.calculateAdjustment(2, 1)).isEqualByComparingTo("0.00");
        }

        @Test
        @DisplayName("extra adults without children")
        void calculateAdjustment_extraAdultsOnly() {
            var p = pricing(2, 6, "30.00");

            // 4 adults, 0 children -> 2 extra adults * 30 = 60
            assertThat(p.calculateAdjustment(4, 0)).isEqualByComparingTo("60.00");
        }

        @Test
        @DisplayName("extra children with child discount")
        void calculateAdjustment_extraChildrenWithDiscount() {
            var p = pricing(2, 6, "30.00");
            p.setChildDiscount(new BigDecimal("50")); // 50% discount for children

            // 2 adults + 2 children = 4 total, base = 2 -> 2 extra
            // extra adults = max(0, 2-2) = 0
            // extra children = 2 - 0 = 2
            // child fee = 30 * (1 - 0.50) * 2 = 30.00
            assertThat(p.calculateAdjustment(2, 2)).isEqualByComparingTo("30.00");
        }

        @Test
        @DisplayName("extra children without child discount pays full rate")
        void calculateAdjustment_extraChildrenWithoutDiscount() {
            var p = pricing(2, 6, "30.00");
            // no child discount set

            // 2 adults + 2 children = 4 total, base = 2 -> 2 extra
            // extra adults = 0, extra children = 2
            // child fee = 30 * 2 = 60
            assertThat(p.calculateAdjustment(2, 2)).isEqualByComparingTo("60.00");
        }

        @Test
        @DisplayName("inactive pricing returns zero")
        void calculateAdjustment_inactive_returnsZero() {
            var p = pricing(2, 6, "30.00");
            p.setActive(false);

            assertThat(p.calculateAdjustment(4, 2)).isEqualByComparingTo("0.00");
        }

        @Test
        @DisplayName("capped at max occupancy")
        void calculateAdjustment_cappedAtMax() {
            var p = pricing(2, 4, "30.00");

            // 5 adults + 0 children = 5 total, capped to max 4
            // extra = min(5,4) - 2 = 2 extra * 30 = 60
            assertThat(p.calculateAdjustment(5, 0)).isEqualByComparingTo("60.00");
        }
    }
}
