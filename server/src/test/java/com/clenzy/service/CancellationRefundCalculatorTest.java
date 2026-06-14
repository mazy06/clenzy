package com.clenzy.service;

import com.clenzy.model.CancellationPolicyType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Moteur de remboursement d'annulation (CLZ Domaine 2) : presets Airbnb-like + regles CUSTOM,
 * delai mesure dans la timezone de la propriete, montants BigDecimal.
 */
class CancellationRefundCalculatorTest {

    private final CancellationRefundCalculator calc = new CancellationRefundCalculator();

    private static final ZoneId PARIS = ZoneId.of("Europe/Paris");
    private static final LocalDate CHECK_IN = LocalDate.of(2026, 6, 20);

    private Instant cancelDaysBefore(long days) {
        return CHECK_IN.atTime(15, 0).atZone(PARIS).minusDays(days).toInstant();
    }

    private CancellationRefundCalculator.Result compute(CancellationPolicyType type, long daysBefore,
                                                        List<Map<String, Object>> rules) {
        return calc.compute(new CancellationRefundCalculator.Input(
                new BigDecimal("100.00"), CHECK_IN, "15:00", "Europe/Paris",
                cancelDaysBefore(daysBefore), type, rules));
    }

    @Test
    void flexible_fullRefundWhenAtLeastOneDayBefore() {
        var r = compute(CancellationPolicyType.FLEXIBLE, 1, null);
        assertThat(r.refundPercentage()).isEqualTo(100);
        assertThat(r.refundAmount()).isEqualByComparingTo("100.00");
        assertThat(r.nonRefundableAmount()).isEqualByComparingTo("0.00");
    }

    @Test
    void flexible_noRefundSameDay() {
        var r = compute(CancellationPolicyType.FLEXIBLE, 0, null);
        assertThat(r.refundPercentage()).isZero();
        assertThat(r.refundAmount()).isEqualByComparingTo("0.00");
    }

    @Test
    void moderate_fullAtFiveDays_halfBelow() {
        assertThat(compute(CancellationPolicyType.MODERATE, 5, null).refundPercentage()).isEqualTo(100);
        var r = compute(CancellationPolicyType.MODERATE, 4, null);
        assertThat(r.refundPercentage()).isEqualTo(50);
        assertThat(r.refundAmount()).isEqualByComparingTo("50.00");
    }

    @Test
    void firm_tiers() {
        assertThat(compute(CancellationPolicyType.FIRM, 30, null).refundPercentage()).isEqualTo(100);
        assertThat(compute(CancellationPolicyType.FIRM, 10, null).refundPercentage()).isEqualTo(50);
        assertThat(compute(CancellationPolicyType.FIRM, 3, null).refundPercentage()).isZero();
    }

    @Test
    void strict_halfAboveSevenDays_noneBelow() {
        assertThat(compute(CancellationPolicyType.STRICT, 7, null).refundPercentage()).isEqualTo(50);
        assertThat(compute(CancellationPolicyType.STRICT, 6, null).refundPercentage()).isZero();
    }

    @Test
    void superStrict_halfAboveThirtyDays() {
        assertThat(compute(CancellationPolicyType.SUPER_STRICT, 30, null).refundPercentage()).isEqualTo(50);
        assertThat(compute(CancellationPolicyType.SUPER_STRICT, 29, null).refundPercentage()).isZero();
    }

    @Test
    void nonRefundable_neverRefunds() {
        assertThat(compute(CancellationPolicyType.NON_REFUNDABLE, 60, null).refundPercentage()).isZero();
    }

    @Test
    void custom_appliesHighestSatisfiedTier() {
        List<Map<String, Object>> rules = List.of(
                Map.<String, Object>of("daysBeforeCheckIn", 30, "refundPercentage", 100),
                Map.<String, Object>of("daysBeforeCheckIn", 7, "refundPercentage", 50),
                Map.<String, Object>of("daysBeforeCheckIn", 0, "refundPercentage", 10));
        assertThat(compute(CancellationPolicyType.CUSTOM, 40, rules).refundPercentage()).isEqualTo(100);
        assertThat(compute(CancellationPolicyType.CUSTOM, 10, rules).refundPercentage()).isEqualTo(50);
        assertThat(compute(CancellationPolicyType.CUSTOM, 2, rules).refundPercentage()).isEqualTo(10);
    }

    @Test
    void custom_stringValuesParsed() {
        List<Map<String, Object>> rules = List.of(
                Map.<String, Object>of("days_before", "14", "refund_percentage", "80"));
        assertThat(compute(CancellationPolicyType.CUSTOM, 20, rules).refundPercentage()).isEqualTo(80);
        assertThat(compute(CancellationPolicyType.CUSTOM, 5, rules).refundPercentage()).isZero();
    }

    @Test
    void custom_emptyRulesNoRefund() {
        assertThat(compute(CancellationPolicyType.CUSTOM, 100, List.of()).refundPercentage()).isZero();
    }

    @Test
    void refundPlusNonRefundableEqualsTotal() {
        var r = compute(CancellationPolicyType.MODERATE, 4, null); // 50%
        assertThat(r.refundAmount().add(r.nonRefundableAmount())).isEqualByComparingTo("100.00");
    }

    @Test
    void nullTotalPrice_yieldsZeroRefund() {
        var r = calc.compute(new CancellationRefundCalculator.Input(
                null, CHECK_IN, "15:00", "Europe/Paris", cancelDaysBefore(10),
                CancellationPolicyType.FLEXIBLE, null));
        assertThat(r.refundAmount()).isEqualByComparingTo("0.00");
    }

    @Test
    void usesPropertyTimezone_notJvmZone() {
        // 14/06 23:00 UTC == 15/06 01:00 a Paris (UTC+2 en ete). Preavis mesure en zone propriete.
        Instant cancel = ZonedDateTime.of(2026, 6, 14, 23, 0, 0, 0, ZoneId.of("UTC")).toInstant();
        var r = calc.compute(new CancellationRefundCalculator.Input(
                new BigDecimal("100.00"), CHECK_IN, "15:00", "Europe/Paris", cancel,
                CancellationPolicyType.FLEXIBLE, null));
        // 15/06 01:00 -> 20/06 15:00 = 5 jours pleins
        assertThat(r.daysBeforeCheckIn()).isEqualTo(5);
    }
}
