package com.clenzy.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class LengthOfStayDiscountTest {

    // ----------------------------------------------------------------
    // Helper
    // ----------------------------------------------------------------

    private LengthOfStayDiscount discount(int minNights, Integer maxNights) {
        var d = new LengthOfStayDiscount();
        d.setMinNights(minNights);
        d.setMaxNights(maxNights);
        d.setActive(true);
        d.setDiscountType(LengthOfStayDiscount.DiscountType.PERCENTAGE);
        d.setDiscountValue(new BigDecimal("10"));
        return d;
    }

    // ================================================================
    // appliesTo
    // ================================================================

    @Nested
    @DisplayName("appliesTo")
    class AppliesTo {

        @Test
        @DisplayName("within range returns true")
        void appliesTo_withinRange_returnsTrue() {
            var d = discount(3, 14);

            assertThat(d.appliesTo(7)).isTrue();
        }

        @Test
        @DisplayName("exactly at min nights returns true")
        void appliesTo_atMinNights_returnsTrue() {
            var d = discount(3, 14);

            assertThat(d.appliesTo(3)).isTrue();
        }

        @Test
        @DisplayName("exactly at max nights returns true")
        void appliesTo_atMaxNights_returnsTrue() {
            var d = discount(3, 14);

            assertThat(d.appliesTo(14)).isTrue();
        }

        @Test
        @DisplayName("below min nights returns false")
        void appliesTo_belowMinNights_returnsFalse() {
            var d = discount(7, 28);

            assertThat(d.appliesTo(5)).isFalse();
        }

        @Test
        @DisplayName("above max nights returns false")
        void appliesTo_aboveMaxNights_returnsFalse() {
            var d = discount(3, 14);

            assertThat(d.appliesTo(15)).isFalse();
        }

        @Test
        @DisplayName("no max nights accepts any value above min")
        void appliesTo_noMaxNights_acceptsAnyAboveMin() {
            var d = discount(7, null);

            assertThat(d.appliesTo(365)).isTrue();
        }

        @Test
        @DisplayName("inactive discount returns false")
        void appliesTo_inactive_returnsFalse() {
            var d = discount(3, 14);
            d.setActive(false);

            assertThat(d.appliesTo(7)).isFalse();
        }
    }

    // ================================================================
    // isValidForDate
    // ================================================================

    @Nested
    @DisplayName("isValidForDate")
    class IsValidForDate {

        @Test
        @DisplayName("within date range returns true")
        void isValidForDate_withinRange_true() {
            var d = discount(3, 14);
            d.setStartDate(LocalDate.of(2026, 1, 1));
            d.setEndDate(LocalDate.of(2026, 12, 31));

            assertThat(d.isValidForDate(LocalDate.of(2026, 6, 15))).isTrue();
        }

        @Test
        @DisplayName("before start date returns false")
        void isValidForDate_beforeStartDate_false() {
            var d = discount(3, 14);
            d.setStartDate(LocalDate.of(2026, 3, 1));
            d.setEndDate(LocalDate.of(2026, 12, 31));

            assertThat(d.isValidForDate(LocalDate.of(2026, 2, 28))).isFalse();
        }

        @Test
        @DisplayName("after end date returns false")
        void isValidForDate_afterEndDate_false() {
            var d = discount(3, 14);
            d.setStartDate(LocalDate.of(2026, 1, 1));
            d.setEndDate(LocalDate.of(2026, 6, 30));

            assertThat(d.isValidForDate(LocalDate.of(2026, 7, 1))).isFalse();
        }

        @Test
        @DisplayName("null dates (no restriction) returns true")
        void isValidForDate_nullDates_true() {
            var d = discount(3, 14);
            // startDate and endDate are null by default

            assertThat(d.isValidForDate(LocalDate.of(2026, 6, 15))).isTrue();
        }

        @Test
        @DisplayName("exactly on start date returns true")
        void isValidForDate_onStartDate_true() {
            var d = discount(3, 14);
            d.setStartDate(LocalDate.of(2026, 3, 1));

            assertThat(d.isValidForDate(LocalDate.of(2026, 3, 1))).isTrue();
        }

        @Test
        @DisplayName("exactly on end date returns true")
        void isValidForDate_onEndDate_true() {
            var d = discount(3, 14);
            d.setEndDate(LocalDate.of(2026, 6, 30));

            assertThat(d.isValidForDate(LocalDate.of(2026, 6, 30))).isTrue();
        }
    }
}
