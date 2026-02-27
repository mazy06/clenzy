package com.clenzy.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class ChannelRateModifierTest {

    // ----------------------------------------------------------------
    // Helper
    // ----------------------------------------------------------------

    private ChannelRateModifier modifier(ChannelRateModifier.ModifierType type, String value) {
        var m = new ChannelRateModifier();
        m.setModifierType(type);
        m.setModifierValue(new BigDecimal(value));
        m.setActive(true);
        return m;
    }

    // ================================================================
    // applyTo
    // ================================================================

    @Nested
    @DisplayName("applyTo")
    class ApplyTo {

        @Test
        @DisplayName("percentage positive increases price")
        void applyTo_percentage_positive_increasesPrice() {
            var m = modifier(ChannelRateModifier.ModifierType.PERCENTAGE, "10");
            BigDecimal result = m.applyTo(new BigDecimal("100.00"));

            // 100 + 10% = 110
            assertThat(result).isEqualByComparingTo("110.00");
        }

        @Test
        @DisplayName("percentage negative decreases price")
        void applyTo_percentage_negative_decreasesPrice() {
            var m = modifier(ChannelRateModifier.ModifierType.PERCENTAGE, "-10");
            BigDecimal result = m.applyTo(new BigDecimal("100.00"));

            // 100 - 10% = 90
            assertThat(result).isEqualByComparingTo("90.00");
        }

        @Test
        @DisplayName("fixed amount positive increases price")
        void applyTo_fixedAmount_positive_increasesPrice() {
            var m = modifier(ChannelRateModifier.ModifierType.FIXED_AMOUNT, "15.00");
            BigDecimal result = m.applyTo(new BigDecimal("100.00"));

            assertThat(result).isEqualByComparingTo("115.00");
        }

        @Test
        @DisplayName("fixed amount negative decreases price")
        void applyTo_fixedAmount_negative_decreasesPrice() {
            var m = modifier(ChannelRateModifier.ModifierType.FIXED_AMOUNT, "-20.00");
            BigDecimal result = m.applyTo(new BigDecimal("100.00"));

            assertThat(result).isEqualByComparingTo("80.00");
        }

        @Test
        @DisplayName("result below zero returns zero (floor)")
        void applyTo_resultBelowZero_returnsZero() {
            var m = modifier(ChannelRateModifier.ModifierType.FIXED_AMOUNT, "-150.00");
            BigDecimal result = m.applyTo(new BigDecimal("100.00"));

            assertThat(result).isEqualByComparingTo("0.00");
        }

        @Test
        @DisplayName("percentage resulting below zero returns zero")
        void applyTo_percentageBelowZero_returnsZero() {
            var m = modifier(ChannelRateModifier.ModifierType.PERCENTAGE, "-200");
            BigDecimal result = m.applyTo(new BigDecimal("50.00"));

            assertThat(result).isEqualByComparingTo("0.00");
        }

        @Test
        @DisplayName("null base price returns null")
        void applyTo_nullBasePrice_returnsNull() {
            var m = modifier(ChannelRateModifier.ModifierType.PERCENTAGE, "10");

            assertThat(m.applyTo(null)).isNull();
        }
    }

    // ================================================================
    // appliesTo
    // ================================================================

    @Nested
    @DisplayName("appliesTo")
    class AppliesTo {

        @Test
        @DisplayName("within date range returns true")
        void appliesTo_withinDateRange_returnsTrue() {
            var m = modifier(ChannelRateModifier.ModifierType.PERCENTAGE, "10");
            m.setStartDate(LocalDate.of(2026, 1, 1));
            m.setEndDate(LocalDate.of(2026, 12, 31));

            assertThat(m.appliesTo(LocalDate.of(2026, 6, 15))).isTrue();
        }

        @Test
        @DisplayName("before start date returns false")
        void appliesTo_beforeStartDate_returnsFalse() {
            var m = modifier(ChannelRateModifier.ModifierType.PERCENTAGE, "10");
            m.setStartDate(LocalDate.of(2026, 3, 1));
            m.setEndDate(LocalDate.of(2026, 12, 31));

            assertThat(m.appliesTo(LocalDate.of(2026, 2, 15))).isFalse();
        }

        @Test
        @DisplayName("after end date returns false")
        void appliesTo_afterEndDate_returnsFalse() {
            var m = modifier(ChannelRateModifier.ModifierType.PERCENTAGE, "10");
            m.setStartDate(LocalDate.of(2026, 1, 1));
            m.setEndDate(LocalDate.of(2026, 6, 30));

            assertThat(m.appliesTo(LocalDate.of(2026, 7, 1))).isFalse();
        }

        @Test
        @DisplayName("null dates (no restriction) returns true")
        void appliesTo_nullDates_returnsTrue() {
            var m = modifier(ChannelRateModifier.ModifierType.PERCENTAGE, "10");
            // startDate and endDate are null by default

            assertThat(m.appliesTo(LocalDate.of(2026, 6, 15))).isTrue();
        }

        @Test
        @DisplayName("inactive modifier returns false")
        void appliesTo_inactive_returnsFalse() {
            var m = modifier(ChannelRateModifier.ModifierType.PERCENTAGE, "10");
            m.setActive(false);

            assertThat(m.appliesTo(LocalDate.of(2026, 6, 15))).isFalse();
        }

        @Test
        @DisplayName("exactly on start date returns true")
        void appliesTo_onStartDate_returnsTrue() {
            var m = modifier(ChannelRateModifier.ModifierType.PERCENTAGE, "10");
            m.setStartDate(LocalDate.of(2026, 3, 1));

            assertThat(m.appliesTo(LocalDate.of(2026, 3, 1))).isTrue();
        }

        @Test
        @DisplayName("exactly on end date returns true")
        void appliesTo_onEndDate_returnsTrue() {
            var m = modifier(ChannelRateModifier.ModifierType.PERCENTAGE, "10");
            m.setEndDate(LocalDate.of(2026, 6, 30));

            assertThat(m.appliesTo(LocalDate.of(2026, 6, 30))).isTrue();
        }
    }
}
