package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum MessageDirection {
    INBOUND("INBOUND"),
    OUTBOUND("OUTBOUND");

    private final String value;

    MessageDirection(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
