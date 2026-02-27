package com.clenzy.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum SentimentLabel {
    POSITIVE("POSITIVE"),
    NEUTRAL("NEUTRAL"),
    NEGATIVE("NEGATIVE");

    private final String value;

    SentimentLabel(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }
}
