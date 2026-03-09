package com.clenzy.dto;

import java.math.BigDecimal;

public record SplitRatios(
    BigDecimal ownerShare,
    BigDecimal platformShare,
    BigDecimal conciergeShare
) {
    public static final SplitRatios DEFAULT = new SplitRatios(
        new BigDecimal("0.8000"),
        new BigDecimal("0.0500"),
        new BigDecimal("0.1500")
    );

    /**
     * Validates that shares sum to 1.0
     */
    public boolean isValid() {
        return ownerShare.add(platformShare).add(conciergeShare)
            .compareTo(BigDecimal.ONE) == 0;
    }
}
