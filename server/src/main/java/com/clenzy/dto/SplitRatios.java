package com.clenzy.dto;

import java.math.BigDecimal;

public record SplitRatios(
    BigDecimal ownerShare,
    BigDecimal platformShare,
    BigDecimal conciergeShare
) {
    /** Default 3-way split: owner 80%, platform 5%, concierge 15% */
    public static final SplitRatios DEFAULT = new SplitRatios(
        new BigDecimal("0.8000"),
        new BigDecimal("0.0500"),
        new BigDecimal("0.1500")
    );

    /** Default 2-way split (no concierge): owner 95%, platform 5% */
    public static final SplitRatios DEFAULT_NO_CONCIERGE = new SplitRatios(
        new BigDecimal("0.9500"),
        new BigDecimal("0.0500"),
        BigDecimal.ZERO
    );

    public boolean hasConcierge() {
        return conciergeShare != null && conciergeShare.compareTo(BigDecimal.ZERO) > 0;
    }

    /**
     * Validates that shares sum to 1.0
     */
    public boolean isValid() {
        return ownerShare.add(platformShare).add(conciergeShare)
            .compareTo(BigDecimal.ONE) == 0;
    }
}
