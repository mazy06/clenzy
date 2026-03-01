package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum PricingProvider {
    PRICELABS("pricelabs"),
    BEYOND_PRICING("beyond_pricing"),
    WHEELHOUSE("wheelhouse");

    private final String value;

    PricingProvider(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
