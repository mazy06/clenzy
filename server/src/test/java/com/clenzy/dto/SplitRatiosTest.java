package com.clenzy.dto;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class SplitRatiosTest {

    // --- Canonical record accessors ---

    @Test
    void canonicalConstructor_exposesAllThreeShares() {
        SplitRatios ratios = new SplitRatios(
            new BigDecimal("0.6000"),
            new BigDecimal("0.1000"),
            new BigDecimal("0.3000")
        );

        assertEquals(new BigDecimal("0.6000"), ratios.ownerShare());
        assertEquals(new BigDecimal("0.1000"), ratios.platformShare());
        assertEquals(new BigDecimal("0.3000"), ratios.conciergeShare());
    }

    // --- DEFAULT constant (owner 80% / platform 5% / concierge 15%) ---

    @Test
    void DEFAULT_isThreeWaySplit() {
        SplitRatios d = SplitRatios.DEFAULT;
        assertEquals(new BigDecimal("0.8000"), d.ownerShare());
        assertEquals(new BigDecimal("0.0500"), d.platformShare());
        assertEquals(new BigDecimal("0.1500"), d.conciergeShare());
    }

    @Test
    void DEFAULT_sumsToOne() {
        assertTrue(SplitRatios.DEFAULT.isValid());
    }

    @Test
    void DEFAULT_hasConcierge() {
        assertTrue(SplitRatios.DEFAULT.hasConcierge());
    }

    // --- DEFAULT_NO_CONCIERGE constant (owner 95% / platform 5%) ---

    @Test
    void DEFAULT_NO_CONCIERGE_isTwoWaySplit() {
        SplitRatios d = SplitRatios.DEFAULT_NO_CONCIERGE;
        assertEquals(new BigDecimal("0.9500"), d.ownerShare());
        assertEquals(new BigDecimal("0.0500"), d.platformShare());
        assertEquals(BigDecimal.ZERO, d.conciergeShare());
    }

    @Test
    void DEFAULT_NO_CONCIERGE_sumsToOne() {
        assertTrue(SplitRatios.DEFAULT_NO_CONCIERGE.isValid());
    }

    @Test
    void DEFAULT_NO_CONCIERGE_doesNotHaveConcierge() {
        assertFalse(SplitRatios.DEFAULT_NO_CONCIERGE.hasConcierge());
    }

    // --- hasConcierge() algebra ---

    @Test
    void hasConcierge_positiveShare_true() {
        SplitRatios r = new SplitRatios(
            new BigDecimal("0.5"),
            new BigDecimal("0.4"),
            new BigDecimal("0.1")
        );
        assertTrue(r.hasConcierge());
    }

    @Test
    void hasConcierge_zeroShare_false() {
        SplitRatios r = new SplitRatios(
            new BigDecimal("0.5"),
            new BigDecimal("0.5"),
            BigDecimal.ZERO
        );
        assertFalse(r.hasConcierge());
    }

    @Test
    void hasConcierge_nullShare_false() {
        SplitRatios r = new SplitRatios(
            new BigDecimal("0.5"),
            new BigDecimal("0.5"),
            null
        );
        assertFalse(r.hasConcierge());
    }

    @Test
    void hasConcierge_negativeShare_false() {
        // compareTo(ZERO) <= 0 returns false for hasConcierge
        SplitRatios r = new SplitRatios(
            new BigDecimal("0.5"),
            new BigDecimal("0.6"),
            new BigDecimal("-0.1")
        );
        assertFalse(r.hasConcierge());
    }

    // --- isValid() algebra ---

    @Test
    void isValid_sumsToOne_true() {
        SplitRatios r = new SplitRatios(
            new BigDecimal("0.50"),
            new BigDecimal("0.25"),
            new BigDecimal("0.25")
        );
        assertTrue(r.isValid());
    }

    @Test
    void isValid_sumLessThanOne_false() {
        SplitRatios r = new SplitRatios(
            new BigDecimal("0.30"),
            new BigDecimal("0.30"),
            new BigDecimal("0.30")
        );
        assertFalse(r.isValid());
    }

    @Test
    void isValid_sumGreaterThanOne_false() {
        SplitRatios r = new SplitRatios(
            new BigDecimal("0.60"),
            new BigDecimal("0.30"),
            new BigDecimal("0.20")
        );
        assertFalse(r.isValid());
    }

    @Test
    void isValid_fullOwner_true() {
        SplitRatios r = new SplitRatios(
            BigDecimal.ONE,
            BigDecimal.ZERO,
            BigDecimal.ZERO
        );
        assertTrue(r.isValid());
    }

    // --- Record equality ---

    @Test
    void records_equalityByValue() {
        SplitRatios a = new SplitRatios(
            new BigDecimal("0.7"),
            new BigDecimal("0.2"),
            new BigDecimal("0.1")
        );
        SplitRatios b = new SplitRatios(
            new BigDecimal("0.7"),
            new BigDecimal("0.2"),
            new BigDecimal("0.1")
        );
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void records_inequalityByValue() {
        SplitRatios a = new SplitRatios(
            new BigDecimal("0.7"),
            new BigDecimal("0.2"),
            new BigDecimal("0.1")
        );
        SplitRatios b = new SplitRatios(
            new BigDecimal("0.8"),
            new BigDecimal("0.1"),
            new BigDecimal("0.1")
        );
        assertNotEquals(a, b);
    }
}
