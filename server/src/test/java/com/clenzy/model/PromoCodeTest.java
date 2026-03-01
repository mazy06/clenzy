package com.clenzy.model;

import com.clenzy.integration.direct.model.PromoCode;
import com.clenzy.integration.direct.model.PromoCode.DiscountType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class PromoCodeTest {

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private PromoCode promo(DiscountType type, String value) {
        var p = new PromoCode(1L, "SUMMER10", type, new BigDecimal(value));
        p.setActive(true);
        return p;
    }

    // ================================================================
    // isValidAt
    // ================================================================

    @Nested
    @DisplayName("isValidAt")
    class IsValidAt {

        @Test
        @DisplayName("within date range returns true")
        void isValidAt_withinRange_returnsTrue() {
            var p = promo(DiscountType.PERCENTAGE, "10");
            p.setValidFrom(LocalDate.of(2026, 1, 1));
            p.setValidUntil(LocalDate.of(2026, 12, 31));

            assertThat(p.isValidAt(LocalDate.of(2026, 6, 15))).isTrue();
        }

        @Test
        @DisplayName("before start date returns false")
        void isValidAt_beforeStart_returnsFalse() {
            var p = promo(DiscountType.PERCENTAGE, "10");
            p.setValidFrom(LocalDate.of(2026, 3, 1));
            p.setValidUntil(LocalDate.of(2026, 12, 31));

            assertThat(p.isValidAt(LocalDate.of(2026, 2, 28))).isFalse();
        }

        @Test
        @DisplayName("after end date returns false")
        void isValidAt_afterEnd_returnsFalse() {
            var p = promo(DiscountType.PERCENTAGE, "10");
            p.setValidFrom(LocalDate.of(2026, 1, 1));
            p.setValidUntil(LocalDate.of(2026, 6, 30));

            assertThat(p.isValidAt(LocalDate.of(2026, 7, 1))).isFalse();
        }

        @Test
        @DisplayName("inactive returns false")
        void isValidAt_inactive_returnsFalse() {
            var p = promo(DiscountType.PERCENTAGE, "10");
            p.setActive(false);

            assertThat(p.isValidAt(LocalDate.of(2026, 6, 15))).isFalse();
        }

        @Test
        @DisplayName("max uses reached returns false")
        void isValidAt_maxUsesReached_returnsFalse() {
            var p = promo(DiscountType.PERCENTAGE, "10");
            p.setMaxUses(5);
            p.setCurrentUses(5);

            assertThat(p.isValidAt(LocalDate.of(2026, 6, 15))).isFalse();
        }

        @Test
        @DisplayName("max uses zero means unlimited")
        void isValidAt_maxUsesZero_meansUnlimited() {
            var p = promo(DiscountType.PERCENTAGE, "10");
            p.setMaxUses(0);
            p.setCurrentUses(100);

            assertThat(p.isValidAt(LocalDate.of(2026, 6, 15))).isTrue();
        }

        @Test
        @DisplayName("null dates means no date restriction")
        void isValidAt_nullDates_noRestriction() {
            var p = promo(DiscountType.PERCENTAGE, "10");
            // validFrom and validUntil are null by default

            assertThat(p.isValidAt(LocalDate.of(2026, 6, 15))).isTrue();
        }
    }

    // ================================================================
    // appliesTo
    // ================================================================

    @Nested
    @DisplayName("appliesTo")
    class AppliesTo {

        @Test
        @DisplayName("specific property with matching id returns true")
        void appliesTo_specificProperty_matchingId_true() {
            var p = promo(DiscountType.PERCENTAGE, "10");
            p.setPropertyId(42L);

            assertThat(p.appliesTo(42L)).isTrue();
        }

        @Test
        @DisplayName("specific property with non-matching id returns false")
        void appliesTo_specificProperty_nonMatchingId_false() {
            var p = promo(DiscountType.PERCENTAGE, "10");
            p.setPropertyId(42L);

            assertThat(p.appliesTo(99L)).isFalse();
        }

        @Test
        @DisplayName("null propertyId applies to all properties")
        void appliesTo_nullProperty_appliesToAll() {
            var p = promo(DiscountType.PERCENTAGE, "10");
            // propertyId is null by default

            assertThat(p.appliesTo(42L)).isTrue();
            assertThat(p.appliesTo(99L)).isTrue();
        }
    }

    // ================================================================
    // computeDiscount
    // ================================================================

    @Nested
    @DisplayName("computeDiscount")
    class ComputeDiscount {

        @Test
        @DisplayName("percentage calculates correctly")
        void computeDiscount_percentage_calculatesCorrectly() {
            var p = promo(DiscountType.PERCENTAGE, "15");

            // 15% of 200 = 30
            assertThat(p.computeDiscount(new BigDecimal("200.00"))).isEqualByComparingTo("30.00");
        }

        @Test
        @DisplayName("percentage with rounding")
        void computeDiscount_percentage_rounds() {
            var p = promo(DiscountType.PERCENTAGE, "10");

            // 10% of 99.99 = 9.999 -> rounded to 10.00
            assertThat(p.computeDiscount(new BigDecimal("99.99"))).isEqualByComparingTo("10.00");
        }

        @Test
        @DisplayName("fixed amount returns value when less than total")
        void computeDiscount_fixedAmount_returnsValue() {
            var p = promo(DiscountType.FIXED_AMOUNT, "25.00");

            assertThat(p.computeDiscount(new BigDecimal("200.00"))).isEqualByComparingTo("25.00");
        }

        @Test
        @DisplayName("fixed amount capped at total when exceeds total")
        void computeDiscount_fixedAmount_cappedAtTotal() {
            var p = promo(DiscountType.FIXED_AMOUNT, "250.00");

            // Fixed discount of 250 on total of 200 -> capped at 200
            assertThat(p.computeDiscount(new BigDecimal("200.00"))).isEqualByComparingTo("200.00");
        }
    }
}
