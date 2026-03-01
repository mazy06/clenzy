package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum PromotionStatus {
    ACTIVE("active"),
    PENDING("pending"),
    EXPIRED("expired"),
    REJECTED("rejected");

    private final String value;

    PromotionStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
