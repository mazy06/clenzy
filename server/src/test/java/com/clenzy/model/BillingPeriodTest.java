package com.clenzy.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class BillingPeriodTest {

    // --- fromString ---

    @Test
    void fromString_null_returnsMonthly() {
        assertEquals(BillingPeriod.MONTHLY, BillingPeriod.fromString(null));
    }

    @Test
    void fromString_blank_returnsMonthly() {
        assertEquals(BillingPeriod.MONTHLY, BillingPeriod.fromString(""));
    }

    @Test
    void fromString_monthly_returnsMonthly() {
        assertEquals(BillingPeriod.MONTHLY, BillingPeriod.fromString("MONTHLY"));
    }

    @Test
    void fromString_annualLowercase_returnsAnnual() {
        assertEquals(BillingPeriod.ANNUAL, BillingPeriod.fromString("annual"));
    }

    @Test
    void fromString_invalid_returnsMonthly() {
        assertEquals(BillingPeriod.MONTHLY, BillingPeriod.fromString("invalid"));
    }

    // --- computeMonthlyPriceCents ---

    @Test
    void computeMonthlyPriceCents_monthly_noDiscount() {
        assertEquals(500, BillingPeriod.MONTHLY.computeMonthlyPriceCents(500));
    }

    @Test
    void computeMonthlyPriceCents_annual_twentyPercentOff() {
        assertEquals(400, BillingPeriod.ANNUAL.computeMonthlyPriceCents(500));
    }

    @Test
    void computeMonthlyPriceCents_biennial_thirtyFivePercentOff() {
        assertEquals(325, BillingPeriod.BIENNIAL.computeMonthlyPriceCents(500));
    }

    // --- computeTotalPriceCents ---

    @Test
    void computeTotalPriceCents_monthly_oneMonth() {
        assertEquals(500, BillingPeriod.MONTHLY.computeTotalPriceCents(500));
    }

    @Test
    void computeTotalPriceCents_annual_twelveMonths() {
        assertEquals(4800, BillingPeriod.ANNUAL.computeTotalPriceCents(500));
    }

    @Test
    void computeTotalPriceCents_biennial_twentyFourMonths() {
        assertEquals(7800, BillingPeriod.BIENNIAL.computeTotalPriceCents(500));
    }

    // --- getMonths and getDiscount ---

    @Test
    void getMonths_monthly() {
        assertEquals(1, BillingPeriod.MONTHLY.getMonths());
    }

    @Test
    void getMonths_annual() {
        assertEquals(12, BillingPeriod.ANNUAL.getMonths());
    }

    @Test
    void getMonths_biennial() {
        assertEquals(24, BillingPeriod.BIENNIAL.getMonths());
    }

    @Test
    void getDiscount_monthly() {
        assertEquals(1.0, BillingPeriod.MONTHLY.getDiscount(), 0.001);
    }

    @Test
    void getDiscount_annual() {
        assertEquals(0.80, BillingPeriod.ANNUAL.getDiscount(), 0.001);
    }

    @Test
    void getDiscount_biennial() {
        assertEquals(0.65, BillingPeriod.BIENNIAL.getDiscount(), 0.001);
    }
}
