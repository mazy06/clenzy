package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum MessageStatus {
    PENDING("PENDING"),
    SENT("SENT"),
    DELIVERED("DELIVERED"),
    FAILED("FAILED"),
    BOUNCED("BOUNCED");

    private final String value;

    MessageStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
